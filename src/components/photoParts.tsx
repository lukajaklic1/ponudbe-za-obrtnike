/**
 * Parts for the "photo" look of the window drawings (the product picker): mitred profiles lit
 * from the top left, a recessed glazing bead, neutral glass with a reflection and an inner
 * shadow, so the windows read like product photos and not like schemes.
 */

export interface PhotoIds { glass: string; shine: string; shV: string; shH: string; barV: string; barH: string; floor: string }
export const photoIds = (uid: string): PhotoIds => ({
  glass: `pg${uid}`, shine: `ps${uid}`, shV: `pv${uid}`, shH: `ph${uid}`, barV: `pbv${uid}`, barH: `pbh${uid}`, floor: `pf${uid}`,
})

export function PhotoDefs({ ids }: { ids: PhotoIds }) {
  return <>
    {/* glass: light, clearly blue-tinted, a little darker at the bottom */}
    <linearGradient id={ids.glass} x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stopColor="#eaf3fb" />
      <stop offset="1" stopColor="#d8e8f5" />
    </linearGradient>
    {/* one broad soft reflection and a thin one next to it */}
    <linearGradient id={ids.shine} x1="0" y1="0" x2="1" y2="0.9">
      <stop offset="0" stopColor="#fff" stopOpacity="0" />
      <stop offset="0.2" stopColor="#fff" stopOpacity="0" />
      <stop offset="0.3" stopColor="#fff" stopOpacity="0.5" />
      <stop offset="0.4" stopColor="#fff" stopOpacity="0" />
      <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
      <stop offset="0.56" stopColor="#fff" stopOpacity="0.35" />
      <stop offset="0.62" stopColor="#fff" stopOpacity="0" />
      <stop offset="1" stopColor="#fff" stopOpacity="0" />
    </linearGradient>
    {/* inner shadow the bead throws on the glass (top and left) */}
    <linearGradient id={ids.shV} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#1b2430" stopOpacity="0.1" />
      <stop offset="1" stopColor="#1b2430" stopOpacity="0" />
    </linearGradient>
    <linearGradient id={ids.shH} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#1b2430" stopOpacity="0.06" />
      <stop offset="1" stopColor="#1b2430" stopOpacity="0" />
    </linearGradient>
    {/* mullions and transoms: rounded profile, lit from the left / top */}
    <linearGradient id={ids.barV} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
      <stop offset="0.35" stopColor="#fff" stopOpacity="0.1" />
      <stop offset="0.7" stopColor="#000" stopOpacity="0.04" />
      <stop offset="1" stopColor="#000" stopOpacity="0.16" />
    </linearGradient>
    <linearGradient id={ids.barH} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
      <stop offset="0.35" stopColor="#fff" stopOpacity="0.1" />
      <stop offset="0.7" stopColor="#000" stopOpacity="0.04" />
      <stop offset="1" stopColor="#000" stopOpacity="0.16" />
    </linearGradient>
    <filter id={ids.floor} x="-20%" y="-200%" width="140%" height="500%">
      <feGaussianBlur stdDeviation="2.4" />
    </filter>
  </>
}

const faces = (x: number, y: number, w: number, h: number, t: number) => ({
  top: `${x},${y} ${x + w},${y} ${x + w - t},${y + t} ${x + t},${y + t}`,
  left: `${x},${y} ${x + t},${y + t} ${x + t},${y + h - t} ${x},${y + h}`,
  right: `${x + w},${y} ${x + w},${y + h} ${x + w - t},${y + h - t} ${x + w - t},${y + t}`,
  bottom: `${x},${y + h} ${x + t},${y + h - t} ${x + w - t},${y + h - t} ${x + w},${y + h}`,
})
const SIDES = ['top', 'left', 'right', 'bottom'] as const
type Light = Record<(typeof SIDES)[number], [string, number]>
/** a face turned to the viewer and the light */
const RAISED: Light = { top: ['#fff', 0.35], left: ['#fff', 0.2], right: ['#000', 0.03], bottom: ['#000', 0.06] }
/** a face sloping into the opening: lit the other way */
const SUNK: Light = { top: ['#000', 0.05], left: ['#000', 0.03], right: ['#fff', 0.1], bottom: ['#fff', 0.2] }

/** a mitred ring of profile (four faces, the joints show at the corners) */
export function Ring({ x, y, w, h, t, color, sunk = false }: { x: number; y: number; w: number; h: number; t: number; color: string; sunk?: boolean }) {
  if (t <= 0 || w <= 2 * t || h <= 2 * t) return null
  const f = faces(x, y, w, h, t)
  const light = sunk ? SUNK : RAISED
  return <g>
    {SIDES.map(k => <g key={k}>
      <polygon points={f[k]} fill={color} />
      <polygon points={f[k]} fill={light[k][0]} fillOpacity={light[k][1]} />
    </g>)}
    <rect x={x} y={y} width={w} height={h} fill="none" stroke="#8a97a3" strokeOpacity={0.55} strokeWidth={0.5} />
    <rect x={x + t} y={y + t} width={w - 2 * t} height={h - 2 * t} fill="none" stroke="#8a97a3" strokeOpacity={0.45} strokeWidth={0.5} />
  </g>
}

/** a profile like a real PVC one: a raised outer face and a chamfer down to the next part */
export function Profile({ x, y, w, h, t, color }: { x: number; y: number; w: number; h: number; t: number; color: string }) {
  const a = t * 0.64
  return <g>
    <Ring x={x} y={y} w={w} h={h} t={a} color={color} />
    <Ring x={x + a} y={y + a} w={w - 2 * a} h={h - 2 * a} t={t - a} color={color} sunk />
  </g>
}

/** a straight bar (mullion or transom) */
export function Bar({ x, y, w, h, color, ids, vertical }: { x: number; y: number; w: number; h: number; color: string; ids: PhotoIds; vertical: boolean }) {
  if (w <= 0 || h <= 0) return null
  return <g>
    <rect x={x} y={y} width={w} height={h} fill={color} />
    <rect x={x} y={y} width={w} height={h} fill={`url(#${vertical ? ids.barV : ids.barH})`} />
    <rect x={x} y={y} width={w} height={h} fill="none" stroke="#2a323b" strokeOpacity={0.22} strokeWidth={0.5} />
  </g>
}

/** glass: neutral, a reflection and the shadow of the bead along the top and left edge */
export function PhotoGlass({ x, y, w, h }: { x: number; y: number; w: number; h: number; ids?: PhotoIds }) {
  if (w <= 0 || h <= 0) return null
  // flat pale glass: no reflections, no gradients (they look dirty)
  return <g>
    <rect x={x} y={y} width={w} height={h} fill="#e4f0fa" />
    <rect x={x} y={y} width={w} height={h} fill="none" stroke="#7f93a6" strokeOpacity={0.55} strokeWidth={0.6} />
  </g>
}
