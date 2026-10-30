import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImagePool, type PoolResult } from '../../src/shared/image/image-pool'

// Fake worker: records posts; the test answers them explicitly.
class FakeWorker {
  static all: FakeWorker[] = []
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  posted: { id: number; kind: string; payload: unknown }[] = []
  terminated = false
  constructor() { FakeWorker.all.push(this) }
  postMessage(m: { id: number; kind: string; payload: unknown }) { this.posted.push(m) }
  terminate() { this.terminated = true }
  reply(data: unknown) { this.onmessage?.({ data }) }
  last() { return this.posted[this.posted.length - 1] }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('ImagePool', () => {
  beforeEach(() => {
    FakeWorker.all = []
    vi.stubGlobal('Worker', FakeWorker)
  })
  afterEach(() => vi.unstubAllGlobals())

  const make = (size = 2) => {
    const pool = new ImagePool(size, () => new FakeWorker() as unknown as Worker)
    const main = vi.fn(async (_k: string, p: unknown): Promise<PoolResult<unknown>> => ({ ok: true, result: { main: p } }))
    pool.mainThread = main
    return { pool, main }
  }

  it('runs up to size tasks at once, queues the rest, calls onStart when a task starts', async () => {
    const { pool } = make(2)
    const started: number[] = []
    const r = [1, 2, 3].map((n) => pool.run('compress', n, { onStart: () => started.push(n) }))
    expect(FakeWorker.all).toHaveLength(2)
    expect(started).toEqual([1, 2])
    expect(pool.stats).toEqual({ queued: 1, running: 2, workers: 2 })
    const w0 = FakeWorker.all[0]
    w0.reply({ id: w0.last().id, ok: true, result: 'a' })
    expect(started).toEqual([1, 2, 3]) // queued task moved onto the freed worker
    expect(w0.posted).toHaveLength(2)
    expect(await r[0]).toEqual({ ok: true, result: 'a' })
  })

  it('retries a failed task on the main thread, except deterministic failures', async () => {
    const { pool, main } = make(1)
    const a = pool.run('compress', 'A')
    const w = FakeWorker.all[0]
    w.reply({ id: w.last().id, ok: false, error: 'boom' })
    expect(await a).toEqual({ ok: true, result: { main: 'A' } })
    const b = pool.run('compress', 'B')
    w.reply({ id: w.last().id, ok: false, error: 'too big', retryable: false })
    expect(await b).toEqual({ ok: false, error: 'too big', retryable: false })
    expect(main).toHaveBeenCalledTimes(1)
  })

  it('a crashed worker hands its task to the main thread and is replaced', async () => {
    const { pool, main } = make(1)
    const a = pool.run('compress', 'A')
    FakeWorker.all[0].onerror?.()
    expect(await a).toEqual({ ok: true, result: { main: 'A' } })
    expect(FakeWorker.all[0].terminated).toBe(true)
    expect(main).toHaveBeenCalledOnce()
    void pool.run('compress', 'B')
    expect(FakeWorker.all).toHaveLength(2)
  })

  it('cancel(group) resolves queued + running tasks of that group only and kills their workers', async () => {
    const { pool } = make(2)
    const a = pool.run('compress', 'A', { group: 'compress' })
    const b = pool.run('compress', 'B', { group: 'convert' })
    const c = pool.run('compress', 'C', { group: 'compress' }) // queued
    pool.cancel('compress')
    expect(await a).toMatchObject({ ok: false, cancelled: true })
    expect(await c).toMatchObject({ ok: false, cancelled: true })
    const [wa, wb] = FakeWorker.all
    expect(wa.terminated).toBe(true)
    expect(wb.terminated).toBe(false)
    wb.reply({ id: wb.last().id, ok: true, result: 'b' })
    expect(await b).toEqual({ ok: true, result: 'b' })
    // later tasks reuse the live worker, then respawn up to size
    void pool.run('compress', 'D', { group: 'compress' })
    void pool.run('compress', 'E', { group: 'compress' })
    await flush()
    expect(wb.last().payload).toBe('D')
    expect(FakeWorker.all).toHaveLength(3)
    expect(FakeWorker.all[2].last().payload).toBe('E')
  })

  it('without Worker support every task runs on the main thread', async () => {
    vi.stubGlobal('Worker', undefined)
    const { pool, main } = make(2)
    const started = vi.fn()
    expect(await pool.run('compress', 'X', { onStart: started })).toEqual({ ok: true, result: { main: 'X' } })
    expect(started).toHaveBeenCalledOnce()
    expect(main).toHaveBeenCalledOnce()
  })
})
