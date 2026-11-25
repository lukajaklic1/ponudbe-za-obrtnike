import type { LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  title: string
  /** shown in a small rounded tile next to the title when the header has a subtitle */
  icon?: LucideIcon
  /** grey line under the title; switches to the compact header (icon tile, smaller title) */
  subtitle?: string
  count?: number
  action?: React.ReactNode
  /** tabs follow right under the header: no line between them */
  flush?: boolean
}

export function PageHeader({ title, icon: Icon, subtitle, count, action, flush }: PageHeaderProps) {
  const line = flush ? '' : 'border-b border-[#e4e9f2]'
  if (subtitle !== undefined) return (
    <div className={`py-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 bg-white shrink-0 ${line}`}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <span className="w-10 h-10 rounded-[10px] bg-white border border-[#e4e9f2] shadow-[0_1px_2px_rgba(16,24,40,.04)] flex items-center justify-center shrink-0">
            <Icon className="w-[18px] h-[18px] text-black" strokeWidth={1.75} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-[15px] leading-5 font-semibold text-black truncate">{title}</h1>
          <p className="text-[13px] leading-[18px] text-[#667085] truncate">{subtitle}</p>
        </div>
      </div>
      {action && <div className="flex flex-wrap items-center gap-2 [&_button]:whitespace-nowrap">{action}</div>}
    </div>
  )
  return (
    // on a phone the buttons go under the title when they do not fit next to it
    <div className={`min-h-14 py-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-6 bg-white shrink-0 ${line}`}>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl leading-8 font-bold tracking-[-0.02em] text-black">{title}</h1>
        {count !== undefined && (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-[#e8eef7] text-[#475467]">{count}</span>
        )}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2 [&_button]:whitespace-nowrap">{action}</div>}
    </div>
  )
}
