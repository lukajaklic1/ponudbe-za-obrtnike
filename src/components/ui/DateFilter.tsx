import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths,
  isSameMonth, isSameDay, isToday,
} from 'date-fns'
import { sl as slLocale, enGB } from 'date-fns/locale'
import { useLanguage } from '../../hooks/useLanguage'
import { cn } from '../../lib/cn'

interface DateFilterProps {
  label: string
  value: string            // yyyy-mm-dd or ''
  allLabel: string
  onChange: (value: string) => void
  min?: string
  max?: string
}

const toKey = (d: Date) => format(d, 'yyyy-MM-dd')
const fromKey = (k: string) => new Date(`${k}T00:00:00`)

// Filter chip (same look as FilterSelect) with its own calendar dropdown
export function DateFilter({ label, value, allLabel, onChange, min, max }: DateFilterProps) {
  const { lang } = useLanguage()
  const locale = lang === 'sl' ? slLocale : enGB
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => startOfMonth(value ? fromKey(value) : new Date()))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setMonth(startOfMonth(value ? fromKey(value) : new Date()))
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  // 6 weeks grid, Monday first
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const days: Date[] = []
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d)
  const weekdays = Array.from({ length: 7 }, (_, i) => format(addDays(gridStart, i), 'EEEEEE', { locale }))
  const disabled = (d: Date) => (!!min && toKey(d) < min) || (!!max && toKey(d) > max)
  const selected = value ? fromKey(value) : null

  function pick(d: Date) {
    if (disabled(d)) return
    onChange(toKey(d))
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 pl-3 ${value ? 'pr-7' : 'pr-3'} py-1 rounded-lg border border-gray-200 bg-white text-sm whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-300 transition-colors`}>
        <span className="text-gray-500">{label}:</span>
        <span className="text-gray-900 font-medium">{value ? format(fromKey(value), 'd. M. yyyy') : allLabel}</span>
        {!value && <CalendarDays className="w-3.5 h-3.5 text-gray-400 ml-0.5" />}
      </button>
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#111827]">
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 w-[280px] bg-white border border-[#e5e7eb] rounded-xl shadow-lg p-3">
          {/* month switcher */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setMonth(m => subMonths(m, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-md text-[#9ca3af] hover:text-[#111827] hover:bg-[#f6f6f6]">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-[#111827] capitalize">{format(month, 'LLLL yyyy', { locale })}</span>
            <button type="button" onClick={() => setMonth(m => addMonths(m, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-md text-[#9ca3af] hover:text-[#111827] hover:bg-[#f6f6f6]">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* weekday names */}
          <div className="grid grid-cols-7 mb-1">
            {weekdays.map((w, i) => <div key={i} className="h-8 flex items-center justify-center text-xs text-[#9ca3af] capitalize">{w}</div>)}
          </div>

          {/* days */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {days.map(d => {
              const sel = !!selected && isSameDay(d, selected)
              const off = disabled(d)
              return (
                <button key={toKey(d)} type="button" disabled={off} onClick={() => pick(d)}
                  className={cn(
                    'h-9 w-9 mx-auto flex items-center justify-center rounded-md text-sm transition-colors',
                    sel ? 'bg-[#101112] text-white font-medium'
                      : off ? 'text-[#c9ccd1] cursor-not-allowed'
                      : isSameMonth(d, month) ? 'text-[#111827] hover:bg-[#f3f4f6]' : 'text-[#c4c7cc] hover:bg-[#f3f4f6]',
                    !sel && isToday(d) && 'ring-1 ring-inset ring-[#e5e7eb] font-medium',
                  )}>
                  {format(d, 'd')}
                </button>
              )
            })}
          </div>

          {/* footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#e5e7eb]">
            <button type="button" onClick={() => pick(new Date())} disabled={disabled(new Date())}
              className="h-8 px-2.5 rounded-md text-sm text-[#111827] hover:bg-[#f6f6f6] disabled:opacity-40">
              {lang === 'sl' ? 'Danes' : 'Today'}
            </button>
            {value && (
              <button type="button" onClick={() => { onChange(''); setOpen(false) }}
                className="h-8 px-2.5 rounded-md text-sm text-[#9ca3af] hover:text-[#111827] hover:bg-[#f6f6f6]">
                {lang === 'sl' ? 'Počisti' : 'Clear'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
