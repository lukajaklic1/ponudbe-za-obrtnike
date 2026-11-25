import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useLanguage } from '../../hooks/useLanguage'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
}

export default function ConfirmDialog({
  open, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', cancelLabel, danger = false, loading = false,
}: ConfirmDialogProps) {
  const { t } = useLanguage()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)] w-full max-w-md overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-[14px] right-[18px] p-1.5 rounded-lg text-[#667085] hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="px-6 pt-[18px] pb-6">
          <h2 className="text-[19px] font-bold tracking-[-0.015em] text-gray-900 pr-8">{title}</h2>
          <p className="mt-3 text-[15px] leading-6 text-[#667085]">{message}</p>
        </div>

        {/* Divider + buttons */}
        <div className="border-t border-[#e4e9f2] bg-white px-6 py-[18px] flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="h-10 px-4 text-[15px] font-medium text-gray-900 bg-white border border-gray-200 rounded-[10px] hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {cancelLabel ?? t.common.cancel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 h-10 px-4 text-[15px] font-medium text-white rounded-[10px] transition-colors disabled:opacity-50"
            style={{
              backgroundColor: danger ? '#ff5454' : '#000000',
              border: danger ? '1px solid #f04f4f' : 'none',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = danger ? '#f04f4f' : '#000000' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = danger ? '#ff5454' : '#000000' }}
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
