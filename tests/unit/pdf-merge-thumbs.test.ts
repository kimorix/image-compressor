import { describe, expect, it } from 'vitest'
import { ThumbLru, thumbKey } from '../../src/features/pdf-merge/lib/thumbs'
import { CancelledError, runInWorker, SourceLockedError, type WorkerLike } from '../../src/features/pdf-merge/lib/client'
import type { MergeJob } from '../../src/features/pdf-merge/lib/write'

describe('thumbnail LRU', () => {
  it('evicts the least recently used and reports it', () => {
    const evicted: string[] = []
    const lru = new ThumbLru(3, (k) => evicted.push(k))
    lru.set('a', 'u1')
    lru.set('b', 'u2')
    lru.set('c', 'u3')
    expect(lru.get('a')).toBe('u1') // a is now newest
    lru.set('d', 'u4')
    expect(evicted).toEqual(['b'])
    expect(lru.has('b')).toBe(false)
    expect(lru.size).toBe(3)
  })
  it('replacing a key revokes the old url; drops a whole source', () => {
    const evicted: [string, string][] = []
    const lru = new ThumbLru(10, (k, u) => evicted.push([k, u]))
    lru.set(thumbKey('f1', 0), 'x')
    lru.set(thumbKey('f1', 0), 'y')
    lru.set(thumbKey('f10', 0), 'z')
    expect(evicted).toEqual([['f1:0', 'x']])
    lru.dropPrefix('f1:')
    expect(evicted).toEqual([['f1:0', 'x'], ['f1:0', 'y']])
    expect(lru.has('f10:0')).toBe(true)
    lru.clear()
    expect(lru.size).toBe(0)
  })
})

class FakeWorker implements WorkerLike {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null
  terminated = false
  sent: unknown[] = []
  transfers: Transferable[][] = []
  constructor(private script: (w: FakeWorker) => void) {}
  postMessage(msg: unknown, transfer: Transferable[] = []) {
    this.sent.push(msg)
    this.transfers.push(transfer)
    queueMicrotask(() => this.script(this))
  }
  emit(data: unknown) { this.onmessage?.({ data } as MessageEvent) }
  terminate() { this.terminated = true }
}

const job: MergeJob = {
  kind: 'merge', sources: [{ id: 'a', name: 'a.pdf', bytes: new ArrayBuffer(8) }], pages: [], name: 'o.pdf',
  pageSize: 'keep', bookmarks: false, keepForms: true, blankBetween: false, titles: {},
}

describe('merge worker client', () => {
  it('relays progress, resolves with the result and terminates', async () => {
    let w!: FakeWorker
    const seen: number[] = []
    const r = await runInWorker(job, (d) => seen.push(d), undefined, () => (w = new FakeWorker((fw) => {
      fw.emit({ type: 'progress', done: 1, total: 2 })
      fw.emit({ type: 'done', result: { outputs: [], warnings: [] } })
    })))
    expect(r).toEqual({ outputs: [], warnings: [] })
    expect(seen).toEqual([1])
    expect(w.terminated).toBe(true)
    expect(w.transfers[0]).toEqual([job.sources[0].bytes])
  })
  it('maps a locked source and cancels via AbortSignal', async () => {
    await expect(runInWorker(job, () => {}, undefined, () => new FakeWorker((fw) => fw.emit({ type: 'error', error: 'x', needsPassword: 'a' }))))
      .rejects.toBeInstanceOf(SourceLockedError)
    const ctrl = new AbortController()
    let w!: FakeWorker
    const p = runInWorker(job, () => {}, ctrl.signal, () => (w = new FakeWorker(() => {})))
    ctrl.abort()
    await expect(p).rejects.toBeInstanceOf(CancelledError)
    expect(w.terminated).toBe(true)
  })
})
