// "Clear all local data": everything the app keeps in this browser.
//   - service worker registrations (unregistered first, so nothing re-caches
//     behind our back) and every Cache Storage cache (precache + runtime)
//   - every IndexedDB database of this origin (watermark logo, the OCR
//     language data tesseract.js caches, anything a later tool adds)
//   - localStorage and sessionStorage (history, settings, language, theme,
//     side nav state, last PDF tool, …)
// In-memory state (results, object URLs, workers) goes with the reload the
// caller does afterwards: a reload discards the document, which revokes its
// blob: URLs and terminates its workers. The service worker registers and
// precaches again on that load.
// Every step is independent: one failing (a blocked database, a browser
// without indexedDB.databases) never stops the others, and the failures are
// reported so the UI can tell the user.

/** IndexedDB names the app is known to create, for browsers without
indexedDB.databases(): the resize tool's logo store and tesseract.js's
language-data cache (idb-keyval's default database). */
export const KNOWN_DATABASES = ['ic-resize', 'keyval-store']
/** Set in sessionStorage after clearing, read once on the next load to show
the "cleared" toast. */
export const CLEARED_FLAG = 'ic-cleared'
/** Fired on window before clearing, so views can stop their work and drop
their "leave page?" guard. */
export const CLEAR_EVENT = 'ic:clear-data'

export interface ClearEnv {
  localStorage?: Pick<Storage, 'clear'> | null
  sessionStorage?: Pick<Storage, 'clear'> | null
  indexedDB?: Pick<IDBFactory, 'deleteDatabase'> & { databases?: () => Promise<{ name?: string }[]> } | null
  caches?: Pick<CacheStorage, 'keys' | 'delete'> | null
  serviceWorker?: { getRegistrations(): Promise<readonly { unregister(): Promise<boolean> }[]> } | null
}

export interface ClearReport {
  /** Steps that failed (empty = everything cleared). */
  failed: string[]
  databases: string[]
  caches: string[]
  serviceWorkers: number
}

let clearing = false
/** True from the start of a clear until the page reloads: views skip their
"leave page?" prompt so the reload is not blocked. */
export function isClearingData(): boolean {
  return clearing
}

function deleteDatabase(idb: NonNullable<ClearEnv['indexedDB']>, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest
    try { req = idb.deleteDatabase(name) } catch (e) { reject(e); return }
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    // Another connection (another tab) still has it open: the delete is
    // queued and completes when that connection closes; our own tab's
    // connections close with the reload. Not a failure.
    req.onblocked = () => resolve()
  })
}

export function defaultEnv(): ClearEnv {
  const w = typeof window !== 'undefined' ? window : undefined
  const safe = <T>(f: () => T): T | null => { try { return f() } catch { return null } }
  return {
    localStorage: safe(() => w?.localStorage ?? null),
    sessionStorage: safe(() => w?.sessionStorage ?? null),
    indexedDB: safe(() => (typeof indexedDB !== 'undefined' ? indexedDB : null)),
    caches: safe(() => (typeof caches !== 'undefined' ? caches : null)),
    serviceWorker: safe(() => (typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? navigator.serviceWorker : null)),
  }
}

export async function clearAllLocalData(env: ClearEnv = defaultEnv()): Promise<ClearReport> {
  clearing = true
  const report: ClearReport = { failed: [], databases: [], caches: [], serviceWorkers: 0 }

  if (env.serviceWorker) {
    try {
      const regs = await env.serviceWorker.getRegistrations()
      for (const r of regs) {
        try { if (await r.unregister()) report.serviceWorkers++ } catch { report.failed.push('serviceWorker') }
      }
    } catch { report.failed.push('serviceWorker') }
  }

  if (env.caches) {
    try {
      for (const key of await env.caches.keys()) {
        try { await env.caches.delete(key); report.caches.push(key) } catch { report.failed.push(`cache:${key}`) }
      }
    } catch { report.failed.push('caches') }
  }

  if (env.indexedDB) {
    const names = new Set(KNOWN_DATABASES)
    if (typeof env.indexedDB.databases === 'function') {
      try {
        for (const d of await env.indexedDB.databases()) if (d.name) names.add(d.name)
      } catch { /* fall back to the known names */ }
    }
    for (const name of names) {
      try { await deleteDatabase(env.indexedDB, name); report.databases.push(name) } catch { report.failed.push(`indexedDB:${name}`) }
    }
  }

  try { env.localStorage?.clear() } catch { report.failed.push('localStorage') }
  try { env.sessionStorage?.clear() } catch { report.failed.push('sessionStorage') }
  return report
}

/** After clearing: leave the toast flag for the next load. */
export function markCleared(storage: Pick<Storage, 'setItem'> | null | undefined, ok: boolean): void {
  try { storage?.setItem(CLEARED_FLAG, ok ? 'ok' : 'partial') } catch { /* toast is a nicety */ }
}

/** On load: read and remove the flag ('ok' | 'partial' | null). */
export function takeClearedFlag(storage: Pick<Storage, 'getItem' | 'removeItem'> | null | undefined): 'ok' | 'partial' | null {
  try {
    const v = storage?.getItem(CLEARED_FLAG) ?? null
    if (v) storage?.removeItem(CLEARED_FLAG)
    return v === 'ok' || v === 'partial' ? v : null
  } catch {
    return null
  }
}
