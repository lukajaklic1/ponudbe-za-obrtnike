// Central thumbnail pipeline: render once, persist to storage, cache locally.
//
// Strategy (fast + private):
//  1. in-memory Map           — instant within a page
//  2. IndexedDB blob cache    — instant across reloads/tabs (survives session)
//  3. persisted thumb in storage (quote_attachments.thumb_path / quote_items.thumb_path)
//  4. only if none exist: render CAD (WASM) / PDF once, then persist + cache
//
// Everywhere (offer review/edit, inline kos, offers list, PDF) reads a tiny JPEG.
// CAD/PDF is never re-rendered after the first time.

import { supabase } from './supabase'
import { pdfFirstPageThumb } from './pdfThumb'

const BUCKET = 'quotations'

type ThumbKind = 'cad' | 'pdf' | 'other'
export function thumbKind(fileName: string): ThumbKind {
  const ext = (fileName.toLowerCase().split('.').pop() || '')
  if (['step', 'stp', 'iges', 'igs', 'stl', 'obj', 'ply', 'fbx'].includes(ext)) return 'cad'
  if (ext === 'pdf') return 'pdf'
  return 'other'
}

// ── IndexedDB blob cache ──────────────────────────────────────
const DB_NAME = 'costflow-thumbs'
const STORE = 'thumbs'
let dbPromise: Promise<IDBDatabase | null> | null = null

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE) }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch { resolve(null) }
  })
  return dbPromise
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openDB()
  if (!db) return null
  return new Promise(resolve => {
    try {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      r.onsuccess = () => resolve((r.result as string) ?? null)
      r.onerror = () => resolve(null)
    } catch { resolve(null) }
  })
}

async function idbSet(key: string, val: string): Promise<void> {
  const db = await openDB()
  if (!db) return
  try { db.transaction(STORE, 'readwrite').objectStore(STORE).put(val, key) } catch { /* noop */ }
}

const mem = new Map<string, string>()

async function getCached(key: string): Promise<string | null> {
  if (mem.has(key)) return mem.get(key)!
  const v = await idbGet(key)
  if (v) mem.set(key, v)
  return v
}

async function setCached(key: string, dataUrl: string): Promise<void> {
  mem.set(key, dataUrl)
  await idbSet(key, dataUrl)
}

// ── data-url <-> blob ─────────────────────────────────────────
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = reject
    fr.readAsDataURL(blob)
  })
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',')
  const mime = /:(.*?);/.exec(head)?.[1] || 'image/jpeg'
  const bin = atob(body)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

// ── storage helpers ───────────────────────────────────────────
async function downloadThumb(thumbPath: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage.from(BUCKET).download(thumbPath)
    if (!data) return null
    return await blobToDataUrl(data)
  } catch { return null }
}

async function persistThumb(companyId: string, id: string, dataUrl: string): Promise<string | null> {
  try {
    const path = `${companyId}/thumbs/${id}.jpg`
    const blob = dataUrlToBlob(dataUrl)
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (error) { console.error('persistThumb upload', error); return null }
    return path
  } catch (e) { console.error('persistThumb', e); return null }
}

async function renderThumb(att: any): Promise<string | null> {
  // Only PDF renders reliably off-screen (pdf.js). CAD (WebGL) is baked from the
  // live 3D viewer the first time it is shown (CadViewer onCapture → saveThumb),
  // because off-screen WebGL rendering does not fire reliably across browsers.
  if (thumbKind(att.file_name) !== 'pdf') return null
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(att.storage_path, 3600)
  if (!data?.signedUrl) return null
  return await pdfFirstPageThumb(data.signedUrl, att.id)
}

// ── public API ────────────────────────────────────────────────

// Fetch an already-persisted thumbnail by storage path, cached by `key`.
// Used for quote_items.thumb_path on the offers list (no re-render, no repeat downloads).
export async function getThumbByPath(key: string, thumbPath: string | null | undefined): Promise<string | null> {
  // Always check memory/IndexedDB first — thumbnail may have been baked this session
  // even if thumb_path hasn't been written to DB yet.
  const cached = await getCached(key)
  if (cached) return cached
  if (!thumbPath) return null
  const d = await downloadThumb(thumbPath)
  if (d) await setCached(key, d)
  return d
}

// Cache + persist a thumbnail data-url for an attachment (e.g. captured from the
// live CAD viewer when the user opens it). Skips work if already persisted.
export async function saveThumb(att: any, dataUrl: string): Promise<void> {
  if (!dataUrl) return
  await setCached(att.id, dataUrl)
  if (att.thumb_path) return
  const path = await persistThumb(att.company_id, att.id, dataUrl)
  if (path) {
    att.thumb_path = path
    supabase.from('quote_attachments').update({ thumb_path: path }).eq('id', att.id).then(() => {})
  }
}

// Ensure an attachment has a thumbnail; returns a data-url or null.
// Generates + persists once (backfill), then always served from cache/storage.
export async function ensureThumb(att: any): Promise<string | null> {
  // 1. local cache
  const cached = await getCached(att.id)
  if (cached) return cached
  // 2. persisted in storage
  if (att.thumb_path) {
    const d = await downloadThumb(att.thumb_path)
    if (d) { await setCached(att.id, d); return d }
  }
  // 3. generate once (cad/pdf only)
  if (thumbKind(att.file_name) === 'other') return null
  const rendered = await renderThumb(att)
  if (!rendered) return null
  await setCached(att.id, rendered)
  // persist in background so it's permanent everywhere
  persistThumb(att.company_id, att.id, rendered).then(path => {
    if (path) {
      att.thumb_path = path
      supabase.from('quote_attachments').update({ thumb_path: path }).eq('id', att.id).then(() => {})
    }
  }).catch(() => {})
  return rendered
}
