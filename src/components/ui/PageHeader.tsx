import type { LucideIcon } from 'lucide-react'
import { PanelLeft } from 'lucide-react'
import { useSidebarCollapse } from '../layout/AppLayout'

interface PageHeaderProps {
  title: string
  /** no longer shown (Levelpath-style headers have no icon); kept so pages can still pass it */
  icon?: LucideIcon
  count?: number
  action?: React.ReactNode
}

export function PageHeader({ title, count, action }: PageHeaderProps) {
  const { collapsed, toggle } = useSidebarCollapse()

  return (
    <div className="h-14 flex items-center justify-between px-6 border-b border-gray-200 bg-white shrink-0">
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
        <h1 className="text-2xl leading-8 font-bold tracking-[-0.02em] text-gray-900">{title}</h1>
        {count !== undefined && (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-[#e8e8e8] text-[#4a4a4a]">{count}</span>
        )}
      </div>
      {action}
    </div>
  )
}
