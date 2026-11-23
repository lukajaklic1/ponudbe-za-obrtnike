import { useId } from 'react'
import { meetsWithoutMullion, type Field, type WindowSpec } from '../lib/costing'
import { Bar, PhotoDefs, PhotoGlass, Profile, Ring, photoIds, type PhotoIds } from './photoParts'

type Zone = 'main' | 'top' | 'bottom'

/**
 * Window drawn from sashes: frame, mullions, top light / bottom panel and the opening
 * symbol of every field (viewed from inside: the triangle's apex points to the hinge side,
 * tilt = apex at the bottom). Fields can be clicked when `onField` is given.
 *
 * Drawn like a render, not a scheme: profiles with depth (light from the top left), glass with
 * a sky reflection, a soft shadow under the window and real handles — the geometry is the same.
 */
/** what is chosen on the window, drawn with it: shading box, insect screen, sills, handle colour */
export interface DrawingExtras {
  /** shading kind (roller, blinds, pleated …): a box over the window and guides at the sides */
  shade?: string | null
  /** colour of the shading and its box (default: the frame colour) */
  shadeColor?: string | null
  /** insect screen: a fine mesh over the glass */
  screen?: boolean
  /** sill materials (outside and inside), drawn under the window */
  sillOut?: string | null
  sillIn?: string | null
  /** colour of the handles */
  handle?: string | null
}
const SILL_HEX: Record<string, string> = {
  granite: '#9aa0a6', granite_dark: '#4b4f54', marble: '#ece9e4', wood_oak: '#b98a55', wood_walnut: '#6b4a32',
  pvc_white: '#f4f4f2', pvc_oak: '#b98a55', pvc_anthracite: '#3d4246', alu_white: '#f2f2f2', alu_silver: '#c3c6c8',
  alu_anthracite: '#3d4246', alu_brown: '#5a3e2b', stone: '#9aa0a6', pvc: '#f4f4f2', wood: '#b98a55', alu: '#c3c6c8', alu_dark: '#3d4246',
}

/** ids of the shared gradients of one drawing (several drawings are on a page) */
interface Ids { glass: string; shine: string; prof: string; metal: string }
const EDGE = '#80868d'

/** a profile (frame, sash, mullion, bead): its colour with light from the top left */
function Prof({ x, y, w, h, color, ids, rx = 0.8, edge = EDGE, sw = 0.7 }: { x: number; y: number; w: number; h: number; color: string; ids: Ids; rx?: number; edge?: string; sw?: number }) {
  if (w <= 0 || h <= 0) return null
  return <g>
    <rect x={x} y={y} width={w} height={h} rx={rx} fill={color} stroke={edge} strokeWidth={sw} />
    <rect x={x} y={y} width={w} height={h} rx={rx} fill={`url(#${ids.prof})`} />
  </g>
}

/** glass: sky-blue with depth, two soft reflections and the shadow of the rebate at its edge */
function Glass({ x, y, w, h, ids }: { x: number; y: number; w: number; h: number; ids: Ids }) {
  if (w <= 0 || h <= 0) return null
  return <g>
    <rect x={x} y={y} width={w} height={h} fill={`url(#${ids.glass})`} />
    <rect x={x} y={y} width={w} height={h} fill={`url(#${ids.shine})`} />
    <rect x={x + 0.6} y={y + 0.6} width={Math.max(0, w - 1.2)} height={Math.max(0, h - 1.2)} fill="none" stroke="#0b1f33" strokeOpacity={0.07} strokeWidth={1} />
    <rect x={x} y={y} width={w} height={h} fill="none" stroke="#a9b6c1" strokeWidth={0.5} />
  </g>
}

/** a handle: a round rose on the sash and the lever pointing down (sideways on a tilt-only sash) */
function Handle({ cx, cy, len, thick, fill, ids, flat = false }: { cx: number; cy: number; len: number; thick: number; fill: string; ids: Ids; flat?: boolean }) {
  const rw = thick * 1.25, rh = thick * 2.3
  return <g>
    {flat
      ? <rect x={cx - rh / 2} y={cy - rw / 2} width={rh} height={rw} rx={rw / 2} fill={fill} stroke="#4d535a" strokeWidth={0.4} />
      : <rect x={cx - rw / 2} y={cy - rh / 2} width={rw} height={rh} rx={rw / 2} fill={fill} stroke="#4d535a" strokeWidth={0.4} />}
    {flat
      ? <rect x={cx - len / 2} y={cy - thick * 0.38} width={len} height={thick * 0.76} rx={thick * 0.38} fill={fill} stroke="#4d535a" strokeWidth={0.4} />
      : <rect x={cx - thick * 0.38} y={cy - rh * 0.15} width={thick * 0.76} height={len} rx={thick * 0.38} fill={fill} stroke="#4d535a" strokeWidth={0.4} />}
    {flat
      ? <rect x={cx - len / 2} y={cy - thick * 0.38} width={len} height={thick * 0.76} rx={thick * 0.38} fill={`url(#${ids.metal})`} />
      : <rect x={cx - thick * 0.38} y={cy - rh * 0.15} width={thick * 0.76} height={len} rx={thick * 0.38} fill={`url(#${ids.metal})`} />}
  </g>
}

