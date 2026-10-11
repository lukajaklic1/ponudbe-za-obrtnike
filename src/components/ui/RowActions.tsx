import { useRef, useState, useEffect } from 'react'
import { MoreVertical } from 'lucide-react'

interface Action {
  label: string
  onClick: () => void
  danger?: boolean
}

interface RowActionsProps {
  actions: Action[]
}

export function RowActions({ actions }: RowActionsProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div ref={ref} className="relative flex justify-end">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-[#f6f6f6] transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px]">
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setOpen(false); a.onClick() }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[#f6f6f6] transition-colors ${a.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
