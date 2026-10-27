// Pool of encode workers, with a main-thread fallback that keeps every
// input working even where a worker cannot (SVG on older Safari, a nested
// worker a bundler did not emit, no Worker support at all). The pool owns
// object URLs: workers hand blobs back, the main thread turns them into
// URLs, so revocation semantics match the old direct path exactly.
import { compressItem, type CompressResult } from './compress'
import { t as translate, type Lang } from '../i18n'
import type { CompressItem, Settings } from '../types'
import type { WorkerResult, WorkerTask } from './compress.worker'

function poolSize(): number {
  // 2–4 workers by hardwareConcurrency: enough parallelism for a batch
  // without paying a wasm instance per core.
  const hw = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4
  return Math.min(4, Math.max(2, hw))
}

interface Pending {
  resolve: (r: CompressResult) => void
  worker: Worker
  item: CompressItem
  settings: Settings
  lang: Lang
  canvasWebp: boolean
}

export class CompressPool {
  private size: number
  private workers: Worker[] = []
  private idle: Worker[] = []
  private queue: Array<{ task: WorkerTask; ctx: Pending }> = []
  private pending = new Map<number, Pending>()
  private nextId = 1
  private canvasWebpPromise: Promise<boolean> | null = null
  private noWorker = false

  constructor(size?: number) {
    this.size = size ?? poolSize()
  }

  // One-time main-thread probe: does this browser's canvas really encode
  // WebP? (Safari's canvas silently emits PNG instead.) The probe must run
  // on the main thread, where real canvas behavior — and any test double on
  // HTMLCanvasElement — lives; a worker's OffscreenCanvas would not see
  // either. The result travels with each task so the worker's canvas
  // fallback mirrors the main-thread behavior.
  private probeCanvasWebp(): Promise<boolean> {
    if (!this.canvasWebpPromise) {
      this.canvasWebpPromise = new Promise((res) => {
        try {
          const c = document.createElement('canvas')
          c.width = 1
          c.height = 1
          c.toBlob((b) => res(!!b && b.type === 'image/webp'), 'image/webp')
        } catch {
          res(false)
        }
      })
    }
    return this.canvasWebpPromise
  }

  private spawn(): Worker | null {
    if (typeof Worker === 'undefined') {
      this.noWorker = true
      return null
    }
    try {
      const w = new Worker(new URL('./compress.worker.ts', import.meta.url), { type: 'module' })
      w.onmessage = (e: MessageEvent<WorkerResult>) => this.onMessage(e.data)
      const dead = () => this.onWorkerError(w)
      w.onerror = dead
      w.onmessageerror = dead
      this.workers.push(w)
      return w
    } catch (err) {
      console.warn('[image-compressor] Worker unavailable, main-thread fallback:', err)
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

  private drain() {
    while (this.queue.length) {
      const w = this.getWorker()
      if (!w) {
        // Spawn failed mid-session: flush the queue through the main thread
        // instead of leaving those tasks parked forever.
        if (this.noWorker) {
          const queued = this.queue.splice(0)
          for (const { ctx } of queued) {
            void this.finish(ctx, { id: -1, ok: false, error: 'worker unavailable' })
          }
        }
        return
      }
      const { task, ctx } = this.queue.shift()!
      ctx.worker = w
      this.pending.set(task.id, ctx)
      w.postMessage(task)
    }
  }

  private async finish(ctx: Pending, res: WorkerResult) {
    if (res.ok && (res.alreadyBest || res.blob)) {
      ctx.resolve({
        done: true,
        error: null,
        origW: res.origW!,
        origH: res.origH!,
        outUrl: URL.createObjectURL(res.alreadyBest ? ctx.item.file : res.blob!),
        outSize: res.outSize!,
        outW: res.outW!,
        outH: res.outH!,
        outName: res.outName!,
        view: 'comp',
        targetNote: res.targetNote ?? null,
        typeNote: res.typeNote ?? null,
        outType: res.outType ?? ctx.item.file.type,
        hasAlpha: res.hasAlpha ?? false,
        isAnimatedGif: res.isAnimatedGif ?? false,
      })
      return
    }
    // Worker failure retries once on the main thread, where <img> decoding
    // and the real canvas cover inputs a worker cannot. A genuine failure
    // fails identically there, so the user still sees the same error.
    const tx = (key: string, ...args: (string | number)[]) => translate(ctx.lang, key, ...args)
    ctx.resolve(await compressItem(ctx.item, ctx.settings, tx, ctx.canvasWebp))
  }

  private onMessage(res: WorkerResult) {
    const ctx = this.pending.get(res.id)
    if (!ctx) return
    this.pending.delete(res.id)
    this.idle.push(ctx.worker)
    this.drain()
    void this.finish(ctx, res)
  }

  private onWorkerError(w: Worker) {
    this.workers = this.workers.filter((x) => x !== w)
    this.idle = this.idle.filter((x) => x !== w)
    try { w.terminate() } catch { /* already dead */ }
    const failed: Pending[] = []
    for (const [id, ctx] of this.pending) {
      if (ctx.worker === w) {
        this.pending.delete(id)
        failed.push(ctx)
      }
    }
    this.drain()
    for (const ctx of failed) {
      void this.finish(ctx, { id: -1, ok: false, error: 'worker error' })
    }
  }

  async run(item: CompressItem, settings: Settings, lang: Lang): Promise<CompressResult> {
    const canvasWebp = await this.probeCanvasWebp()
    const tx = (key: string, ...args: (string | number)[]) => translate(lang, key, ...args)
    if (this.noWorker) return compressItem(item, settings, tx, canvasWebp)
    return new Promise<CompressResult>((resolve) => {
      const task: WorkerTask = { id: this.nextId++, file: item.file, settings, lang, canvasWebp }
      // Worker is assigned in drain; until then ctx.worker is a placeholder
      // the queue path replaces before posting.
      const ctx = {
        resolve,
        worker: null as unknown as Worker,
        item,
        settings,
        lang,
        canvasWebp,
      } as Pending
      const w = this.getWorker()
      if (w) {
        ctx.worker = w
        this.pending.set(task.id, ctx)
        w.postMessage(task)
      } else if (this.noWorker) {
        // Spawn failed (no Worker support, or construction threw): do not
        // park the task in the queue, go straight to the main thread.
        resolve(compressItem(item, settings, tx, canvasWebp))
      } else {
        this.queue.push({ task, ctx })
      }
    })
  }
}
