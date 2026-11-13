import { useState } from 'react'
import { UploadCloud, Download, FileText } from 'lucide-react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { supabase } from '../lib/supabase'
import { toast } from './ui/Toast'
import { parseCustomerCsv, parseCustomerSheet, customerDisplayName, CUSTOMER_TEMPLATE_HEADER, CUSTOMER_TEMPLATE_EXAMPLE, type CustomerImportRow } from '../lib/customerImport'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  lang: 'sl' | 'en'
  typeLabels: { person: string; company: string }
  onDone: () => void
}

const L = {
  sl: {
    title: 'Uvoz strank', intro: 'Uvozite stranke iz Excela. Naložite Excel datoteko (.xlsx ali .xls) ali CSV. Prebere se prvi list.',
    template: 'Prenesi predlogo', pick: 'Izberite Excel ali CSV datoteko',
    columns: 'Stolpci: Tip (oseba ali podjetje), Ime, Priimek, Podjetje, ID za DDV, E-pošta, Telefon, Ulica, Poštna št., Kraj, Opombe. Pri podjetju sta ime in priimek kontaktna oseba.',
    preview: 'Predogled', newRow: 'Dodana',
    summary: (n: number, e: number) => `Dodanih bo: ${n}${e ? ` · Preskočenih zaradi napake: ${e}` : ''}`,
    errors: { type: 'neznan tip stranke', company: 'manjka naziv podjetja', person: 'manjka ime ali priimek' } as Record<string, string>,
    import: 'Uvozi', cancel: 'Prekliči', done: (n: number) => `Uvoženih strank: ${n}`, empty: 'V datoteki ni vrstic.', more: (n: number) => `… in še ${n} vrstic`,
    sheet: 'Stranke', file: 'predloga-stranke.xlsx',
  },
  en: {
    title: 'Import customers', intro: 'Import customers from Excel. Upload an Excel file (.xlsx or .xls) or CSV. The first sheet is read.',
    template: 'Download template', pick: 'Choose an Excel or CSV file',
    columns: 'Columns: Type (person or company), First name, Last name, Company, VAT ID, Email, Phone, Street, Postal code, City, Notes. For companies the first and last name are the contact person.',
    preview: 'Preview', newRow: 'New',
    summary: (n: number, e: number) => `To be added: ${n}${e ? ` · Skipped (errors): ${e}` : ''}`,
    errors: { type: 'unknown customer type', company: 'missing company name', person: 'missing first or last name' } as Record<string, string>,
    import: 'Import', cancel: 'Cancel', done: (n: number) => `Imported customers: ${n}`, empty: 'The file has no rows.', more: (n: number) => `… and ${n} more rows`,
    sheet: 'Customers', file: 'customers-template.xlsx',
  },
}

export default function CustomerImportModal({ open, onClose, companyId, lang, typeLabels, onDone }: Props) {
  const T = L[lang]
  const [rows, setRows] = useState<CustomerImportRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)

  // Like the services import: every valid row is added as a new customer
  const valid = (rows ?? []).filter(r => !r.error)
  const errors = (rows ?? []).filter(r => r.error)

  function close() { setRows(null); setFileName(''); onClose() }

  async function downloadTemplate() {
    const XLSX = await import('xlsx')   // loaded only when needed (keeps the app bundle small)
    const ws = XLSX.utils.aoa_to_sheet([CUSTOMER_TEMPLATE_HEADER, ...CUSTOMER_TEMPLATE_EXAMPLE])
    ws['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 24 }]
    // Keep phone / postal code as text so Excel does not drop leading zeros
    for (const ref of Object.keys(ws)) if (/^[GI]\d+$/.test(ref)) ws[ref].z = '@'
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, T.sheet)
    XLSX.writeFile(wb, T.file)
  }

  async function readFile(file: File) {
    setFileName(file.name)
    const buf = await file.arrayBuffer()
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      setRows(parseCustomerSheet(XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' })))
      return
    }
    // CSV: Excel may save as UTF-8 or Windows-1250 (Slovenian) — prefer UTF-8, fall back if it has broken chars
    let text = new TextDecoder('utf-8').decode(buf)
    if (text.includes('�')) text = new TextDecoder('windows-1250').decode(buf)
    setRows(parseCustomerCsv(text))
  }

  async function doImport() {
    if (!valid.length) return
    setImporting(true)
    const { error } = await supabase.from('customers').insert(valid.map(r => ({
      company_id: companyId, customer_type: r.customer_type, name: customerDisplayName(r),
      first_name: r.first_name, last_name: r.last_name,
      contact_person: r.customer_type === 'company' ? (`${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || null) : null,
      vat_number: r.vat_number, email: r.email, phone: r.phone,
      address_street: r.address_street, address_postal_code: r.address_postal_code, address_city: r.address_city,
      notes: r.notes, status: 'active',
    })) as any)
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
                    {rows.slice(0, 50).map(r => (
                      <tr key={r.line} className={r.error ? 'bg-[#fff8f3]' : ''}>
                        <td className="px-3 py-2 text-xs text-gray-400 w-10">{r.line}</td>
                        <td className="px-3 py-2 text-gray-900">
                          {customerDisplayName(r) || <span className="text-gray-300">—</span>}
                          {r.customer_type === 'company' && (r.first_name || r.last_name) && <div className="text-xs text-gray-400">{`${r.first_name ?? ''} ${r.last_name ?? ''}`.trim()}</div>}
                        </td>
                        <td className="px-3 py-2 text-gray-500 w-28 whitespace-nowrap">{typeLabels[r.customer_type]}</td>
                        <td className="px-3 py-2 text-gray-500 w-28">{r.address_city ?? ''}</td>
                        <td className="px-3 py-2 w-40 text-right">
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap" style={
                            r.error ? { backgroundColor: '#feeee1', border: '1px solid #fee0c8', color: '#9e3f00' }
                              : { backgroundColor: '#e0fced', border: '1px solid #d4f8e6', color: '#098259' }}>
                            {r.error ? T.errors[r.error] : T.newRow}
                          </span>
                        </td>
                      </tr>
                    ))}
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
