// What happened to this quote, newest first: made, edited, moved from status to status,
// opened, attachments. The status lines come from the database trigger, so they are there
// even when the change came from the public configurator.
import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { loadQuoteEvents, type QuoteEvent } from '../lib/quoteEvents'

interface Props {
  quoteId: string
  companyId: string
  lang: 'sl' | 'en'
  /** the label of a status, as the rest of the app writes it */
  statusLabels: Record<string, string>
  /** refreshed when this changes (after a save, say) */
  refreshKey?: number
}

const pad = (n: number) => String(n).padStart(2, '0')
const when = (iso: string) => {
  const d = new Date(iso)
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()} ob ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function QuoteHistory({ quoteId, companyId, lang, statusLabels, refreshKey = 0 }: Props) {
  const sl = lang === 'sl'
  const [events, setEvents] = useState<QuoteEvent[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      loadQuoteEvents(quoteId),
      supabase.from('users').select('id, first_name, last_name').eq('company_id', companyId),
    ]).then(([evs, us]) => {
      if (!alive) return
      // the history records changes; who looked at a quote is not one, and old rows go too
      setEvents(evs.filter(e => e.action !== 'viewed'))
      setNames(Object.fromEntries((((us.data ?? []) as { id: string; first_name: string; last_name: string }[]))
        .map(u => [u.id, `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()])))
      setLoading(false)
    })
    return () => { alive = false }
  }, [quoteId, companyId, refreshKey])

  if (loading || events.length === 0) return null

  const st = (k: string | null) => (k && statusLabels[k]) || k || '—'
  const money = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : null)

  const line = (e: QuoteEvent): { text: string; detail?: string } => {
    const m = (e.meta ?? {}) as Record<string, unknown>
    switch (e.action) {
      case 'created':
        return { text: m.source === 'configurator'
          ? (sl ? 'Povpraševanje prišlo prek konfiguratorja' : 'Enquiry came in through the configurator')
          : (sl ? 'Ponudba ustvarjena' : 'Quote created') }
      case 'status':
        return { text: sl ? `Status: ${st(e.from_status)} → ${st(e.to_status)}` : `Status: ${st(e.from_status)} → ${st(e.to_status)}`,
          detail: money(m.total_net) ?? undefined }
      case 'edited': {
        const before = money(m.total_net_before), after = money(m.total_net)
        return { text: sl ? 'Ponudba spremenjena in shranjena' : 'Quote edited and saved',
          // the amount is worth saying only when the edit moved it
          detail: before && after && before !== after ? `${before} → ${after}` : undefined }
      }
      case 'assignee':
        return { text: sl ? 'Zamenjana odgovorna oseba' : 'Assignee changed',
          detail: typeof m.to === 'string' ? (names[m.to] ?? undefined) : (sl ? 'brez' : 'none') }
      case 'attachment_added':
        return { text: sl ? 'Dodana priloga' : 'Attachment added', detail: String(m.file_name ?? '') }
      case 'attachment_removed':
        return { text: sl ? 'Odstranjena priloga' : 'Attachment removed', detail: String(m.file_name ?? '') }
      default:
        return { text: e.action }
    }
  }

  const who = (e: QuoteEvent) => {
    if (e.actor_id && names[e.actor_id]) return names[e.actor_id]
    const m = (e.meta ?? {}) as Record<string, unknown>
    if (m.source === 'configurator') return sl ? 'Stranka' : 'The customer'
    return sl ? 'Sistem' : 'System'
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-[-0.01em] text-gray-900 mb-4">
        <History className="w-4 h-4 text-[#7f7f7f]" />{sl ? 'Zgodovina ponudbe' : 'Quote history'}
      </h2>
      <ol className="relative">
        {events.map((e, i) => {
          const { text, detail } = line(e)
          const last = i === events.length - 1
          return (
            <li key={e.id} className="relative pl-6 pb-4 last:pb-0">
              {!last && <span className="absolute left-[5px] top-3 bottom-0 w-px bg-gray-200" />}
              <span className="absolute left-0 top-[5px] w-[11px] h-[11px] rounded-full border-2 border-white bg-gray-300" />
              <p className="text-sm font-medium text-gray-900">
                {text}{detail && <span className="font-normal text-[#5e5e5e]"> · {detail}</span>}
              </p>
              <p className="text-xs text-[#7f7f7f] mt-0.5">{who(e)} · {when(e.created_at)}</p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