export default function SpecDrawing({ spec, width, height, size = 220, frameColor = '#fbfbfa', showDims = false, onField, className, plain = false, slim = false, extras, photo = false }: {
  spec: WindowSpec; width: number; height: number; size?: number; frameColor?: string; showDims?: boolean; plain?: boolean; slim?: boolean
  /** product-photo look (picker cards): mitred profiles, neutral glass, handles, frame depth and a floor shadow */
  photo?: boolean
  onField?: (zone: Zone, index: number) => void; className?: string; extras?: DrawingExtras
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const ids: Ids = { glass: `sg${uid}`, shine: `ss${uid}`, prof: `sp${uid}`, metal: `sm${uid}` }
  const shadowId = `sd${uid}`
  const pids = photoIds(uid)
  const w = Math.max(300, width || 0), h = Math.max(300, height || 0)
  const scale = size / Math.max(w, h)
  // room for the soft shadow under the window
  const shadowOn = !slim && size >= 60
  const pad = showDims ? 26 : shadowOn ? 6 : 2
  const W = w * scale, H = h * scale
  // photo: seen straight from the front, standing on a soft shadow
  const depth = 0
  const floor = photo ? 7 : 0
  // slim: thin, true-to-scale profiles for small list pictures, which would otherwise look heavy
  const frame = slim ? Math.max(2.5, Math.min(11, 45 * scale)) : Math.max(5, Math.min(11, 70 * scale))
  const bar = frame * 0.9
  const ix = pad + frame, iy = pad + frame, iw = W - 2 * frame, ih = H - 2 * frame
  const topH = spec.top !== 'none' ? ih * spec.topRatio : 0
  const botH = spec.bottom !== 'none' ? ih * spec.bottomRatio : 0
  const mainY = iy + (topH ? topH + bar : 0)
  const mainH = ih - (topH ? topH + bar : 0) - (botH ? botH + bar : 0)

  // room for the shading box above and the sills below
  const shade = extras?.shade && extras.shade !== 'none' && !String(extras.shade).startsWith('screen') ? extras.shade : null
  // the kind decides the picture: roller shutter = big box and a closed curtain of lamellas,
  // external blinds = a slim head rail and tilted slats with light between them, pleated = folded fabric inside, no box
  const shadeKind: 'roller' | 'blinds' | 'pleated' | null = !shade ? null : shade === 'blinds' ? 'blinds' : shade === 'pleated' ? 'pleated' : 'roller'
  const boxH = shadeKind === 'roller' ? Math.max(10, H * 0.09) : shadeKind === 'blinds' ? Math.max(6, H * 0.05) : 0
  const shadeFill = extras?.shadeColor ?? '#f4f4f2'
  const sills = [extras?.sillOut, extras?.sillIn].filter((x): x is string => !!x && x !== 'none')
  const sillH = Math.max(5, H * 0.03)
  const below = sills.length ? sills.length * sillH + 2 : 0
  const handleFill = extras?.handle || '#e9eaec'
  const parts: React.ReactNode[] = []
  function row(zone: Zone, fields: Field[], y: number, rh: number) {
    const n = fields.length
    // a passive sash meets its neighbour without a mullion
    const slides = (f: Field) => f.opening === 'slide_window' || f.opening === 'slide'
    const mull = fields.slice(1).map((f, i) => !meetsWithoutMullion(fields[i], f) && !slides(f) && !slides(fields[i]))
    const free = iw - mull.filter(Boolean).length * bar
    const total = fields.reduce((a, f) => a + (f.weight ?? 1), 0)
    let x = ix
    fields.forEach((f, i) => {
      const fw = free * (f.weight ?? 1) / total
      parts.push(<FieldShape key={`${zone}${i}`} f={f} x={x} y={y} w={fw} h={rh} sashFrame={slim ? Math.max(1.5, frame * 0.6) : Math.max(3, frame * 0.75)} frameColor={frameColor} plain={plain} handleFill={handleFill} ids={ids} pids={photo ? pids : undefined}
        meetL={i > 0 && !mull[i - 1]} meetR={i < n - 1 && !mull[i]}
        onClick={onField ? () => onField(zone, i) : undefined} />)
      x += fw
      if (i < n - 1 && mull[i]) {
        parts.push(photo
          ? <Bar key={`${zone}m${i}`} x={x} y={y} w={bar} h={rh} color={frameColor} ids={pids} vertical />
          : <Prof key={`${zone}m${i}`} x={x} y={y} w={Math.max(0, bar)} h={Math.max(0, rh)} color={frameColor} ids={ids} rx={0} />)
        x += bar
      }
    })
  }
  if (topH) { row('top', spec.topFields, iy, topH); parts.push(photo ? <Bar key="tb" x={ix} y={iy + topH} w={iw} h={bar} color={frameColor} ids={pids} vertical={false} /> : <Prof key="tb" x={ix} y={iy + topH} w={Math.max(0, iw)} h={Math.max(0, bar)} color={frameColor} ids={ids} rx={0} />) }
  row('main', spec.main, mainY, mainH)
  if (botH) { parts.push(photo ? <Bar key="bb" x={ix} y={mainY + mainH} w={iw} h={bar} color={frameColor} ids={pids} vertical={false} /> : <Prof key="bb" x={ix} y={mainY + mainH} w={Math.max(0, iw)} h={Math.max(0, bar)} color={frameColor} ids={ids} rx={0} />); row('bottom', spec.bottomFields, mainY + mainH + bar, botH) }

  return (
    <svg className={className} width={W + pad * 2 + depth} height={H + pad * 2 + boxH + below + floor} viewBox={`0 0 ${W + pad * 2 + depth} ${H + pad * 2 + boxH + below + floor}`} role="img" aria-label={`${width} × ${height} mm`}>
      <defs>
        <pattern id={`mesh${uid}`} width="3" height="3" patternUnits="userSpaceOnUse">
          <path d="M0 0H3M0 0V3" stroke="#5b6168" strokeWidth="0.35" fill="none" />
        </pattern>
        {/* glass: light sky at the top, deeper blue at the bottom */}
        <linearGradient id={ids.glass} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#eef5fa" />
          <stop offset="0.5" stopColor="#dfecf5" />
          <stop offset="1" stopColor="#d0e3f0" />
        </linearGradient>
        {/* two diagonal reflections over the glass */}
        <linearGradient id={ids.shine} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="0.22" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.36" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.56" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.66" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        {/* profiles: light from the top left, a little shade to the bottom right */}
        <linearGradient id={ids.prof} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.1" />
        </linearGradient>
        {/* metal of the handles */}
        <linearGradient id={ids.metal} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
        {photo && <PhotoDefs ids={pids} />}
        <filter id={shadowId} x="-15%" y="-15%" width="130%" height="135%">
          <feDropShadow dx="0" dy={Math.max(1, size * 0.012)} stdDeviation={Math.max(1, size * 0.016)} floodColor="#1b2430" floodOpacity="0.2" />
        </filter>
      </defs>
      {/* shading: the box over the window */}
      {boxH > 0 && <Prof x={pad - 2} y={pad} w={Math.max(0, W + 4)} h={Math.max(0, boxH)} rx={shadeKind === 'roller' ? 1.5 : 0.8} color={shadeFill} ids={ids} sw={0.9} />}
      <g transform={`translate(0 ${boxH})`}>
      {/* the frame, with its soft shadow */}
      {photo ? <g>
        {/* soft shadow on the floor */}
        <ellipse cx={pad + W / 2 + depth / 2} cy={pad + H + 1.5} rx={W * 0.48} ry={2.4} fill="#1b2430" opacity={0.16} filter={`url(#${pids.floor})`} />
        <rect x={pad} y={pad} width={Math.max(0, W)} height={Math.max(0, H)} fill={frameColor} />
        <Profile x={pad} y={pad} w={W} h={H} t={frame} color={frameColor} />
      </g> : <>
      {shadowOn && <rect x={pad} y={pad} width={Math.max(0, W)} height={Math.max(0, H)} rx={1.5} fill={frameColor} filter={`url(#${shadowId})`} />}
      <Prof x={pad} y={pad} w={Math.max(0, W)} h={Math.max(0, H)} rx={1.5} color={frameColor} ids={ids} sw={1} />
      </>}
      {/* the gap between frame and sashes */}
      <rect x={ix} y={iy} width={Math.max(0, iw)} height={Math.max(0, ih)} fill={frameColor} />
      <rect x={ix} y={iy} width={Math.max(0, iw)} height={Math.max(0, ih)} fill="#1b2430" fillOpacity={0.22} stroke={EDGE} strokeWidth={0.6} />
      {parts}
      {/* shading lowered a little, so you see it is there */}
      {shadeKind === 'roller' && (() => {
        // roller shutter: a closed curtain of rounded lamellas, an end bar, wide guide rails
        const ch = ih * 0.3, step = 3.6
        return <g>
          <rect x={ix} y={iy} width={Math.max(0, iw)} height={Math.max(0, ch)} fill={shadeFill} />
          {Array.from({ length: Math.max(2, Math.floor(ch / step)) }, (_, i) => <g key={i}>
            <rect x={ix} y={iy + i * step} width={Math.max(0, iw)} height={1.1} fill="#fff" fillOpacity={0.45} />
            <line x1={ix} x2={ix + iw} y1={iy + (i + 1) * step - 0.3} y2={iy + (i + 1) * step - 0.3} stroke="#000" strokeOpacity={0.22} strokeWidth={0.6} />
          </g>)}
          <rect x={ix} y={iy + ch - 2.6} width={Math.max(0, iw)} height={2.6} fill={shadeFill} stroke="#000" strokeOpacity={0.35} strokeWidth={0.5} />
          <rect x={ix - 1.5} y={iy} width={3.2} height={Math.max(0, ih)} fill={shadeFill} stroke="#000" strokeOpacity={0.3} strokeWidth={0.5} />
          <rect x={ix + iw - 1.7} y={iy} width={3.2} height={Math.max(0, ih)} fill={shadeFill} stroke="#000" strokeOpacity={0.3} strokeWidth={0.5} />
        </g>
      })()}
      {shadeKind === 'blinds' && (() => {
        // external venetian blinds: separate tilted slats with light between them, ladder tapes, thin guide wires
        const ch = ih * 0.45, step = 4.6
        const n = Math.max(3, Math.floor(ch / step))
        return <g>
          {Array.from({ length: n }, (_, i) => {
            const y0 = iy + i * step
            return <g key={i}>
              <polygon points={`${ix},${y0 + 0.6} ${ix + iw},${y0 + 0.6} ${ix + iw},${y0 + 3.4} ${ix},${y0 + 3.4}`} fill={shadeFill} />
              <rect x={ix} y={y0 + 0.6} width={Math.max(0, iw)} height={1} fill="#fff" fillOpacity={0.55} />
              <rect x={ix} y={y0 + 2.6} width={Math.max(0, iw)} height={0.8} fill="#000" fillOpacity={0.2} />
              <line x1={ix} x2={ix + iw} y1={y0 + 3.4} y2={y0 + 3.4} stroke="#000" strokeOpacity={0.3} strokeWidth={0.4} />
            </g>
          })}
          {/* the slat that closes the blind at the bottom */}
          <rect x={ix} y={iy + n * step} width={Math.max(0, iw)} height={2.4} fill={shadeFill} stroke="#000" strokeOpacity={0.35} strokeWidth={0.5} />
          {[0.25, 0.75].map(f => <line key={f} x1={ix + iw * f} x2={ix + iw * f} y1={iy} y2={iy + n * step} stroke="#4b5158" strokeOpacity={0.55} strokeWidth={0.6} />)}
          <line x1={ix + 1} x2={ix + 1} y1={iy} y2={iy + ih} stroke="#6b7178" strokeWidth={0.9} />
          <line x1={ix + iw - 1} x2={ix + iw - 1} y1={iy} y2={iy + ih} stroke="#6b7178" strokeWidth={0.9} />
        </g>
      })()}
      {shadeKind === 'pleated' && (() => {
        // pleated blind inside: folded fabric between a top and a bottom rail, no box and no guides
        const ch = ih * 0.38, step = 2.6, top = iy + 2
        return <g>
          <rect x={ix + 1} y={iy} width={Math.max(0, iw - 2)} height={2.2} fill="#9aa0a6" />
          {Array.from({ length: Math.max(3, Math.floor(ch / step)) }, (_, i) => <g key={i}>
            <rect x={ix + 1} y={top + i * step} width={Math.max(0, iw - 2)} height={step} fill={shadeFill} />
            <rect x={ix + 1} y={top + i * step + step / 2} width={Math.max(0, iw - 2)} height={step / 2} fill="#000" fillOpacity={0.1} />
          </g>)}
          <rect x={ix + 1} y={top + Math.max(3, Math.floor(ch / step)) * step} width={Math.max(0, iw - 2)} height={2.2} fill="#9aa0a6" />
        </g>
      })()}
      {/* insect screen: a mesh over the glass */}
      {extras?.screen && <rect x={ix} y={iy} width={Math.max(0, iw)} height={Math.max(0, ih)} fill={`url(#mesh${uid})`} opacity={0.45} />}
      {/* sills under the window: outside first, then inside */}
      {sills.map((m, i) => <Prof key={i} x={pad - 5} y={pad + H + 1 + i * sillH} w={Math.max(0, W + 10)} h={sillH - (i ? 1 : 0)} rx={1}
        color={SILL_HEX[m] ?? '#c3c6c8'} ids={ids} />)}
      </g>
      {showDims && <g fontSize={11} fill="#8ea9c0" fontFamily="Inter, system-ui, sans-serif">
        {/* the width stays over everything (also over a shading box), the height goes down with the window */}
        <line x1={pad} y1={pad - 12} x2={pad + W} y2={pad - 12} stroke="#a3a3a3" />
        <text x={pad + W / 2} y={pad - 16} textAnchor="middle">{width || '—'}</text>
        <g transform={`translate(0 ${boxH})`}>
          <line x1={pad - 12} y1={pad} x2={pad - 12} y2={pad + H} stroke="#a3a3a3" />
          <text x={pad - 16} y={pad + H / 2} textAnchor="middle" transform={`rotate(-90 ${pad - 16} ${pad + H / 2})`}>{height || '—'}</text>
        </g>
      </g>}
    </svg>
  )
}

const gyOf = (y: number, sashFrame: number) => y + 1.5 + sashFrame

function FieldShape({ f, x, y, w, h, sashFrame, frameColor, onClick, plain, meetL = false, meetR = false, handleFill, ids, pids }: { f: Field; x: number; y: number; w: number; h: number; sashFrame: number; frameColor: string; onClick?: () => void; plain?: boolean; meetL?: boolean; meetR?: boolean; handleFill: string; ids: Ids; pids?: PhotoIds }) {
  // photo: the handles are part of the picture even without the opening symbols
  const handles = !plain || !!pids
  const G = (r: { x: number; y: number; w: number; h: number }) => pids ? <PhotoGlass {...r} ids={pids} /> : <Glass {...r} ids={ids} />
  const clickable = onClick ? { onClick, style: { cursor: 'pointer' } } : {}
  const hover = onClick ? <rect x={x} y={y} width={Math.max(0, w)} height={Math.max(0, h)} fill="#131313" opacity={0} className="hover:opacity-10 transition-opacity" /> : null
  // the opening symbol: thin and soft, it should not cover the glass
  const line = { stroke: '#4f5d6a', strokeOpacity: 0.55, strokeWidth: 0.8, fill: 'none' }
  if (f.opening === 'fixed') {
    // glass in the frame behind a glazing bead; a small cross marks "fixed", like on the competitors' drawings
    const bead = Math.max(1.5, sashFrame * 0.45)
    const c = Math.min(w, h) * 0.12
    return <g {...clickable}>
      {pids
        ? <><rect x={x} y={y} width={Math.max(0, w)} height={Math.max(0, h)} fill={frameColor} /><Ring x={x} y={y} w={w} h={h} t={bead * 1.3} color={frameColor} sunk /></>
        : <Prof x={x + 0.5} y={y + 0.5} w={Math.max(0, w - 1)} h={Math.max(0, h - 1)} color={frameColor} ids={ids} rx={0} sw={0.5} />}
      {pids
        ? G({ x: x + bead * 1.3, y: y + bead * 1.3, w: Math.max(0, w - 2.6 * bead), h: Math.max(0, h - 2.6 * bead) })
        : G({ x: x + 0.5 + bead, y: y + 0.5 + bead, w: Math.max(0, w - 1 - 2 * bead), h: Math.max(0, h - 1 - 2 * bead) })}
      {!plain && <g {...line} strokeOpacity={0.45}><line x1={x + w / 2 - c} y1={y + h / 2} x2={x + w / 2 + c} y2={y + h / 2} /><line x1={x + w / 2} y1={y + h / 2 - c} x2={x + w / 2} y2={y + h / 2 + c} /></g>}
      {hover}
    </g>
  }
  const inset = 1.5
  // two sashes without a mullion meet: no gap between them, the sash profiles keep their width
  const il = meetL ? 0 : inset, ir = meetR ? 0 : inset
  const fl = sashFrame, fr = sashFrame
  const sx = x + il, sy = y + inset, sw = w - il - ir, sh = h - 2 * inset
  const gx = sx + fl, gy = sy + sashFrame, gw = Math.max(0, sw - fl - fr), gh = Math.max(0, sh - 2 * sashFrame)
  const slide = f.opening === 'slide_window' || f.opening === 'slide'
  const thick = Math.max(2.4, sashFrame * 0.55), len = Math.max(7, Math.min(22, sh * 0.11))
  if (slide) {
    // sliding sash: arrow towards the side it slides to, a long pull handle on the side it opens from
    const dir = f.hinge === 'right' ? 1 : -1, cy = gyOf(y, sashFrame) + (h - 2 * sashFrame - 3) / 2, cx = x + w / 2, alen = w * 0.22
    const px = x + 1.5, pw = Math.max(0, w - 3)
    const gx2 = px + sashFrame, gy2 = y + 1.5 + sashFrame, gw2 = Math.max(0, w - 3 - 2 * sashFrame), gh2 = Math.max(0, h - 3 - 2 * sashFrame)
    return <g {...clickable}>
      {pids ? <Profile x={px} y={y + 1.5} w={pw} h={Math.max(0, h - 3)} t={sashFrame} color={frameColor} /> : <Prof x={px} y={y + 1.5} w={pw} h={Math.max(0, h - 3)} color={frameColor} ids={ids} rx={0} />}
      {G({ x: gx2, y: gy2, w: gw2, h: gh2 })}
      {!plain && f.opening === 'slide' && <polyline points={`${gx2},${gy2 + gh2} ${gx2 + gw2 / 2},${gy2} ${gx2 + gw2},${gy2 + gh2}`} {...line} />}
      {!plain && <g {...line} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round">
        <line x1={cx - dir * alen} y1={cy} x2={cx + dir * alen} y2={cy} />
        <polyline points={`${cx + dir * (alen - 5)},${cy - 4} ${cx + dir * alen},${cy} ${cx + dir * (alen - 5)},${cy + 4}`} />
      </g>}
      {/* the handle on the side the sash is pulled from */}
      {handles && <Handle cx={dir > 0 ? px + sashFrame / 2 : px + pw - sashFrame / 2} cy={y + h / 2 - len / 2} len={len * 1.4} thick={thick} fill={handleFill} ids={ids} />}
      {hover}
    </g>
  }
  const turn = f.opening === 'turn' || f.opening === 'tilt_turn' || f.opening === 'passive'
  const tilt = f.opening === 'tilt' || f.opening === 'tilt_turn'
  const right = f.hinge === 'right'
  return <g {...clickable}>
    {pids ? <Profile x={sx} y={sy} w={sw} h={sh} t={sashFrame} color={frameColor} /> : <Prof x={sx} y={sy} w={Math.max(0, sw)} h={Math.max(0, sh)} color={frameColor} ids={ids} rx={0.6} />}
    {G({ x: gx, y: gy, w: gw, h: gh })}
    {!plain && turn && <polyline points={`${right ? gx : gx + gw},${gy} ${right ? gx + gw : gx},${gy + gh / 2} ${right ? gx : gx + gw},${gy + gh}`} {...line} />}
    {!plain && tilt && <polyline points={`${gx},${gy + gh} ${gx + gw / 2},${gy} ${gx + gw},${gy + gh}`} {...line} />}
    {/* the handle sits on the side that opens (on top for a tilt-only sash); a passive sash has none */}
    {!handles || f.opening === 'passive' ? null : f.opening === 'tilt'
      ? <Handle cx={sx + sw / 2} cy={sy + sashFrame / 2} len={len} thick={thick} fill={handleFill} ids={ids} flat />
      : <Handle cx={right ? sx + fl / 2 : sx + sw - fr / 2} cy={sy + sh / 2 - len * 0.35} len={len} thick={thick} fill={handleFill} ids={ids} />}
    {hover}
  </g>
}
