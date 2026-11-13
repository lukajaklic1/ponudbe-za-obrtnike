/**
 * Roof window lying in the roof slope, seen from the front: the top edge leans back
 * (shifted right), like the usual roof window pictures. The dashed line marks the pivot.
 */
export default function RoofWindowDrawing({ size = 100, opening, frameColor = '#f8fafc', className }: { size?: number; opening?: 'center' | 'top'; frameColor?: string; className?: string }) {
  const axisY = opening === 'top' ? -28 : -2
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" role="img" aria-hidden>
      <g transform="translate(50 50) skewX(-20)">
        {/* frame depth (side of the frame visible below) */}
        <rect x={-24} y={-36} width={48} height={76} rx={1.5} fill="#cbd5e1" stroke="#334155" strokeWidth={1} />
        {/* frame + sash + glass */}
        <rect x={-24} y={-40} width={48} height={76} rx={1.5} fill={frameColor} stroke="#334155" strokeWidth={1.3} />
        <rect x={-19} y={-35} width={38} height={66} rx={1} fill={frameColor} stroke="#334155" strokeWidth={0.9} />
        <rect x={-15} y={-30.5} width={30} height={57} fill="#dbeafe" stroke="#334155" strokeWidth={0.8} />
        <line x1={-10} y1={-18} x2={-2} y2={-24} stroke="#ffffff" strokeWidth={2.6} strokeLinecap="round" opacity={0.85} />
        {opening && <line x1={-19} y1={axisY} x2={19} y2={axisY} stroke="#475569" strokeWidth={1} strokeDasharray="3 2" />}
        {/* handle on the lower edge */}
        <rect x={-6} y={27.5} width={12} height={2.6} rx={0.8} fill="#334155" />
      </g>
    </svg>
  )
}
