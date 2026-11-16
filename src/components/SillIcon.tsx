import { useId } from 'react'

export type SillMaterial = 'stone' | 'pvc' | 'wood' | 'alu' | 'alu_dark'
export const SILL_MATERIALS: SillMaterial[] = ['stone', 'pvc', 'wood', 'alu', 'alu_dark']

/**
 * A window sill in perspective (top, front edge and right end), with the texture of its material:
 * granite speckles, smooth white PVC, wood grain, or brushed aluminium with a drip edge.
 */
export default function SillIcon({ material = 'pvc', size = 64 }: { material?: SillMaterial | string; side?: 'inner' | 'outer'; size?: number }) {
  const uid = useId().replace(/:/g, '')
  const id = (k: string) => `${k}-${uid}`
  const m = (SILL_MATERIALS as string[]).includes(material) ? material as SillMaterial : 'pvc'
  const metal = m === 'alu' || m === 'alu_dark'
  // shape: top face, front edge, right end
  const T = metal ? 3 : m === 'pvc' ? 6 : 9            // thickness of the front edge
  const x0 = 6, x1 = 92, dx = 20, y0 = 44, rise = 20     // front left/right, depth offset, front top, how far back the top goes
  const top = `${x0},${y0} ${x1},${y0} ${x1 + dx},${y0 - rise} ${x0 + dx},${y0 - rise}`
  const front = `${x0},${y0} ${x1},${y0} ${x1},${y0 + T} ${x0},${y0 + T}`
  const end = `${x1},${y0} ${x1 + dx},${y0 - rise} ${x1 + dx},${y0 - rise + T} ${x1},${y0 + T}`
  const fill = {
    stone: { top: `url(#${id('stone')})`, front: '#6b7076', end: '#5b6066', edge: '#4b5056' },
    pvc: { top: `url(#${id('pvc')})`, front: '#e7e9ec', end: '#d6d9dd', edge: '#b4b9bf' },
    wood: { top: `url(#${id('wood')})`, front: '#9a6532', end: '#86552a', edge: '#6e4422' },
    alu: { top: `url(#${id('alu')})`, front: '#aeb4ba', end: '#9aa1a8', edge: '#7c838a' },
    alu_dark: { top: `url(#${id('alud')})`, front: '#2f3438', end: '#272b2f', edge: '#1d2124' },
  }[m]
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 120 74" className="shrink-0" aria-hidden>
      <defs>
        {/* granite: grey with dark, light and rusty speckles */}
        <pattern id={id('stone')} width="48" height="30" patternUnits="userSpaceOnUse" patternTransform="skewX(-45)">
          <rect width="48" height="30" fill="#9da3a9" />
          <circle cx="23.5" cy="16.8" r="0.48" fill="#3f4348" /><circle cx="21.3" cy="15.2" r="0.44" fill="#1f2124" /><circle cx="28.3" cy="12.3" r="0.66" fill="#8d8f92" /><circle cx="31.6" cy="2.3" r="0.90" fill="#3f4348" /><circle cx="32.3" cy="4.7" r="0.97" fill="#e8eaec" /><circle cx="8.5" cy="1.5" r="1.38" fill="#1f2124" /><circle cx="5.8" cy="13.3" r="1.40" fill="#3f4348" /><circle cx="20.1" cy="16.5" r="1.09" fill="#55595e" /><circle cx="8.2" cy="29.6" r="0.84" fill="#3f4348" /><circle cx="26.3" cy="9.9" r="0.52" fill="#8d8f92" /><circle cx="16.9" cy="10.5" r="0.44" fill="#1f2124" /><circle cx="11.5" cy="26.5" r="0.87" fill="#3f4348" /><circle cx="28.9" cy="12.1" r="1.18" fill="#7b6a5c" /><circle cx="6.5" cy="6.7" r="0.85" fill="#2f3236" /><circle cx="2.3" cy="12.4" r="1.10" fill="#7b6a5c" /><circle cx="45.8" cy="9.7" r="0.83" fill="#e8eaec" /><circle cx="21.1" cy="25.2" r="0.85" fill="#e8eaec" /><circle cx="12.7" cy="7.1" r="1.17" fill="#3f4348" /><circle cx="13.0" cy="23.0" r="1.29" fill="#1f2124" /><circle cx="44.5" cy="25.8" r="1.17" fill="#7b6a5c" /><circle cx="26.6" cy="0.7" r="0.71" fill="#55595e" /><circle cx="10.3" cy="11.8" r="1.10" fill="#7b6a5c" /><circle cx="12.8" cy="28.7" r="0.36" fill="#55595e" /><circle cx="28.1" cy="13.2" r="0.45" fill="#1f2124" /><circle cx="21.9" cy="26.2" r="1.00" fill="#e8eaec" /><circle cx="6.0" cy="23.8" r="1.34" fill="#55595e" /><circle cx="1.2" cy="4.6" r="1.13" fill="#7b6a5c" /><circle cx="31.7" cy="26.1" r="0.60" fill="#8d8f92" /><circle cx="8.1" cy="1.1" r="0.44" fill="#2f3236" /><circle cx="25.8" cy="24.9" r="1.28" fill="#3f4348" /><circle cx="23.7" cy="1.6" r="0.66" fill="#e8eaec" /><circle cx="3.1" cy="10.7" r="0.60" fill="#55595e" /><circle cx="37.9" cy="4.1" r="0.53" fill="#2f3236" /><circle cx="30.0" cy="2.6" r="0.79" fill="#2f3236" /><circle cx="22.9" cy="12.4" r="0.36" fill="#8d8f92" /><circle cx="21.7" cy="22.2" r="0.72" fill="#1f2124" /><circle cx="34.4" cy="19.2" r="0.64" fill="#55595e" /><circle cx="3.7" cy="26.4" r="0.44" fill="#2f3236" /><circle cx="8.9" cy="9.1" r="0.38" fill="#d5d8db" /><circle cx="21.1" cy="11.3" r="0.94" fill="#1f2124" /><circle cx="25.4" cy="12.6" r="0.48" fill="#1f2124" /><circle cx="31.8" cy="15.0" r="1.35" fill="#7b6a5c" /><circle cx="22.0" cy="29.0" r="1.32" fill="#e8eaec" /><circle cx="23.9" cy="21.1" r="1.22" fill="#1f2124" /><circle cx="26.2" cy="29.7" r="1.05" fill="#8d8f92" /><circle cx="21.1" cy="2.3" r="1.42" fill="#d5d8db" />
        </pattern>
        {/* polished sheen over the stone */}
        <linearGradient id={id('sheen')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" /><stop offset="0.5" stopColor="#ffffff" stopOpacity="0" /><stop offset="1" stopColor="#ffffff" stopOpacity="0.12" />
        </linearGradient>
        {/* smooth white PVC with a soft sheen */}
        <linearGradient id={id('pvc')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" /><stop offset="0.5" stopColor="#f3f4f6" /><stop offset="1" stopColor="#e5e7eb" />
        </linearGradient>
        {/* wood: warm base with grain lines along the sill */}
        <pattern id={id('wood')} width="60" height="8" patternUnits="userSpaceOnUse" patternTransform="skewX(-45)">
          <rect width="60" height="8" fill="#c38a52" />
          <path d="M0 2 Q15 1 30 2.5 T60 2" stroke="#a46d3a" strokeWidth="0.9" fill="none" />
          <path d="M0 5.5 Q20 6.5 40 5 T60 5.8" stroke="#ad7642" strokeWidth="0.7" fill="none" />
          <path d="M0 7.2 Q25 7 60 7.6" stroke="#d29c64" strokeWidth="0.5" fill="none" />
        </pattern>
        {/* brushed aluminium */}
        <linearGradient id={id('alu')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d7dbdf" /><stop offset="0.35" stopColor="#f4f6f7" /><stop offset="0.6" stopColor="#c3c8cd" /><stop offset="1" stopColor="#e3e6e9" />
        </linearGradient>
        <linearGradient id={id('alud')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3b4146" /><stop offset="0.35" stopColor="#555c62" /><stop offset="0.6" stopColor="#353a3f" /><stop offset="1" stopColor="#474d53" />
        </linearGradient>
      </defs>
      {/* shadow */}
      <ellipse cx="60" cy={y0 + T + 9} rx="52" ry="4" fill="#000" opacity="0.06" />
      <polygon points={top} fill={fill.top} stroke={fill.edge} strokeWidth="1" strokeLinejoin="round" />
      <polygon points={end} fill={fill.end} stroke={fill.edge} strokeWidth="1" strokeLinejoin="round" />
      <polygon points={front} fill={fill.front} stroke={fill.edge} strokeWidth="1" strokeLinejoin="round" />
      {/* aluminium: bent-down drip edge along the front */}
      {metal && <polygon points={`${x0},${y0 + T} ${x1},${y0 + T} ${x1 - 2},${y0 + T + 8} ${x0 - 2},${y0 + T + 8}`} fill={fill.front} stroke={fill.edge} strokeWidth="1" strokeLinejoin="round" />}
      {/* PVC: rounded front nose highlight */}
      {m === 'pvc' && <line x1={x0 + 2} y1={y0 + 1.5} x2={x1 - 2} y2={y0 + 1.5} stroke="#ffffff" strokeWidth="1.4" opacity="0.9" />}
      {m === 'stone' && <polygon points={top} fill={`url(#${id('sheen')})`} />}
      {/* stone: polished edge highlight */}
      {m === 'stone' && <line x1={x0 + 2} y1={y0 + 1} x2={x1 - 2} y2={y0 + 1} stroke="#c9cdd1" strokeWidth="1" opacity="0.8" />}
    </svg>
  )
}
