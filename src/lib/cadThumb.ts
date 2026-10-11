import * as OV from 'online-3d-viewer'

// Render a CAD model once and capture a still image via the library's
// GetImageAsDataUrl (which renders to an offscreen target correctly — unlike
// reading canvas.toDataURL() on a live WebGL canvas, which returns blank
// without preserveDrawingBuffer). Result is cached by the caller.
export async function cadThumb(id: string, url: string, fileName: string): Promise<string | null> {
  const key = `cadthumb_${id}`
  try {
    const cached = sessionStorage.getItem(key)
    if (cached) return cached
  } catch { /* ignore */ }

  return new Promise((resolve) => {
    // In-viewport but invisible (opacity:0) — WebGL renders reliably only when the
    // element is actually laid out & composited (display:none / off-screen can stall).
    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:240px;opacity:0;pointer-events:none;z-index:-1;'
    document.body.appendChild(container)

    let done = false
    const finish = (result: string | null) => {
      if (done) return
      done = true
      try { document.body.removeChild(container) } catch { /* noop */ }
      resolve(result)
    }
    const timeout = setTimeout(() => finish(null), 25000)

    fetch(url)
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], fileName)
        const viewer = new OV.EmbeddedViewer(container, {
          backgroundColor: new OV.RGBAColor(244, 245, 247, 255),
          defaultColor: new OV.RGBColor(150, 154, 162),
          onModelLoaded: () => {
            // one frame so the model is actually rendered before capture
            requestAnimationFrame(() => {
              try {
                const dataUrl = viewer.GetViewer().GetImageAsDataUrl(640, 480, false)
                clearTimeout(timeout)
                if (dataUrl && dataUrl.length > 200) {
                  try { sessionStorage.setItem(key, dataUrl) } catch { /* quota */ }
                  finish(dataUrl)
                } else {
                  finish(null)
                }
              } catch {
                clearTimeout(timeout)
                finish(null)
              }
            })
          },
          onModelLoadFailed: () => { clearTimeout(timeout); finish(null) },
        } as any)
        viewer.LoadModelFromFileList([file])
      })
      .catch(() => { clearTimeout(timeout); finish(null) })
  })
}
