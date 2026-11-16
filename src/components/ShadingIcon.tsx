import { useId } from 'react'

export const SHADING_ICONS = ['blinds', 'roller', 'pleated', 'screen', 'screen_roll', 'screen_pleated', 'none'] as const

/**
 * Square picture of a shading product on a window: external blinds (slats), roller shutter (box + slats),
 * pleated blind (zig-zag), framed insect screen (mesh) or roll-up screen (mesh coming out of a box).
 */
export default function ShadingIcon({ kind, size = 64 }: { kind?: string | null; size?: number }) {
  const uid = useId().replace(/:/g, '')
  const mesh = `mesh-${uid}`, glass = `glass-${uid}`, clip = `clip-${uid}`
  const frame = <>
    <rect x="8" y="8" width="44" height="46" rx="1.5" fill="#ffffff" stroke="#9ca3af" strokeWidth="1.4" />
    <rect x="12" y="12" width="36" height="38" fill={`url(#${glass})`} stroke="#cbd5e1" strokeWidth="0.8" />
  </>
  let body: React.ReactNode
  switch (kind) {
    case 'blinds':
      body = <>{frame}
        <rect x="8" y="4" width="44" height="4" rx="1" fill="#6b7280" />
        {Array.from({ length: 9 }, (_, i) => <g key={i}>
          <rect x="9" y={9 + i * 3.6} width="42" height="2.6" rx="0.6" fill="#d1d5db" stroke="#9ca3af" strokeWidth="0.4" />
          <rect x="9" y={9 + i * 3.6} width="42" height="0.8" fill="#f3f4f6" />
        </g>)}
        <line x1="20" y1="8" x2="20" y2="42" stroke="#6b7280" strokeWidth="0.5" /><line x1="40" y1="8" x2="40" y2="42" stroke="#6b7280" strokeWidth="0.5" />
      </>
      break
    case 'roller':
      body = <>{frame}
        <rect x="6" y="2" width="48" height="8" rx="1.5" fill="#9ca3af" stroke="#6b7280" strokeWidth="0.8" />
        <rect x="8" y="10" width="44" height="26" fill="#e5e7eb" />
        {Array.from({ length: 13 }, (_, i) => <line key={i} x1="8" x2="52" y1={11 + i * 2} y2={11 + i * 2} stroke="#9ca3af" strokeWidth="0.5" />)}
        <rect x="8" y="35" width="44" height="2" fill="#6b7280" />
      </>
      break
    case 'pleated':
      body = <>{frame}
        <rect x="12" y="12" width="36" height="2.5" fill="#9ca3af" />
        <path d={'M12 15 ' + Array.from({ length: 12 }, (_, i) => `L48 ${16 + i * 2.2} L12 ${17.1 + i * 2.2}`).join(' ')} fill="#f5efe6" stroke="#d6c7b2" strokeWidth="0.5" strokeLinejoin="round" />
        <rect x="12" y="42" width="36" height="2" fill="#9ca3af" />
      </>
      break
    case 'screen_pleated':
      // pleated insect screen on a door: mesh folded like an accordion (vertical pleats), pull bar on the right
      body = <>{frame}
        <rect x="12" y="12" width="32" height="38" fill={`url(#${mesh})`} />
        {Array.from({ length: 10 }, (_, i) => <rect key={i} x={12 + i * 3.2} y="12" width="1.6" height="38" fill="#9ca3af" opacity="0.35" />)}
        {Array.from({ length: 11 }, (_, i) => <line key={'l' + i} x1={12 + i * 3.2} y1="12" x2={12 + i * 3.2} y2="50" stroke="#6b7280" strokeWidth="0.5" />)}
        <rect x="44" y="11" width="3.5" height="40" rx="1" fill="#6b7280" />
        <rect x="12" y="10" width="36" height="2" fill="#9ca3af" /><rect x="12" y="50" width="36" height="2" fill="#9ca3af" />
      </>
      break
    case 'screen':
      body = <>{frame}
        <rect x="11" y="11" width="38" height="40" rx="1" fill={`url(#${mesh})`} stroke="#6b7280" strokeWidth="1.6" />
      </>
      break
    case 'screen_roll':
      body = <>{frame}
        <rect x="9" y="7" width="42" height="5" rx="1.2" fill="#9ca3af" stroke="#6b7280" strokeWidth="0.6" />
        <rect x="12" y="12" width="36" height="28" fill={`url(#${mesh})`} />
        <rect x="11" y="39" width="38" height="2" rx="0.6" fill="#6b7280" />
        <line x1="12" y1="12" x2="12" y2="50" stroke="#6b7280" strokeWidth="1" /><line x1="48" y1="12" x2="48" y2="50" stroke="#6b7280" strokeWidth="1" />
      </>
      break
    default:
      body = <rect width="60" height="60" fill="#f3f4f6" />
  }
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" className="shrink-0" aria-hidden>
      <defs>
        <pattern id={mesh} width="2" height="2" patternUnits="userSpaceOnUse">
          <rect width="2" height="2" fill="#e5e7eb" fillOpacity="0.35" />
          <path d="M0 0 H2 M0 0 V2" stroke="#4b5563" strokeWidth="0.35" opacity="0.7" />
        </pattern>
        <linearGradient id={glass} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef6fb" /><stop offset="1" stopColor="#d6e8f3" />
        </linearGradient>
        <clipPath id={clip}><rect width="60" height="60" rx="7" /></clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}><rect width="60" height="60" fill="#f8fafc" />{body}</g>
    </svg>
  )
}
