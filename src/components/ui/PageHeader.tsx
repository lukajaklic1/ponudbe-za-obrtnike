import type { LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  title: string
  /** no longer shown (Levelpath-style headers have no icon); kept so pages can still pass it */
  icon?: LucideIcon
  count?: number
  action?: React.ReactNode
  /** tabs follow right under the header: no line between them */
  flush?: boolean
}

export function PageHeader({ title, count, action, flush }: PageHeaderProps) {
  return (
    // on a phone the buttons go under the title when they do not fit next to it
    <div className={`min-h-14 py-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-6 bg-white shrink-0 ${flush ? '' : 'border-b border-gray-200'}`}>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl leading-8 font-bold tracking-[-0.02em] text-gray-900">{title}</h1>
        {count !== undefined && (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-[#e8e8e8] text-[#4a4a4a]">{count}</span>
        )}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2 [&_button]:whitespace-nowrap">{action}</div>}
    </div>
  )
}
