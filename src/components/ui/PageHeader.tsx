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
    <div className="h-[57px] flex items-center justify-between px-4 border-b border-gray-200 bg-white shrink-0">
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
        {Icon && <Icon className="w-4 h-4 text-gray-900 shrink-0" />}
        <h1 className="text-sm font-medium text-gray-900">{title}</h1>
        {count !== undefined && (
          <span className="text-xs font-medium text-gray-600 px-1.5 py-0.5 rounded bg-gray-100">{count}</span>
        )}
      </div>
      {action}
    </div>
  )
}
