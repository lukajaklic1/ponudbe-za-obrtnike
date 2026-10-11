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
  danger?: boolean
  loading?: boolean
}

export default function ConfirmDialog({
  open, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', danger = false, loading = false,
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
      <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="px-6 pt-6 pb-5">
          <h2 className="text-xl font-bold text-gray-900 pr-6">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">{message}</p>
        </div>

        {/* Divider + buttons */}
        <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-[#7f7f7f] bg-white border border-gray-200 rounded-lg hover:bg-[#f6f6f6] transition-colors disabled:opacity-50"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
            style={{
              backgroundColor: danger ? '#ff5454' : '#2563eb',
              border: danger ? '1px solid #f04f4f' : 'none',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = danger ? '#f04f4f' : '#1d4ed8' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = danger ? '#ff5454' : '#2563eb' }}
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
