import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { House, Plus, ExternalLink, Copy, Inbox, FileText, Send, Ruler, Timer, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { PageHeader } from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { QuoteStatusBadge } from '../components/ui/QuoteStatusBadge'
import { toast } from '../components/ui/Toast'
import type { QuoteStatus } from '../types/database'

interface Row {
  id: string; quote_number: string; status: QuoteStatus; total_net: number | null; created_at: string; updated_at: string
  sent_at: string | null; site_address: string | null
  customers: { name: string } | null
}

const HOUR = 3600000, DAY = 86400000
const ROWS = 5

/** Where a user lands after signing in: the work in front of them as small tables, newest first. */
export default function HomePage() {
  const { company, profile, hasPerm } = useCompany()
  const { t, lang } = useLanguage()
  const navigate = useNavigate()
  const sl = lang !== 'en'
  const [rows, setRows] = useState<Row[] | null>(null)
  const canQuotes = hasPerm('quotes', 'view')

  useEffect(() => {
    if (!company || !canQuotes) { setRows([]); return }
    supabase.from('quotes').select('id, quote_number, status, total_net, created_at, updated_at, sent_at, site_address, customers(name)')
      .eq('company_id', company.id).order('updated_at', { ascending: false }).limit(1000)
      .then(({ data }: { data: unknown }) => setRows((data as Row[] | null) ?? []))
  }, [company?.id, canQuotes])

  const money = (n: number | null) => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: company?.currency ?? 'EUR' })
  const ago = (iso: string) => {
    const ms = Date.now() - Date.parse(iso)
    if (ms < HOUR) return sl ? 'pravkar' : 'just now'
    if (ms < DAY) { const h = Math.floor(ms / HOUR); return sl ? `pred ${h} h` : `${h} h ago` }
    const d = Math.floor(ms / DAY)
    return sl ? `pred ${d} d` : `${d} d ago`
  }
  const dur = (ms: number) => {
    if (ms < DAY) { const h = Math.max(1, Math.round(ms / HOUR)); return `${h} ${sl ? 'h' : 'h'}` }
    return `${(ms / DAY).toLocaleString('de-DE', { maximumFractionDigits: 1 })} ${sl ? 'dni' : 'days'}`
  }

  const list = rows ?? []
  const by = (f: (q: Row) => boolean, key: 'created_at' | 'updated_at' | 'sent_at' = 'updated_at') =>
    list.filter(f).sort((a, b) => Date.parse(b[key] ?? b.updated_at) - Date.parse(a[key] ?? a.updated_at))
  const enquiries = by(q => q.status === 'enquiry', 'created_at')
  const sent = by(q => q.status === 'sent' || q.status === 'downloaded', 'sent_at')
  const drafts = by(q => q.status === 'draft')
  const measuring = by(q => q.status === 'measure')
  // how long a quote takes from the enquiry to the offer being sent (offers the supplier sent himself)
  const times = list.filter(q => q.sent_at).map(q => Date.parse(q.sent_at as string) - Date.parse(q.created_at)).filter(x => x >= 0)
  const avgSend = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null
  const stale = sent.filter(q => Date.now() - Date.parse(q.sent_at ?? q.updated_at) > 7 * DAY).length

  const hour = new Date().getHours()
  const hello = sl ? (hour < 12 ? 'Dobro jutro' : hour < 18 ? 'Dober dan' : 'Dober večer') : (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening')
  const today = new Date().toLocaleDateString(sl ? 'sl-SI' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const publicUrl = company?.configurator_enabled && company.configurator_slug ? `${window.location.origin}/k/${company.configurator_slug}` : null

  const kpis = [
    { icon: Inbox, bg: '#feeee1', color: '#9e3f00', label: sl ? 'Povpraševanja' : 'Enquiries', value: String(enquiries.length), sub: sl ? 'čakajo na ponudbo' : 'waiting for an offer' },
    { icon: Send, bg: '#fef3cd', color: '#8a6100', label: sl ? 'Čakajo na odgovor' : 'Waiting for an answer', value: String(sent.length), sub: stale ? (sl ? `${stale} starejših od 7 dni` : `${stale} older than 7 days`) : (sl ? 'poslane in prenesene' : 'sent and downloaded') },
    { icon: Timer, bg: '#eaf1fe', color: '#215bcf', label: sl ? 'Povprečen čas do ponudbe' : 'Average time to an offer', value: avgSend === null ? '–' : dur(avgSend), sub: sl ? 'od povpraševanja do pošiljanja' : 'from the enquiry to sending' },
    { icon: Ruler, bg: '#dcf5f4', color: '#0c6b6b', label: sl ? 'Izmere v teku' : 'Measurements in progress', value: String(measuring.length), sub: sl ? 'čakajo na zaključek' : 'to be finished' },
  ]

  /** one table card: title, count, "all" link, header row and the newest rows */
  function Table({ icon: Icon, title, status, items, cols, empty }: {
    icon: typeof Inbox; title: string; status: string; items: Row[]; empty: string
    cols: { head: string; cell: (q: Row) => ReactNode; right?: boolean; hide?: boolean }[]
  }) {
    return <section className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <Icon className="w-4 h-4 text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <span className="inline-flex items-center h-[22px] px-2 rounded-md bg-[#f4f4f5] text-[#7f7f7f] text-xs font-medium tabular-nums">{rows === null ? '–' : items.length}</span>
        <Link to={`/quotes?status=${status}`} className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-[#5e5e5e] hover:text-gray-900">{sl ? 'Vse' : 'All'}<ArrowRight className="w-3.5 h-3.5" /></Link>
      </div>
      {rows !== null && items.length === 0
        ? <p className="px-5 pb-6 pt-2 text-sm font-medium text-[#7f7f7f] border-t border-gray-200">{empty}</p>
        : <div className="overflow-x-auto"><table className="w-full text-sm font-medium">
          <thead className="bg-gray-50 border-y border-gray-200"><tr>
            {cols.map((c, i) => <th key={i} className={`px-4 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap ${c.right ? 'text-right' : 'text-left'} ${c.hide ? 'hidden 2xl:table-cell' : ''}`}>{c.head}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-200">
            {items.slice(0, ROWS).map(q => <tr key={q.id} onClick={() => navigate(`/quotes/${q.id}`)} className="hover:bg-gray-50 transition-colors cursor-pointer">
              {cols.map((c, i) => <td key={i} className={`px-4 py-2.5 ${c.right ? 'text-right whitespace-nowrap' : ''} ${c.hide ? 'hidden 2xl:table-cell' : ''}`}>{c.cell(q)}</td>)}
            </tr>)}
          </tbody>
        </table></div>}
    </section>
  }

  const number = { head: sl ? 'Številka' : 'Number', cell: (q: Row) => <span className="font-semibold text-gray-900 whitespace-nowrap">{q.quote_number}</span> }
  const customer = { head: sl ? 'Stranka' : 'Customer', cell: (q: Row) => <span className="block max-w-[170px] truncate text-gray-900" title={q.customers?.name ?? ''}>{q.customers?.name ?? '—'}</span> }
  const value = { head: sl ? 'Vrednost' : 'Value', right: true, cell: (q: Row) => <span className="text-gray-900 tabular-nums">{money(q.total_net)}</span> }
  const when = (head: string, f: (q: Row) => string) => ({ head, right: true, cell: (q: Row) => <span className="text-[#7f7f7f]">{ago(f(q))}</span> })

  return (
    <div>
      <PageHeader title={t.nav.home} icon={House}
        action={hasPerm('quotes', 'create') && <Button onClick={() => navigate('/quotes/new')} className="gap-1.5"><Plus className="w-4 h-4" />{sl ? 'Nova ponudba' : 'New quote'}</Button>} />
      <div className="px-6 py-6 max-w-[1400px] mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-gray-900">{hello}{profile?.first_name ? `, ${profile.first_name}` : ''}</h1>
          <p className="text-sm font-medium text-[#5e5e5e] mt-1">{today}</p>
        </div>

        {canQuotes && <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {kpis.map(x => (
              <div key={x.label} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: x.bg }}><x.icon className="w-4 h-4" style={{ color: x.color }} /></div>
                </div>
                <div className="text-xs font-medium text-[#7f7f7f]">{x.label}</div>
                <div className="text-2xl font-bold tracking-[-0.02em] text-gray-900 tabular-nums mt-0.5">{rows === null ? '–' : x.value}</div>
                <div className="text-xs font-medium text-[#7f7f7f] mt-0.5">{x.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5 items-start">
            <Table icon={Inbox} title={sl ? 'Prejeta povpraševanja' : 'Received enquiries'} status="enquiry" items={enquiries}
              empty={sl ? 'Ni novih povpraševanj.' : 'No new enquiries.'}
              cols={[number, customer, when(sl ? 'Prejeto' : 'Received', q => q.created_at), value]} />
            <Table icon={Send} title={sl ? 'Poslane ponudbe' : 'Sent offers'} status="sent" items={sent}
              empty={sl ? 'Ni ponudb, ki čakajo na odgovor.' : 'No offers waiting for an answer.'}
              cols={[number, customer, when(sl ? 'Poslano' : 'Sent', q => q.sent_at ?? q.updated_at), { head: 'Status', cell: q => <QuoteStatusBadge status={q.status} label={t.qp.status[q.status] ?? q.status} />, hide: true }, value]} />
            <Table icon={FileText} title={sl ? 'Osnutki' : 'Drafts'} status="draft" items={drafts}
              empty={sl ? 'Ni osnutkov.' : 'No drafts.'}
              cols={[number, customer, when(sl ? 'Posodobljeno' : 'Updated', q => q.updated_at), value]} />
            <Table icon={Ruler} title={sl ? 'Izmere v teku' : 'Measurements in progress'} status="measure" items={measuring}
              empty={sl ? 'Ni izmer v teku.' : 'No measurements in progress.'}
              cols={[number, customer, { head: sl ? 'Naslov montaže' : 'Site', cell: q => <span className="block max-w-[170px] truncate text-[#5e5e5e]" title={q.site_address ?? ''}>{q.site_address || '—'}</span> }, value]} />
          </div>
        </>}

        {publicUrl && <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900">{sl ? 'Vaš konfigurator' : 'Your configurator'}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <div className="flex-1 min-w-[220px] rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 truncate">{publicUrl}</div>
            <Button variant="secondary" className="gap-1.5" onClick={() => { navigator.clipboard.writeText(publicUrl).then(() => toast.success(sl ? 'Kopirano' : 'Copied')) }}><Copy className="w-4 h-4" />{sl ? 'Kopiraj' : 'Copy'}</Button>
            <a href={publicUrl} target="_blank" rel="noreferrer"><Button variant="secondary" className="gap-1.5"><ExternalLink className="w-4 h-4" />{sl ? 'Odpri' : 'Open'}</Button></a>
          </div>
        </section>}
      </div>
    </div>
  )
}
