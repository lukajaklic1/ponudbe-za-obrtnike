import type { LucideIcon } from 'lucide-react'
import { PanelLeft } from 'lucide-react'
import { useSidebarCollapse } from '../layout/AppLayout'

interface PageHeaderProps {
  title: string
  icon?: LucideIcon
  count?: number
  action?: React.ReactNode
}

export function PageHeader({ title, icon: Icon, count, action }: PageHeaderProps) {
  const { collapsed, toggle } = useSidebarCollapse()

  return (
    <div className="h-[61px] flex items-center justify-between px-6 border-b border-[#e3e6ea] bg-white shrink-0 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center gap-2">
        {collapsed && (
          <button
            onClick={toggle}
            className="hidden lg:flex p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-[#f6f6f6] transition-colors"
            title="Show sidebar"
          >
            <PanelLeft className="w-[18px] h-[18px]" />
          </button>
        )}
        {Icon && <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></span>}
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
        {count !== undefined && (
          <span className="text-xs font-medium text-gray-600 px-1.5 py-0.5 rounded bg-gray-100">{count}</span>
        )}
      </div>
      {action}
    </div>
  )
}
