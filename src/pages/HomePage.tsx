import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { House, Plus, Inbox, FileText, Send, Ruler, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { PageHeader } from '../components/ui/PageHeader'
import { QuoteStatusBadge } from '../components/ui/QuoteStatusBadge'
import type { QuoteStatus } from '../types/database'
import Button from '../components/ui/Button'

interface Row { id: string; quote_number: string; status: string; total_net: number | null; created_at: string; updated_at: string; sent_at: string | null; site_address: string | null; customers: { name: string; address: string | null } | null }

const HOUR = 3600000, DAY = 86400000

/** Where a user lands after signing in: four numbers that say what needs doing, each opens its list. */
export default function HomePage() {
  const { company, profile, hasPerm } = useCompany()
  const { t, lang } = useLanguage()
  const navigate = useNavigate()
  const sl = lang !== 'en'
  const [rows, setRows] = useState<Row[] | null>(null)
  const canQuotes = hasPerm('quotes', 'view')

  useEffect(() => {
    if (!company || !canQuotes) { setRows([]); return }
    supabase.from('quotes').select('id, quote_number, status, total_net, created_at, updated_at, sent_at, site_address, customers(name, address)').eq('company_id', company.id).limit(2000)
      .then(({ data }: { data: unknown }) => setRows((data as Row[] | null) ?? []))
  }, [company?.id, canQuotes])

  const list = rows ?? []
  const count = (st: string) => list.filter(q => q.status === st).length
  const sent = list.filter(q => q.status === 'sent')
  const stale = sent.filter(q => Date.now() - Date.parse(q.sent_at ?? q.updated_at) > 7 * DAY).length
  // how long it takes from the enquiry to the offer being sent
  const times = list.filter(q => q.sent_at).map(q => Date.parse(q.sent_at as string) - Date.parse(q.created_at)).filter(x => x >= 0)
  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null
  const avgText = avg === null ? null : avg < DAY ? `${Math.max(1, Math.round(avg / HOUR))} h` : `${(avg / DAY).toLocaleString('de-DE', { maximumFractionDigits: 1 })} ${sl ? 'dni' : 'days'}`

  const ago = (iso: string) => {
    const ms = Date.now() - Date.parse(iso)
    if (ms < HOUR) return sl ? 'pravkar' : 'just now'
    if (ms < DAY) { const h = Math.floor(ms / HOUR); return sl ? `pred ${h} h` : `${h} h ago` }
    const d = Math.floor(ms / DAY)
    return sl ? `pred ${d} d` : `${d} d ago`
  }
  const money = (n: number | null) => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: company?.currency ?? 'EUR' })
  const newest = (items: Row[], key: (q: Row) => string) => [...items].sort((a, b) => Date.parse(key(b)) - Date.parse(key(a)))
  const newEnquiries = newest(list.filter(q => q.status === 'enquiry'), q => q.created_at)
  // open offers: made and out with the customer, not decided yet
  const openOffers = newest(list.filter(q => ['issued', 'sent', 'downloaded', 'measure'].includes(q.status)), q => q.sent_at ?? q.updated_at)
  const statusName = (s0: string) => (t.qp.status as Record<string, string>)[s0] ?? s0

  /** a plain table card: the newest rows, a link to all of them */
  function Table({ title, status, items, empty, when, whenOf, showStatus }: { title: string; status: string; items: Row[]; empty: string; when: string; whenOf: (q: Row) => string; showStatus?: boolean }) {
    return <section className="bg-white rounded-xl border border-gray-200 overflow-hidden h-full flex flex-col">
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <span className="inline-flex items-center h-[22px] px-2 rounded-md bg-[#f4f4f5] text-[#7f7f7f] text-xs font-medium tabular-nums">{rows === null ? '–' : items.length}</span>
        <Link to={`/quotes?status=${status}`} className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-[#5e5e5e] hover:text-gray-900">{sl ? 'Prikaži vse' : 'Show all'}<ArrowRight className="w-3.5 h-3.5" /></Link>
      </div>
      {rows !== null && items.length === 0
        ? <p className="px-5 pb-6 pt-2 text-sm font-medium text-[#7f7f7f] border-t border-gray-200">{empty}</p>
        : <div className="overflow-x-auto"><table className="w-full text-sm font-medium">
          <thead className="bg-gray-50 border-y border-gray-200"><tr>
            {[sl ? 'Številka' : 'Number', sl ? 'Stranka' : 'Customer', ...(showStatus ? ['Status'] : []), when, sl ? 'Vrednost' : 'Value'].map((h, i, all) => <th key={i} className={`px-4 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap ${i >= 2 && !(showStatus && i === 2) ? 'text-right' : 'text-left'} ${i === all.length - 1 ? 'text-right' : ''}`}>{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-200">
            {items.slice(0, 5).map(q => <tr key={q.id} onClick={() => navigate(`/quotes/${q.id}`)} className="hover:bg-gray-50 transition-colors cursor-pointer">
              <td className="px-4 py-4 font-semibold text-gray-900 whitespace-nowrap">{q.quote_number}</td>
              <td className="px-4 py-4">
                <span className="block max-w-[240px] truncate text-gray-900" title={q.customers?.name ?? ''}>{q.customers?.name ?? '—'}</span>
                {(q.site_address || q.customers?.address) && <span className="block max-w-[240px] truncate text-xs text-[#7f7f7f] mt-0.5" title={q.site_address || q.customers?.address || ''}>{q.site_address || q.customers?.address}</span>}
              </td>
              {showStatus && <td className="px-4 py-4"><QuoteStatusBadge status={q.status as QuoteStatus} label={statusName(q.status)} /></td>}
              <td className="px-4 py-4 text-right whitespace-nowrap text-[#7f7f7f]">{ago(whenOf(q))}</td>
              <td className="px-4 py-4 text-right whitespace-nowrap text-gray-900 tabular-nums">{money(q.total_net)}</td>
            </tr>)}
          </tbody>
        </table></div>}
    </section>
  }
  const hour = new Date().getHours()
  const hello = sl ? (hour < 12 ? 'Dobro jutro' : hour < 18 ? 'Dober dan' : 'Dober večer') : (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening')
  const today = new Date().toLocaleDateString(sl ? 'sl-SI' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const cards = [
    { icon: Inbox, bg: '#feeee1', fg: '#9e3f00', status: 'enquiry', label: sl ? 'Povpraševanja' : 'Enquiries', value: count('enquiry'), sub: avgText ? (sl ? `Povprečen čas do ponudbe: ${avgText}` : `Average time to an offer: ${avgText}`) : (sl ? 'čakajo na ponudbo' : 'waiting for an offer') },
    { icon: FileText, bg: '#eeeff1', fg: '#52525b', status: 'draft', label: sl ? 'Osnutki' : 'Drafts', value: count('draft'), sub: sl ? 'v pripravi' : 'in progress' },
    { icon: Send, bg: '#fef3cd', fg: '#8a6100', status: 'sent', label: sl ? 'Poslane ponudbe' : 'Sent offers', value: sent.length, sub: stale ? (sl ? `${stale} starejših od 7 dni` : `${stale} older than 7 days`) : (sl ? 'čakajo na odgovor' : 'waiting for an answer') },
    { icon: Ruler, bg: '#dcf5f4', fg: '#0c6b6b', status: 'measure', label: sl ? 'Izmere v teku' : 'Measurements in progress', value: count('measure'), sub: sl ? 'čakajo na zaključek' : 'to be finished' },
  ]

  return (
    <div>
      <PageHeader title={t.nav.home} icon={House}
        action={hasPerm('quotes', 'create') && <Button onClick={() => navigate('/quotes/new')} className="gap-1.5"><Plus className="w-4 h-4" />{sl ? 'Nova ponudba' : 'New quote'}</Button>} />
      <div className="px-6 py-6 max-w-[1500px] mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-gray-900">{hello}{profile?.first_name ? `, ${profile.first_name}` : ''}</h1>
          <p className="text-sm font-medium text-[#5e5e5e] mt-1">{today}</p>
        </div>

        {canQuotes && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {cards.map(x => (
            <div key={x.status} onClick={() => navigate(`/quotes?status=${x.status}`)}
              className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col cursor-pointer hover:border-gray-400 transition-colors">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: x.bg }}><x.icon className="w-[18px] h-[18px]" style={{ color: x.fg }} /></div>
              <div className="text-sm font-medium text-gray-900 mt-4">{x.label}</div>
              <div className="text-4xl font-bold tracking-[-0.03em] text-gray-900 tabular-nums mt-1.5">{rows === null ? '–' : x.value}</div>
              <div className="text-xs font-medium text-[#7f7f7f] mt-1 min-h-[16px]">{x.sub}</div>
              <Link to={`/quotes?status=${x.status}`} onClick={e => e.stopPropagation()}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#5e5e5e] hover:text-gray-900">{sl ? 'Prikaži vse' : 'Show all'}<ArrowRight className="w-3.5 h-3.5" /></Link>
            </div>
          ))}
        </div>}

        {canQuotes && <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 sm:gap-5 items-stretch">
          <Table title={sl ? 'Nova povpraševanja' : 'New enquiries'} status="enquiry" items={newEnquiries} empty={sl ? 'Ni novih povpraševanj.' : 'No new enquiries.'}
            when={sl ? 'Prejeto' : 'Received'} whenOf={q => q.created_at} showStatus />
          <Table title={sl ? 'Odprte ponudbe' : 'Open offers'} status="sent" items={openOffers} empty={sl ? 'Ni odprtih ponudb.' : 'No open offers.'}
            when={sl ? 'Poslano' : 'Sent'} whenOf={q => q.sent_at ?? q.updated_at} showStatus />
        </div>}
      </div>
    </div>
  )
}
