import { useId } from 'react'
import type { WindowMaterial } from '../lib/windows'

/**
 * Schematic 3D cut-away of a window profile (our own drawing, not a manufacturer picture).
 * The cut face is at the front, the profile is extruded backwards and the insulated glass
 * rises from the sash. Units are roughly millimetres of an 82 mm system.
 * Outside is on the RIGHT (its face is visible), inside on the left.
 *
 * Parts that are shown (simplified but in the right order and proportion):
 * frame with rebate + outer stop, sash with overlap lip, glazing bead on the inside,
 * triple glazing (~46 % of the profile depth) with spacers, outer / middle / stop gaskets,
 * PVC chambers in one row with steel reinforcement, ALU thermal break (polyamide + foam),
 * glued wood lamellas, drip rail on wood, ALU cladding on PVC-ALU and wood-ALU.
 */

type Pt = [number, number]
interface Face { front: string; top: string; side: string; stroke?: string }
interface Part { pts: Pt[]; c: Face; detail?: React.ReactNode; overlay?: React.ReactNode; opacity?: number }

// oblique projection: depth goes up and to the right
const D: Pt = [26, -18]

const C = {
  pvc:    { front: '#f2f4f7', top: '#ffffff', side: '#d8dde4' },
  alu:    { front: '#5b626d', top: '#7c838e', side: '#474d57' },
  wood:   { front: '#d3a066', top: '#e7bf88', side: '#bf8a4f' },
  gasket: { front: '#1d2026', top: '#3a3f47', side: '#14161a' },
  poly:   { front: '#26282c', top: '#3b3e44', side: '#1b1d20' },
  foam:   { front: '#e8e3d5', top: '#f3efe4', side: '#d6d0bf' },
  spacer: { front: '#8b939e', top: '#aab1ba', side: '#6f7782' },
  glass:  { front: '#a7c7ea', top: '#dcecfb', side: '#c9dff6', stroke: 'rgba(59,110,170,0.45)' },
} satisfies Record<string, Face>

const EDGE = 'rgba(15,23,42,0.4)'
const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
const poly = (pts: Pt[]) => pts.map(p => p.join(',')).join(' ')

function Prism({ part }: { part: Part }) {
  const { pts, c } = part
  const clip = useId()
  // orientation → outward normals; a face is visible when its normal points along the depth vector
  let area = 0
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; area += p[0] * q[1] - q[0] * p[1] })
  const faces = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length]
    const ex = q[0] - p[0], ey = q[1] - p[1]
    const n: Pt = area > 0 ? [ey, -ex] : [-ey, ex]
    const visible = n[0] * D[0] + n[1] * D[1] > 0.0001
    const isTop = n[1] < 0 && Math.abs(n[1]) >= Math.abs(n[0])
    const back = ((p[0] + q[0]) / 2) * D[0] + ((p[1] + q[1]) / 2) * D[1]
    return { p, q, visible, isTop, back }
  }).filter(f => f.visible).sort((a, b) => b.back - a.back)

  return (
    <g opacity={part.opacity}>
      {faces.map((f, i) => (
        <polygon key={i} points={poly([f.p, [f.p[0] + D[0], f.p[1] + D[1]], [f.q[0] + D[0], f.q[1] + D[1]], f.q])}
          fill={f.isTop ? c.top : c.side} stroke={c.stroke ?? EDGE} strokeWidth={0.4} strokeLinejoin="round" />
      ))}
      <polygon points={poly(pts)} fill={c.front} stroke={c.stroke ?? EDGE} strokeWidth={0.5} strokeLinejoin="round" />
      {part.overlay}
      {part.detail && <g clipPath={`url(#${CSS.escape(clip)})`}><clipPath id={clip}><polygon points={poly(pts)} /></clipPath>{part.detail}</g>}
    </g>
  )
}

