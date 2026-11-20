// Cuts away the empty margin around a logo (white or transparent), so it shows as big as it can.
// Only raster images (PNG, JPG, WEBP); an SVG is returned as it is. Returns a PNG, or the original file
// when there is nothing to cut or the image cannot be read.
export async function trimImage(file: File, pad = 4): Promise<File> {
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) return file
  try {
    const url = URL.createObjectURL(file)
    const img = await new Promise<HTMLImageElement>((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url })
    URL.revokeObjectURL(url)
    const w = img.naturalWidth, h = img.naturalHeight
    if (!w || !h) return file
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return file
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, w, h)
    // a pixel is empty when it is (nearly) transparent or (nearly) white
    const empty = (i: number) => data[i + 3] < 16 || (data[i] > 244 && data[i + 1] > 244 && data[i + 2] > 244)
    let top = h, bottom = -1, left = w, right = -1
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (empty((y * w + x) * 4)) continue
      if (y < top) top = y
      if (y > bottom) bottom = y
      if (x < left) left = x
      if (x > right) right = x
    }
    if (bottom < 0) return file
    top = Math.max(0, top - pad); left = Math.max(0, left - pad)
    bottom = Math.min(h - 1, bottom + pad); right = Math.min(w - 1, right + pad)
    const cw = right - left + 1, ch = bottom - top + 1
    // less than 2% to cut: keep the original
    if (cw * ch > w * h * 0.98) return file
    const out = document.createElement('canvas')
    out.width = cw; out.height = ch
    out.getContext('2d')!.drawImage(canvas, left, top, cw, ch, 0, 0, cw, ch)
    const blob = await new Promise<Blob | null>(ok => out.toBlob(ok, 'image/png'))
    if (!blob) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' })
  } catch {
    return file
  }
}
