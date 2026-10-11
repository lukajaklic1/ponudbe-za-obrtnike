import { useRef } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { format } from 'date-fns'

interface DateFilterProps {
  label: string
  value: string            // yyyy-mm-dd or ''
  allLabel: string
  onChange: (value: string) => void
  min?: string
  max?: string
}

// Filter chip (same look as FilterSelect) that opens the browser's date picker
export function DateFilter({ label, value, allLabel, onChange, min, max }: DateFilterProps) {
  const input = useRef<HTMLInputElement>(null)

  function open() {
    const el = input.current
    if (!el) return
    try { el.showPicker() } catch { el.focus() }
  }

  return (
    <div className="relative">
      <button type="button" onClick={open}
        className={`flex items-center gap-1.5 pl-3 ${value ? 'pr-7' : 'pr-3'} py-1 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-300 transition-colors`}>
        <span className="text-gray-500">{label}:</span>
        <span className="text-gray-900 font-medium">{value ? format(new Date(`${value}T00:00:00`), 'd. M. yyyy') : allLabel}</span>
        {!value && <CalendarDays className="w-3.5 h-3.5 text-gray-400 ml-0.5" />}
      </button>
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {/* Hidden native input — only used for its picker */}
      <input ref={input} type="date" value={value} min={min} max={max} tabIndex={-1} aria-hidden
        onChange={e => onChange(e.target.value)}
        className="absolute left-0 bottom-0 w-full h-0 opacity-0 pointer-events-none" />
    </div>
  )
}
