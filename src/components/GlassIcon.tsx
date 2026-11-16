/** Cross-section of an insulating glass unit: 2 or 3 panes (light blue) with spacers between them. */
export default function GlassIcon({ layers = 2, size = 40 }: { layers?: number; size?: number }) {
  const n = Math.max(1, Math.min(4, layers))
  const pane = 4, gap = 9
  const total = n * pane + (n - 1) * gap
  const x0 = (40 - total) / 2
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0" aria-hidden>
      <rect x="0.5" y="0.5" width="39" height="39" rx="7" fill="#f8fafc" stroke="#e5e7eb" />
      {Array.from({ length: n - 1 }, (_, i) => {
        const x = x0 + (i + 1) * pane + i * gap
        return <g key={'s' + i}>
          <rect x={x} y="7" width={gap} height="3" fill="#9ca3af" />
          <rect x={x} y="30" width={gap} height="3" fill="#9ca3af" />
        </g>
      })}
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={x0 + i * (pane + gap)} y="5" width={pane} height="30" rx="1" fill="#cfe8f5" stroke="#7fb6d4" strokeWidth="0.8" />
      ))}
    </svg>
  )
}
