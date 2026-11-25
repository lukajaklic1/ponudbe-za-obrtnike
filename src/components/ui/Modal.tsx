import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        'relative bg-white rounded-2xl border border-gray-200 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)] w-full flex flex-col overflow-hidden',
        'max-h-[calc(100vh-3rem)]',
        size === 'sm' && 'max-w-sm',
        size === 'md' && 'max-w-lg',
        size === 'lg' && 'max-w-2xl',
      )}>
        <div className="flex items-center justify-between px-6 h-[60px] border-b border-[#eeeff1] shrink-0">
          <h2 className="text-[19px] font-bold tracking-[-0.015em] text-gray-900">{title}</h2>
          <button onClick={onClose} className="-mr-1.5 p-1.5 rounded-lg text-[#5e5e5e] hover:text-gray-900 hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body px-6 py-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
