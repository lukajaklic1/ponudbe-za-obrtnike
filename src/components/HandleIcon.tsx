import { useId } from 'react'
import { parseColor } from '../lib/colors'

/** Mix a hex colour with white (t > 0) or black (t < 0). */
function shade(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t)))
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('')
}

/**
 * Window handle seen from the room: the rosette on the sash and the lever pointing down,
 * in the handle's colour (light from the left). A lockable handle shows the key cylinder.
 */
export default function HandleIcon({ look, lockable = false, size = 40 }: { look?: string | null; lockable?: boolean; size?: number }) {
  const uid = useId().replace(/:/g, '')
  const spec = parseColor(look ?? '#ffffff')
  const hex = spec?.hex ?? '#ffffff'
  const metal = spec?.finish === 'metal'
  const light = shade(hex, metal ? 0.55 : 0.35), dark = shade(hex, metal ? -0.35 : -0.18)
  const edge = shade(hex, -0.3)
  const g = `h-${uid}`
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120" className="shrink-0" aria-hidden>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={light} />
          <stop offset={metal ? '0.45' : '0.6'} stopColor={hex} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      {/* shadow on the sash */}
      <ellipse cx="54" cy="112" rx="16" ry="3" fill="#000" opacity="0.08" />
      {/* rosette */}
      <rect x="35" y="6" width="30" height="58" rx="9" fill={`url(#${g})`} stroke={edge} strokeWidth="1.5" />
      {/* key cylinder of a lockable handle */}
      {lockable && <g>
        <circle cx="50" cy="19" r="5.5" fill={shade(hex, -0.45)} stroke={edge} strokeWidth="1" />
        <rect x="49" y="16" width="2" height="6" rx="1" fill={shade(hex, 0.6)} />
      </g>}
      {/* neck + lever pointing down */}
      <circle cx="50" cy="40" r="9" fill={`url(#${g})`} stroke={edge} strokeWidth="1.5" />
      <path d="M44 42 Q43 76 45 104 Q46 110 51 110 Q56 110 57 104 Q58 76 56 42 Z" fill={`url(#${g})`} stroke={edge} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M47 48 Q46.5 76 48 102" stroke={light} strokeWidth="1.6" fill="none" opacity="0.7" strokeLinecap="round" />
    </svg>
  )
}
