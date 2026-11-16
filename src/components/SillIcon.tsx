/**
 * Window sill in cross-section next to the bottom of the window frame:
 * inside (left of the wall) a flat board, outside a sloped metal sill with a drip edge.
 */
export default function SillIcon({ side, size = 64 }: { side: 'inner' | 'outer'; size?: number }) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 80 60" className="shrink-0" aria-hidden>
      {/* wall */}
      <rect x="30" y="20" width="20" height="40" fill="#e5e7eb" />
      {/* window frame bottom */}
      <rect x="32" y="4" width="16" height="16" rx="1.5" fill="#ffffff" stroke="#9ca3af" strokeWidth="1.2" />
      <rect x="35" y="4" width="10" height="10" fill="#dbeafe" opacity="0.8" />
      {side === 'inner'
        ? <g>
            {/* inside sill: flat board towards the room */}
            <rect x="30" y="20" width="20" height="40" fill="#e5e7eb" />
            <rect x="4" y="18" width="36" height="5" rx="1" fill="#f8fafc" stroke="#6b7280" strokeWidth="1.2" />
            <rect x="4" y="23" width="3" height="3" fill="#6b7280" />
          </g>
        : <g>
            {/* outside sill: sloped metal with a drip edge */}
            <path d="M46 19 L78 24 L78 30 L76 30 L76 26 L46 22 Z" fill="#cbd5e1" stroke="#475569" strokeWidth="1.2" strokeLinejoin="round" />
          </g>}
    </svg>
  )
}
