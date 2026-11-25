interface SortIconProps {
  active: boolean
  dir: 'asc' | 'desc'
}

export function SortIcon({ active, dir }: SortIconProps) {
  const up = active && dir === 'asc'
  const down = active && dir === 'desc'
  return (
    <span className="inline-flex flex-col gap-[1px] ml-1 shrink-0" style={{ lineHeight: 1 }}>
      <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
        <path d="M3.5 0L7 5H0L3.5 0Z" fill={up ? '#5e5e5e' : '#c8c8c8'} />
      </svg>
      <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
        <path d="M3.5 5L0 0H7L3.5 5Z" fill={down ? '#5e5e5e' : '#c8c8c8'} />
      </svg>
    </span>
  )
}
