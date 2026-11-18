// Window drawings for the offer PDF: the same SVG drawings as in the app, turned into PNG pictures
// (the PDF library draws pictures, not React components). Runs in the browser before the PDF is built.
import { renderToStaticMarkup } from 'react-dom/server'
import SpecDrawing from '../components/SpecDrawing'
import WindowDrawing from '../components/WindowDrawing'
import RoofWindowDrawing from '../components/RoofWindowDrawing'
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

/** line index → picture of the window with its sizes (only lines that come from the configurator) */
export async function windowDrawings(lines: OfferSnapshotLine[]): Promise<Record<number, string>> {
  const out: Record<number, string> = {}
  for (let i = 0; i < lines.length; i++) {
    const cfg = lines[i].config as { kind?: string; item?: any; template?: string | null } | null | undefined
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
