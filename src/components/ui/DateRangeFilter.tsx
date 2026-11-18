import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Check, ChevronDown, X } from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths, subDays, startOfYear } from 'date-fns'
import { useLanguage } from '../../hooks/useLanguage'
import { DateFilter } from './DateFilter'
import { cn } from '../../lib/cn'

const toKey = (d: Date) => format(d, 'yyyy-MM-dd')
const fromKey = (k: string) => new Date(`${k}T00:00:00`)

interface Props {
  label: string
  from: string            // yyyy-mm-dd or ''
  to: string              // yyyy-mm-dd or ''
  onChange: (from: string, to: string) => void
}

/**
 * One filter chip for a date range: quick periods (last 30 days, this month …) and "custom" with a start and an end.
 * Same look as the other filter chips.
 */
export function DateRangeFilter({ label, from, to, onChange }: Props) {
  const { lang } = useLanguage()
  const sl = lang === 'sl'
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const today = new Date()
  const presets: { id: string; label: string; from: string; to: string }[] = [
    { id: 'all', label: sl ? 'Vse' : 'Any time', from: '', to: '' },
    { id: '7', label: sl ? 'Zadnjih 7 dni' : 'Last 7 days', from: toKey(subDays(today, 6)), to: toKey(today) },
    { id: '30', label: sl ? 'Zadnjih 30 dni' : 'Last 30 days', from: toKey(subDays(today, 29)), to: toKey(today) },
    { id: '90', label: sl ? 'Zadnjih 90 dni' : 'Last 90 days', from: toKey(subDays(today, 89)), to: toKey(today) },
    { id: 'month', label: sl ? 'Ta mesec' : 'This month', from: toKey(startOfMonth(today)), to: toKey(endOfMonth(today)) },
    { id: 'prev', label: sl ? 'Prejšnji mesec' : 'Last month', from: toKey(startOfMonth(subMonths(today, 1))), to: toKey(endOfMonth(subMonths(today, 1))) },
    { id: 'year', label: sl ? 'Letos' : 'This year', from: toKey(startOfYear(today)), to: toKey(today) },
  ]
  const active = presets.find(p => p.from === from && p.to === to)
  const short = (k: string) => format(fromKey(k), 'd. M. yyyy')
  const shown = active ? active.label
    : from && to ? `${short(from)} – ${short(to)}`
    : from ? `${sl ? 'od' : 'from'} ${short(from)}`
    : `${sl ? 'do' : 'until'} ${short(to)}`
  const isSet = !!(from || to)

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => { setOpen(o => !o); setCustom(!active && isSet) }}
        className={cn('flex items-center gap-1.5 pl-3 h-8 rounded-[10px] border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.06)] text-sm whitespace-nowrap hover:border-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500', isSet ? 'pr-7' : 'pr-2.5')}>
        <span className="text-gray-600">{label}:</span>
        <span className="text-gray-900 font-medium">{shown}</span>
        {!isSet && <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-0.5" />}
      </button>
      {isSet && <button type="button" onClick={() => onChange('', '')} title={sl ? 'Počisti' : 'Clear'}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900"><X className="w-3.5 h-3.5" /></button>}

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-max min-w-[220px] bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {presets.map(p => {
            const on = !custom && active?.id === p.id
            return <button key={p.id} type="button" onClick={() => { onChange(p.from, p.to); setCustom(false); setOpen(false) }}
              className={cn('flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-left hover:bg-gray-50', on ? 'text-gray-900 font-medium' : 'text-gray-700')}>
              <span className="flex-1">{p.label}</span>
              <Check className={cn('w-3.5 h-3.5 text-gray-900', on ? '' : 'invisible')} />
            </button>
          })}
          <div className="my-1 border-t border-gray-100" />
          <button type="button" onClick={() => setCustom(c => !c)}
            className={cn('flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-left hover:bg-gray-50', custom ? 'text-gray-900 font-medium' : 'text-gray-700')}>
            <CalendarDays className="w-3.5 h-3.5 text-gray-500" />
            <span className="flex-1">{sl ? 'Po meri' : 'Custom'}</span>
            <Check className={cn('w-3.5 h-3.5 text-gray-900', custom ? '' : 'invisible')} />
          </button>
          {custom && (
            <div className="flex items-center gap-2 px-3 pt-1.5 pb-2">
              <DateFilter label={sl ? 'Od' : 'From'} value={from} allLabel="—" max={to || undefined} onChange={v => onChange(v, to)} />
              <DateFilter label={sl ? 'Do' : 'To'} value={to} allLabel="—" min={from || undefined} onChange={v => onChange(from, v)} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
