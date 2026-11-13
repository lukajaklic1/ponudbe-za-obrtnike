import type { Field, WindowSpec } from '../lib/costing'

type Zone = 'main' | 'top' | 'bottom'

/**
 * Window drawn from sashes: frame, mullions, top light / bottom panel and the opening
 * symbol of every field (viewed from inside: the triangle's apex points to the hinge side,
 * tilt = apex at the bottom). Fields can be clicked when `onField` is given.
 */
export default function SpecDrawing({ spec, width, height, size = 220, frameColor = '#f8fafc', showDims = false, onField, className, plain = false }: {
  spec: WindowSpec; width: number; height: number; size?: number; frameColor?: string; showDims?: boolean; plain?: boolean
  onField?: (zone: Zone, index: number) => void; className?: string
}) {
  const w = Math.max(300, width || 0), h = Math.max(300, height || 0)
  const scale = size / Math.max(w, h)
  const pad = showDims ? 26 : 2
  const W = w * scale, H = h * scale
  const frame = Math.max(5, Math.min(11, 70 * scale))
  const bar = frame * 0.9
  const ix = pad + frame, iy = pad + frame, iw = W - 2 * frame, ih = H - 2 * frame
  const topH = spec.top !== 'none' ? ih * spec.topRatio : 0
  const botH = spec.bottom !== 'none' ? ih * spec.bottomRatio : 0
  const mainY = iy + (topH ? topH + bar : 0)
  const mainH = ih - (topH ? topH + bar : 0) - (botH ? botH + bar : 0)

  const parts: React.ReactNode[] = []
  function row(zone: Zone, fields: Field[], y: number, rh: number) {
    const n = fields.length
    // a passive sash meets its neighbour without a mullion
    const slides = (f: Field) => f.opening === 'slide_window' || f.opening === 'slide'
    const mull = fields.slice(1).map((f, i) => f.opening !== 'passive' && fields[i].opening !== 'passive' && !slides(f) && !slides(fields[i]))
    const fw = (iw - mull.filter(Boolean).length * bar) / n
    let x = ix
    fields.forEach((f, i) => {
      parts.push(<FieldShape key={`${zone}${i}`} f={f} x={x} y={y} w={fw} h={rh} sashFrame={Math.max(3, frame * 0.75)} frameColor={frameColor} plain={plain}
        onClick={onField ? () => onField(zone, i) : undefined} />)
      x += fw
      if (i < n - 1 && mull[i]) { parts.push(<rect key={`${zone}m${i}`} x={x} y={y} width={bar} height={rh} fill={frameColor} stroke="#334155" strokeWidth={0.8} />); x += bar }
    })
  }
  if (topH) { row('top', spec.topFields, iy, topH); parts.push(<rect key="tb" x={ix} y={iy + topH} width={iw} height={bar} fill={frameColor} stroke="#334155" strokeWidth={0.8} />) }
  row('main', spec.main, mainY, mainH)
  if (botH) { parts.push(<rect key="bb" x={ix} y={mainY + mainH} width={iw} height={bar} fill={frameColor} stroke="#334155" strokeWidth={0.8} />); row('bottom', spec.bottomFields, mainY + mainH + bar, botH) }

  return (
    <svg className={className} width={W + pad * 2} height={H + pad * 2} viewBox={`0 0 ${W + pad * 2} ${H + pad * 2}`} role="img" aria-label={`${width} × ${height} mm`}>
      <rect x={pad} y={pad} width={W} height={H} rx={1.5} fill={frameColor} stroke="#334155" strokeWidth={1.2} />
      <rect x={ix} y={iy} width={iw} height={ih} fill="#dbeafe" stroke="#334155" strokeWidth={0.8} />
      {parts}
      {showDims && <g fontSize={11} fill="#64748b" fontFamily="Inter, system-ui, sans-serif">
        <line x1={pad} y1={pad - 12} x2={pad + W} y2={pad - 12} stroke="#94a3b8" />
        <text x={pad + W / 2} y={pad - 16} textAnchor="middle">{width || '—'}</text>
        <line x1={pad - 12} y1={pad} x2={pad - 12} y2={pad + H} stroke="#94a3b8" />
        <text x={pad - 16} y={pad + H / 2} textAnchor="middle" transform={`rotate(-90 ${pad - 16} ${pad + H / 2})`}>{height || '—'}</text>
      </g>}
    </svg>
  )
}

