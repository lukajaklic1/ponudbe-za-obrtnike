// Force online-3d-viewer's occt loader to use our self-hosted /occt/ files via an
// ABSOLUTE url. The occt worker is a blob: worker (null/blob base url) — importScripts
// and the wasm fetch MUST use an absolute url, a root-relative '/occt/' fails to resolve
// against a blob: base. We serve /occt/ with ACAO:* in vercel.json.
//
// IMPORTANT: normalize from ANY prior state (CDN, relative '/occt/', or already-absolute).
// Vercel caches node_modules, so an old postinstall may have left a stale (wrong) patch —
// a simple find-the-CDN-string replace would skip it. We rewrite the baseUrl assignment
// unconditionally instead.
import { readFileSync, writeFileSync, existsSync } from 'fs'

const file = 'node_modules/online-3d-viewer/build/engine/o3dv.module.js'
const ABS = "globalThis.location.origin + '/occt/'"

if (!existsSync(file)) {
  console.log('patch-occt: module not found, skipped')
  process.exit(0)
}
let src = readFileSync(file, 'utf8')

// The occt worker baseUrl is the only `let baseUrl = ...;` in this module (CreateOcctWorker).
const re = /let baseUrl = [^;]+;/
const m = src.match(re)
if (!m) {
  console.log('patch-occt: baseUrl assignment not found (loader changed?) — skipped')
  process.exit(0)
}

const desired = `let baseUrl = ${ABS};`
if (m[0] === desired) {
  console.log('patch-occt: already absolute /occt/, ok')
} else {
  src = src.replace(re, desired)
  writeFileSync(file, src)
  console.log(`patch-occt: normalized "${m[0]}" -> "${desired}"`)
}
