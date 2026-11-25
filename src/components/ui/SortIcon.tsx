interface SortIconProps {
  active: boolean
  dir: 'asc' | 'desc'
}

/** small up/down chevrons after a column label; the sorted direction turns black */
export function SortIcon({ active, dir }: SortIconProps) {
  const up = active && dir === 'asc'
  const down = active && dir === 'desc'
  return (
    <span className="sort-icon inline-flex flex-col gap-[2px] ml-1.5 shrink-0" style={{ lineHeight: 1 }} aria-hidden>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
        <path d="M1 4L4 1L7 4" stroke={up ? '#000000' : '#b5b2ab'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
        <path d="M1 1L4 4L7 1" stroke={down ? '#000000' : '#b5b2ab'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
