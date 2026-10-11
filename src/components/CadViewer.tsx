import { useEffect, useRef, useState } from 'react'
import * as OV from 'online-3d-viewer'

// occt-import-js / draco / rhino wasm libs are fetched automatically from jsDelivr by the library at load time.
// onCapture (optional): fires once with a still-image data-url after the model is rendered,
// so callers can bake/persist a thumbnail from the real (visible) render — guaranteed non-blank.
export default function CadViewer({ url, fileName, onCapture, onError }: { url: string; fileName: string; onCapture?: (dataUrl: string) => void; onError?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let viewer: any
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(url)
        const blob = await res.blob()
        const file = new File([blob], fileName)
        if (cancelled || !ref.current) return
        ref.current.innerHTML = '' // ensure no stale canvas from a previous model
        viewer = new OV.EmbeddedViewer(ref.current, {
          backgroundColor: new OV.RGBAColor(244, 245, 247, 255),
          defaultColor: new OV.RGBColor(160, 162, 168),
          onModelLoaded: () => {
            if (!onCapture || cancelled) return
            // give the renderer a frame, then grab a still via the library API
            requestAnimationFrame(() => {
              try {
                const dataUrl = viewer.GetViewer().GetImageAsDataUrl(640, 480, false)
                if (dataUrl && dataUrl.length > 200 && !cancelled) onCapture(dataUrl)
              } catch { /* noop */ }
            })
          },
          onModelLoadFailed: () => { if (!cancelled) { setError(true); onError?.() } },
        } as any)
        viewer.LoadModelFromFileList([file])
      } catch (e) {
        console.error('cad viewer', e)
        if (!cancelled) { setError(true); onError?.() }
      }
    })()
    return () => { cancelled = true; try { viewer?.Destroy?.() } catch { /* noop */ } }
  }, [url, fileName])

  if (error) return <div className="w-full h-full flex items-center justify-center text-white/70 text-sm">3D predogleda ni bilo mogoče naložiti.</div>
  return <div ref={ref} className="w-full h-full" />
}
