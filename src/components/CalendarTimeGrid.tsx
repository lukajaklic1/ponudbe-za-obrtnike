import { useEffect, useRef, useState } from 'react'
import { JOB_STATUS_COLOR, jobTitle, jobSite, type JobRow } from '../lib/jobs'

// Outlook-style week / day view: hours down the side, one column per day,
// jobs with working hours as blocks, jobs without hours in an "all day" row.

interface Props {
  days: Date[]
  jobs: JobRow[]                     // scheduled jobs (have a start or end date)
  dayLabels: string[]                // Mon..Sun short names
  allDayLabel: string
  canCreate: boolean
  onOpen: (j: JobRow) => void
  onCreate: (date: string, time: string) => void
  onDayClick?: (d: Date) => void
}

const HOUR_H = 48                    // px per hour
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
const jobStart = (j: JobRow) => (j.start_date ?? j.end_date)!
const jobEnd = (j: JobRow) => (j.end_date ?? j.start_date)!

interface Block { job: JobRow; top: number; height: number; col: number; cols: number; from: number; to: number }

export default function CalendarTimeGrid({ days, jobs, dayLabels, allDayLabel, canCreate, onOpen, onCreate, onDayClick }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t) }, [])

  const first = iso(days[0]), last = iso(days[days.length - 1])
  const inRange = jobs.filter(j => jobStart(j) <= last && jobEnd(j) >= first)
  const timed = inRange.filter(j => j.start_time)
  const allDay = inRange.filter(j => !j.start_time)

  // Visible hours: 06–20, widened if a job starts earlier / ends later
  const startH = Math.min(6, ...timed.map(j => Math.floor(toMin(j.start_time!) / 60)))
  const endH = Math.max(20, ...timed.map(j => Math.ceil(toMin(j.end_time ?? j.start_time!) / 60) + (j.end_time ? 0 : 1)))
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i)

  useEffect(() => { if (scroller.current) scroller.current.scrollTop = Math.max(0, (7 - startH) * HOUR_H) }, [startH, days.length])

  // Blocks for one day, overlapping ones placed side by side
  function blocksFor(d: Date): Block[] {
    const day = iso(d)
    const list = timed
      .filter(j => jobStart(j) <= day && jobEnd(j) >= day)
      .map(job => {
        const from = toMin(job.start_time!)
        const to = Math.max(from + 30, job.end_time ? toMin(job.end_time) : from + 60)
        return { job, from, to, top: (from - startH * 60) / 60 * HOUR_H, height: (to - from) / 60 * HOUR_H, col: 0, cols: 1 }
      })
      .sort((a, b) => a.from - b.from || b.to - a.to)
    // group into clusters of mutually overlapping blocks, then give each a column
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
      lane: 0,
    }))
    .sort((a, b) => a.from - b.from || (b.to - b.from) - (a.to - a.from))
  for (const s of allDaySegs) {
    let lane = lanesEnd.findIndex(e => e < s.from)
    if (lane === -1) { lane = lanesEnd.length; lanesEnd.push(s.to) } else lanesEnd[lane] = s.to
    s.lane = lane
  }

  function clickSlot(e: React.MouseEvent<HTMLDivElement>, d: Date) {
    if (!canCreate || e.target !== e.currentTarget) return
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    const min = Math.floor((startH * 60 + (y / HOUR_H) * 60) / 15) * 15
    onCreate(iso(d), fmt(Math.min(min, 23 * 60)))
  }

  const today = iso(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const cols = `56px repeat(${days.length}, minmax(0, 1fr))`

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
      {/* Day headers */}
      <div className="grid border-b border-gray-200 bg-gray-50" style={{ gridTemplateColumns: cols }}>
        <div />
        {days.map((d, i) => {
          const isToday = iso(d) === today
          const wd = (d.getDay() + 6) % 7
          return (
            <button key={i} type="button" onClick={() => onDayClick?.(d)} disabled={!onDayClick}
              className={`flex items-center gap-1.5 px-2 py-2 text-left border-l border-gray-100 ${onDayClick ? 'hover:bg-gray-100' : ''}`}>
              <span className={`text-xs font-medium ${wd >= 5 ? 'text-gray-400' : 'text-gray-500'}`}>{dayLabels[wd]}</span>
              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm ${isToday ? 'bg-blue-600 text-white font-semibold' : 'text-gray-900 font-medium'}`}>{d.getDate()}</span>
            </button>
          )
        })}
      </div>

      {/* All-day row */}
      <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: cols }}>
        <div className="px-2 py-1.5 text-[11px] text-gray-400 leading-tight">{allDayLabel}</div>
        <div className="relative grid gap-y-1 py-1.5 border-l border-gray-100"
          style={{ gridColumn: `2 / ${days.length + 2}`, gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${Math.max(lanesEnd.length, 1)}, 24px)` }}>
          {allDaySegs.map(s => {
            const c = JOB_STATUS_COLOR[s.job.status]
            return (
              <button key={s.job.id} type="button" onClick={() => onOpen(s.job)} title={jobTitle(s.job)}
                style={{ gridColumn: `${s.from + 1} / ${s.to + 2}`, gridRow: s.lane + 1, backgroundColor: c.bg, color: c.text }}
                className="mx-1 flex items-center gap-1.5 px-2 rounded-md text-xs font-medium text-left truncate hover:brightness-95">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />
                <span className="truncate">{jobTitle(s.job)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Hours */}
      <div ref={scroller} className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 290px)', minHeight: 360 }}>
        <div className="grid relative" style={{ gridTemplateColumns: cols, height: hours.length * HOUR_H }}>
          {/* hour labels */}
          <div className="relative">
            {hours.map((h, i) => (
              <div key={h} className="absolute right-2 text-[11px] text-gray-400 -translate-y-1/2" style={{ top: i * HOUR_H }}>{i === 0 ? '' : `${String(h).padStart(2, '0')}:00`}</div>
            ))}
          </div>
          {days.map((d, di) => {
            const wd = (d.getDay() + 6) % 7
            const isToday = iso(d) === today
            return (
              <div key={di} onClick={e => clickSlot(e, d)}
                className={`relative border-l border-gray-100 ${wd >= 5 ? 'bg-[#fcfcfc]' : ''} ${canCreate ? 'cursor-pointer' : ''}`}
                style={{ backgroundImage: `repeating-linear-gradient(to bottom, #f0f0f0 0, #f0f0f0 1px, transparent 1px, transparent ${HOUR_H / 2}px, #f7f7f7 ${HOUR_H / 2}px, #f7f7f7 ${HOUR_H / 2 + 1}px, transparent ${HOUR_H / 2 + 1}px, transparent ${HOUR_H}px)` }}>
                {blocksFor(d).map(b => {
                  const c = JOB_STATUS_COLOR[b.job.status]
                  const who = b.job.assignee ? `${b.job.assignee.first_name} ${b.job.assignee.last_name}` : null
                  const short = b.height < 44
                  return (
                    <button key={b.job.id} type="button" onClick={() => onOpen(b.job)}
                      title={`${fmt(b.from)}–${fmt(b.to)} · ${jobTitle(b.job)}${who ? ` · ${who}` : ''}`}
                      className="absolute rounded-md px-2 py-1 text-left overflow-hidden hover:brightness-95 transition shadow-[0_1px_2px_rgba(16,24,40,0.06)]"
                      style={{
                        top: b.top + 1, height: b.height - 2,
                        left: `calc(${(b.col / b.cols) * 100}% + 2px)`, width: `calc(${100 / b.cols}% - 4px)`,
                        backgroundColor: c.bg, color: c.text, borderLeft: `3px solid ${c.dot}`,
                      }}>
                      <div className={`text-xs font-semibold truncate ${short ? 'inline' : ''}`}>{jobTitle(b.job)}</div>
                      <div className={`text-[11px] opacity-80 truncate ${short ? 'inline ml-1.5' : ''}`}>{fmt(b.from)}–{fmt(b.to)}</div>
                      {!short && b.height >= 70 && jobSite(b.job) && <div className="text-[11px] opacity-70 truncate">{jobSite(b.job)}</div>}
                      {!short && b.height >= 90 && who && <div className="text-[11px] opacity-70 truncate">{who}</div>}
                    </button>
                  )
                })}
                {isToday && nowMin >= startH * 60 && nowMin <= endH * 60 && (
                  <div className="absolute left-0 right-0 pointer-events-none z-10" style={{ top: (nowMin - startH * 60) / 60 * HOUR_H }}>
                    <div className="relative h-0.5 bg-red-500"><span className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-red-500" /></div>
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