const gyOf = (y: number, sashFrame: number) => y + 1.5 + sashFrame

function FieldShape({ f, x, y, w, h, sashFrame, frameColor, onClick, plain }: { f: Field; x: number; y: number; w: number; h: number; sashFrame: number; frameColor: string; onClick?: () => void; plain?: boolean }) {
  const clickable = onClick ? { onClick, style: { cursor: 'pointer' } } : {}
  const hover = onClick ? <rect x={x} y={y} width={w} height={h} fill="#2563eb" opacity={0} className="hover:opacity-10 transition-opacity" /> : null
  if (f.opening === 'fixed') {
    // glass in the frame: a small cross marks "fixed", like on the competitors' drawings
    const c = Math.min(w, h) * 0.12
    return <g {...clickable}>
      <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} fill="#dbeafe" stroke="#64748b" strokeWidth={0.5} />
      {!plain && <g stroke="#94a3b8" strokeWidth={0.8}><line x1={x + w / 2 - c} y1={y + h / 2} x2={x + w / 2 + c} y2={y + h / 2} /><line x1={x + w / 2} y1={y + h / 2 - c} x2={x + w / 2} y2={y + h / 2 + c} /></g>}
      {hover}
    </g>
  }
  const inset = 1.5
  const sx = x + inset, sy = y + inset, sw = w - 2 * inset, sh = h - 2 * inset
  const gx = sx + sashFrame, gy = sy + sashFrame, gw = sw - 2 * sashFrame, gh = sh - 2 * sashFrame
  const line = { stroke: '#475569', strokeWidth: 0.8, fill: 'none' }
  const slide = f.opening === 'slide_window' || f.opening === 'slide'
  if (slide) {
    // sliding sash: arrow towards the side it slides to
    const dir = f.hinge === 'right' ? 1 : -1, cy = gyOf(y, sashFrame) + (h - 2 * sashFrame - 3) / 2, cx = x + w / 2, len = w * 0.22
    return <g {...clickable}>
      <rect x={x + 1.5} y={y + 1.5} width={w - 3} height={h - 3} fill={frameColor} stroke="#334155" strokeWidth={0.8} />
      <rect x={x + 1.5 + sashFrame} y={y + 1.5 + sashFrame} width={w - 3 - 2 * sashFrame} height={h - 3 - 2 * sashFrame} fill="#dbeafe" stroke="#334155" strokeWidth={0.6} />
      {!plain && <g stroke="#475569" strokeWidth={1.1} fill="none" strokeLinecap="round" strokeLinejoin="round">
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
    <rect x={sx} y={sy} width={sw} height={sh} fill={frameColor} stroke="#334155" strokeWidth={0.8} />
    <rect x={gx} y={gy} width={gw} height={gh} fill="#dbeafe" stroke="#334155" strokeWidth={0.6} />
    {!plain && turn && <polyline points={`${right ? gx : gx + gw},${gy} ${right ? gx + gw : gx},${gy + gh / 2} ${right ? gx : gx + gw},${gy + gh}`} {...line} />}
    {!plain && tilt && <polyline points={`${gx},${gy} ${gx + gw / 2},${gy + gh} ${gx + gw},${gy}`} {...line} />}
    {plain || f.opening === 'passive' ? null : f.opening === 'tilt'
      ? <rect x={sx + sw / 2 - hh / 2} y={sy + sashFrame / 2 - hw / 2} width={hh} height={hw} rx={1} fill="#334155" />
      : <rect x={right ? sx + sashFrame / 2 - hw / 2 : sx + sw - sashFrame / 2 - hw / 2} y={sy + sh / 2 - hh / 2} width={hw} height={hh} rx={1} fill="#334155" />}
    {hover}
  </g>
}
