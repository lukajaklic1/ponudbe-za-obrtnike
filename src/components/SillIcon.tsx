import { useId } from 'react'
import { graniteTexture } from '../lib/textures'

/** Materials of window sills; each one is drawn as a square sample with its texture. */
export type SillMaterial =
  | 'none'
  | 'granite' | 'granite_dark' | 'marble'
  | 'wood_oak' | 'wood_walnut'
  | 'pvc_white' | 'pvc_oak' | 'pvc_anthracite'
  | 'alu_white' | 'alu_silver' | 'alu_anthracite' | 'alu_brown'
export const SILL_MATERIALS: SillMaterial[] = [
  'none', 'pvc_white', 'pvc_oak', 'pvc_anthracite', 'wood_oak', 'wood_walnut', 'granite', 'granite_dark', 'marble',
  'alu_white', 'alu_silver', 'alu_anthracite', 'alu_brown',
]
/** Older material keys → current ones. */
const OLD: Record<string, SillMaterial> = { stone: 'granite', pvc: 'pvc_white', wood: 'wood_oak', alu: 'alu_silver', alu_dark: 'alu_anthracite' }
export const sillMaterialOf = (m?: string | null): SillMaterial =>
  (SILL_MATERIALS as string[]).includes(m ?? '') ? m as SillMaterial : OLD[m ?? ''] ?? 'none'

/**
 * One texture layer made from SVG noise: the red channel of the noise decides where the colour shows.
 * alpha = k · noise + c, so a high k gives sharp grains (granite) and a negative k thin ridges (marble veins).
 */
interface Layer {
  type?: 'fractalNoise' | 'turbulence'
  freq: string; octaves?: number; seed: number
  rgb: [number, number, number]      // colour of the layer, 0..1
  k: number; c: number               // alpha = k · noise + c
  opacity?: number
}
const hex = (h: string): [number, number, number] => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]

const L = (freq: string, seed: number, color: string, k: number, c: number, extra: Partial<Layer> = {}): Layer =>
  ({ freq, seed, rgb: hex(color), k, c, ...extra })

/** soft clouds over the base */
const clouds = (freq: string, seed: number, color: string, opacity: number) => L(freq, seed, color, 2.2, -0.9, { octaves: 3, opacity })
/** fibres / brushing: noise stretched along the sill */
const streaks = (freq: string, seed: number, color: string, k: number, c: number, opacity: number) => L(freq, seed, color, k, c, { octaves: 3, opacity })

const TEXTURES: Record<Exclude<SillMaterial, 'none'>, { base: string; layers: Layer[]; gloss?: boolean; image?: () => string | null; marbleVeins?: boolean }> = {
  granite: { base: '#9ea3a8', gloss: true, layers: [], image: () => graniteTexture('grey', [
    ['#8f9499', 30], ['#6e7378', 18], ['#c9ccd0', 14], ['#eceded', 10], ['#2a2c30', 16], ['#b49a8a', 8], ['#a5a9ad', 14],
  ], { seed: 11, large: 160, small: 1800, fine: 0.55 }) },
  granite_dark: { base: '#2a2c30', gloss: true, layers: [], image: () => graniteTexture('dark', [
    ['#1b1c1f', 34], ['#2e3034', 26], ['#45484d', 16], ['#6f7379', 10], ['#a9adb2', 6], ['#121315', 8],
  ], { seed: 23, large: 160, small: 1800, fine: 0.5 }) },
  marble: { base: '#f3f2ef', gloss: true, marbleVeins: true, layers: [
    clouds('0.035', 31, '#d9d6d0', 0.8),
    clouds('0.08', 35, '#e6e3de', 0.5),
  ] },
  wood_oak: { base: '#c58d55', layers: [
    clouds('0.02 0.12', 41, '#b07740', 0.6),
    streaks('0.012 0.55', 42, '#8a5a2b', 3.2, -1.45, 0.75),
    streaks('0.02 1.4', 43, '#e0ac77', 2.5, -1.2, 0.45),
  ] },
  wood_walnut: { base: '#6b452a', layers: [
    clouds('0.02 0.1', 51, '#5a381f', 0.7),
    streaks('0.012 0.5', 52, '#3a2213', 3.2, -1.4, 0.8),
    streaks('0.02 1.3', 53, '#8f6342', 2.5, -1.2, 0.45),
  ] },
  pvc_oak: { base: '#d39f69', gloss: true, layers: [
    streaks('0.01 0.45', 61, '#a8723d', 3, -1.4, 0.6),
    streaks('0.02 1.2', 62, '#e6b885', 2.5, -1.2, 0.4),
  ] },
  pvc_white: { base: '#f6f7f8', gloss: true, layers: [] },
  pvc_anthracite: { base: '#3a4045', gloss: true, layers: [clouds('0.05', 71, '#454b51', 0.4)] },
  alu_white: { base: '#eceeef', layers: [streaks('0.003 0.9', 81, '#c4c8cc', 2.4, -1.1, 0.6), streaks('0.004 1.2', 82, '#ffffff', 2.4, -1.1, 0.8)] },
  alu_silver: { base: '#c2c7cc', layers: [streaks('0.003 0.9', 83, '#8d949b', 2.4, -1.1, 0.7), streaks('0.004 1.2', 84, '#f3f5f6', 2.4, -1.1, 0.8)] },
  alu_anthracite: { base: '#383e43', layers: [streaks('0.003 0.9', 85, '#1e2225', 2.4, -1.1, 0.7), streaks('0.004 1.2', 86, '#646c73', 2.4, -1.1, 0.6)] },
  alu_brown: { base: '#4d3a30', layers: [streaks('0.003 0.9', 87, '#2e221c', 2.4, -1.1, 0.7), streaks('0.004 1.2', 88, '#7d6457', 2.4, -1.1, 0.6)] },
}