// cavities drawn on a cut face
const holes = (list: [number, number, number, number][], fill: string, stroke: string) => (
  <g>{list.map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} rx={0.6} fill={fill} stroke={stroke} strokeWidth={0.4} />)}</g>
)
const steelU = (x: number, y: number, w: number, h: number) => (
  <path d={`M ${x} ${y} L ${x} ${y + h} L ${x + w} ${y + h} L ${x + w} ${y}`} fill="none" stroke="#6b7480" strokeWidth={1.3} strokeLinejoin="round" />
)
const lamellas = (xs: number[], y1: number, y2: number) => (
  <g stroke="#a8743c" strokeWidth={0.5} opacity={0.9}>{xs.map(x => <line key={x} x1={x} y1={y1} x2={x} y2={y2} />)}</g>
)
const endGrain = (x: number, y: number, w: number, h: number) => (
  <g fill="none" stroke="#b9854a" strokeWidth={0.35} opacity={0.75}>
    {[0.3, 0.55, 0.8].map(f => <ellipse key={f} cx={x + w / 2} cy={y + h * 1.1} rx={w * f * 0.55} ry={h * f * 0.9} />)}
  </g>
)

// ─── shared pieces (outside = right) ───
const glazing = (x0: number, tops: [number, number, number]): Part[] => {
  // triple insulated glass: 4 mm panes, 12–13 mm cavities with spacers at the edge
  const xs = [x0, x0 + 17, x0 + 34]
  const out: Part[] = []
  xs.forEach((x, i) => {
    out.push({ pts: rect(x, tops[i], 4, 100 - tops[i]), c: C.glass, opacity: 0.93,
      overlay: <line x1={x + 4.6} y1={tops[i] + 12} x2={x + 4.6 + D[0] * 0.7} y2={tops[i] + 12 + D[1] * 0.7 + 30} stroke="#ffffff" strokeWidth={1.2} opacity={0.55} /> })
    if (i < 2) out.push({ pts: rect(x + 4, 89, 13, 11), c: C.spacer })
  })
  return out
}
const gasket = (x: number, y: number, w: number, h: number): Part => ({ pts: rect(x, y, w, h), c: C.gasket })

