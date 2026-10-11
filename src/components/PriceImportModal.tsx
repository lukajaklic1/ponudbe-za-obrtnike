import { useState } from 'react'
import { UploadCloud, Download, FileText } from 'lucide-react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { supabase } from '../lib/supabase'
import { toast } from './ui/Toast'
import { parsePriceCsv, parsePriceSheet, TEMPLATE_HEADER, TEMPLATE_EXAMPLE, type ImportRow } from '../lib/priceImport'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  lang: 'sl' | 'en'
  units: Record<string, string>
  money: (n: number) => string
  onDone: () => void
}

const L = {
  sl: {
    title: 'Uvoz storitev', intro: 'Uvozite storitve iz Excela. Naložite Excel datoteko (.xlsx ali .xls) ali CSV. Prebere se prvi list.',
    template: 'Prenesi predlogo', pick: 'Izberite Excel ali CSV datoteko', columns: 'Stolpci: Šifra, Naziv, Opis, Enota (m2, m, kos, h, pavšal, l, kg), Cena (brez DDV), DDV (22, 9,5 ali 0).',
    preview: 'Predogled', line: 'Vrstica', newRow: 'Dodana', invalid: 'Napaka',
    summary: (n: number, e: number) => `Dodanih bo: ${n}${e ? ` · Preskočenih zaradi napake: ${e}` : ''}`,
    errors: { name: 'manjka naziv', unit: 'neznana enota', price: 'neveljavna cena', vat: 'DDV mora biti 22, 9,5 ali 0' } as Record<string, string>,
    import: 'Uvozi', cancel: 'Prekliči', done: (n: number) => `Uvoženih storitev: ${n}`, empty: 'V datoteki ni vrstic.', more: (n: number) => `… in še ${n} vrstic`,
  },
  en: {
    title: 'Import services', intro: 'Import services from Excel. Upload an Excel file (.xlsx or .xls) or CSV. The first sheet is read.',
    template: 'Download template', pick: 'Choose an Excel or CSV file', columns: 'Columns: Code, Name, Description, Unit (m2, m, pcs, h, lump, l, kg), Price (excl. VAT), VAT (22, 9.5 or 0).',
    preview: 'Preview', line: 'Line', newRow: 'New', invalid: 'Error',
    summary: (n: number, e: number) => `To be added: ${n}${e ? ` · Skipped (errors): ${e}` : ''}`,
    errors: { name: 'missing name', unit: 'unknown unit', price: 'invalid price', vat: 'VAT must be 22, 9.5 or 0' } as Record<string, string>,
    import: 'Import', cancel: 'Cancel', done: (n: number) => `Imported services: ${n}`, empty: 'The file has no rows.', more: (n: number) => `… and ${n} more rows`,
  },
}

export default function PriceImportModal({ open, onClose, companyId, lang, units, money, onDone }: Props) {
  const T = L[lang]
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)

  // Code (šifra) is the user's own label, not a key — every valid row is added as a new service
  const valid = (rows ?? []).filter(r => !r.error)
  const errors = (rows ?? []).filter(r => r.error)

  function close() { setRows(null); setFileName(''); onClose() }

  async function downloadTemplate() {
    const XLSX = await import('xlsx')   // loaded only when needed (keeps the app bundle small)
    const example = TEMPLATE_EXAMPLE.map(r => r.map((c, i) => (i === 4 || i === 5) && c ? Number(c.replace(',', '.')) : c))
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADER, ...example])
    ws['!cols'] = [{ wch: 8 }, { wch: 34 }, { wch: 30 }, { wch: 8 }, { wch: 10 }, { wch: 6 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, lang === 'sl' ? 'Storitve' : 'Services')
    XLSX.writeFile(wb, lang === 'sl' ? 'predloga-storitve.xlsx' : 'services-template.xlsx')
  }

  async function readFile(file: File) {
    setFileName(file.name)
    const buf = await file.arrayBuffer()
    if (/.(xlsx|xls)$/i.test(file.name)) {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      setRows(parsePriceSheet(XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' })))
      return
    }
    // CSV: Excel may save as UTF-8 or Windows-1250 (Slovenian) — prefer UTF-8, fall back if it has broken chars
    let text = new TextDecoder('utf-8').decode(buf)
    if (text.includes('�')) text = new TextDecoder('windows-1250').decode(buf)
    setRows(parsePriceCsv(text))
  }

  async function doImport() {
    if (!valid.length) return
    setImporting(true)
    const uid = (await supabase.auth.getUser()).data.user?.id ?? null
    const { error } = await supabase.from('price_items').insert(valid.map(r => ({
        company_id: companyId, code: r.code, name: r.name, description: r.description, category: null,
      unit: r.unit, price: r.price, vat_rate: r.vat_rate, is_active: true, created_by: uid, updated_by: null,
    })))
    setImporting(false)
    if (error) { toast.error(error.message); return }
    toast.success(T.done(valid.length))
    onDone()
    close()
  }

  return (
    <Modal open={open} onClose={close} title={T.title} size="lg">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600">{T.intro}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={downloadTemplate} className="gap-1.5"><Download className="w-3.5 h-3.5" />{T.template}</Button>
          <span className="text-xs text-gray-400">{T.columns}</span>
        </div>

        <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50/40 transition-colors">
          {fileName ? <FileText className="w-4 h-4 text-blue-600 shrink-0" /> : <UploadCloud className="w-4 h-4 text-gray-400 shrink-0" />}
          <span className={`text-sm ${fileName ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{fileName || T.pick}</span>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = '' }} />
        </label>

        {rows && (rows.length === 0 ? <p className="text-sm text-gray-400">{T.empty}</p> : (
          <div>
            <p className="text-xs font-medium text-[#7f7f7f] mb-2">{T.preview}</p>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {rows.slice(0, 50).map(r => {
                      return (
                        <tr key={r.line} className={r.error ? 'bg-[#fff8f3]' : ''}>
                          <td className="px-3 py-2 text-xs text-gray-400 w-10">{r.line}</td>
                          <td className="px-3 py-2 text-gray-500 w-16">{r.code ?? ''}</td>
                          <td className="px-3 py-2 text-gray-900">{r.name || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2 text-gray-500 w-16">{units[r.unit]}</td>
                          <td className="px-3 py-2 text-gray-700 w-24 text-right whitespace-nowrap">{money(r.price)}</td>
                          <td className="px-3 py-2 w-32 text-right">
                            <span className="px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap" style={
                              r.error ? { backgroundColor: '#feeee1', border: '1px solid #fee0c8', color: '#9e3f00' }
                                : { backgroundColor: '#e0fced', border: '1px solid #d4f8e6', color: '#098259' }} title={r.error ? T.errors[r.error] : undefined}>
                              {r.error ? T.errors[r.error] : T.newRow}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length > 50 && <p className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">{T.more(rows.length - 50)}</p>}
            </div>
            <p className="text-sm text-gray-700 mt-3">{T.summary(valid.length, errors.length)}</p>
          </div>
        ))}

        <div className="flex justify-end gap-3 mt-1 pt-4 -mx-6 px-6 border-t border-gray-200">
          <Button variant="secondary" onClick={close}>{T.cancel}</Button>
          <Button loading={importing} onClick={doImport} disabled={!valid.length}>{T.import}{valid.length ? ` (${valid.length})` : ''}</Button>
        </div>
      </div>
    </Modal>
  )
}
