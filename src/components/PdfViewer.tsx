import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export default function PdfViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [zoom, setZoom] = useState(1.5)
  const [loading, setLoading] = useState(true)
  const renderRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setPdf(null)
    pdfjsLib.getDocument(url).promise.then(doc => {
      if (cancelled) return
      setPdf(doc)
      setTotal(doc.numPages)
      setPage(1)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [url])

  useEffect(() => {
    if (!pdf || !containerRef.current) return
    let cancelled = false
    if (renderRef.current) { try { renderRef.current.cancel() } catch {} }
    setLoading(true)

    pdf.getPage(page).then((p: any) => {
      if (cancelled || !containerRef.current) return
      const container = containerRef.current
      const baseVp = p.getViewport({ scale: 1 })
      const scale = Math.min(zoom, (container.clientWidth - 32) / baseVp.width)
      const viewport = p.getViewport({ scale })
      let canvas = container.querySelector('canvas') as HTMLCanvasElement
      if (!canvas) { canvas = document.createElement('canvas'); container.appendChild(canvas) }
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      canvas.style.display = 'block'
      const ctx = canvas.getContext('2d')!
      const task = p.render({ canvasContext: ctx, viewport })
      renderRef.current = task
      task.promise.then(() => { if (!cancelled) setLoading(false) }).catch(() => {})
    })
    return () => { cancelled = true }
  }, [pdf, page, zoom])

  return (
    <div className="w-full h-full flex flex-col bg-gray-800">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 text-white text-xs flex-shrink-0">
        {total > 1 ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 hover:bg-gray-700 rounded disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
            <span>{page} / {total}</span>
            <button onClick={() => setPage(p => Math.min(total, p + 1))} disabled={page === total} className="p-1 hover:bg-gray-700 rounded disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
          </div>
        ) : <span className="text-gray-400">{total} stran</span>}
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1 hover:bg-gray-700 rounded"><ZoomOut className="w-4 h-4" /></button>
          <span className="min-w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="p-1 hover:bg-gray-700 rounded"><ZoomIn className="w-4 h-4" /></button>
        </div>
      </div>
      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-auto flex items-start justify-center p-4 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-7 h-7 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}
