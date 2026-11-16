import { useId } from 'react'

/**
 * Insulating glass unit in perspective: 2 or 3 panes with green glass edges, a light reflection
 * and the spacer with desiccant (yellow grains) at the bottom between the panes.
 */
export default function GlassIcon({ layers = 2, size = 40 }: { layers?: number; size?: number }) {
  const uid = useId().replace(/:/g, '')
  const n = Math.max(2, Math.min(4, layers))
  const W = 36, RISE = 20           // pane depth to the back, and how much the top / bottom slant
  const GAP = n > 2 ? 17 : 22       // distance between the panes (the cavity)
  const TOP = 26, BOT = 114         // front edge from TOP to BOT
  const total = (n - 1) * GAP + W
  const x0 = (100 - total) / 2
  const xs = Array.from({ length: n }, (_, i) => x0 + i * GAP)
  const g = `glass-${uid}`, r = `refl-${uid}`, e = `edge-${uid}`
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120" className="shrink-0" aria-hidden>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef9f6" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#c6e8df" stopOpacity="0.8" />
          <stop offset="1" stopColor="#9fd3c5" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={r} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={e} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3fae8c" />
          <stop offset="1" stopColor="#1f7a5f" />
        </linearGradient>
      </defs>
      {/* back to front, so the front pane overlaps */}
      {xs.slice().reverse().map((x, k) => {
        const i = n - 1 - k
        return <g key={i}>
          {/* spacer with desiccant between this pane and the next one (at the bottom of the cavity) */}
          {i < n - 1 && <g>
            {/* spacer bar along the bottom edge, with the desiccant grains showing on its front */}
            <polygon points={`${x + 2},${BOT - 12} ${x + GAP},${BOT - 12} ${x + GAP + 6},${BOT - 15} ${x + 8},${BOT - 15}`} fill="#6f7882" />
            <rect x={x + 2} y={BOT - 12} width={GAP - 2} height="10" fill="#9aa3ad" />
            {[0.2, 0.4, 0.6, 0.8].flatMap(t => [0, 1].map(row => <circle key={t + '-' + row} cx={x + 2 + (GAP - 2) * t + row * 1.5} cy={BOT - 9.5 + row * 4} r="1.3" fill={row ? '#c9a227' : '#e8c547'} />))}
          </g>}
          {/* the pane: face, reflection, green edges */}
          <polygon points={`${x},${TOP} ${x + W},${TOP - RISE} ${x + W},${BOT - RISE} ${x},${BOT}`} fill={`url(#${g})`} stroke="#6dbba3" strokeWidth="0.8" />
          <polygon points={`${x + 8},${TOP + 6} ${x + 16},${TOP + 1} ${x + 16},${BOT - 36} ${x + 8},${BOT - 31}`} fill={`url(#${r})`} opacity="0.85" />
          <line x1={x + W} y1={TOP - RISE} x2={x + W} y2={BOT - RISE} stroke="#3fa585" strokeWidth="1.6" />
          <line x1={x} y1={TOP} x2={x + W} y2={TOP - RISE} stroke="#3fa585" strokeWidth="2" />
          <line x1={x} y1={BOT} x2={x + W} y2={BOT - RISE} stroke="#2f8a6d" strokeWidth="1.2" />
          <rect x={x - 2.2} y={TOP - 1} width="4.4" height={BOT - TOP + 2} rx="1" fill={`url(#${e})`} />
        </g>
      })}
    </svg>
  )
}
