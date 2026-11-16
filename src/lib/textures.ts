// Procedural material textures drawn once on a canvas and cached as data URLs.
// Granite: a mix of large and small interlocking crystals (two Voronoi layers) in the mineral colours,
// softened slightly like a polished slab.

type RGB = [number, number, number]
const cache = new Map<string, string>()

function rand(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }
const hexRgb = (h: string): RGB => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB

/** Nearest crystal for every pixel of an N×N tile (wraps around so the edges match). */
function voronoi(N: number, n: number, seed: number) {
  const r = rand(seed)
  const g = Math.max(1, Math.round(Math.sqrt(n))), cell = N / g
  const px: number[] = [], py: number[] = []
  for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) { px.push((i + 0.1 + r() * 0.8) * cell); py.push((j + 0.1 + r() * 0.8) * cell) }
  const owner = new Int32Array(N * N)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const bx = Math.floor(x / cell), by = Math.floor(y / cell)
    let best = 0, d1 = Infinity
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
      const ix = (bx + dx + g) % g, iy = (by + dy + g) % g, k = ix * g + iy
      const ox = bx + dx < 0 ? -N : bx + dx >= g ? N : 0, oy = by + dy < 0 ? -N : by + dy >= g ? N : 0
      const ddx = px[k] + ox - x, ddy = py[k] + oy - y, d = ddx * ddx + ddy * ddy
      if (d < d1) { d1 = d; best = k }
    }
    owner[y * N + x] = best
  }
  return { owner, count: g * g }
}

/**
 * Granite as a polished slab. `palette` = [colour, weight]; `fine` = share of the surface covered by
 * the small crystals (the rest shows the large ones).
 */
export function graniteTexture(key: string, palette: [string, number][], opts: { size?: number; seed?: number; large?: number; small?: number; fine?: number } = {}): string | null {
  if (typeof document === 'undefined') return null
  const id = `granite:${key}`
  const hit = cache.get(id)
  if (hit) return hit
  const N = opts.size ?? 256, seed = opts.seed ?? 7
  const r = rand(seed + 1)
  const total = palette.reduce((a, [, w]) => a + w, 0)
  const pick = (): RGB => { let x = r() * total; for (const [c, w] of palette) { x -= w; if (x <= 0) return hexRgb(c) } return hexRgb(palette[0][0]) }
  const big = voronoi(N, opts.large ?? 180, seed), small = voronoi(N, opts.small ?? 1600, seed + 50)
  const bigCol = Array.from({ length: big.count }, () => { const c = pick(), v = 0.9 + r() * 0.2; return c.map(x => x * v) as RGB })
  const smallCol = Array.from({ length: small.count }, () => { const c = pick(), v = 0.9 + r() * 0.2; return c.map(x => x * v) as RGB })
  const showSmall = Array.from({ length: small.count }, () => r() < (opts.fine ?? 0.55))
  const canvas = document.createElement('canvas')
  canvas.width = N; canvas.height = N
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const img = ctx.createImageData(N, N)
  for (let i = 0; i < N * N; i++) {
    const s = small.owner[i]
    const c = showSmall[s] ? smallCol[s] : bigCol[big.owner[i]]
    img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  // soften the crystal edges a little, like stone under polish
  const out = document.createElement('canvas')
  out.width = N; out.height = N
  const octx = out.getContext('2d')
  if (!octx) return null
  octx.filter = 'blur(0.6px)'
  octx.drawImage(canvas, 0, 0)
  const url = out.toDataURL('image/png')
  cache.set(id, url)
  return url
}
