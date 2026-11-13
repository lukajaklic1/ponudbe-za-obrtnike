import { sashesFor, transomFor, type Hinge, type Sash, type WindowTemplate } from '../lib/windows'

interface Props {
  template: WindowTemplate
  width: number   // mm
  height: number  // mm
  hinge?: Hinge
  /** Max drawing size in px (the longer side). */
  size?: number
  showDims?: boolean
  frameColor?: string
  className?: string
  /** only the shape: no opening symbols, no handles */
  plain?: boolean
}

/**
 * Schematic window drawing, viewed from the inside.
 * Opening symbols: the triangle's apex points to the hinge side
 * (turn → apex on the side, tilt → apex at the bottom).
 */
export default function WindowDrawing({ template, width, height, hinge = 'left', size = 240, showDims = false, frameColor = '#f8fafc', className, plain = false }: Props) {
  const w = Math.max(200, width || 0)
  const h = Math.max(200, height || 0)
  const scale = size / Math.max(w, h)
  const pad = showDims ? 26 : 2
  const W = w * scale
  const H = h * scale
  const frame = Math.max(5, Math.min(12, 70 * scale))
  const sashFrame = Math.max(3, Math.min(9, 55 * scale))
  const sashes = sashesFor(template, hinge)
  const transom = transomFor(template)

  const innerX = pad + frame
  const innerY = pad + frame
  const innerW = W - frame * 2
  const innerH = H - frame * 2

  // Optional fixed top light: its own row above the main sashes, separated by a transom bar
  const topH = transom ? Math.max(18, innerH * 0.26) : 0
  const mainY = transom ? innerY + topH + frame : innerY
  const mainH = transom ? innerH - topH - frame : innerH

  function row(list: Sash[], y: number, h: number, key: string) {
    const totalWeight = list.reduce((a, s) => a + s.weight, 0)
    let x = innerX
    return list.map((s, i) => {
      const sw = innerW * s.weight / totalWeight
      const el = <SashShape key={key + i} sash={s} x={x} y={y} w={sw} h={h} sashFrame={sashFrame} frameColor={frameColor} plain={plain} />
      const mullion = s.mullionAfter
        ? <rect key={`${key}m${i}`} x={x + sw - frame / 2} y={y} width={frame} height={h} fill={frameColor} stroke="#334155" strokeWidth={1} />
        : null
      x += sw
      return [el, mullion]
    })
  }
  const parts = [
    ...(transom ? row(transom, innerY, topH, 't') : []),
    transom ? <rect key="bar" x={innerX} y={innerY + topH} width={innerW} height={frame} fill={frameColor} stroke="#334155" strokeWidth={1} /> : null,
    ...row(sashes, mainY, mainH, 'm'),
  ]

  // Special shape: arched head, drawn as one fixed glazing
  if (template === 'special') {
    const ry = Math.min(W / 2, H * 0.45), iry = Math.max(4, ry - frame)
    const outer = `M ${pad} ${pad + H} L ${pad} ${pad + ry} A ${W / 2} ${ry} 0 0 1 ${pad + W} ${pad + ry} L ${pad + W} ${pad + H} Z`
    const inner = `M ${innerX} ${pad + H - frame} L ${innerX} ${pad + ry} A ${innerW / 2} ${iry} 0 0 1 ${innerX + innerW} ${pad + ry} L ${innerX + innerW} ${pad + H - frame} Z`
    return (
      <svg className={className} width={W + pad * 2} height={H + pad * 2} viewBox={`0 0 ${W + pad * 2} ${H + pad * 2}`} role="img" aria-label={`${width} × ${height} mm`}>
        <path d={outer} fill={frameColor} stroke="#334155" strokeWidth={1.25} />
        <path d={inner} fill="#dbeafe" stroke="#334155" strokeWidth={1} />
        <path d={`M ${innerX + innerW * 0.25} ${pad + H * 0.55} l ${innerW * 0.12} ${-H * 0.08}`} stroke="#ffffff" strokeWidth={2} opacity={0.8} />
      </svg>
    )
  }

  return (
    <svg
      className={className}
      width={W + pad * 2}
      height={H + pad * 2}
      viewBox={`0 0 ${W + pad * 2} ${H + pad * 2}`}
      role="img"
      aria-label={`${width} × ${height} mm`}
    >
      <rect x={pad} y={pad} width={W} height={H} rx={1.5} fill={frameColor} stroke="#334155" strokeWidth={1.25} />
      <rect x={innerX} y={innerY} width={innerW} height={innerH} fill="#dbeafe" stroke="#334155" strokeWidth={1} />
      {parts}
      {showDims && (
        <g fontSize={11} fill="#64748b" fontFamily="Inter, system-ui, sans-serif">
          <line x1={pad} y1={pad - 12} x2={pad + W} y2={pad - 12} stroke="#94a3b8" strokeWidth={1} />
          <line x1={pad} y1={pad - 16} x2={pad} y2={pad - 8} stroke="#94a3b8" />
          <line x1={pad + W} y1={pad - 16} x2={pad + W} y2={pad - 8} stroke="#94a3b8" />
          <text x={pad + W / 2} y={pad - 16} textAnchor="middle">{width || '—'}</text>
          <line x1={pad - 12} y1={pad} x2={pad - 12} y2={pad + H} stroke="#94a3b8" strokeWidth={1} />
          <line x1={pad - 16} y1={pad} x2={pad - 8} y2={pad} stroke="#94a3b8" />
          <line x1={pad - 16} y1={pad + H} x2={pad - 8} y2={pad + H} stroke="#94a3b8" />
          <text x={pad - 16} y={pad + H / 2} textAnchor="middle" transform={`rotate(-90 ${pad - 16} ${pad + H / 2})`}>{height || '—'}</text>
        </g>
      )}
    </svg>
  )
}

