import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { House, Plus, UserPlus, Inbox, FileText, FileCheck, Send, Ruler, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { PageHeader } from '../components/ui/PageHeader'
import Button from '../components/ui/Button'

interface Row { assignee_id: string | null; id: string; quote_number: string; status: string; total_net: number | null; created_at: string; updated_at: string; sent_at: string | null; site_address: string | null; customers: { name: string; address: string | null } | null }

const DAY = 86400000

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
    supabase.from('quotes').select('assignee_id, id, quote_number, status, total_net, created_at, updated_at, sent_at, site_address, customers(name, address)').eq('company_id', company.id).limit(2000)
      .then(({ data }: { data: unknown }) => setRows((data as Row[] | null) ?? []))
  }, [company?.id, canQuotes])

  // by default only what is assigned to the signed-in user (Zadolženi); the switch shows the whole company
  const [mine, setMine] = useState<boolean>(() => { try { return localStorage.getItem('obrtdesk-home-mine') !== '0' } catch { return true } })
  function chooseMine(v: boolean) { setMine(v); try { localStorage.setItem('obrtdesk-home-mine', v ? '1' : '0') } catch { /* ignore */ } }
  const list = (rows ?? []).filter(q => !mine || !profile?.id || q.assignee_id === profile.id)
  const qs = mine && profile?.id ? `&assignee=${profile.id}` : ''
  const count = (st: string) => list.filter(q => q.status === st).length
  const sent = list.filter(q => q.status === 'sent')
  const stale = sent.filter(q => Date.now() - Date.parse(q.sent_at ?? q.updated_at) > 7 * DAY).length

  const newest = (items: Row[], key: (q: Row) => string) => [...items].sort((a, b) => Date.parse(key(b)) - Date.parse(key(a)))
  // open offers: made and out with the customer, waiting for an answer; measurement is a stage of its own, so the cards add up
  const openOffers = newest(list.filter(q => q.status === 'sent' || q.status === 'downloaded'), q => q.sent_at ?? q.updated_at)

  const hello = sl ? 'Pozdravljeni' : 'Hello'

  const cards = [
    { icon: Inbox, bg: '#feeee1', fg: '#9e3f00', status: 'enquiry', label: sl ? 'Odprta povpraševanja' : 'Open enquiries', value: count('enquiry'), sub: '' },
    { icon: FileText, bg: '#eeeff1', fg: '#52525b', status: 'draft', label: sl ? 'Osnutki ponudb' : 'Draft offers', value: count('draft'), sub: '' },
    { icon: FileCheck, bg: '#f0eafd', fg: '#6b3fc4', status: 'issued', label: sl ? 'Izdane ponudbe, ki čakajo na pošiljanje' : 'Issued offers waiting to be sent', value: count('issued'), sub: '' },
    { icon: Send, bg: '#fef3cd', fg: '#8a6100', status: 'out', label: sl ? 'Odprte ponudbe pri strankah' : 'Open offers with customers', value: openOffers.length, sub: stale ? (sl ? `${stale} starejših od 7 dni` : `${stale} older than 7 days`) : '' },
    { icon: Ruler, bg: '#dcf5f4', fg: '#0c6b6b', status: 'measure', label: sl ? 'Vaše izmere v teku' : 'Your measurements in progress', value: count('measure'), sub: '' },
  ]

  return (
    <div className="min-h-full bg-white">
      <PageHeader title={t.nav.home} icon={House} />
      <div className="px-6 py-10 max-w-[1500px] mx-auto space-y-10">
        <div className="text-center pt-2 pb-2">
<h1 className="text-3xl leading-[1.25] font-bold tracking-[-0.02em] text-gray-900">            {hello}{profile?.first_name ? `, ${profile.first_name}` : ''}!<br />{sl ? 'Kaj želite urediti danes?' : 'What would you like to do today?'}          </h1>
          {hasPerm('quotes', 'create') && <div className="flex flex-wrap justify-center gap-2 mt-5">
            <Button variant="secondary" onClick={() => navigate('/quotes/new')} className="gap-1.5"><Plus className="w-4 h-4" />{sl ? 'Nova ponudba' : 'New quote'}</Button>
            {hasPerm('customers', 'create') && <Button variant="secondary" onClick={() => navigate('/customers?new=1')} className="gap-1.5"><UserPlus className="w-4 h-4" />{sl ? 'Dodaj stranko' : 'Add customer'}</Button>}
          </div>}
        </div>

        {canQuotes && <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 text-center">{mine ? (sl ? 'Poglejte vaše odprte naloge' : 'Your open tasks') : (sl ? 'Poglejte odprte naloge celotnega podjetja' : 'See the open tasks of the whole company')}</h2>
          <div className="flex justify-center mb-5"><div className="inline-flex p-[3px] rounded-[11px] bg-[#f1f1f1]">
            {([[true, sl ? 'Vaše' : 'Yours'], [false, sl ? 'Vse' : 'Everyone']] as const).map(([v, label]) => <button key={label} type="button" onClick={() => chooseMine(v)} className={`h-8 px-4 rounded-lg text-sm font-semibold transition-colors ${mine === v ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.1)]' : 'text-[#5e5e5e] hover:text-gray-900'}`}>{label}</button>)}
          </div></div>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4 max-w-[980px] mx-auto">
          {cards.map(x => (
            <div key={x.status} onClick={() => navigate(`/quotes?status=${x.status}${qs}`)}
              className="bg-white rounded-xl border border-[#e4e4e7] shadow-[0_1px_2px_rgba(16,24,40,0.05)] p-5 flex flex-col cursor-pointer hover:border-gray-400 hover:shadow-[0_2px_6px_rgba(16,24,40,0.08)] transition-all w-full sm:w-[300px]">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: x.bg }}><x.icon className="w-4 h-4" style={{ color: x.fg }} /></div>
              <div className="text-sm font-medium text-gray-900 mt-3 min-h-[40px]">{x.label}</div>
              <div className="text-3xl font-bold tracking-[-0.03em] text-gray-900 tabular-nums mt-1">{rows === null ? '–' : x.value}</div>
              <div className="text-xs font-medium text-[#7f7f7f] mt-1 mb-4 min-h-[16px]">{x.sub}</div>
              <Link to={`/quotes?status=${x.status}${qs}`} onClick={e => e.stopPropagation()}
                className="mt-auto self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-gray-400 hover:text-gray-900 transition-colors">{sl ? 'Prikaži vse' : 'Show all'}<ArrowRight className="w-3.5 h-3.5" /></Link>
            </div>
          ))}
          </div>
        </div>}
      </div>
    </div>
  )
}
