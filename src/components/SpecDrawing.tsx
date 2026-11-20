import { meetsWithoutMullion, type Field, type WindowSpec } from '../lib/costing'

type Zone = 'main' | 'top' | 'bottom'

/**
 * Window drawn from sashes: frame, mullions, top light / bottom panel and the opening
 * symbol of every field (viewed from inside: the triangle's apex points to the hinge side,
 * tilt = apex at the bottom). Fields can be clicked when `onField` is given.
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

export default function SpecDrawing({ spec, width, height, size = 220, frameColor = '#fbfbfa', showDims = false, onField, className, plain = false, slim = false, extras }: {
  spec: WindowSpec; width: number; height: number; size?: number; frameColor?: string; showDims?: boolean; plain?: boolean; slim?: boolean
  onField?: (zone: Zone, index: number) => void; className?: string; extras?: DrawingExtras
}) {
  const w = Math.max(300, width || 0), h = Math.max(300, height || 0)
  const scale = size / Math.max(w, h)
  const pad = showDims ? 26 : 2
  const W = w * scale, H = h * scale
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
  const boxH = shade ? Math.max(10, H * 0.09) : 0
  const sills = [extras?.sillOut, extras?.sillIn].filter((x): x is string => !!x && x !== 'none')
  const sillH = Math.max(5, H * 0.03)
  const below = sills.length ? sills.length * sillH + 2 : 0
  const handleFill = extras?.handle || '#5b6168'
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
      parts.push(<FieldShape key={`${zone}${i}`} f={f} x={x} y={y} w={fw} h={rh} sashFrame={slim ? Math.max(1.5, frame * 0.6) : Math.max(3, frame * 0.75)} frameColor={frameColor} plain={plain} handleFill={handleFill}
        meetL={i > 0 && !mull[i - 1]} meetR={i < n - 1 && !mull[i]}
        onClick={onField ? () => onField(zone, i) : undefined} />)
      x += fw
      if (i < n - 1 && mull[i]) { parts.push(<rect key={`${zone}m${i}`} x={x} y={y} width={Math.max(0, bar)} height={Math.max(0, rh)} fill={frameColor} stroke="#5b6168" strokeWidth={0.8} />); x += bar }
    })
  }
  if (topH) { row('top', spec.topFields, iy, topH); parts.push(<rect key="tb" x={ix} y={iy + topH} width={Math.max(0, iw)} height={Math.max(0, bar)} fill={frameColor} stroke="#5b6168" strokeWidth={0.8} />) }
  row('main', spec.main, mainY, mainH)
  if (botH) { parts.push(<rect key="bb" x={ix} y={mainY + mainH} width={Math.max(0, iw)} height={Math.max(0, bar)} fill={frameColor} stroke="#5b6168" strokeWidth={0.8} />); row('bottom', spec.bottomFields, mainY + mainH + bar, botH) }

  return (
    <svg className={className} width={W + pad * 2} height={H + pad * 2 + boxH + below} viewBox={`0 0 ${W + pad * 2} ${H + pad * 2 + boxH + below}`} role="img" aria-label={`${width} × ${height} mm`}>
      <defs>
        <pattern id="spec-mesh" width="3" height="3" patternUnits="userSpaceOnUse">
          <path d="M0 0H3M0 0V3" stroke="#5b6168" strokeWidth="0.35" fill="none" />
        </pattern>
      </defs>
      {/* shading: the box over the window */}
      {shade && <rect x={pad - 2} y={pad} width={Math.max(0, W + 4)} height={Math.max(0, boxH)} rx={1.5} fill={extras?.shadeColor ?? frameColor} stroke="#5b6168" strokeWidth={1} />}
      <g transform={`translate(0 ${boxH})`}>
      <rect x={pad} y={pad} width={Math.max(0, W)} height={Math.max(0, H)} rx={1.5} fill={frameColor} stroke="#5b6168" strokeWidth={1.2} />
      <rect x={ix} y={iy} width={Math.max(0, iw)} height={Math.max(0, ih)} fill="#cfe3f3" stroke="#5b6168" strokeWidth={0.8} />
      {parts}
      {/* shading lowered a little, so you see it is there */}
      {shade && <g>
        <rect x={ix} y={iy} width={Math.max(0, iw)} height={Math.max(0, ih * 0.22)} fill={extras?.shadeColor ?? frameColor} opacity={0.95} />
        {Array.from({ length: Math.max(2, Math.round(ih * 0.22 / 4)) }, (_, i) => <line key={i} x1={ix} x2={ix + iw} y1={iy + i * 4 + 4} y2={iy + i * 4 + 4} stroke="#8d9297" strokeWidth={0.5} />)}
        <rect x={ix - 1} y={iy} width={2.5} height={Math.max(0, ih)} fill="#8d9297" />
        <rect x={ix + iw - 1.5} y={iy} width={2.5} height={Math.max(0, ih)} fill="#8d9297" />
      </g>}
      {/* insect screen: a mesh over the glass */}
      {extras?.screen && <rect x={ix} y={iy} width={Math.max(0, iw)} height={Math.max(0, ih)} fill="url(#spec-mesh)" opacity={0.45} />}
      {/* sills under the window: outside first, then inside */}
      {sills.map((m, i) => <rect key={i} x={pad - 5} y={pad + H + 1 + i * sillH} width={Math.max(0, W + 10)} height={sillH - (i ? 1 : 0)} rx={1}
        fill={SILL_HEX[m] ?? '#c3c6c8'} stroke="#5b6168" strokeWidth={0.7} />)}
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

