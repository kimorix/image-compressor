// App-wide pool of image workers (one pool, lazily created, shared by every
// image tool so there is only ever one set of wasm encoder instances), with a
// main-thread fallback that keeps every input working even where a worker
// cannot (SVG on older Safari, a nested worker a bundler did not emit, no
// Worker support at all).
//
// Generalised from the compressor's CompressPool: a task is a job kind (see
// jobs.ts) plus a structured-cloneable payload; the pool hands back the
// job's raw result. Callers own everything around that (object URLs,
// translations, item state). Cancellation is per group, so cancelling one
// tool's batch never touches another tool's tasks.
import { jobError, loadJob, type JobError, type JobKind } from './jobs'
import type { WorkerReply, WorkerRequest } from './image.worker'

export type PoolResult<R> =
  | { ok: true; result: R }
  | { ok: false; error: string; retryable?: boolean; cancelled?: boolean }

export interface RunOptions {
  /** Cancellation group (e.g. the tool name); see cancel(). */
  group?: string
  /** UI-only notification: the task left the queue and is now running. */
  onStart?: () => void
}

interface Ctx {
  id: number
  kind: JobKind
  payload: unknown
  group: string
  resolve: (r: PoolResult<unknown>) => void
  onStart?: () => void
  worker: Worker | null
}

export function defaultPoolSize(): number {
  // 2–4 workers by hardwareConcurrency: enough parallelism for a batch
  // without paying a wasm instance per core.
  const hw = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4
  return Math.min(4, Math.max(2, hw))
}

async function runOnMainThread(kind: JobKind, payload: unknown): Promise<PoolResult<unknown>> {
  try {
    const job = await loadJob(kind)
    const { result } = await job.run(payload)
    return { ok: true, result }
  } catch (err) {
    const retryable = (err as JobError | null)?.retryable
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      ...(retryable === false ? { retryable: false } : {}),
    }
  }
}

export type WorkerFactory = () => Worker

const defaultFactory: WorkerFactory = () =>
  new Worker(new URL('./image.worker.ts', import.meta.url), { type: 'module' })

export class ImagePool {
  private size: number
  private factory: WorkerFactory
  private workers: Worker[] = []
  private idle: Worker[] = []
  private queue: Ctx[] = []
  private pending = new Map<number, Ctx>()
  private nextId = 1
  private noWorker = false
  /** Main-thread runner; replaceable in tests. */
  mainThread: (kind: JobKind, payload: unknown) => Promise<PoolResult<unknown>> = runOnMainThread

  constructor(size?: number, factory: WorkerFactory = defaultFactory) {
    this.size = size ?? defaultPoolSize()
    this.factory = factory
  }

  private spawn(): Worker | null {
    if (typeof Worker === 'undefined') {
      this.noWorker = true
      return null
    }
    try {
      const w = this.factory()
      w.onmessage = (e: MessageEvent<WorkerReply>) => this.onMessage(e.data)
      const dead = () => this.onWorkerError(w)
      w.onerror = dead
      w.onmessageerror = dead
      this.workers.push(w)
      return w
    } catch (err) {
      console.warn('[image-pool] Worker unavailable, main-thread fallback:', err)
      this.noWorker = true
      return null
    }
  }

  private getWorker(): Worker | null {
    const idle = this.idle.pop()
    if (idle) return idle
    if (this.workers.length < this.size) return this.spawn()
    return null
  }

  private post(w: Worker, ctx: Ctx) {
    ctx.worker = w
    this.pending.set(ctx.id, ctx)
    ctx.onStart?.()
    w.postMessage({ id: ctx.id, kind: ctx.kind, payload: ctx.payload } satisfies WorkerRequest)
  }

  private drain() {
    while (this.queue.length) {
      const w = this.getWorker()
      if (!w) {
        // Spawn failed mid-session: flush the queue through the main thread
        // instead of leaving those tasks parked forever.
        if (this.noWorker) {
          for (const ctx of this.queue.splice(0)) {
            void this.finish(ctx, { id: ctx.id, ok: false, error: 'worker unavailable' })
          }
        }
        return
      }
      this.post(w, this.queue.shift()!)
    }
  }

