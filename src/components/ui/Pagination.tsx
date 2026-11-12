import { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useLanguage } from '../../hooks/useLanguage'

export const PAGE_SIZE_OPTIONS = [20, 50, 100]

/** Rows per page, remembered per list in this browser. */
export function usePageSize(key: string, fallback = 20): [number, (n: number) => void] {
  const storageKey = `obrtdesk-page-size-${key}`
  const [size, setSize] = useState<number>(() => {
    try { const v = Number(localStorage.getItem(storageKey)); return PAGE_SIZE_OPTIONS.includes(v) ? v : fallback } catch { return fallback }
  })
  function update(n: number) {
    setSize(n)
    try { localStorage.setItem(storageKey, String(n)) } catch { /* ignore */ }
  }
  return [size, update]
}

interface PaginationProps {
  total: number
  page: number
  pageSize: number
  onChange: (page: number) => void
  /** shows the rows-per-page picker (20 / 50 / 100) */
  onPageSizeChange?: (size: number) => void
}

export default function Pagination({ total, page, pageSize, onChange, onPageSizeChange }: PaginationProps) {
  const { t, lang } = useLanguage()
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  // nothing to page through: hide (with the picker, only when even the smallest size fits everything)
  if (onPageSizeChange ? total <= PAGE_SIZE_OPTIONS[0] : totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  // Build page numbers to show: always first, last, current ±1, with ellipsis
  function getPages(): (number | '...')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '...')[] = [1]
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i)
    }
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
    return pages
  }

  return (
    <div className="flex items-center justify-between pt-4 pb-1">
      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <label className="flex items-center gap-2 text-sm font-[450] text-[#4a5361]">
            {lang === 'sl' ? 'Vrstic na stran' : 'Rows per page'}
            <span className="relative">
              <select value={pageSize} onChange={e => { onPageSizeChange(Number(e.target.value)); onChange(1) }}
                className="appearance-none h-8 pl-2.5 pr-7 rounded-md border border-[#d4d7c9] bg-white text-sm font-[450] text-[#4a5361] hover:bg-[#f7f8f4] focus:outline-none focus:ring-2 focus:ring-gray-300 cursor-pointer">
                {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#8a8f80] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </span>
          </label>
        )}
        <p className="text-sm font-[450] text-[#4a5361]">
          {t.common.showing} <span>{from}–{to}</span> {t.common.of} <span>{total}</span>
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => { onChange(page - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          disabled={page === 1}
          className="w-8 h-8 flex items-center justify-center rounded-md text-[#8a8f80] hover:text-[#4a5361] hover:bg-[#f7f8f4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPages().map((p, i) => p === '...'
          ? <span key={`ellipsis-${i}`} className="w-8 text-center text-sm font-[450] text-[#4a5361]">…</span>
          : (
            <button
              key={p}
              onClick={() => { onChange(p as number); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              className={cn(
                'w-8 h-8 rounded-md text-sm font-[450] transition-colors',
                p === page
                  ? 'bg-[#101112] text-white'
                  : 'text-[#4a5361] hover:bg-[#f7f8f4]',
              )}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => { onChange(page + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          disabled={page === totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-md text-[#8a8f80] hover:text-[#4a5361] hover:bg-[#f7f8f4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
