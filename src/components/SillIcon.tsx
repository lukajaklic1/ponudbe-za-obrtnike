import { useId } from 'react'

/** Materials of window sills; each one is drawn as a square sample with its texture. */
export type SillMaterial =
  | 'granite' | 'granite_dark' | 'marble'
  | 'wood_oak' | 'wood_walnut'
  | 'pvc_white' | 'pvc_oak' | 'pvc_anthracite'
  | 'alu_white' | 'alu_silver' | 'alu_anthracite' | 'alu_brown'
export const SILL_MATERIALS: SillMaterial[] = [
  'pvc_white', 'pvc_oak', 'pvc_anthracite', 'wood_oak', 'wood_walnut', 'granite', 'granite_dark', 'marble',
  'alu_white', 'alu_silver', 'alu_anthracite', 'alu_brown',
]
/** Older material keys → current ones. */
const OLD: Record<string, SillMaterial> = { stone: 'granite', pvc: 'pvc_white', wood: 'wood_oak', alu: 'alu_silver', alu_dark: 'alu_anthracite' }
export const sillMaterialOf = (m?: string | null): SillMaterial =>
  (SILL_MATERIALS as string[]).includes(m ?? '') ? m as SillMaterial : OLD[m ?? ''] ?? 'pvc_white'

// fixed pseudo-random numbers, so a texture looks the same on every render
function rand(seed: number) { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 } }

function speckles(seed: number, n: number, colors: string[], min = 0.4, max = 1.6) {
  const r = rand(seed)
  return Array.from({ length: n }, (_, i) => <circle key={i} cx={(r() * 60).toFixed(1)} cy={(r() * 60).toFixed(1)} r={(min + r() * (max - min)).toFixed(2)} fill={colors[Math.floor(r() * colors.length)]} />)
}
function grain(seed: number, color: string, light: string) {
  const r = rand(seed)
  return Array.from({ length: 14 }, (_, i) => {
    const y = 2 + i * 4.3 + r() * 1.5, a = (r() * 3 - 1.5).toFixed(1), b = (r() * 3 - 1.5).toFixed(1)
    return <path key={i} d={`M-2 ${y} C 15 ${y + +a}, 35 ${y + +b}, 62 ${y + (r() * 2 - 1)}`} stroke={i % 3 === 0 ? light : color} strokeWidth={(0.4 + r() * 0.9).toFixed(2)} fill="none" opacity="0.85" />
  })
}
function brushed(seed: number, dark: string, light: string) {
  const r = rand(seed)
  return Array.from({ length: 40 }, (_, i) => <line key={i} x1="0" x2="60" y1={i * 1.5 + 0.5} y2={i * 1.5 + 0.5} stroke={r() > 0.5 ? light : dark} strokeWidth="0.5" opacity={(0.15 + r() * 0.35).toFixed(2)} />)
}

/** A square sample of the sill material (like a colour swatch, but with the texture). */
export default function SillIcon({ material, size = 64 }: { material?: string | null; size?: number }) {
  const uid = useId().replace(/:/g, '')
  const m = sillMaterialOf(material)
  const clip = `sill-clip-${uid}`, sheen = `sill-sheen-${uid}`
  let body: React.ReactNode
  switch (m) {
    case 'granite':
      body = <><rect width="60" height="60" fill="#9298a0" />{speckles(11, 170, ['#2f3236', '#44484d', '#5c6166', '#e9ebed', '#d3d6d9', '#7d6b5d', '#b5b9bd', '#1c1e21'], 0.35, 1.5)}</>
      break
    case 'granite_dark':
      body = <><rect width="60" height="60" fill="#2c2f33" />{speckles(23, 160, ['#4a4e53', '#606469', '#121315', '#8a8e93', '#3a3d41', '#a9adb1'], 0.3, 1.3)}</>
      break
    case 'marble':
      body = <><rect width="60" height="60" fill="#f1f0ed" />
        <path d="M-5 12 C 10 18, 22 6, 35 16 S 55 30, 66 22" stroke="#b9bcc1" strokeWidth="1.1" fill="none" opacity="0.7" />
        <path d="M-5 40 C 12 34, 20 48, 38 42 S 52 50, 66 46" stroke="#a9adb2" strokeWidth="0.8" fill="none" opacity="0.6" />
        <path d="M20 -4 C 24 14, 16 28, 26 40 S 30 56, 28 66" stroke="#c7cace" strokeWidth="0.6" fill="none" opacity="0.7" />
        <path d="M35 16 C 40 24, 44 28, 52 30" stroke="#b9bcc1" strokeWidth="0.5" fill="none" opacity="0.6" /></>
      break
    case 'wood_oak':
      body = <><rect width="60" height="60" fill="#c48b52" />{grain(5, '#9f6935', '#d9a571')}<ellipse cx="42" cy="38" rx="4" ry="1.8" fill="#8d5a2c" opacity="0.6" /></>
      break
    case 'wood_walnut':
      body = <><rect width="60" height="60" fill="#6a4429" />{grain(9, '#4a2c19', '#8a5d3b')}<ellipse cx="18" cy="22" rx="3.5" ry="1.5" fill="#3d2414" opacity="0.6" /></>
      break
    case 'pvc_oak':
      body = <><rect width="60" height="60" fill="#d39c62" />{grain(13, '#b37a43', '#e3b07c')}</>
      break
    case 'pvc_anthracite':
      body = <rect width="60" height="60" fill="#3a4045" />
      break
    case 'alu_white':
      body = <><rect width="60" height="60" fill="#eceeef" />{brushed(3, '#b9bec3', '#ffffff')}</>
      break
    case 'alu_silver':
      body = <><rect width="60" height="60" fill="#c3c8cd" />{brushed(4, '#8e959c', '#f2f4f5')}</>
      break
    case 'alu_anthracite':
      body = <><rect width="60" height="60" fill="#3a4045" />{brushed(6, '#1f2326', '#6b737a')}</>
      break
    case 'alu_brown':
      body = <><rect width="60" height="60" fill="#4d3a30" />{brushed(8, '#2f221c', '#7a6155')}</>
      break
    default: // pvc_white
      body = <rect width="60" height="60" fill="#f6f7f8" />
  }
  const glossy = m.startsWith('pvc') || m === 'marble' || m.startsWith('granite')
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" className="shrink-0 rounded-lg" aria-hidden>
      <defs>
        <clipPath id={clip}><rect width="60" height="60" rx="7" /></clipPath>
        <linearGradient id={sheen} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.45" /><stop offset="0.45" stopColor="#ffffff" stopOpacity="0" /><stop offset="1" stopColor="#000000" stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {body}
        {glossy && <rect width="60" height="60" fill={`url(#${sheen})`} />}
      </g>
      <rect x="0.5" y="0.5" width="59" height="59" rx="6.5" fill="none" stroke="#000" strokeOpacity="0.1" />
    </svg>
  )
}
