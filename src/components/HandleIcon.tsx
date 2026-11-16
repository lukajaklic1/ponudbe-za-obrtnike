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
  const g = `h-${uid}`, fillUrl = `url(#${g})`
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
      <rect x="38" y="110" width="30" height="4" rx="2" fill="#000" opacity="0.07" />
      {/* rosette: slim, square-edged plate */}
      <rect x="37" y="6" width="26" height="58" rx="3" fill={fillUrl} stroke={edge} strokeWidth="1.5" />
      {/* key cylinder of a lockable handle */}
      {lockable && <g>
        <rect x="45" y="13" width="10" height="10" rx="2" fill={shade(hex, -0.45)} stroke={edge} strokeWidth="1" />
        <rect x="49" y="15" width="2" height="6" rx="0.8" fill={shade(hex, 0.6)} />
      </g>}
      {/* square neck + straight square-edged lever pointing down */}
      <rect x="42" y="32" width="16" height="16" rx="2.5" fill={fillUrl} stroke={edge} strokeWidth="1.5" />
      <rect x="44" y="44" width="12" height="64" rx="2" fill={fillUrl} stroke={edge} strokeWidth="1.5" />
      <line x1="47" y1="48" x2="47" y2="104" stroke={light} strokeWidth="1.6" opacity="0.7" strokeLinecap="round" />
    </svg>
  )
}
