import { ChevronDown } from 'lucide-react'

interface SortIconProps {
  active: boolean
  dir: 'asc' | 'desc'
  /** 'chevron' = new table style (Ponudbe first, the rest will follow) */
  variant?: 'arrows' | 'chevron'
}

export function SortIcon({ active, dir, variant = 'arrows' }: SortIconProps) {
  if (variant === 'chevron') {
    // grey when idle, dark when sorted, flipped for ascending
    return (
      <ChevronDown
        className={`w-3.5 h-3.5 ml-1 shrink-0 transition-transform ${active ? 'text-[#4a5361]' : 'text-[#8a8f80]'} ${active && dir === 'asc' ? 'rotate-180' : ''}`}
        strokeWidth={2}
      />
    )
  }
  const up = active && dir === 'asc'
  const down = active && dir === 'desc'
  return (
    <span className="inline-flex flex-col gap-[1px] ml-1 shrink-0" style={{ lineHeight: 1 }}>
      <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
        <path d="M3.5 0L7 5H0L3.5 0Z" fill={up ? '#6b7064' : '#cfd2c4'} />
      </svg>
      <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
        <path d="M3.5 5L0 0H7L3.5 5Z" fill={down ? '#6b7064' : '#cfd2c4'} />
      </svg>
    </span>
  )
}
