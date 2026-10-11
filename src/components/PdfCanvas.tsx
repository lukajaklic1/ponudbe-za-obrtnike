import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

// Renders any generated PDF page-by-page to canvases with pdf.js (works without
// the browser's built-in PDF viewer). `makeBlob` is re-run whenever `version` changes.
export default function PdfCanvas({ makeBlob, version, errorLabel }: { makeBlob: () => Promise<Blob>; version: unknown; errorLabel: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setState('loading')
    ;(async () => {
      try {
        const blob = await makeBlob()
        const doc = await Promise.race([
          pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('PDF preview timed out')), 20000)),
        ])
        const el = host.current
        if (!el || cancelled) return
        el.innerHTML = ''
        const width = Math.min(el.clientWidth || 800, 900)
        const ratio = window.devicePixelRatio || 1
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n)
          const base = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: (width / base.width) * ratio })
          const canvas = document.createElement('canvas')
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          canvas.style.width = `${width}px`
          canvas.className = 'block mx-auto bg-white shadow-sm border border-gray-200 rounded mb-4 max-w-full'
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
          if (cancelled) return
          el.appendChild(canvas)
        }
        if (!cancelled) setState('ready')
      } catch (e) {
        console.error('pdf preview', e)
        if (!cancelled) { setError(e instanceof Error ? e.message : String(e)); setState('error') }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  return (
    <div className="bg-gray-100 rounded-xl border border-gray-200 p-4 sm:p-6 min-h-[400px]">
      {state === 'loading' && <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}
      {state === 'error' && <div className="text-center text-sm text-red-600 py-16">{errorLabel}<div className="text-xs text-gray-400 mt-1">{error}</div></div>}
      <div ref={host} />
    </div>
  )
}
