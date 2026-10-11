import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../hooks/useLanguage'
import { Upload, File, Trash2, Download, FileText, LayoutGrid, List, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ensureThumb, saveThumb } from '../lib/thumbs'
import { pdfFirstPageThumb } from '../lib/pdfThumb'
import { countAttachments } from '../utils/pluralize'
import CadViewer from './CadViewer'
import PdfViewer from './PdfViewer'

interface QuoteAttachmentsProps {
  quoteId?: string
  companyId: string
  quoteItemId?: string
  attachments: any[]
  onChange: (attachments: any[]) => void
  readonly?: boolean
  inline?: boolean
  preview?: boolean
}

type FileType = 'cad' | 'pdf' | 'bom' | 'other'
type ViewMode = 'grid' | 'list'

const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']

function getFileType(filename: string): FileType {
  const ext = filename.toLowerCase().split('.').pop() || ''
  const cadExts = ['step', 'stp', 'iges', 'igs', 'stl', 'obj', 'ply', 'fbx']

  if (cadExts.includes(ext)) return 'cad'
  if (ext === 'pdf') return 'pdf'
  if (imageExts.includes(ext)) return 'bom'   // trades: photos from the site
  return 'other'
}

function isImage(filename: string) {
  return imageExts.includes(filename.toLowerCase().split('.').pop() || '')
}


