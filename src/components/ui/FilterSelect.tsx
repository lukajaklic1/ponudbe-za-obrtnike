import { useRef, useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Option {
  value: string
  label: string
}

interface FilterSelectProps {
  label: string
  value: string
  options: Option[]
  allLabel: string
  onChange: (value: string) => void
  icon?: LucideIcon
}

export function FilterSelect({ label, value, options, allLabel, onChange, icon: Icon }: FilterSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selectedLabel = value === '' ? allLabel : (options.find(o => o.value === value)?.label ?? value)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-300 transition-colors"
      >
        {Icon ? <Icon className="w-3.5 h-3.5 text-gray-500" /> : <span className="text-gray-500">{label}:</span>}
        <span className="text-gray-900 font-medium">{selectedLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-0.5" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-full">
          <button
            onClick={() => { onChange(''); setOpen(false) }}
            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[#f6f6f6] transition-colors ${value === '' ? 'text-gray-900 font-medium' : 'text-gray-600'}`}
          >
            {allLabel}
          </button>
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[#f6f6f6] transition-colors ${value === opt.value ? 'text-gray-900 font-medium' : 'text-gray-600'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