function FieldShape({ f, x, y, w, h, sashFrame, frameColor, onClick, plain, meetL = false, meetR = false, handleFill = '#5b6168' }: { f: Field; x: number; y: number; w: number; h: number; sashFrame: number; frameColor: string; onClick?: () => void; plain?: boolean; meetL?: boolean; meetR?: boolean; handleFill?: string }) {
  const clickable = onClick ? { onClick, style: { cursor: 'pointer' } } : {}
  const hover = onClick ? <rect x={x} y={y} width={Math.max(0, w)} height={Math.max(0, h)} fill="#131313" opacity={0} className="hover:opacity-10 transition-opacity" /> : null
  if (f.opening === 'fixed') {
    // glass in the frame: a small cross marks "fixed", like on the competitors' drawings
    const c = Math.min(w, h) * 0.12
    return <g {...clickable}>
      <rect x={x + 1} y={y + 1} width={Math.max(0, w - 2)} height={Math.max(0, h - 2)} fill="#cfe3f3" stroke="#8ea9c0" strokeWidth={0.5} />
      {!plain && <g stroke="#a3a3a3" strokeWidth={0.8}><line x1={x + w / 2 - c} y1={y + h / 2} x2={x + w / 2 + c} y2={y + h / 2} /><line x1={x + w / 2} y1={y + h / 2 - c} x2={x + w / 2} y2={y + h / 2 + c} /></g>}
      {hover}
    </g>
  }
  const inset = 1.5
  // two sashes without a mullion meet: no gap between them, the sash profiles keep their width
  const il = meetL ? 0 : inset, ir = meetR ? 0 : inset
  const fl = sashFrame, fr = sashFrame
  const sx = x + il, sy = y + inset, sw = w - il - ir, sh = h - 2 * inset
  const gx = sx + fl, gy = sy + sashFrame, gw = Math.max(0, sw - fl - fr), gh = Math.max(0, sh - 2 * sashFrame)
  const line = { stroke: '#7c7f82', strokeWidth: 0.8, fill: 'none' }
  const slide = f.opening === 'slide_window' || f.opening === 'slide'
  if (slide) {
    // sliding sash: arrow towards the side it slides to
    const dir = f.hinge === 'right' ? 1 : -1, cy = gyOf(y, sashFrame) + (h - 2 * sashFrame - 3) / 2, cx = x + w / 2, len = w * 0.22
    return <g {...clickable}>
      <rect x={x + 1.5} y={y + 1.5} width={Math.max(0, w - 3)} height={Math.max(0, h - 3)} fill={frameColor} stroke="#5b6168" strokeWidth={0.8} />
      <rect x={x + 1.5 + sashFrame} y={y + 1.5 + sashFrame} width={Math.max(0, w - 3 - 2 * sashFrame)} height={Math.max(0, h - 3 - 2 * sashFrame)} fill="#cfe3f3" stroke="#5b6168" strokeWidth={0.6} />
      {!plain && f.opening === 'slide' && (() => {
        // parallel slide & tilt (PSK): the panel tilts too
        const gx = x + 1.5 + sashFrame, gy = y + 1.5 + sashFrame, gw = Math.max(0, w - 3 - 2 * sashFrame), gh = Math.max(0, h - 3 - 2 * sashFrame)
        return <polyline points={`${gx},${gy + gh} ${gx + gw / 2},${gy} ${gx + gw},${gy + gh}`} stroke="#7c7f82" strokeWidth={0.8} fill="none" />
      })()}
      {!plain && <g stroke="#7c7f82" strokeWidth={1.1} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <line x1={cx - dir * len} y1={cy} x2={cx + dir * len} y2={cy} />
        <polyline points={`${cx + dir * (len - 5)},${cy - 4} ${cx + dir * len},${cy} ${cx + dir * (len - 5)},${cy + 4}`} />
      </g>}
      {hover}
    </g>
  }
  const turn = f.opening === 'turn' || f.opening === 'tilt_turn' || f.opening === 'passive'
  const tilt = f.opening === 'tilt' || f.opening === 'tilt_turn'
  const right = f.hinge === 'right'
  const hw = Math.max(2.5, sashFrame * 0.55), hh = Math.max(8, Math.min(22, sh * 0.12))
  return <g {...clickable}>
    <rect x={sx} y={sy} width={Math.max(0, sw)} height={Math.max(0, sh)} fill={frameColor} stroke="#5b6168" strokeWidth={0.8} />
    <rect x={gx} y={gy} width={Math.max(0, gw)} height={Math.max(0, gh)} fill="#cfe3f3" stroke="#5b6168" strokeWidth={0.6} />
    {!plain && turn && <polyline points={`${right ? gx : gx + gw},${gy} ${right ? gx + gw : gx},${gy + gh / 2} ${right ? gx : gx + gw},${gy + gh}`} {...line} />}
    {!plain && tilt && <polyline points={`${gx},${gy + gh} ${gx + gw / 2},${gy} ${gx + gw},${gy + gh}`} {...line} />}
    {plain || f.opening === 'passive' ? null : f.opening === 'tilt'
      ? <rect x={sx + sw / 2 - hh / 2} y={sy + sashFrame / 2 - hw / 2} width={Math.max(0, hh)} height={Math.max(0, hw)} rx={1} fill={handleFill} stroke="#5b6168" strokeWidth={0.4} />
      : <rect x={right ? sx + fl / 2 - hw / 2 : sx + sw - fr / 2 - hw / 2} y={sy + sh / 2 - hh / 2} width={Math.max(0, hw)} height={Math.max(0, hh)} rx={1} fill={handleFill} stroke="#5b6168" strokeWidth={0.4} />}
    {hover}
  </g>
}
