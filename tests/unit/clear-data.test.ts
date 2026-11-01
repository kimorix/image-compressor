import { describe, expect, it } from 'vitest'
import {
  CLEARED_FLAG, KNOWN_DATABASES, clearAllLocalData, isClearingData, markCleared, takeClearedFlag, type ClearEnv,
} from '../../src/shared/lib/clear-data'
import { MESSAGES } from '../../src/shared/i18n'

class MemStorage {
  map = new Map<string, string>()
  getItem(k: string) { return this.map.get(k) ?? null }
  setItem(k: string, v: string) { this.map.set(k, String(v)) }
  removeItem(k: string) { this.map.delete(k) }
  clear() { this.map.clear() }
}

/** Fake IndexedDB factory: deleteDatabase answers async like the real one. */
function fakeIdb(names: string[], opts: { blocked?: string[]; failing?: string[]; noList?: boolean } = {}) {
  const dbs = new Set(names)
  const deleted: string[] = []
  const factory = {
    deleteDatabase(name: string) {
      const req: Record<string, unknown> = { error: null }
      setTimeout(() => {
        if (opts.failing?.includes(name)) { req.error = new Error('nope'); (req.onerror as () => void)?.(); return }
        if (opts.blocked?.includes(name)) { (req.onblocked as () => void)?.(); return }
        dbs.delete(name)
        deleted.push(name)
        ;(req.onsuccess as () => void)?.()
      }, 0)
      return req as unknown as IDBOpenDBRequest
    },
    databases: opts.noList ? undefined : async () => [...dbs].map((name) => ({ name })),
  }
  return { factory, dbs, deleted }
}

function fakeCaches(keys: string[]) {
  const set = new Set(keys)
  return { set, api: { keys: async () => [...set], delete: async (k: string) => set.delete(k) } }
}

function fakeSw(n: number) {
  let regs = Array.from({ length: n }, () => ({ unregister: async () => { regs = regs.slice(1); return true } }))
  return { get count() { return regs.length }, api: { getRegistrations: async () => regs.slice() } }
}

describe('clear all local data', () => {
  it('empties IndexedDB, Cache Storage, service workers, localStorage and sessionStorage', async () => {
    const local = new MemStorage()
    local.setItem('ic-history', '[]')
    local.setItem('ic-lang', 'zh')
    local.setItem('ic-sidenav', 'rail')
    const session = new MemStorage()
    session.setItem('scroll:compress', '120')
    const idb = fakeIdb(['ic-resize', 'keyval-store', 'something-else'])
    const caches = fakeCaches(['workbox-precache-v2-https://x/', 'ic-runtime'])
    const sw = fakeSw(1)
    const env: ClearEnv = { localStorage: local, sessionStorage: session, indexedDB: idb.factory, caches: caches.api, serviceWorker: sw.api }
    const report = await clearAllLocalData(env)
    expect(report.failed).toEqual([])
    expect(local.map.size).toBe(0)
    expect(session.map.size).toBe(0)
    expect(idb.dbs.size).toBe(0)
    expect(caches.set.size).toBe(0)
    expect(sw.count).toBe(0)
    expect(report.serviceWorkers).toBe(1)
    expect(report.databases.sort()).toEqual(['ic-resize', 'keyval-store', 'something-else'])
    expect(isClearingData()).toBe(true)
  })

  it('falls back to the known database names without indexedDB.databases()', async () => {
    const idb = fakeIdb(['ic-resize', 'keyval-store'], { noList: true })
    const report = await clearAllLocalData({ indexedDB: idb.factory })
    expect(idb.dbs.size).toBe(0)
    expect(report.databases.sort()).toEqual([...KNOWN_DATABASES].sort())
  })

  it('keeps going when one step fails and reports it', async () => {
    const local = new MemStorage()
    local.setItem('a', '1')
    const idb = fakeIdb(['ic-resize', 'bad', 'busy'], { failing: ['bad'], blocked: ['busy'] })
    const caches = { keys: async () => { throw new Error('denied') }, delete: async () => false }
    const report = await clearAllLocalData({ localStorage: local, indexedDB: idb.factory, caches })
    expect(report.failed).toEqual(['caches', 'indexedDB:bad'])
    expect(local.map.size).toBe(0)
    expect(idb.deleted).toContain('ic-resize')
    // A delete blocked by another tab is queued, not failed.
    expect(report.databases).toContain('busy')
  })

  it('survives a browser without any of the storages', async () => {
    const report = await clearAllLocalData({})
    expect(report.failed).toEqual([])
  })

  it('leaves a one-shot flag for the toast after the reload', () => {
    const s = new MemStorage()
    markCleared(s, true)
    expect(s.getItem(CLEARED_FLAG)).toBe('ok')
    expect(takeClearedFlag(s)).toBe('ok')
    expect(takeClearedFlag(s)).toBeNull()
    expect(s.map.size).toBe(0)
    markCleared(s, false)
    expect(takeClearedFlag(s)).toBe('partial')
    expect(takeClearedFlag(null)).toBeNull()
  })

  it('has the dialog and toast copy in all six languages', () => {
    const keys = ['clearData', 'clearDataTitle', 'clearDataIntro', 'clearDataHistory', 'clearDataSettings', 'clearDataFiles', 'clearDataOffline', 'clearDataSession', 'clearDataReload', 'clearDataConfirm', 'clearDataCancel', 'clearDataWorking', 'clearDataDone', 'clearDataFail']
    for (const [code, m] of Object.entries(MESSAGES)) {
      for (const k of keys) {
        expect(m[k], `${code}.${k}`).toBeTypeOf('string')
        expect((m[k] as string).length, `${code}.${k}`).toBeGreaterThan(1)
      }
    }
  })
})

describe('clearAllLocalData never hangs', () => {
  it('gives up on a step that never settles and still clears storage', async () => {
    const { clearAllLocalData } = await import('../../src/shared/lib/clear-data')
    const never = () => new Promise<never>(() => {})
    let cleared = 0
    const report = await clearAllLocalData({
      localStorage: { clear: () => { cleared++ } },
      sessionStorage: { clear: () => { cleared++ } },
      caches: { keys: never, delete: never } as never,
      serviceWorker: { getRegistrations: never },
      indexedDB: { deleteDatabase: () => ({}) as IDBOpenDBRequest, databases: never } as never,
    }, 20)
    expect(cleared).toBe(2)
    expect(report.failed).toContain('caches')
    expect(report.failed).toContain('serviceWorker')
    expect(report.failed.some((f) => f.startsWith('indexedDB:'))).toBe(true)
  })
})
