// The watermark logo, kept in IndexedDB so it is there next visit (settings
// in localStorage hold no binary). One record: the image bytes and its
// original name. SVG logos are rasterised once on upload (1024 px on the
// long side, transparency kept) so every context — including a worker,
// where createImageBitmap cannot decode SVG — draws the same PNG.
// Storage failures (private mode, quota) only mean the logo is not
// remembered; the current session still works.

export interface StoredLogo {
  blob: Blob
  name: string
}

const DB = 'ic-resize'
const STORE = 'logo'
const KEY = 'current'
export const LOGO_TYPES = ['image/png', 'image/webp', 'image/svg+xml', 'image/jpeg', 'image/gif', 'image/avif']
export const LOGO_ACCEPT = 'image/png,image/webp,image/svg+xml,image/jpeg,.svg'
/** Logos above this are refused (a logo is small; this stops a 40 MP photo). */
export const LOGO_MAX_BYTES = 8 * 1024 * 1024
const SVG_RASTER = 1024

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return }
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => { db.close(); resolve(req.result) }
    t.onerror = () => { db.close(); reject(t.error) }
    t.onabort = () => { db.close(); reject(t.error) }
  }))
}

export async function loadLogo(): Promise<StoredLogo | null> {
  try {
    const v = await tx<StoredLogo | undefined>('readonly', (s) => s.get(KEY) as IDBRequest<StoredLogo | undefined>)
    return v && v.blob instanceof Blob ? v : null
  } catch {
    return null
  }
}

export async function saveLogo(logo: StoredLogo): Promise<void> {
  try { await tx('readwrite', (s) => s.put(logo, KEY)) } catch { /* not remembered */ }
}

export async function clearLogo(): Promise<void> {
  try { await tx('readwrite', (s) => s.delete(KEY)) } catch { /* nothing stored */ }
}

export function isSvg(file: Blob & { name?: string }): boolean {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name ?? '')
}

/** Main thread: SVG → PNG (long side 1024, or the SVG's own size if larger). */
export async function rasterizeSvg(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file.type === 'image/svg+xml' ? file : new Blob([file], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('svg'))
      img.src = url
    })
    const nw = img.naturalWidth || SVG_RASTER
    const nh = img.naturalHeight || SVG_RASTER
    const k = Math.max(1, SVG_RASTER / Math.max(nw, nh))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(nw * k))
    c.height = Math.max(1, Math.round(nh * k))
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    const out = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'))
    if (!out) throw new Error('svg')
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Prepare an uploaded file as the logo (rasterising SVG). */
export async function prepareLogo(file: File): Promise<StoredLogo> {
  if (file.size > LOGO_MAX_BYTES) throw new Error('logoTooBig')
  const blob = isSvg(file) ? await rasterizeSvg(file) : file
  return { blob, name: file.name }
}