  private async finish(ctx: Ctx, res: WorkerReply) {
    if (res.ok) {
      ctx.resolve({ ok: true, result: res.result })
      return
    }
    // Deterministic failures must not be re-run on the main thread: a pixel
    // cap error would decode the same huge image again and double peak memory.
    if (res.retryable === false) {
      ctx.resolve({ ok: false, error: res.error, retryable: false })
      return
    }
    // Worker failure retries once on the main thread, where <img> decoding
    // and the real canvas cover inputs a worker cannot. A genuine failure
    // fails identically there, so the user still sees the same error.
    ctx.resolve(await this.mainThread(ctx.kind, ctx.payload))
  }

  private onMessage(res: WorkerReply) {
    const ctx = this.pending.get(res.id)
    if (!ctx) return
    this.pending.delete(res.id)
    if (ctx.worker) this.idle.push(ctx.worker)
    this.drain()
    void this.finish(ctx, res)
  }

  private onWorkerError(w: Worker) {
    this.workers = this.workers.filter((x) => x !== w)
    this.idle = this.idle.filter((x) => x !== w)
    try { w.terminate() } catch { /* already dead */ }
    const failed: Ctx[] = []
    for (const [id, ctx] of this.pending) {
      if (ctx.worker === w) {
        this.pending.delete(id)
        failed.push(ctx)
      }
    }
    this.drain()
    for (const ctx of failed) {
      void this.finish(ctx, { id: ctx.id, ok: false, error: 'worker error' })
    }
  }

  /**
   * Cancel every queued and running task of one group: each resolves with
   * `{ ok: false, cancelled: true }`, and the workers running them are
   * terminated so a slow wasm encode actually stops instead of finishing
   * invisibly. Other groups' tasks keep running; the pool respawns workers
   * on demand.
   */
  cancel(group: string): void {
    const cancelled = { ok: false as const, error: 'cancelled', cancelled: true }
    const keep: Ctx[] = []
    for (const ctx of this.queue) {
      if (ctx.group === group) ctx.resolve(cancelled)
      else keep.push(ctx)
    }
    this.queue = keep
    const dead = new Set<Worker>()
    for (const [id, ctx] of this.pending) {
      if (ctx.group !== group) continue
      this.pending.delete(id)
      ctx.resolve(cancelled)
      if (ctx.worker) dead.add(ctx.worker)
    }
    for (const w of dead) {
      try { w.terminate() } catch { /* already dead */ }
    }
    if (dead.size) {
      this.workers = this.workers.filter((w) => !dead.has(w))
      this.idle = this.idle.filter((w) => !dead.has(w))
      this.drain()
    }
  }

  /** Run one job; never rejects (failures come back as `ok: false`). */
  run<R>(kind: JobKind, payload: unknown, opts: RunOptions = {}): Promise<PoolResult<R>> {
    return new Promise<PoolResult<unknown>>((resolve) => {
      const ctx: Ctx = { id: this.nextId++, kind, payload, group: opts.group ?? '', resolve, onStart: opts.onStart, worker: null }
      if (this.noWorker) {
        opts.onStart?.()
        void this.mainThread(kind, payload).then(resolve)
        return
      }
      const w = this.getWorker()
      if (w) this.post(w, ctx)
      else if (this.noWorker) {
        // Spawn failed (no Worker support, or construction threw): do not
        // park the task in the queue, go straight to the main thread.
        opts.onStart?.()
        void this.mainThread(kind, payload).then(resolve)
      } else this.queue.push(ctx)
    }) as Promise<PoolResult<R>>
  }

  /** Tasks waiting for a worker / running (for tests and diagnostics). */
  get stats() {
    return { queued: this.queue.length, running: this.pending.size, workers: this.workers.length }
  }
}

let shared: ImagePool | null = null

/** The one pool every image tool uses (created on first call). */
export function getImagePool(): ImagePool {
  if (!shared) shared = new ImagePool()
  return shared
}

export { jobError }
