import type { WindowMaterial } from '../lib/windows'

/**
 * Schematic cross-section of a window profile, used as the default picture
 * of a profile in the price list and the configurator (until the supplier
 * uploads a photo of their own profile). Outside is on the left.
 */
export default function ProfileSection({ material, size = 96, className }: { material: WindowMaterial; size?: number; className?: string }) {
  const stroke = '#334155'
  const pvc = '#f8fafc', alu = '#cbd5e1', aluDark = '#94a3b8', wood = '#c8955f', woodDark = '#a8743f', steel = '#475569'
  const glass = '#bfdbfe'

  // glazing unit on top: 3 panes for chambered profiles, 2 for steel
  const panes = material === 'steel' ? [44, 56] : [40, 50, 60]
  const glazing = (
    <g>
      <rect x={panes[0] - 3} y={6} width={panes[panes.length - 1] - panes[0] + 6} height={40} fill="#eff6ff" />
      {panes.map(x => <rect key={x} x={x - 1.5} y={6} width={3} height={40} fill={glass} stroke="#93c5fd" strokeWidth={0.6} />)}
      <rect x={panes[0] - 3} y={42} width={panes[panes.length - 1] - panes[0] + 6} height={4} fill="#64748b" />
    </g>
  )

  // chambered core (PVC and PVC-ALU)
  const chambers = (x: number, w: number) => (
    <g>
      <rect x={x} y={46} width={w} height={44} rx={3} fill={pvc} stroke={stroke} strokeWidth={1.2} />
      {[0, 1, 2].map(r => [0, 1, 2].map(cIdx => (
        <rect key={`${r}${cIdx}`} x={x + 4 + cIdx * ((w - 8) / 3)} y={50 + r * 13} width={(w - 8) / 3 - 3} height={10} rx={1.5}
          fill="#ffffff" stroke="#94a3b8" strokeWidth={0.8} />
      )))}
    </g>
  )

  let body: React.ReactNode
  switch (material) {
    case 'pvc':
      body = chambers(22, 56)
      break
    case 'pvc_alu':
      body = <g>{chambers(28, 50)}<path d="M 28 46 L 18 46 Q 14 46 14 50 L 14 86 Q 14 90 18 90 L 28 90" fill={alu} stroke={stroke} strokeWidth={1.2} /></g>
      break
    case 'alu':
      body = <g>
        <rect x={20} y={46} width={24} height={44} rx={2} fill={alu} stroke={stroke} strokeWidth={1.2} />
        <rect x={56} y={46} width={24} height={44} rx={2} fill={alu} stroke={stroke} strokeWidth={1.2} />
        <rect x={44} y={52} width={12} height={32} fill="#1f2937" />
        {[56, 66, 76].map(y => <line key={y} x1={24} y1={y} x2={40} y2={y} stroke={aluDark} strokeWidth={0.8} />)}
        {[56, 66, 76].map(y => <line key={y} x1={60} y1={y} x2={76} y2={y} stroke={aluDark} strokeWidth={0.8} />)}
      </g>
      break
    case 'wood':
      body = <g>
        <rect x={20} y={46} width={60} height={44} rx={5} fill={wood} stroke={stroke} strokeWidth={1.2} />
        {[54, 62, 70, 78].map((y, i) => <path key={y} d={`M 24 ${y} Q 50 ${y + (i % 2 ? 3 : -3)} 76 ${y}`} stroke={woodDark} strokeWidth={0.8} fill="none" />)}
      </g>
      break
    case 'wood_alu':
      body = <g>
        <rect x={30} y={46} width={50} height={44} rx={5} fill={wood} stroke={stroke} strokeWidth={1.2} />
        {[54, 62, 70, 78].map((y, i) => <path key={y} d={`M 34 ${y} Q 55 ${y + (i % 2 ? 3 : -3)} 76 ${y}`} stroke={woodDark} strokeWidth={0.8} fill="none" />)}
        <path d="M 30 46 L 20 46 Q 16 46 16 50 L 16 86 Q 16 90 20 90 L 30 90" fill={alu} stroke={stroke} strokeWidth={1.2} />
      </g>
      break
    case 'steel':
      body = <g>
        <rect x={34} y={46} width={32} height={44} rx={1} fill={steel} stroke="#1f2937" strokeWidth={1.2} />
        <rect x={40} y={52} width={20} height={32} fill="#64748b" />
      </g>
      break
  }

  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 96" role="img" aria-label={material}>
      {glazing}
      {body}
    </svg>
  )
}
