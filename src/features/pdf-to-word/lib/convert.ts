// One PDF → one .docx: open (with password), pick the pages, extract them
// one by one on the main thread (pdf.js parses in its own worker), then
// build the Word file in the docx worker. Cancellable at every page and
// during the build (the worker is terminated).
import { baseName } from '../../../shared/lib/format'
import type { ConvertStats, PageModel, PdfSettings } from '../types'
import type { DocxRequest, DocxResponse } from '../worker/docx.worker'
import { extractPage } from './extract'
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

let nextId = 1

function buildInWorker(pages: PageModel[], opts: DocxRequest['opts'], signal?: AbortSignal): Promise<{ blob: Blob; stats: ConvertStats }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return }
    const worker = new Worker(new URL('../worker/docx.worker.ts', import.meta.url), { type: 'module' })
    const id = nextId++
    const done = () => {
      worker.terminate()
      signal?.removeEventListener('abort', onAbort)
    }
    const onAbort = () => { done(); reject(abortError()) }
    signal?.addEventListener('abort', onAbort)
    worker.onmessage = (e: MessageEvent<DocxResponse>) => {
      if (e.data.id !== id) return
      done()
      if (e.data.ok) resolve({ blob: e.data.blob, stats: e.data.stats })
      else reject(new Error(e.data.error))
    }
    worker.onerror = (e) => { done(); reject(new Error(e.message || 'worker failed')) }
    const transfer: ArrayBuffer[] = []
    for (const p of pages) {
      for (const img of p.images) transfer.push(img.data.buffer as ArrayBuffer)
      if (p.background) transfer.push(p.background.data.buffer as ArrayBuffer)
    }
    worker.postMessage({ id, pages, opts } satisfies DocxRequest, transfer)
  })
}

export async function convertPdf(
  file: File,
  password: string,
  settings: PdfSettings,
  onProgress: (p: ConvertProgress) => void,
  signal?: AbortSignal,
): Promise<ConvertResult> {
  const doc = await openPdf(await file.arrayBuffer(), password)
  try {
    if (signal?.aborted) throw abortError()
    const range = parsePageRange(settings.pageRange, doc.numPages)
    if (!range.ok) throw new PageRangeError(range.error)
    const total = range.pages.length
    const readShare = 0.92
    const pages: PageModel[] = []
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw abortError()
      onProgress({ phase: 'read', page: i + 1, total, progress: (i / total) * readShare })
      pages.push(await extractPage(doc, range.pages[i], {
        keepImages: settings.keepImages,
        mode: settings.mode,
        ocr: settings.ocr,
        ocrLang: settings.ocrLang,
        signal,
        onOcr: (p) => onProgress({ phase: 'ocr', page: i + 1, total, progress: ((i + p) / total) * readShare }),
      }))
    }
    if (signal?.aborted) throw abortError()
    onProgress({ phase: 'build', page: total, total, progress: readShare })
    const { blob, stats } = await buildInWorker(pages, { mode: settings.mode, keepImages: settings.keepImages, title: baseName(file.name) }, signal)
    const warnings: string[] = []
    if (pages.some((p) => p.background && !p.ocr)) warnings.push(settings.ocr ? 'warnOcrEmpty' : 'warnScannedAsImage')
    if (settings.pageRange.trim() && total < doc.numPages) warnings.push('warnPartial')
    onProgress({ phase: 'build', page: total, total, progress: 1 })
    return { blob, name: docxName(file.name), stats, warnings }
  } finally {
    void doc.loadingTask.destroy()
  }
}
