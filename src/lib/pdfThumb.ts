import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

async function renderPdfThumb(url: string, maxW = 320): Promise<string | null> {
  try {
    const pdf = await pdfjsLib.getDocument(url).promise
    const page = await pdf.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: Math.min(2, maxW / base.width) })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    await page.render({ canvasContext: ctx, viewport }).promise
    return canvas.toDataURL('image/jpeg', 0.7)
  } catch (e) {
    console.error('pdf thumb', e)
    return null
  }
}

// Cached version — generates once per session per attachment id
export async function pdfFirstPageThumb(url: string, cacheKey: string, maxW = 320): Promise<string | null> {
  const key = `pdfthumb_${cacheKey}`
  const cached = sessionStorage.getItem(key)
  if (cached) return cached
  const thumb = await renderPdfThumb(url, maxW)
  if (thumb) sessionStorage.setItem(key, thumb)
  return thumb
}
