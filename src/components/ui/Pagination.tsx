import { useState } from 'react'
import Select from './Select'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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
  /** show the footer as soon as there is more than one page (fixed page sizes, e.g. on the reports) */
  fixedSize?: boolean
}

/** "14 rezultatov" in Slovene: 1 rezultat, 2 rezultata, 3–4 rezultati, 5+ rezultatov (… 101 rezultat …) */
function results(n: number, sl: boolean) {
  if (!sl) return `${n} ${n === 1 ? 'result' : 'results'}`
  const m = n % 100
  return `${n} ${m === 1 ? 'rezultat' : m === 2 ? 'rezultata' : m === 3 || m === 4 ? 'rezultati' : 'rezultatov'}`
}

/**
 * Footer of a table (Levelpath style): number of results on the left, rows per page and the arrows on the right.
 * It sits right under the table and joins its frame (see .table-footer in index.css).
 */
export default function Pagination({ total, page, pageSize, onChange, onPageSizeChange, fixedSize }: PaginationProps) {
  const { lang } = useLanguage()
  const sl = lang === 'sl'
  // only when the list is longer than the smallest page (20 rows) — short lists need no footer
  if (total <= (fixedSize ? pageSize : PAGE_SIZE_OPTIONS[0])) return null
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const go = (p: number) => { onChange(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const arrow = 'w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors'

  return (
    <div className="table-footer flex items-center justify-between gap-4 px-4 py-2.5 bg-white border border-gray-200 border-t-0 rounded-b-xl">
      <p className="text-[15px] font-medium text-gray-900">{results(total, sl)}</p>
      <div className="flex items-center gap-3">
        {onPageSizeChange && total > PAGE_SIZE_OPTIONS[0] && (
          <span className="block w-[118px]">
            <Select size="xs" align="right" value={pageSize} className="h-8 text-[15px] font-medium border-transparent shadow-none hover:bg-gray-100 hover:border-transparent justify-end"
              options={PAGE_SIZE_OPTIONS.map(n => ({ value: n, label: sl ? `${n} vrstic` : `${n} rows` }))}
              onChange={n => { onPageSizeChange(n); onChange(1) }} />
          </span>
        )}
        {totalPages > 1 && <span className="text-[15px] font-medium text-gray-600 whitespace-nowrap">{from}–{to} {sl ? 'od' : 'of'} {total}</span>}
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => go(page - 1)} disabled={page <= 1} className={arrow} aria-label={sl ? 'Prejšnja stran' : 'Previous page'}><ChevronLeft className="w-4 h-4" /></button>
          <button type="button" onClick={() => go(page + 1)} disabled={page >= totalPages} className={arrow} aria-label={sl ? 'Naslednja stran' : 'Next page'}><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  )
}
