// One PDF → one .docx: open (with password), pick the pages, extract them
// one by one on the main thread (pdf.js parses in its own worker) and
// stream each page to this conversion's docx worker as soon as it is read,
// which analyses it on arrival and packs the Word file at the end.
// Cancellable at every page and during the build (the worker is terminated).
import { baseName } from '../../../shared/lib/format'
import type { ConvertStats, PdfSettings } from '../types'
import type { DocxRequest, DocxResponse, WirePage } from '../worker/docx.worker'
import type { BuildOptions } from './docx-builder'
import { canUseOffscreen, deviceRenderPixelCap, extractPage } from './extract'
import { parsePageRange } from './page-range'
import { openPdf } from './pdf-loader'

export interface ConvertProgress {
  phase: 'read' | 'ocr' | 'build'
  page: number
  total: number
  /** 0..1 over the whole file. */
  progress: number
}

export interface ConvertResult {
  blob: Blob
  name: string
  stats: ConvertStats
  /** i18n keys of notes about the output. */
  warnings: string[]
}

export class PageRangeError extends Error {
  constructor(public readonly reason: 'syntax' | 'empty' | 'outOfRange') {
    super(`page range: ${reason}`)
    this.name = 'PageRangeError'
  }
}

export function docxName(pdfName: string): string {
  return `${baseName(pdfName) || 'document'}.docx`
}

function abortError() {
  return new DOMException('cancelled', 'AbortError')
}

export function isAbort(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError'
}

/** The bytes and bitmaps a page hands to the worker (moved, not copied). */
export function pageTransfer(page: WirePage): Transferable[] {
  const out: Transferable[] = []
  for (const img of page.background ? [...page.images, page.background] : page.images) {
    if (img.bitmap) out.push(img.bitmap)
    else if (img.data) out.push(img.data.buffer as ArrayBuffer)
  }
  return out
}

interface WorkerLike {
  postMessage(msg: unknown, transfer?: Transferable[]): void
  terminate(): void
  onmessage: ((e: MessageEvent<DocxResponse>) => void) | null
  onerror: ((e: ErrorEvent) => void) | null
}

function spawnDocxWorker(): WorkerLike {
  return new Worker(new URL('../worker/docx.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike
}

/**
 * One conversion's docx worker. Pages go in as they are extracted (their
 * picture buffers transferred, so the main thread holds nothing between
 * pages); `finish()` resolves with the packed file. A worker error fails
 * the next `addPage` right away, so extraction stops early. Aborting the
 * signal terminates the worker.
 */
export class DocxStream {
  private worker: WorkerLike
  private failure: Error | null = null
  private settle!: { resolve: (r: { blob: Blob; stats: ConvertStats }) => void; reject: (e: Error) => void }
  private readonly result: Promise<{ blob: Blob; stats: ConvertStats }>
  private closed = false

  constructor(opts: BuildOptions, private readonly signal?: AbortSignal, spawn: () => WorkerLike = spawnDocxWorker) {
    this.result = new Promise((resolve, reject) => { this.settle = { resolve, reject } })
    // finish() may never be reached (an extraction error): keep an early
    // worker failure from surfacing as an unhandled rejection.
    this.result.catch(() => {})
    if (signal?.aborted) throw abortError()
    this.worker = spawn()
    this.worker.onmessage = (e) => {
      const m = e.data
      if (m.type === 'done') { this.close(); this.settle.resolve({ blob: m.blob, stats: m.stats }) } else this.fail(new Error(m.error))
    }
    this.worker.onerror = (e) => this.fail(new Error(e.message || 'docx worker failed'))
    signal?.addEventListener('abort', this.onAbort)
    this.post({ type: 'start', opts })
  }

  private onAbort = () => this.fail(abortError())

  private fail(err: Error) {
    if (!this.failure) this.failure = err
    this.close()
    this.settle.reject(this.failure)
  }

  private post(msg: DocxRequest, transfer: Transferable[] = []) {
    this.worker.postMessage(msg, transfer)
  }

  addPage(page: WirePage): void {
    if (this.failure) throw this.failure
    this.post({ type: 'page', page }, pageTransfer(page))
  }

  finish(): Promise<{ blob: Blob; stats: ConvertStats }> {
    if (!this.failure && !this.closed) this.post({ type: 'finish' })
    return this.result
  }

  /** Stop the worker (idempotent). */
  close(): void {
    if (this.closed) return
    this.closed = true
    this.signal?.removeEventListener('abort', this.onAbort)
    this.worker.terminate()
  }
}

export async function convertPdf(
  file: File,
  password: string,
  settings: PdfSettings,
  onProgress: (p: ConvertProgress) => void,
  signal?: AbortSignal,
): Promise<ConvertResult> {
  const doc = await openPdf(await file.arrayBuffer(), password)
  let stream: DocxStream | null = null
  try {
    if (signal?.aborted) throw abortError()
    const range = parsePageRange(settings.pageRange, doc.numPages)
    if (!range.ok) throw new PageRangeError(range.error)
    const total = range.pages.length
    const readShare = 0.92
    const maxPixels = deviceRenderPixelCap()
    const bitmaps = canUseOffscreen()
    stream = new DocxStream({ mode: settings.mode, keepImages: settings.keepImages, title: baseName(file.name) }, signal)
    let pictureOnly = false
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw abortError()
      onProgress({ phase: 'read', page: i + 1, total, progress: (i / total) * readShare })
      const page = await extractPage(doc, range.pages[i], {
        keepImages: settings.keepImages,
        mode: settings.mode,
        ocr: settings.ocr,
        ocrLang: settings.ocrLang,
        signal,
        maxPixels,
        bitmaps,
        onOcr: (p) => onProgress({ phase: 'ocr', page: i + 1, total, progress: ((i + p) / total) * readShare }),
      })
      if (page.background && !page.ocr) pictureOnly = true
      stream.addPage(page)
    }
    if (signal?.aborted) throw abortError()
    onProgress({ phase: 'build', page: total, total, progress: readShare })
    const { blob, stats } = await stream.finish()
    const warnings: string[] = []
    if (pictureOnly) warnings.push(settings.ocr ? 'warnOcrEmpty' : 'warnScannedAsImage')
    if (settings.pageRange.trim() && total < doc.numPages) warnings.push('warnPartial')
    onProgress({ phase: 'build', page: total, total, progress: 1 })
    return { blob, name: docxName(file.name), stats, warnings }
  } finally {
    stream?.close()
    void doc.loadingTask.destroy()
  }
}
