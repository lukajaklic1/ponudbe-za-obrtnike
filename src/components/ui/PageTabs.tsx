import { cn } from '../../lib/cn'

export interface PageTab {
  key: string
  label: string
  count?: number
}

/**
 * Section tabs under the page header (Levelpath style): the open one is black and underlined,
 * a quiet count chip next to each label. Room for more sections of the same page later.
 */
export function PageTabs({ tabs, active, onChange }: { tabs: PageTab[]; active: string; onChange?: (key: string) => void }) {
  return (
    <div className="flex items-end gap-7 px-6 pt-5">
      {tabs.map(t => {
        const on = t.key === active
        return (
          <button key={t.key} type="button" onClick={() => onChange?.(t.key)}
            className={cn('inline-flex items-center gap-2 pb-2 text-[15px] font-medium border-b-[3px] transition-colors',
              on ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-600 hover:text-gray-900')}>
            {t.label}
            {t.count !== undefined && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-[#e9e8e3] text-[#464646]">{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