export default function QuoteAttachments({ quoteId, companyId, quoteItemId, attachments, onChange, readonly, inline, preview }: QuoteAttachmentsProps) {
  const { lang, t } = useLanguage()
  const kindLabels = { pdf: t.qp.attKind.drawing, cad: t.qp.attKind.cad, bom: t.qp.attKind.bom, other: t.qp.attKind.other }
  const [uploading, setUploading] = useState(false)
  const [filterType, setFilterType] = useState<FileType | 'all'>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [previewAtt, setPreviewAtt] = useState<any>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [cadUrls, setCadUrls] = useState<Record<string, string>>({})
  const [loadingThumbs, setLoadingThumbs] = useState<Set<string>>(new Set())
  const processingRef = useRef<Set<string>>(new Set())

  // Load cached thumbnails from IndexedDB/storage for all attachments.
  useEffect(() => {
    const toLoad = attachments.filter(a => !processingRef.current.has(a.id))
    if (toLoad.length === 0) return
    toLoad.forEach(a => processingRef.current.add(a.id))
    let cancelled = false
    ;(async () => {
      for (const att of toLoad) {
        if (cancelled) break
        try {
          const thumb = await ensureThumb(att)
          if (thumb && !cancelled) {
            setThumbs(prev => ({ ...prev, [att.id]: thumb }))
            // Notify parent so pieceThumbs re-runs (covers fresh-session load from storage)
            if (att.quote_item_id) onChange([...attachments.map(a => a.id === att.id ? { ...a, thumb_path: att.thumb_path } : a)])
          }
        } catch { /* noop */ }
      }
    })()
    return () => { cancelled = true }
  }, [attachments])

  // As soon as the preloaded signed URL for a PDF is available, render its thumbnail
  // directly via pdf.js — faster than ensureThumb creating its own signed URL.
  useEffect(() => {
    const pdfsReady = attachments.filter(a =>
      getFileType(a.file_name) === 'pdf' && cadUrls[a.id] && !thumbs[a.id])
    if (pdfsReady.length === 0) return
    pdfsReady.forEach(a => setLoadingThumbs(prev => { const s = new Set(prev); s.add(a.id); return s }))
    let cancelled = false
    pdfsReady.forEach(async att => {
      try {
        const thumb = await pdfFirstPageThumb(cadUrls[att.id], att.id)
        if (!cancelled) {
          if (thumb) { saveThumb(att, thumb); setThumbs(prev => ({ ...prev, [att.id]: thumb })) }
          setLoadingThumbs(prev => { const s = new Set(prev); s.delete(att.id); return s })
        }
      } catch { setLoadingThumbs(prev => { const s = new Set(prev); s.delete(att.id); return s }) }
    })
    return () => { cancelled = true }
  }, [cadUrls])

  // Preload signed URLs for ALL attachments so clicks are instant (no wait on signed URL fetch).
  // CAD-specific: also used to render the mini live-viewer for thumbnail baking.
  useEffect(() => {
    const missing = attachments.filter(a => !cadUrls[a.id])
    if (missing.length === 0) return
    let cancelled = false
    missing.forEach(async att => {
      const { data } = await supabase.storage.from('quotations').createSignedUrl(att.storage_path, 3600)
      if (!cancelled && data?.signedUrl) setCadUrls(prev => ({ ...prev, [att.id]: data.signedUrl }))
    })
    return () => { cancelled = true }
  }, [attachments])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || !quoteId) return
    setUploading(true)

    for (const file of e.target.files) {
      try {
        const storagePath = `${companyId}/quotes/${quoteId}/${Date.now()}_${file.name}`

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('quotations')
          .upload(storagePath, file)
        if (uploadError) throw uploadError

        // Insert into database
        const { data, error: dbError } = await supabase
          .from('quote_attachments')
          .insert([{
            company_id: companyId,
            quote_id: quoteId,
            quote_item_id: quoteItemId || null,
            file_name: file.name,
            file_size: file.size,
            storage_path: storagePath,
          }])
          .select()
          .single()

        if (dbError) throw dbError

        // Update state with new attachment
        onChange([...attachments, data])

        // Generate + persist its thumbnail once (so it's instant everywhere afterwards)
        ensureThumb(data).then(thumb => {
          if (thumb) setThumbs(prev => ({ ...prev, [data.id]: thumb }))
        }).catch(() => {})
      } catch (err) {
        console.error('Upload error:', err)
      }
    }

    setUploading(false)
    e.target.value = ''
  }

  async function openPreview(att: any) {
    setPreviewAtt(att)
    // Use preloaded URL if available, otherwise fetch fresh
    if (cadUrls[att.id]) { setPreviewUrl(cadUrls[att.id]); return }
    setPreviewUrl(null)
    const { data } = await supabase.storage.from('quotations').createSignedUrl(att.storage_path, 3600)
    if (data?.signedUrl) { setCadUrls(prev => ({ ...prev, [att.id]: data.signedUrl })); setPreviewUrl(data.signedUrl) }
  }

  function closePreview() {
    setPreviewAtt(null)
    setPreviewUrl(null)
  }

  async function deleteFile(att: any) {
    try {
      await Promise.all([
        supabase.storage.from('quotations').remove([att.storage_path]),
        supabase.from('quote_attachments').delete().eq('id', att.id),
      ])
      onChange(attachments.filter(a => a.id !== att.id))
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  async function downloadFile(att: any) {
    try {
      const { data } = await supabase.storage.from('quotations').createSignedUrl(att.storage_path, 3600)
      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  // preview (offer review) shows ALL attachments — quote-level + every item-level.
  // inline (quoteItemId set) shows only that item's. edit mode shows quote-level only.
  const filtered = preview
    ? attachments
    : quoteItemId
      ? attachments.filter(a => a.quote_item_id === quoteItemId)
      : attachments.filter(a => !a.quote_item_id)

  const counts = {
    cad: filtered.filter(a => getFileType(a.file_name) === 'cad').length,
    pdf: filtered.filter(a => getFileType(a.file_name) === 'pdf').length,
    bom: filtered.filter(a => getFileType(a.file_name) === 'bom').length,
    other: filtered.filter(a => getFileType(a.file_name) === 'other').length,
  }

  let displayed = filtered
  if (filterType !== 'all') {
    displayed = filtered.filter(a => getFileType(a.file_name) === filterType)
  }

  if (preview) {
    return (
      <>
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-4 h-full">
        {/* Header: one row on desktop, two rows on mobile */}
        <div className="flex flex-wrap gap-y-2 items-center gap-x-3">
          {/* Left: icon + count */}
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-semibold text-gray-700">
              {countAttachments(lang, filtered.length)}
            </span>
          </div>

          {/* Filter pills — inline on desktop, wraps on mobile */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['bom', 'pdf', 'other'] as const).map(type => (
              <button key={type}
                onClick={() => setFilterType(f => f === type ? 'all' : type)}
                className={`px-2 py-0.5 rounded-md text-xs font-medium border transition-all ${filterType === type ? 'border-[#3a7df2] bg-[#deeafd] text-[#3a7df2]' : 'border-[#deeafd] bg-[#eff5fe] text-[#3a7df2] hover:border-[#3a7df2]'}`}
              >
                {kindLabels[type]} ({counts[type]})
              </button>
            ))}
          </div>

          {/* Right: view toggle + upload */}
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
              <button onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all duration-100 ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}>
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all duration-100 ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}>
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
            {!readonly && (
              <>
                <input type="file" multiple onChange={handleFileUpload} disabled={uploading || !quoteId} className="hidden" id="header-upload" />
                <label htmlFor="header-upload" className={`flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium ${quoteId ? 'cursor-pointer text-gray-700 hover:border-gray-400 hover:bg-[#f6f6f6]' : 'cursor-not-allowed opacity-50 text-gray-400'}`}>
                  <Upload className="w-4 h-4" />
                  {t.qp.uploadFiles}
                </label>
              </>
            )}
          </div>
        </div>

        {/* File grid/list */}
        {(() => {
          const typeBadge: Record<FileType, string> = {
            cad: 'bg-blue-50 text-blue-600',
            pdf: 'bg-rose-50 text-rose-500',
            bom: 'bg-emerald-50 text-emerald-600',
            other: 'bg-gray-100 text-gray-500',
          }
          return viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1 overflow-y-auto auto-rows-min content-start">
            {displayed.length === 0 ? (
              <p className="text-xs text-gray-400 col-span-2 sm:col-span-3">{t.qp.noFiles}</p>
            ) : (
              displayed.map(att => {
                const fileType = getFileType(att.file_name)
                const isCad = fileType === 'cad'
                const isPdf = fileType === 'pdf'
                return (
                  <div key={att.id}
                    className="flex flex-col rounded-xl border border-gray-200 overflow-hidden group bg-white cursor-pointer hover:border-gray-300 hover:shadow-md transition-all duration-150"
                    onClick={() => openPreview(att)}>
                    {/* Preview */}
                    <div className="w-full h-[120px] bg-[#f7f7f8] flex items-center justify-center overflow-hidden relative">
                      {thumbs[att.id] ? (
                        <img src={thumbs[att.id]} alt="" className="w-full h-full object-contain" />
                      ) : isCad && cadUrls[att.id] ? (
                        <div className="w-full h-full pointer-events-none" onClick={e => e.stopPropagation()}>
                          <CadViewer
                            url={cadUrls[att.id]}
                            fileName={att.file_name}
                            onCapture={async dataUrl => {
                              await saveThumb(att, dataUrl)
                              setThumbs(prev => ({ ...prev, [att.id]: dataUrl }))
                              if (att.quote_item_id) onChange([...attachments.map(a => a.id === att.id ? { ...a, thumb_path: att.thumb_path } : a)])
                            }}
                          />
                        </div>
                      ) : isCad ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-400 rounded-full animate-spin" />
                        </div>
                      ) : isPdf && loadingThumbs.has(att.id) ? (
                        <div className="w-full h-full bg-rose-50 flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-rose-200 border-t-rose-400 rounded-full animate-spin" />
                        </div>
                      ) : isPdf ? (
                        <div className="w-full h-full bg-rose-50 flex items-center justify-center">
                          <FileText className="w-9 h-9 text-rose-300" />
                        </div>
                      ) : isImage(att.file_name) && cadUrls[att.id] ? (
                        <img src={cadUrls[att.id]} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <File className="w-9 h-9 text-gray-300" />
                      )}
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/[0.04] transition-colors pointer-events-none" />
                      {/* Actions */}
                      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); downloadFile(att) }}
                          className="w-6 h-6 bg-white/90 backdrop-blur-sm rounded-full shadow-sm flex items-center justify-center hover:bg-white hover:text-blue-600 text-gray-500 transition-colors">
                          <Download className="w-3 h-3" />
                        </button>
                        {!readonly && (
                          <button onClick={(e) => { e.stopPropagation(); deleteFile(att) }}
                            className="w-6 h-6 bg-white/90 backdrop-blur-sm rounded-full shadow-sm flex items-center justify-center hover:bg-white hover:text-red-500 text-gray-500 transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Footer */}
                    <div className="px-2.5 py-2 border-t border-gray-100">
                      <p className="text-[11px] font-semibold text-gray-800 truncate leading-tight mb-1.5">{att.file_name}</p>
                      <div className="flex items-center justify-between gap-1">
                        <select
                          className={`text-[10px] font-semibold rounded-md px-1.5 py-0.5 cursor-pointer border-none appearance-none focus:outline-none transition-colors ${typeBadge[fileType]}`}
                          defaultValue={fileType}
                          onClick={(e) => e.stopPropagation()}
                          onChange={async (e) => {
                            e.stopPropagation()
                            await supabase.from('quote_attachments').update({ kind: e.target.value }).eq('id', att.id)
                          }}
                        >
                          <option value="pdf">{kindLabels.pdf}</option>
                          <option value="cad">{kindLabels.cad}</option>
                          <option value="bom">{kindLabels.bom}</option>
                          <option value="other">{kindLabels.other}</option>
                        </select>
                        <span className="text-[10px] text-gray-400 font-medium shrink-0">{(att.file_size / 1024).toFixed(0)} KB</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1">
            {displayed.length === 0 ? (
              <p className="text-xs text-gray-400">{t.qp.noFiles}</p>
            ) : (
              displayed.map(att => {
                const fileType = getFileType(att.file_name)
                return (
                <div key={att.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer group transition-colors"
                  onClick={() => openPreview(att)}>
                  {/* Thumb or icon */}
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {thumbs[att.id]
                      ? <img src={thumbs[att.id]} alt="" className="w-full h-full object-contain" />
                      : fileType === 'pdf'
                        ? <FileText className="w-4 h-4 text-rose-400" />
                        : <File className="w-4 h-4 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate leading-tight">{att.file_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-semibold rounded px-1 py-0.5 ${typeBadge[fileType]}`}>{kindLabels[fileType]}</span>
                      <span className="text-[10px] text-gray-400">{(att.file_size / 1024).toFixed(0)} KB</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); downloadFile(att) }} className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {!readonly && (
                      <button onClick={(e) => { e.stopPropagation(); deleteFile(att) }} className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )})
            )}
          </div>
        )
        })()}

      </div>

      {/* Full-screen preview modal */}
      {previewAtt && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex flex-col" onClick={closePreview}>
          <div className="flex items-center justify-between px-6 py-3 bg-gray-900 text-white" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <button onClick={() => { const idx = displayed.findIndex(a => a.id === previewAtt.id); if (idx > 0) openPreview(displayed[idx - 1]) }} className="p-1 hover:bg-gray-700 rounded"><ChevronLeft className="w-5 h-5" /></button>
              <span className="text-sm font-medium">{previewAtt.file_name}</span>
              <button onClick={() => { const idx = displayed.findIndex(a => a.id === previewAtt.id); if (idx < displayed.length - 1) openPreview(displayed[idx + 1]) }} className="p-1 hover:bg-gray-700 rounded"><ChevronRight className="w-5 h-5" /></button>
            </div>
            <button onClick={closePreview} className="p-1 hover:bg-gray-700 rounded"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-hidden" onClick={e => e.stopPropagation()}>
            {!previewUrl ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
              </div>
            ) : getFileType(previewAtt.file_name) === 'cad' ? (
              <CadViewer url={previewUrl} fileName={previewAtt.file_name} onCapture={dataUrl => { saveThumb(previewAtt, dataUrl); setThumbs(prev => prev[previewAtt.id] ? prev : { ...prev, [previewAtt.id]: dataUrl }) }} />
            ) : getFileType(previewAtt.file_name) === 'pdf' ? (
              <PdfViewer url={previewUrl} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <img src={previewUrl} alt={previewAtt.file_name} className="max-w-full max-h-full object-contain" />
              </div>
            )}
          </div>
        </div>
      )}
      </>
    )
  }

  if (inline) {
    const [selectedAtt, setSelectedAtt] = useState<any>(filtered[0] ?? null)
    const [selectedUrl, setSelectedUrl] = useState<string | null>(null)
    const [inlineFilterType, setInlineFilterType] = useState<FileType | 'all'>('all')

    const inlineDisplayed = inlineFilterType === 'all' ? filtered : filtered.filter(a => getFileType(a.file_name) === inlineFilterType)
    const inlineCounts = {
      pdf: filtered.filter(a => getFileType(a.file_name) === 'pdf').length,
      cad: filtered.filter(a => getFileType(a.file_name) === 'cad').length,
      bom: filtered.filter(a => getFileType(a.file_name) === 'bom').length,
      other: filtered.filter(a => getFileType(a.file_name) === 'other').length,
    }

    // Select a file → fetch its signed URL so the live viewer renders it directly
    // (interactive, in-window). The render also bakes the thumbnail for grids/lists.
    async function selectAtt(att: any) {
      setSelectedAtt(att)
      if (cadUrls[att.id]) { setSelectedUrl(cadUrls[att.id]); return }
      setSelectedUrl(null)
      const { data } = await supabase.storage.from('quotations').createSignedUrl(att.storage_path, 3600)
      if (data?.signedUrl) { setCadUrls(prev => ({ ...prev, [att.id]: data.signedUrl })); setSelectedUrl(data.signedUrl) }
    }

    // Auto-select first file on mount.
    useEffect(() => {
      if (filtered.length > 0 && (!selectedAtt || !filtered.some(a => a.id === selectedAtt.id))) selectAtt(filtered[0])
    }, [filtered.length])

    // Race fix: once the preloaded URL arrives for the selected file, set it immediately.
    useEffect(() => {
      if (selectedAtt && !selectedUrl && cadUrls[selectedAtt.id]) setSelectedUrl(cadUrls[selectedAtt.id])
    }, [cadUrls, selectedAtt?.id])

    const selFt = selectedAtt ? getFileType(selectedAtt.file_name) : null
    // Bake the thumbnail in the background (for grid/list/table); the big preview
    // stays the live interactive viewer.
    const bakeSelected = (dataUrl: string) => {
      if (!selectedAtt) return
      saveThumb(selectedAtt, dataUrl)
      setThumbs(prev => prev[selectedAtt.id] ? prev : { ...prev, [selectedAtt.id]: dataUrl })
    }

    return (
      <>
      <div className="bg-white rounded-xl border border-gray-200 flex flex-col h-full overflow-hidden">
        {/* Top: large interactive preview — rotate the model directly here. */}
        <div className="min-h-0 bg-gray-50 border-b border-gray-200 relative" style={{flex: '0 0 68%'}}>
          {!selectedAtt ? (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">{t.qp.noFiles}</div>
          ) : !selectedUrl ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-7 h-7 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : selFt === 'cad' ? (
            <CadViewer url={selectedUrl} fileName={selectedAtt.file_name} onCapture={bakeSelected} />
          ) : selFt === 'pdf' ? (
            <PdfViewer url={selectedUrl} />
          ) : (
            <img src={selectedUrl} alt={selectedAtt.file_name} className="w-full h-full object-contain" />
          )}
          {selectedAtt && (
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs px-3 py-1.5 truncate pointer-events-none">
              {selectedAtt.file_name}
            </div>
          )}
        </div>

        {/* Bottom: header row + thumbnail grid — scrollable */}
        <div className="flex flex-col flex-1 min-h-0 border-t border-gray-100">
          {/* Header row — sticky, doesn't scroll */}
          <div className="flex items-center gap-2 flex-wrap px-4 py-3 shrink-0">
            <FileText className="w-4 h-4 text-gray-500 shrink-0" />
            <span className="text-xs font-semibold text-gray-600 shrink-0">
              {countAttachments(lang, filtered.length)}
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {(['pdf','cad','bom','other'] as const).map((type) => (
                <button key={type} onClick={() => setInlineFilterType(inlineFilterType === type ? 'all' : type)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${inlineFilterType === type ? 'border-[#3a7df2] bg-[#deeafd] text-[#3a7df2]' : 'border-[#deeafd] bg-[#eff5fe] text-[#3a7df2] hover:border-[#3a7df2]'}`}>
                  {kindLabels[type]} ({inlineCounts[type]})
                </button>
              ))}
            </div>
            {!readonly && (
              <div className="ml-auto shrink-0">
                <input type="file" multiple onChange={handleFileUpload} disabled={uploading || !quoteId} className="hidden" id="inline-upload" />
                <label htmlFor="inline-upload" className={`flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium ${quoteId ? 'cursor-pointer text-gray-700 hover:border-gray-300 hover:bg-gray-50' : 'cursor-not-allowed opacity-40 text-gray-400'}`}>
                  <Upload className="w-3.5 h-3.5" /> {t.qp.uploadFiles}
                </label>
              </div>
            )}
          </div>

          {/* Thumbnails — scrollable */}
          <div className="overflow-y-auto flex-1 min-h-0 px-4 pb-4">
            {(() => {
              const inlineTypeBadge: Record<FileType, string> = {
                cad: 'bg-blue-50 text-blue-600',
                pdf: 'bg-rose-50 text-rose-500',
                bom: 'bg-emerald-50 text-emerald-600',
                other: 'bg-gray-100 text-gray-500',
              }
              return (
            <div className="grid grid-cols-3 gap-2.5">
              {inlineDisplayed.length === 0 ? (
                <p className="text-xs text-gray-400 col-span-3 py-2">{t.qp.noFiles}</p>
              ) : inlineDisplayed.map(att => {
                const ft = getFileType(att.file_name)
                const isSel = selectedAtt?.id === att.id
                return (
                  <div key={att.id} onClick={() => selectAtt(att)}
                    className={`flex flex-col rounded-xl overflow-hidden cursor-pointer transition-all duration-150 group border-2 ${isSel ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
                    <div className="w-full h-[90px] bg-[#f7f7f8] flex items-center justify-center overflow-hidden relative">
                      {thumbs[att.id] ? (
                        <img src={thumbs[att.id]} alt="" className="w-full h-full object-contain" />
                      ) : ft === 'cad' && cadUrls[att.id] ? (
                        <div className="w-full h-full pointer-events-none">
                          <CadViewer
                            url={cadUrls[att.id]}
                            fileName={att.file_name}
                            onCapture={async dataUrl => {
                              await saveThumb(att, dataUrl)
                              setThumbs(prev => ({ ...prev, [att.id]: dataUrl }))
                              if (att.quote_item_id) onChange([...attachments.map(a => a.id === att.id ? { ...a, thumb_path: att.thumb_path } : a)])
                            }}
                          />
                        </div>
                      ) : ft === 'cad' ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-400 rounded-full animate-spin" />
                        </div>
                      ) : ft === 'pdf' && loadingThumbs.has(att.id) ? (
                        <div className="w-full h-full bg-rose-50 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-rose-200 border-t-rose-400 rounded-full animate-spin" />
                        </div>
                      ) : ft === 'pdf' ? (
                        <div className="w-full h-full bg-rose-50 flex items-center justify-center">
                          <FileText className="w-7 h-7 text-rose-300" />
                        </div>
                      ) : isImage(att.file_name) && cadUrls[att.id] ? (
                        <img src={cadUrls[att.id]} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <File className="w-7 h-7 text-gray-300" />
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/[0.04] transition-colors pointer-events-none" />
                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={e => { e.stopPropagation(); downloadFile(att) }}
                          className="w-5 h-5 bg-white/90 rounded-full shadow-sm flex items-center justify-center hover:bg-white hover:text-blue-600 text-gray-500 transition-colors">
                          <Download className="w-2.5 h-2.5" />
                        </button>
                        {!readonly && (
                          <button onClick={e => { e.stopPropagation(); deleteFile(att) }}
                            className="w-5 h-5 bg-white/90 rounded-full shadow-sm flex items-center justify-center hover:bg-white hover:text-red-500 text-gray-500 transition-colors">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="px-2 py-1.5 border-t border-gray-100">
                      <p className="text-[10px] font-semibold text-gray-800 truncate leading-tight mb-1">{att.file_name}</p>
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-semibold rounded px-1 py-0.5 ${inlineTypeBadge[ft]}`}>{kindLabels[ft]}</span>
                        <span className="text-[9px] text-gray-400">{(att.file_size / 1024).toFixed(0)} KB</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Full-screen viewer — loads the real CAD/PDF only on click */}
      {previewAtt && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex flex-col" onClick={closePreview}>
          <div className="flex items-center justify-between px-6 py-3 bg-gray-900 text-white" onClick={e => e.stopPropagation()}>
            <span className="text-sm font-medium truncate">{previewAtt.file_name}</span>
            <button onClick={closePreview} className="p-1 hover:bg-gray-700 rounded"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-hidden" onClick={e => e.stopPropagation()}>
            {!previewUrl ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
              </div>
            ) : getFileType(previewAtt.file_name) === 'cad' ? (
              <CadViewer url={previewUrl} fileName={previewAtt.file_name} onCapture={dataUrl => { saveThumb(previewAtt, dataUrl); setThumbs(prev => prev[previewAtt.id] ? prev : { ...prev, [previewAtt.id]: dataUrl }) }} />
            ) : getFileType(previewAtt.file_name) === 'pdf' ? (
              <PdfViewer url={previewUrl} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <img src={previewUrl} alt={previewAtt.file_name} className="max-w-full max-h-full object-contain" />
              </div>
            )}
          </div>
        </div>
      )}
      </>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-4">
      {!readonly && (
        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium text-[#7f7f7f]">{quoteItemId ? 'Item Files' : 'Quote Files'}</span>
          <div className="flex items-center gap-2">
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              disabled={uploading || !quoteId}
              className="hidden"
              id={quoteItemId ? `item-upload-${quoteItemId}` : 'quote-upload'}
            />
            <label htmlFor={quoteItemId ? `item-upload-${quoteItemId}` : 'quote-upload'} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload Files'}
            </label>
          </div>
        </label>
      )}

      {filtered.length > 0 && (
        <div className="flex flex-col gap-2">
          {filtered.map(att => (
            <div key={att.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <File className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 truncate">{att.file_name}</span>
              </div>
              <div className="flex gap-1 ml-2">
                <button
                  onClick={() => downloadFile(att)}
                  className="p-1 text-gray-400 hover:text-blue-600"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                {!readonly && (
                  <button
                    onClick={() => deleteFile(att)}
                    className="ml-1 p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
