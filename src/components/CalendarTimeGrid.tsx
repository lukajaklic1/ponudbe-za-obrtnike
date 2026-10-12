import { useEffect, useRef, useState } from 'react'
import { JOB_STATUS_COLOR, jobTitle, jobSite, type JobRow } from '../lib/jobs'

// Outlook / Attio-style week & day view: hours down the side, one column per day,
// jobs with working hours as blocks, jobs without hours in an "all day" row.
// Blocks (and unscheduled jobs from the side panel) can be dragged onto a slot.

interface Props {
  days: Date[]
  jobs: JobRow[]                     // scheduled jobs (have a start or end date)
  dayLabels: string[]                // Mon..Sun short names
  allDayLabel: string
  canEdit: boolean
  dragJob: JobRow | null             // job being dragged (from here or the side panel)
  onDragJob: (j: JobRow | null) => void
  onOpen: (j: JobRow) => void
  onCreate: (date: string, time: string) => void
  onPlace: (j: JobRow, date: string, time: string | null) => void   // time null = all day
  onDayClick?: (d: Date) => void
  workerNames: (j: JobRow) => string | null
}

const HOUR_H = 52                    // px per hour
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
const jobStart = (j: JobRow) => (j.start_date ?? j.end_date)!
const jobEnd = (j: JobRow) => (j.end_date ?? j.start_date)!
export const jobDuration = (j: JobRow) => j.start_time && j.end_time ? Math.max(30, toMin(j.end_time) - toMin(j.start_time)) : 120

interface Block { job: JobRow; top: number; height: number; col: number; cols: number; from: number; to: number }

