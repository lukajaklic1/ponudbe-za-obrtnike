import type { LucideIcon } from 'lucide-react'
import { PanelLeft } from 'lucide-react'
import { useSidebarCollapse } from '../layout/AppLayout'

interface PageHeaderProps {
  title: string
  icon?: LucideIcon
  count?: number
  action?: React.ReactNode
  /** spacious = new look (Ponudbe first): quiet breadcrumb bar + large page title, 32px side padding */
  variant?: 'compact' | 'spacious'
  /** spacious only: sections under the title, e.g. [{ label: 'Vse ponudbe', count: 22, active: true }] */
  tabs?: { label: string; count?: number; active?: boolean; onClick?: () => void }[]
}

function Counter({ count }: { count: number }) {
  return <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-2 rounded-full bg-[#e9ebe2] text-[13px] font-semibold text-[#4a5361]">{count}</span>
}

export function PageHeader({ title, icon: Icon, count, action, variant = 'compact', tabs }: PageHeaderProps) {
  const { collapsed, toggle } = useSidebarCollapse()

  const toggleButton = collapsed && (
    <button
      onClick={toggle}
      className="hidden lg:flex p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-[#eeefe8] transition-colors"
      title="Show sidebar"
    >
      <PanelLeft className="w-[18px] h-[18px]" />
    </button>
  )

  if (variant === 'spacious') {
    return (
      <div className="bg-white shrink-0">
        {/* quiet top bar: where you are + the page's main actions */}
        <div className="h-16 flex items-center justify-between gap-3 px-8">
          <div className="flex items-center gap-2 min-w-0">
            {toggleButton}
            <span className="text-sm font-[450] text-[#4a5361] truncate">{title}</span>
          </div>
          {action}
        </div>
        {/* page title */}
        <div className="px-8 pt-3 pb-1 flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-[#101112]">{title}</h1>
          {!tabs && count !== undefined && <Counter count={count} />}
        </div>
        {/* section tabs with counters, active one underlined in black */}
        {tabs && (
          <div className="px-8 mt-4">
            <div className="flex items-end gap-6 border-b border-[#e4e6dd]">
              {tabs.map(tab => (
                <button key={tab.label} type="button" onClick={tab.onClick}
                  className={`relative flex items-center gap-2 pb-3 -mb-px text-sm transition-colors ${tab.active
                    ? 'font-medium text-[#101112] border-b-[3px] border-[#101112]'
                    : 'font-[450] text-[#4a5361] border-b-[3px] border-transparent hover:text-[#101112]'}`}>
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`inline-flex items-center justify-center h-5 min-w-[22px] px-1.5 rounded-full text-xs font-medium ${tab.active ? 'bg-[#101112] text-white' : 'bg-[#e9ebe2] text-[#4a5361]'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-[57px] flex items-center justify-between px-4 border-b border-gray-200 bg-white shrink-0">
      <div className="flex items-center gap-2">
        {toggleButton}
        {Icon && <Icon className="w-4 h-4 text-gray-900 shrink-0" />}
        <h1 className="text-sm font-medium text-gray-900">{title}</h1>
        {count !== undefined && <Counter count={count} />}
      </div>
      {action}
    </div>
  )
}
