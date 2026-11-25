import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * Shared look for list pages: a full-width search bar on a light fill (no border),
 * then filter tabs as plain labels with small count pills, extra filters on the right.
 * Tables under it use the frameless style from index.css (.table-frame).
 */
export function SearchBar({ value, onChange, placeholder, className, compact }: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
  /** small white field with a light border, for the page header */
  compact?: boolean
}) {
  if (compact) return (
    <div className={cn('relative w-full sm:w-72', className)}>
      <Search className="w-4 h-4 text-[#667085] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={2} />
      <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="search-bar w-full h-9 pl-9 pr-3 rounded-[10px] bg-white border border-[#e4e9f2] text-[13px] text-black placeholder:text-[#667085] outline-none focus:border-[#d0d5dd] focus:ring-2 focus:ring-[#f6f8fc]" />
    </div>
  )
  return (
    <div className={cn('relative w-full', className)}>
      <Search className="w-[18px] h-[18px] text-[#667085] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={2} />
      <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="search-bar w-full h-11 pl-11 pr-4 rounded-xl bg-surface text-[14px] text-black placeholder:text-[#667085] outline-none focus:ring-2 focus:ring-[#e8eef7]" />
    </div>
  )
}

/** small grey square icon button (refresh, settings …) */
export function IconButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className="w-9 h-9 inline-flex items-center justify-center rounded-[10px] border border-[#e4e9f2] bg-white text-[#667085] hover:text-black hover:bg-[#f6f8fc] transition-colors">
      <Icon className="w-4 h-4" strokeWidth={1.75} />
    </button>
  )
}

export interface FilterTab<K extends string = string> {
  key: K
  label: string
  count?: number
}

export function FilterTabs<K extends string>({ tabs, active, onChange, right }: {
  tabs: FilterTab<K>[]
  active: K
  onChange: (key: K) => void
  /** extra filters (dropdowns, view switch) on the right of the tab row */
  right?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-4 mb-2">
      <div role="tablist" className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {tabs.map(t => {
          const on = t.key === active
          return (
            <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => onChange(t.key)}
              className={cn('inline-flex items-center gap-2 h-8 text-[14px] transition-colors',
                on ? 'text-black font-medium' : 'text-[#667085] hover:text-black')}>
              {t.label}
              {t.count !== undefined && (
                <span className={cn('min-w-[22px] h-[20px] px-1.5 inline-flex items-center justify-center rounded-full text-[12px] font-medium tabular-nums',
                  on ? 'bg-[#e8eef7] text-black' : 'bg-surface text-[#667085]')}>{t.count}</span>
              )}
            </button>
          )
        })}
      </div>
      {right && <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  )
}
