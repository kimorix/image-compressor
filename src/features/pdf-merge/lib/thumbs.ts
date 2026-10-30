// Page thumbnails for the merge grid: pdf.js renders a page only when its
// tile asks (PageGrid need-thumb), newest request first, two at a time.
// Results are JPEG blob URLs kept in an LRU of ~300; an evicted URL is
// revoked and its tile asks again if it scrolls back into view. One pdf.js
// document per source stays open while the file is in the list.
import type { PdfDoc } from '../../../shared/pdf/pdf-loader'

export const THUMB_LIMIT = 300
export const THUMB_CSS_WIDTH = 160

/** Least-recently-used map of thumbnail URLs. Pure (eviction via callback), unit tested. */
export class ThumbLru {
  private map = new Map<string, string>()
  constructor(readonly limit: number, private onEvict: (key: string, url: string) => void) {}

  get size(): number { return this.map.size }

  get(key: string): string | undefined {
    const url = this.map.get(key)
    if (url !== undefined) {
      this.map.delete(key)
      this.map.set(key, url)
    }
    return url
  }

  has(key: string): boolean { return this.map.has(key) }

  set(key: string, url: string): void {
    const old = this.map.get(key)
    if (old !== undefined) {
      this.map.delete(key)
      if (old !== url) this.onEvict(key, old)
    }
    this.map.set(key, url)
    while (this.map.size > this.limit) {
      const [k, u] = this.map.entries().next().value as [string, string]
      this.map.delete(k)
      this.onEvict(k, u)
    }
  }

  /** Drop every entry whose key starts with `prefix` (a removed file). */
  dropPrefix(prefix: string): void {
    for (const [k, u] of [...this.map]) {
      if (k.startsWith(prefix)) {
        this.map.delete(k)
        this.onEvict(k, u)
      }
    }
  }

  clear(): void { this.dropPrefix('') }
}

export const thumbKey = (src: string, index: number) => `${src}:${index}`

export interface ProbeResult {
  pages: number
  ownerLocked: boolean
  hasForm: boolean
  xfa: boolean
  hasOutline: boolean
  /** Page 1 width / height as displayed. */
  aspect: number
}

export class ThumbService {
  private docs = new Map<string, Promise<PdfDoc>>()
  private queue: { src: string; index: number; key: string }[] = []
  private pending = new Set<string>()
  private active = 0
  readonly lru: ThumbLru

  constructor(
    /** Called when a thumbnail is ready (url) or evicted (null). */
    private onChange: (key: string, url: string | null, aspect?: number) => void,
    private concurrency = 2,
    limit = THUMB_LIMIT,
  ) {
    this.lru = new ThumbLru(limit, (k, u) => {
      URL.revokeObjectURL(u)
      this.onChange(k, null)
    })
  }

  /** Open a source with pdf.js (kept for thumbnails) and read what the UI needs. */
  async probe(src: string, file: File): Promise<ProbeResult> {
    const { openPdf } = await import('../../../shared/pdf/pdf-loader')
    const p = file.arrayBuffer().then((b) => openPdf(b))
    this.docs.set(src, p)
    p.catch(() => { if (this.docs.get(src) === p) this.docs.delete(src) })
    const doc = await p
    const [meta, outline, page] = await Promise.all([
      doc.getMetadata().catch(() => null),
      doc.getOutline().catch(() => null),
      doc.getPage(1),
    ])
    const vp = page.getViewport({ scale: 1 })
    const info = (meta?.info ?? {}) as { IsAcroFormPresent?: boolean; IsXFAPresent?: boolean; EncryptFilterName?: string }
    return {
      pages: doc.numPages,
      // Encrypted, yet opened without a password: only an owner password.
      ownerLocked: !!info.EncryptFilterName,
      hasForm: !!info.IsAcroFormPresent,
      xfa: !!info.IsXFAPresent,
      hasOutline: !!outline?.length,
      aspect: vp.width / vp.height,
    }
  }

  /** A tile wants its thumbnail (newest requests render first). */
  request(src: string, index: number): void {
    const key = thumbKey(src, index)
    const hit = this.lru.get(key)
    if (hit) { this.onChange(key, hit); return }
    if (!this.docs.has(src)) return
    if (this.pending.has(key)) {
      // Still queued (scrolled past earlier): move it to the front again.
      const i = this.queue.findIndex((q) => q.key === key)
      if (i >= 0 && i < this.queue.length - 1) this.queue.push(...this.queue.splice(i, 1))
      return
    }
    this.pending.add(key)
    this.queue.push({ src, index, key })
    this.pump()
  }

  private pump() {
    while (this.active < this.concurrency && this.queue.length) {
      const job = this.queue.pop()!
      this.active++
      void this.render(job.src, job.index, job.key).finally(() => {
        this.active--
        this.pending.delete(job.key)
        this.pump()
      })
    }
  }

  private async render(src: string, index: number, key: string): Promise<void> {
    const docP = this.docs.get(src)
    if (!docP) return
    try {
      const doc = await docP
      const page = await doc.getPage(index + 1)
      try {
        const base = page.getViewport({ scale: 1 })
        const dpr = Math.min(2, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1)
        const scale = Math.min(4, (THUMB_CSS_WIDTH * dpr) / base.width)
        const vp = page.getViewport({ scale })
        const w = Math.max(1, Math.round(vp.width))
        const h = Math.max(1, Math.round(vp.height))
        let blob: Blob | null
        if (typeof OffscreenCanvas !== 'undefined') {
          const c = new OffscreenCanvas(w, h)
          const ctx = c.getContext('2d')!
          ctx.fillStyle = '#fff'
          ctx.fillRect(0, 0, w, h)
          await page.render({ canvas: c as unknown as HTMLCanvasElement, canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport: vp }).promise
          blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.8 })
          c.width = c.height = 0
        } else {
          const c = document.createElement('canvas')
          c.width = w
          c.height = h
          const ctx = c.getContext('2d')!
          ctx.fillStyle = '#fff'
          ctx.fillRect(0, 0, w, h)
          await page.render({ canvas: c, canvasContext: ctx, viewport: vp }).promise
          blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.8))
          c.width = c.height = 0
        }
        if (!blob || !this.docs.has(src)) return
        const url = URL.createObjectURL(blob)
        this.lru.set(key, url)
        this.onChange(key, url, base.width / base.height)
      } finally {
        page.cleanup()
      }
    } catch { /* a thumbnail is optional */ }
  }

  /** Forget a source: close its document, drop its queued renders and thumbnails. */
  drop(src: string): void {
    const d = this.docs.get(src)
    this.docs.delete(src)
    this.queue = this.queue.filter((q) => q.src !== src)
    this.lru.dropPrefix(src + ':')
    void d?.then((doc) => doc.loadingTask.destroy()).catch(() => {})
  }

  dispose(): void {
    for (const src of [...this.docs.keys()]) this.drop(src)
    this.lru.clear()
  }
}
