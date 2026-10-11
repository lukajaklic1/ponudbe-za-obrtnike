import { useRef, useState, useEffect } from 'react'
import { X, RotateCcw } from 'lucide-react'

interface CadViewerModalProps {
  url: string
  fileName: string
  onClose: () => void
}

export default function CadViewerModal({ url, fileName, onClose }: CadViewerModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCAD() {
      try {
        setLoading(true)
        // OCCT 3D viewer - loads STEP/IGES models
        if ((window as any).OCCTModule) {
          // const viewer = new (window as any).Viewer(canvasRef.current)
          await fetch(url)
          // const arrayBuffer = await response.arrayBuffer()
          // Viewer would load the CAD model
          console.log('Loading CAD:', fileName)
          setLoading(false)
        } else {
          setError('3D viewer not available')
          setLoading(false)
        }
      } catch (err) {
        setError(`Failed to load: ${err}`)
        setLoading(false)
      }
    }
    
    loadCAD()
  }, [url, fileName])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-11/12 h-5/6 flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="font-bold text-lg">{fileName}</h2>
          <button onClick={onClose} className="p-1 hover:bg-[#f6f6f6] rounded">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 bg-gray-100 relative overflow-hidden">
          {loading && <div className="absolute inset-0 flex items-center justify-center bg-gray-200"><span>Loading 3D model...</span></div>}
          {error && <div className="absolute inset-0 flex items-center justify-center bg-red-100"><span className="text-red-700">{error}</span></div>}
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>

        <div className="p-4 border-t flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            <RotateCcw className="w-4 h-4" />
            Reset View
          </button>
        </div>
      </div>
    </div>
  )
}
