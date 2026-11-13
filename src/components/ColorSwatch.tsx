import { useId } from 'react'
import { WOODS, type ColorSpec } from '../lib/colors'

/**
 * Colour sample with the surface it has on a window profile:
 * smooth (soft sheen), structured (fine grain), metallic (brushed sheen) or wood-grain foil.
 */
export default function ColorSwatch({ spec, size = 40, rounded = 8, className }: { spec: ColorSpec; size?: number; rounded?: number; className?: string }) {
  const id = useId().replace(/[^a-z0-9]/gi, '')
  const light = isLight(spec.hex)
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 40 40" role="img" aria-hidden>
      <defs>
        <clipPath id={`cl${id}`}><rect width="40" height="40" rx={rounded * 40 / size} /></clipPath>
        <linearGradient id={`sh${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={spec.finish === 'metal' ? 0.55 : 0.28} />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity={spec.finish === 'metal' ? 0.3 : 0.14} />
        </linearGradient>
        {spec.finish === 'struct' && <pattern id={`st${id}`} width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="3" fill="transparent" />
          <circle cx="0.8" cy="0.8" r="0.45" fill={light ? '#000' : '#fff'} opacity="0.12" />
          <circle cx="2.3" cy="2.1" r="0.35" fill={light ? '#000' : '#fff'} opacity="0.09" />
        </pattern>}
      </defs>
      <g clipPath={`url(#cl${id})`}>
        <rect width="40" height="40" fill={spec.hex} />
        {spec.finish === 'wood' && spec.wood && <WoodGrain color={WOODS[spec.wood].grain} />}
        {spec.finish === 'struct' && <rect width="40" height="40" fill={`url(#st${id})`} />}
        {spec.finish === 'metal' && <g stroke="#fff" strokeWidth="0.35" opacity="0.25">{Array.from({ length: 20 }, (_, i) => <line key={i} x1="0" y1={i * 2 + 0.5} x2="40" y2={i * 2 + 0.5} />)}</g>}
        <rect width="40" height="40" fill={`url(#sh${id})`} />
      </g>
      <rect x="0.5" y="0.5" width="39" height="39" rx={rounded * 40 / size} fill="none" stroke={light ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.25)'} />
    </svg>
  )
}

function WoodGrain({ color }: { color: string }) {
  // long wavy fibres + two knots, like a printed wood foil
  const lines = [3, 7, 10, 14, 18, 21, 25, 29, 32, 36]
  return <g fill="none" stroke={color} strokeLinecap="round">
    {lines.map((y, i) => <path key={y} d={`M -2 ${y} C 8 ${y + (i % 2 ? 2 : -2)}, 18 ${y + (i % 3 ? -1.5 : 2)}, 28 ${y} S 40 ${y + (i % 2 ? -2 : 1.5)}, 44 ${y}`}
      strokeWidth={i % 3 === 0 ? 0.9 : 0.5} opacity={i % 3 === 0 ? 0.55 : 0.35} />)}
    <ellipse cx="13" cy="12" rx="3.2" ry="1.4" strokeWidth="0.6" opacity="0.5" />
    <ellipse cx="13" cy="12" rx="1.6" ry="0.6" strokeWidth="0.5" opacity="0.5" />
    <ellipse cx="30" cy="27" rx="2.6" ry="1.1" strokeWidth="0.6" opacity="0.45" />
  </g>
}

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (r * 299 + g * 587 + b * 114) / 1000 > 150
}
