import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { House, Plus, Inbox, FileText, Send, Ruler, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../hooks/useCompany'
import { useLanguage } from '../hooks/useLanguage'
import { PageHeader } from '../components/ui/PageHeader'
import Button from '../components/ui/Button'

interface Row { status: string; created_at: string; updated_at: string; sent_at: string | null }

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
    supabase.from('quotes').select('status, created_at, updated_at, sent_at').eq('company_id', company.id).limit(2000)
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

  const hour = new Date().getHours()
  const hello = sl ? (hour < 12 ? 'Dobro jutro' : hour < 18 ? 'Dober dan' : 'Dober večer') : (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening')
  const today = new Date().toLocaleDateString(sl ? 'sl-SI' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const cards = [
    { icon: Inbox, status: 'enquiry', label: sl ? 'Povpraševanja' : 'Enquiries', value: count('enquiry'), sub: avgText ? (sl ? `Povprečen čas do ponudbe: ${avgText}` : `Average time to an offer: ${avgText}`) : (sl ? 'čakajo na ponudbo' : 'waiting for an offer') },
    { icon: FileText, status: 'draft', label: sl ? 'Osnutki' : 'Drafts', value: count('draft'), sub: sl ? 'v pripravi' : 'in progress' },
    { icon: Send, status: 'sent', label: sl ? 'Poslane ponudbe' : 'Sent offers', value: sent.length, sub: stale ? (sl ? `${stale} starejših od 7 dni` : `${stale} older than 7 days`) : (sl ? 'čakajo na odgovor' : 'waiting for an answer') },
    { icon: Ruler, status: 'measure', label: sl ? 'Izmere v teku' : 'Measurements in progress', value: count('measure'), sub: sl ? 'čakajo na zaključek' : 'to be finished' },
  ]

  return (
    <div>
      <PageHeader title={t.nav.home} icon={House}
        action={hasPerm('quotes', 'create') && <Button onClick={() => navigate('/quotes/new')} className="gap-1.5"><Plus className="w-4 h-4" />{sl ? 'Nova ponudba' : 'New quote'}</Button>} />
      <div className="px-6 py-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-gray-900">{hello}{profile?.first_name ? `, ${profile.first_name}` : ''}</h1>
          <p className="text-sm font-medium text-[#5e5e5e] mt-1">{today}</p>
        </div>

        {canQuotes && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {cards.map(x => (
            <div key={x.status} onClick={() => navigate(`/quotes?status=${x.status}`)}
              className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col cursor-pointer hover:border-gray-400 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[#f4f4f5] flex items-center justify-center"><x.icon className="w-4 h-4 text-[#52525b]" /></div>
              <div className="text-sm font-medium text-gray-900 mt-4">{x.label}</div>
              <div className="text-3xl font-bold tracking-[-0.02em] text-gray-900 tabular-nums mt-1">{rows === null ? '–' : x.value}</div>
              <div className="text-xs font-medium text-[#7f7f7f] mt-1 min-h-[16px]">{x.sub}</div>
              <Link to={`/quotes?status=${x.status}`} onClick={e => e.stopPropagation()}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#5e5e5e] hover:text-gray-900">{sl ? 'Prikaži vse' : 'Show all'}<ArrowRight className="w-3.5 h-3.5" /></Link>
            </div>
          ))}
        </div>}
      </div>
    </div>
  )
}