function SashShape({ sash, x, y, w, h, sashFrame, frameColor, plain }: { sash: Sash; x: number; y: number; w: number; h: number; sashFrame: number; frameColor: string; plain?: boolean }) {
  const inset = 2
  const sx = x + inset, sy = y + inset, sw = w - inset * 2, sh = h - inset * 2
  const gx = sx + sashFrame, gy = sy + sashFrame, gw = Math.max(0, sw - sashFrame * 2), gh = Math.max(0, sh - sashFrame * 2)
  const line = { stroke: '#475569', strokeWidth: 0.9, strokeDasharray: '4 3', fill: 'none' }
  const symbols: React.ReactNode[] = []

  const turn = sash.kind === 'turn' || sash.kind === 'tilt_turn'
  const tilt = sash.kind === 'tilt' || sash.kind === 'tilt_turn' || sash.kind === 'slide_tilt'
  if (turn) {
    // apex on the hinge side, mid-height
    const apexX = sash.hinge === 'right' ? gx + gw : gx
    const baseX = sash.hinge === 'right' ? gx : gx + gw
    symbols.push(<polyline key="t" points={`${baseX},${gy} ${apexX},${gy + gh / 2} ${baseX},${gy + gh}`} {...line} />)
  }
  if (tilt) {
    // apex at the bottom middle
    symbols.push(<polyline key="k" points={`${gx},${gy} ${gx + gw / 2},${gy + gh} ${gx + gw},${gy}`} {...line} />)
  }
  if (sash.kind === 'slide' || sash.kind === 'slide_tilt') {
    const dir = sash.hinge === 'right' ? 1 : -1
    const cy = gy + gh / 2
    const x1 = gx + gw / 2 - (dir * gw) / 4, x2 = gx + gw / 2 + (dir * gw) / 4
    symbols.push(<g key="s" stroke="#475569" strokeWidth={1.2} fill="none">
      <line x1={x1} y1={cy} x2={x2} y2={cy} />
      <polyline points={`${x2 - dir * 7},${cy - 5} ${x2},${cy} ${x2 - dir * 7},${cy + 5}`} />
    </g>)
  }

  // Handle on the side opposite the hinge (tilt-only: top middle)
  let handle: React.ReactNode = null
  if (sash.kind !== 'fixed') {
    const hw = Math.max(3, sashFrame * 0.55), hh = Math.max(12, Math.min(26, sh * 0.12))
    if (sash.kind === 'tilt') {
      handle = <rect x={sx + sw / 2 - hh / 2} y={sy + sashFrame / 2 - hw / 2} width={hh} height={hw} rx={1.5} fill="#334155" />
    } else if (sash.kind !== 'turn') {
      const hx = sash.hinge === 'right' ? sx + sashFrame / 2 - hw / 2 : sx + sw - sashFrame / 2 - hw / 2
      handle = <rect x={hx} y={sy + sh * (sash.door ? 0.48 : 0.5) - hh / 2} width={hw} height={hh} rx={1.5} fill="#334155" />
    }
  }

  if (sash.kind === 'fixed') {
    // glazing directly in the frame: thin glazing bead only
    return <g>
      <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} fill="#dbeafe" stroke="#64748b" strokeWidth={0.6} />
      <path d={`M ${x + w * 0.25} ${y + h * 0.3} l ${w * 0.12} ${-h * 0.08}`} stroke="#ffffff" strokeWidth={2} opacity={0.8} />
    </g>
  }

  return (
    <g>
      <rect x={sx} y={sy} width={sw} height={sh} fill={frameColor} stroke="#334155" strokeWidth={1} />
      <rect x={gx} y={gy} width={gw} height={gh} fill="#dbeafe" stroke="#334155" strokeWidth={0.8} />
      <path d={`M ${gx + gw * 0.2} ${gy + gh * 0.28} l ${gw * 0.14} ${-gh * 0.08}`} stroke="#ffffff" strokeWidth={2} opacity={0.8} />
      {!plain && symbols}
      {!plain && handle}
    </g>
  )
}