export default function CalendarTimeGrid({ days, jobs, dayLabels, allDayLabel, canEdit, dragJob, onDragJob, onOpen, onCreate, onPlace, onDayClick, workerNames }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())
  const [hover, setHover] = useState<{ day: number; min: number } | null>(null)   // drop preview
  const [overAllDay, setOverAllDay] = useState(false)
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t) }, [])
  useEffect(() => { if (!dragJob) { setHover(null); setOverAllDay(false) } }, [dragJob])

  const first = iso(days[0]), last = iso(days[days.length - 1])
  const inRange = jobs.filter(j => jobStart(j) <= last && jobEnd(j) >= first)
  const timed = inRange.filter(j => j.start_time)
  const allDay = inRange.filter(j => !j.start_time)

  // Visible hours: 06–20, widened if a job starts earlier / ends later
  const startH = Math.min(6, ...timed.map(j => Math.floor(toMin(j.start_time!) / 60)))
  const endH = Math.min(24, Math.max(20, ...timed.map(j => Math.ceil((toMin(j.start_time!) + jobDuration(j)) / 60))))
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i)

  useEffect(() => { if (scroller.current) scroller.current.scrollTop = Math.max(0, (7 - startH) * HOUR_H - 8) }, [startH, days.length])

  // Blocks for one day, overlapping ones placed side by side
  function blocksFor(d: Date): Block[] {
    const day = iso(d)
    const list: Block[] = timed
      .filter(j => jobStart(j) <= day && jobEnd(j) >= day)
      .map(job => {
        const from = toMin(job.start_time!)
        const to = from + jobDuration(job)
        return { job, from, to, top: (from - startH * 60) / 60 * HOUR_H, height: (to - from) / 60 * HOUR_H, col: 0, cols: 1 }
      })
      .sort((a, b) => a.from - b.from || b.to - a.to)
    let cluster: Block[] = [], clusterEnd = -1
    const flush = () => { const n = Math.max(...cluster.map(b => b.col)) + 1; cluster.forEach(b => (b.cols = n)); cluster = [] }
    for (const b of list) {
      if (cluster.length && b.from >= clusterEnd) flush()
      const used = new Set(cluster.filter(c => c.to > b.from).map(c => c.col))
      let col = 0; while (used.has(col)) col++
      b.col = col; cluster.push(b); clusterEnd = Math.max(clusterEnd, b.to)
    }
    if (cluster.length) flush()
    return list
  }

  // All-day bars across the visible days, stacked in lanes
  const lanesEnd: number[] = []
  const allDaySegs = allDay
    .map(job => ({
      job,
      from: jobStart(job) < first ? 0 : days.findIndex(d => iso(d) === jobStart(job)),
      to: jobEnd(job) > last ? days.length - 1 : days.findIndex(d => iso(d) === jobEnd(job)),
      lane: 0, startsHere: jobStart(job) >= first, endsHere: jobEnd(job) <= last,
    }))
    .sort((a, b) => a.from - b.from || (b.to - b.from) - (a.to - a.from))
  for (const s of allDaySegs) {
    let lane = lanesEnd.findIndex(e => e < s.from)
    if (lane === -1) { lane = lanesEnd.length; lanesEnd.push(s.to) } else lanesEnd[lane] = s.to
    s.lane = lane
  }

  // y inside a day column → minutes, snapped to 15
  const slotAt = (e: React.MouseEvent | React.DragEvent, el: HTMLElement) => {
    const y = e.clientY - el.getBoundingClientRect().top
    return Math.max(startH * 60, Math.min(23 * 60 + 45, Math.floor((startH * 60 + (y / HOUR_H) * 60) / 15) * 15))
  }

  function clickSlot(e: React.MouseEvent<HTMLDivElement>, d: Date) {
    if (!canEdit || e.target !== e.currentTarget) return
    onCreate(iso(d), fmt(slotAt(e, e.currentTarget)))
  }

  const today = iso(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const cols = `60px repeat(${days.length}, minmax(0, 1fr))`

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
      {/* Day headers */}
      <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: cols }}>
        <div />
        {days.map((d, i) => {
          const isToday = iso(d) === today
          const wd = (d.getDay() + 6) % 7
          return (
            <button key={i} type="button" onClick={() => onDayClick?.(d)} disabled={!onDayClick}
              className={`flex items-center gap-2 px-3 h-11 text-left border-l border-gray-100 transition-colors ${onDayClick ? 'hover:bg-gray-50' : ''}`}>
              <span className={`text-[13px] ${isToday ? 'text-blue-600 font-medium' : wd >= 5 ? 'text-gray-400' : 'text-gray-500'}`}>{dayLabels[wd]}</span>
              <span className={`inline-flex items-center justify-center min-w-[26px] h-[26px] px-1 rounded-md text-[13px] font-semibold ${isToday ? 'bg-blue-600 text-white' : 'text-gray-900'}`}>{d.getDate()}</span>
            </button>
          )
        })}
      </div>

      {/* All-day row (drop here = whole day, no hours) */}
      <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: cols }}>
        <div className="px-2 pt-2 text-[11px] text-gray-400 text-right leading-tight">{allDayLabel}</div>
        <div
          onDragOver={e => { if (dragJob && canEdit) { e.preventDefault(); setOverAllDay(true); setHover(null) } }}
          onDragLeave={() => setOverAllDay(false)}
          onDrop={e => {
            e.preventDefault(); setOverAllDay(false)
            if (!dragJob) return
            const r = e.currentTarget.getBoundingClientRect()
            const idx = Math.min(days.length - 1, Math.floor((e.clientX - r.left) / (r.width / days.length)))
            onPlace(dragJob, iso(days[idx]), null); onDragJob(null)
          }}
          className={`relative grid gap-y-1 py-1.5 border-l border-gray-100 transition-colors ${overAllDay ? 'bg-blue-50/70' : ''}`}
          style={{ gridColumn: `2 / ${days.length + 2}`, gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${Math.max(lanesEnd.length, 1)}, 26px)` }}>
          {allDaySegs.map(s => {
            const c = JOB_STATUS_COLOR[s.job.status]
            return (
              <button key={s.job.id} type="button" onClick={() => onOpen(s.job)} title={jobTitle(s.job)}
                draggable={canEdit} onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragJob(s.job) }} onDragEnd={() => onDragJob(null)}
                style={{ gridColumn: `${s.from + 1} / ${s.to + 2}`, gridRow: s.lane + 1, backgroundColor: c.bg, color: c.text, boxShadow: `inset 3px 0 0 ${c.dot}` }}
                className={`mx-1 flex items-center px-2.5 text-xs font-medium text-left truncate hover:brightness-[0.97] transition
                  ${s.startsHere ? 'rounded-l-md' : 'rounded-l-none'} ${s.endsHere ? 'rounded-r-md' : 'rounded-r-none'} ${dragJob?.id === s.job.id ? 'opacity-40' : ''}`}>
                <span className="truncate">{jobTitle(s.job)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Hours */}
      <div ref={scroller} className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)', minHeight: 380 }}>
        <div className="grid relative" style={{ gridTemplateColumns: cols, height: hours.length * HOUR_H }}>
          {/* hour labels, sitting just under each line */}
          <div className="relative">
            {hours.map((h, i) => (
              <div key={h} className="absolute right-2.5 text-[11px] text-gray-400 tabular-nums" style={{ top: i * HOUR_H + 3 }}>{`${String(h).padStart(2, '0')}:00`}</div>
            ))}
          </div>
          {days.map((d, di) => {
            const wd = (d.getDay() + 6) % 7
            const isToday = iso(d) === today
            const preview = hover && hover.day === di && dragJob
            return (
              <div key={di}
                onClick={e => clickSlot(e, d)}
                onDragOver={e => { if (!dragJob || !canEdit) return; e.preventDefault(); const min = slotAt(e, e.currentTarget); setHover(h => h && h.day === di && h.min === min ? h : { day: di, min }) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setHover(h => (h?.day === di ? null : h)) }}
                onDrop={e => { e.preventDefault(); if (!dragJob) return; onPlace(dragJob, iso(d), fmt(slotAt(e, e.currentTarget))); onDragJob(null); setHover(null) }}
                className={`relative border-l border-gray-100 ${isToday ? 'bg-blue-50/25' : wd >= 5 ? 'bg-gray-50/60' : ''} ${canEdit ? 'cursor-pointer' : ''}`}
                style={{ backgroundImage: `linear-gradient(to bottom, #eef0f2 1px, transparent 1px), linear-gradient(to bottom, transparent ${HOUR_H / 2}px, #f6f7f8 ${HOUR_H / 2}px, #f6f7f8 ${HOUR_H / 2 + 1}px, transparent ${HOUR_H / 2 + 1}px)`, backgroundSize: `100% ${HOUR_H}px` }}>
                {blocksFor(d).map(b => {
                  const c = JOB_STATUS_COLOR[b.job.status]
                  const who = workerNames(b.job)
                  const short = b.height < 46
                  return (
                    <button key={b.job.id} type="button" onClick={() => onOpen(b.job)}
                      draggable={canEdit} onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragJob(b.job) }} onDragEnd={() => onDragJob(null)}
                      title={`${fmt(b.from)}–${fmt(b.to)} · ${jobTitle(b.job)}${who ? ` · ${who}` : ''}`}
                      className={`absolute flex flex-col items-stretch justify-start rounded-lg pl-2.5 pr-2 py-1.5 text-left overflow-hidden hover:brightness-[0.97] transition ring-1 ring-white ${dragJob?.id === b.job.id ? 'opacity-40' : ''}`}
                      style={{
                        top: b.top + 1, height: b.height - 2,
                        left: `calc(${(b.col / b.cols) * 100}% + 3px)`, width: `calc(${100 / b.cols}% - 6px)`,
                        backgroundColor: c.bg, color: c.text, boxShadow: `inset 3px 0 0 ${c.dot}`,
                      }}>
                      {short
                        ? <div className="text-xs truncate"><span className="font-semibold">{jobTitle(b.job)}</span><span className="opacity-75 ml-1.5">{fmt(b.from)}</span></div>
                        : <>
                            <div className="text-xs font-semibold leading-snug line-clamp-2">{jobTitle(b.job)}</div>
                            <div className="text-[11px] opacity-75 mt-0.5 tabular-nums">{fmt(b.from)} – {fmt(b.to)}</div>
                            {b.height >= 84 && jobSite(b.job) && <div className="text-[11px] opacity-70 truncate mt-0.5">{jobSite(b.job)}</div>}
                            {b.height >= 104 && who && <div className="text-[11px] opacity-70 truncate">{who}</div>}
                          </>}
                    </button>
                  )
                })}

                {/* where the dragged job would land */}
                {preview && (
                  <div className="absolute left-[3px] right-[3px] rounded-lg border-2 border-dashed border-blue-400 bg-blue-50/80 pointer-events-none px-2 py-1 text-[11px] font-medium text-blue-700 tabular-nums z-20"
                    style={{ top: (hover.min - startH * 60) / 60 * HOUR_H, height: Math.max(22, jobDuration(dragJob) / 60 * HOUR_H) }}>
                    {fmt(hover.min)} – {fmt(Math.min(24 * 60, hover.min + jobDuration(dragJob)))}
                  </div>
                )}

                {isToday && nowMin >= startH * 60 && nowMin <= endH * 60 && (
                  <div className="absolute left-0 right-0 pointer-events-none z-10" style={{ top: (nowMin - startH * 60) / 60 * HOUR_H }}>
                    <div className="relative h-px bg-red-500"><span className="absolute -left-[5px] -top-[4px] w-[9px] h-[9px] rounded-full bg-red-500" /></div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