function partsFor(material: WindowMaterial): Part[] {
  const PVC_FRAME: Pt[] = [[0, 210], [82, 210], [82, 126], [74, 126], [74, 150], [18, 150], [18, 160], [0, 160]]
  const SASH: Pt[] = [[8, 100], [64, 100], [64, 146], [16, 146], [16, 158], [8, 158]]
  const BEAD: Pt[] = [[12, 100], [24, 100], [24, 84], [18, 84], [12, 91]]

  switch (material) {
    case 'pvc':
    case 'pvc_alu': {
      const parts: Part[] = [
        { pts: PVC_FRAME, c: C.pvc, detail: <g>
          {holes([[3, 165, 10, 40], [16, 156, 10, 49], [29, 156, 26, 49], [58, 156, 9, 49], [70, 156, 3, 49], [76, 130, 4, 75]], '#e1e6ec', '#aab3bf')}
          {steelU(32, 160, 20, 40)}
        </g> },
        gasket(52, 146, 7, 4),
        { pts: SASH, c: C.pvc, detail: <g>
          {holes([[10, 104, 6, 50], [19, 104, 22, 38], [44, 104, 17, 38]], '#e1e6ec', '#aab3bf')}
          {steelU(22, 107, 16, 31)}
        </g> },
        { pts: BEAD, c: C.pvc, detail: holes([[15, 92, 6, 6]], '#e1e6ec', '#aab3bf') },
        gasket(22.5, 86, 1.5, 6),
        ...glazing(24, [40, 31, 22]),
        gasket(62, 84, 2, 8),
        { pts: rect(64, 82, 8, 64), c: C.pvc, detail: holes([[66, 86, 4, 56]], '#e1e6ec', '#aab3bf') },
        gasket(72, 128, 2, 9),
      ]
      if (material === 'pvc_alu') parts.push(
        { pts: rect(64, 77, 14, 4), c: C.alu },
        { pts: rect(72.5, 81, 5, 41), c: C.alu },
        { pts: rect(82.5, 122, 5, 84), c: C.alu },
      )
      return parts
    }
    case 'alu': {
      const cav = '#3a4049', cavS = '#2a2f36'
      return [
        { pts: [[0, 210], [34, 210], [34, 150], [18, 150], [18, 160], [0, 160]], c: C.alu, detail: holes([[3, 164, 12, 41], [19, 154, 12, 51]], cav, cavS) },
        { pts: rect(34, 154, 12, 5), c: C.poly },
        { pts: rect(34, 159, 12, 40), c: C.foam },
        { pts: rect(34, 199, 12, 5), c: C.poly },
        { pts: [[46, 210], [82, 210], [82, 126], [74, 126], [74, 150], [46, 150]], c: C.alu, detail: holes([[49, 154, 22, 51], [76, 130, 4, 75]], cav, cavS) },
        gasket(52, 146, 7, 4),
        { pts: [[8, 100], [34, 100], [34, 146], [16, 146], [16, 158], [8, 158]], c: C.alu, detail: holes([[11, 104, 20, 38]], cav, cavS) },
        { pts: rect(34, 102, 12, 5), c: C.poly },
        { pts: rect(34, 107, 12, 32), c: C.foam },
        { pts: rect(34, 139, 12, 5), c: C.poly },
        { pts: rect(46, 100, 18, 46), c: C.alu, detail: holes([[49, 104, 12, 38]], cav, cavS) },
        { pts: BEAD, c: C.alu },
        gasket(22.5, 86, 1.5, 6),
        ...glazing(24, [40, 31, 22]),
        gasket(62, 84, 2, 8),
        { pts: rect(64, 82, 8, 64), c: C.alu, detail: holes([[66, 86, 4, 56]], cav, cavS) },
        gasket(72, 128, 2, 9),
      ]
    }
    case 'wood': {
      return [
        { pts: [[0, 210], [82, 210], [82, 150], [18, 150], [18, 160], [0, 160]], c: C.wood,
          detail: <g>{lamellas([27, 55], 150, 210)}{endGrain(0, 160, 27, 50)}{endGrain(27, 150, 28, 60)}{endGrain(55, 150, 27, 60)}</g> },
        gasket(46, 146, 7, 4),
        { pts: SASH, c: C.wood, detail: <g>{lamellas([30, 47], 100, 146)}{endGrain(8, 100, 22, 46)}{endGrain(30, 100, 17, 46)}{endGrain(47, 100, 17, 46)}</g> },
        { pts: BEAD, c: C.wood },
        gasket(22.5, 86, 1.5, 6),
        ...glazing(24, [40, 31, 22]),
        gasket(62, 84, 2, 8),
        { pts: rect(64, 82, 14, 62), c: C.wood, detail: endGrain(64, 82, 14, 62) },
        gasket(70, 144, 6, 6),
        // drip rail (odkapnik) on the outside, sends water away from the frame joint
        { pts: [[78, 132], [80, 132], [88, 142], [88, 146], [78, 144]], c: C.alu },
      ]
    }
    case 'wood_alu': {
      return [
        { pts: [[0, 210], [70, 210], [70, 150], [18, 150], [18, 160], [0, 160]], c: C.wood,
          detail: <g>{lamellas([24, 47], 150, 210)}{endGrain(0, 160, 24, 50)}{endGrain(24, 150, 23, 60)}{endGrain(47, 150, 23, 60)}</g> },
        gasket(44, 146, 7, 4),
        { pts: SASH, c: C.wood, detail: <g>{lamellas([30, 47], 100, 146)}{endGrain(8, 100, 22, 46)}{endGrain(30, 100, 17, 46)}{endGrain(47, 100, 17, 46)}</g> },
        { pts: BEAD, c: C.wood },
        gasket(22.5, 86, 1.5, 6),
        ...glazing(24, [40, 31, 22]),
        gasket(62, 84, 2, 8),
        // aluminium cladding: holds the glass from outside and covers the wood
        { pts: [[60, 78], [76, 78], [76, 146], [64, 146], [64, 84], [60, 84]], c: C.alu },
        gasket(68, 146, 6, 4),
        { pts: rect(72, 140, 8, 70), c: C.alu },
      ]
    }
    case 'steel':
      return [
        { pts: rect(30, 150, 40, 60), c: C.alu, detail: holes([[34, 154, 32, 52]], '#3a4049', '#2a2f36') },
        { pts: rect(34, 100, 32, 46), c: C.alu, detail: holes([[38, 104, 24, 38]], '#3a4049', '#2a2f36') },
        ...glazing(40, [40, 31, 22]).filter((_, i) => i < 3),
      ]
  }
}

export default function ProfileSection({ material, size = 96, className }: { material: WindowMaterial; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size * 1.6} viewBox="-6 -2 128 218" role="img" aria-label={material}>
      <ellipse cx={58} cy={211} rx={56} ry={4.5} fill="#0f172a" opacity={0.07} />
      {partsFor(material).map((p, i) => <Prism key={i} part={p} />)}
    </svg>
  )
}
