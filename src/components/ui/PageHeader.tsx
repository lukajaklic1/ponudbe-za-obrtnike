import type { LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  title: string
  icon?: LucideIcon
  count?: number
  action?: React.ReactNode
  /** accepted for the pages that pass it */
  flush?: boolean
}

export function PageHeader({ title, icon: Icon, count, action }: PageHeaderProps) {
  return (
    <div className="h-[57px] flex items-center justify-between px-4 border-b border-gray-200 bg-white shrink-0">
      <div className="flex items-center gap-2">
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
