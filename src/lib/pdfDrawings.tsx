// Window drawings for the offer PDF: the same SVG drawings as in the app, turned into PNG pictures
// (the PDF library draws pictures, not React components). Runs in the browser before the PDF is built.
import { renderToStaticMarkup } from 'react-dom/server'
import SpecDrawing from '../components/SpecDrawing'
import WindowDrawing from '../components/WindowDrawing'
import RoofWindowDrawing from '../components/RoofWindowDrawing'
import SillIcon from '../components/SillIcon'
import ShadingIcon from '../components/ShadingIcon'
import type { OfferSnapshotLine } from '../types/database'

/** an SVG string → PNG data URL, drawn sharp (scale × its own size) */
function rasterize(svg: string, scale = 3): Promise<string | null> {
  return new Promise(resolve => {
    const w = Number(svg.match(/width="([\d.]+)"/)?.[1] ?? 160), h = Number(svg.match(/height="([\d.]+)"/)?.[1] ?? 160)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(w * scale); canvas.height = Math.ceil(h * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(null); return }
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
}

function svgOf(el: React.ReactElement) {
  const svg = renderToStaticMarkup(el)
  return /xmlns=/.test(svg) ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
}
/** a photo URL → PNG data URL (so the PDF never fails on a picture it cannot load) */
function photo(url: string): Promise<string | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const max = 300, k = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * k)); canvas.height = Math.max(1, Math.round(img.height * k))
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(null); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      try { resolve(canvas.toDataURL('image/png')) } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** line index → picture: the window with its sizes, or the sill / shading of a sub-position */
export async function windowDrawings(lines: OfferSnapshotLine[]): Promise<Record<number, string>> {
  const out: Record<number, string> = {}
  for (let i = 0; i < lines.length; i++) {
    const cfg = lines[i].config as { kind?: string; item?: any; template?: string | null; image_url?: string | null; sill?: string | null; shade?: string | null } | null | undefined
    // sub-positions: the supplier's photo, or the drawing of the sill / shading
    if (cfg?.kind === 'sub') {
      const png = cfg.image_url ? await photo(cfg.image_url) : await rasterize(svgOf(cfg.sill != null || !cfg.shade ? <SillIcon material={cfg.sill} size={64} /> : <ShadingIcon kind={cfg.shade} size={64} />))
      if (png) out[i] = png
      continue
    }
    if (cfg?.kind !== 'window' || !cfg.item) continue
    const it = cfg.item
    const el = it.roof ? <RoofWindowDrawing size={150} />
      : it.spec ? <SpecDrawing spec={it.spec} width={it.width ?? 0} height={it.height ?? 0} size={180} showDims />
      : cfg.template ? <WindowDrawing template={cfg.template as never} width={it.width ?? 0} height={it.height ?? 0} hinge={it.hinge} size={180} showDims />
      : null
    if (!el) continue
    let svg = renderToStaticMarkup(el)
    if (!/xmlns=/.test(svg)) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
    const png = await rasterize(svg)
    if (png) out[i] = png
  }
  return out
}