/** A square sample of the sill material (like a colour swatch, but with the texture). */
export default function SillIcon({ material, size = 64 }: { material?: string | null; size?: number }) {
  const uid = useId().replace(/:/g, '')
  const m = sillMaterialOf(material)
  const clip = `sill-clip-${uid}`, sheen = `sill-sheen-${uid}`
  const tex: (typeof TEXTURES)[keyof typeof TEXTURES] = m === 'none' ? { base: '#f5f3ef', layers: [], gloss: false } : TEXTURES[m]
  const imgUrl = tex.image?.() ?? null
  const warp = `sill-warp-${uid}`, soft = `sill-soft-${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" className="shrink-0 rounded-lg" aria-hidden>
      <defs>
        <clipPath id={clip}><rect width="60" height="60" rx="7" /></clipPath>
        <linearGradient id={sheen} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.4" /><stop offset="0.45" stopColor="#ffffff" stopOpacity="0" /><stop offset="1" stopColor="#000000" stopOpacity="0.07" />
        </linearGradient>
        {tex.marbleVeins && <>
          {/* veins: smooth curves bent by noise, slightly blurred like stone under polish */}
          <filter id={warp} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="3" seed="5" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation="0.3" />
          </filter>
          <filter id={soft} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="8" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="8" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </>}
        {tex.layers.map((l, i) => (
          <filter key={i} id={`sill-${uid}-${i}`} x="0" y="0" width="60" height="60" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feTurbulence type={l.type ?? 'fractalNoise'} baseFrequency={l.freq} numOctaves={l.octaves ?? 2} seed={l.seed} stitchTiles="stitch" />
            <feColorMatrix type="matrix" values={`0 0 0 0 ${l.rgb[0]}  0 0 0 0 ${l.rgb[1]}  0 0 0 0 ${l.rgb[2]}  ${l.k} 0 0 0 ${l.c}`} />
            <feComponentTransfer><feFuncA type="linear" slope={l.opacity ?? 1} /></feComponentTransfer>
          </filter>
        ))}
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="60" height="60" fill={tex.base} />
        {imgUrl && <image href={imgUrl} width="60" height="60" preserveAspectRatio="none" />}
        {tex.layers.map((_, i) => <rect key={i} width="60" height="60" fill="#000" filter={`url(#sill-${uid}-${i})`} />)}
        {tex.marbleVeins && <>
          <g filter={`url(#${soft})`} fill="none" stroke="#9aa0a7" strokeLinecap="round" opacity="0.35">
            <path d="M-6 16 C 8 22, 18 10, 30 19 S 50 33, 68 26" strokeWidth="5" />
            <path d="M-6 46 C 8 41, 20 51, 34 46 S 52 40, 68 45" strokeWidth="4" />
          </g>
          <g filter={`url(#${warp})`} fill="none" stroke="#959ba2" strokeLinecap="round" opacity="0.8">
            <path d="M-6 16 C 8 22, 18 10, 30 19 S 50 33, 68 26" strokeWidth="0.9" opacity="0.7" />
            <path d="M30 19 C 33 29, 29 39, 38 50 S 45 60, 43 68" strokeWidth="0.6" opacity="0.6" />
            <path d="M-6 46 C 8 41, 20 51, 34 46 S 52 40, 68 45" strokeWidth="0.8" opacity="0.55" />
            <path d="M12 -6 C 15 6, 9 13, 13 21" strokeWidth="0.45" opacity="0.5" />
            <path d="M47 30 C 52 22, 58 19, 68 13" strokeWidth="0.5" opacity="0.55" />
            <path d="M20 46 C 22 52, 18 58, 21 66" strokeWidth="0.35" opacity="0.45" />
          </g>
        </>}
        {tex.gloss && <rect width="60" height="60" fill={`url(#${sheen})`} />}
      </g>
      <rect x="0.5" y="0.5" width="59" height="59" rx="6.5" fill="none" stroke="#000" strokeOpacity="0.1" />
    </svg>
  )
}
