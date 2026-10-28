// The compressor's view of the app-wide image pool (shared/image/image-pool):
// same API the view has always used (run / cancelAll), translating the
// pool's raw job results into CompressResults. The pool hands blobs back;
// this wrapper turns them into object URLs on the main thread, so
// revocation semantics match the old direct path exactly.
import type { CompressBlobSuccess, CompressResult } from './compress'
import type { CompressPayload } from './compress-job'
import { t as translate, type Lang } from '../../../shared/i18n'
import type { ImagePool } from '../../../shared/image/image-pool'
import type { CompressItem, Settings } from '../types'

const GROUP = 'compress'

// The pool module loads with the first compression, not with the page: it
// is shared with the other image tools and stays out of the first-load
// chunk (the compress job and encoders were already lazy).
function loadPool(): Promise<ImagePool> {
  return import('../../../shared/image/image-pool').then((m) => m.getImagePool())
}

export class CompressPool {
  private canvasWebpPromise: Promise<boolean> | null = null
  private poolPromise: Promise<ImagePool> | null
  private pool: ImagePool | null = null
  // Bumped by cancelAll: a run still waiting for the pool module when the
  // user cancels resolves as cancelled instead of starting afterwards.
  private generation = 0

  constructor(pool?: ImagePool) {
    this.pool = pool ?? null
    this.poolPromise = pool ? Promise.resolve(pool) : null
  }

  private getPool(): Promise<ImagePool> {
    if (!this.poolPromise) {
      this.poolPromise = loadPool().then((p) => (this.pool = p))
      this.poolPromise.catch(() => { this.poolPromise = null })
    }
    return this.poolPromise
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

  // User cancellation: every queued/in-flight compress task resolves with a
  // cancelled result and its worker is terminated (see ImagePool.cancel).
  cancelAll(): void {
    this.generation++
    this.pool?.cancel(GROUP)
  }

  async run(item: CompressItem, settings: Settings, lang: Lang, onStart?: () => void): Promise<CompressResult> {
    const gen = this.generation
    const canvasWebp = await this.probeCanvasWebp()
    let pool: ImagePool
    try {
      pool = await this.getPool()
    } catch {
      return { done: false, error: translate(lang, 'compressFail') }
    }
    if (gen !== this.generation) return { done: false, error: translate(lang, 'cancelled'), cancelled: true }
    const payload: CompressPayload = { file: item.file, settings, lang, canvasWebp }
    const res = await pool.run<CompressBlobSuccess>('compress', payload, { group: GROUP, onStart })
    if (!res.ok) {
      if (res.cancelled) return { done: false, error: translate(lang, 'cancelled'), cancelled: true }
      return {
        done: false,
        error: res.error || translate(lang, 'compressFail'),
        ...(res.retryable === false ? { retryable: false } : {}),
      }
    }
    const r = res.result
    return {
      done: true,
      error: null,
      origW: r.origW,
      origH: r.origH,
      outUrl: URL.createObjectURL(r.alreadyBest ? item.file : r.outBlob!),
      outSize: r.outSize,
      outW: r.outW,
      outH: r.outH,
      outName: r.outName,
      view: 'comp',
      targetNote: r.targetNote ?? null,
      targetNoteNotable: r.targetNoteNotable ?? false,
      typeNote: r.typeNote ?? null,
      outType: r.outType ?? item.file.type,
      hasAlpha: r.hasAlpha ?? false,
      isAnimatedGif: r.isAnimatedGif ?? false,
    }
  }
}
