// Assemble the PDF(s) on the main thread. pdf-lib (@cantoo/pdf-lib, the
// maintained MIT fork) is imported here only, and this module is only
// imported when the user presses Generate, so neither reaches the page
// load. The slow part, decoding and encoding each image, runs in the
// shared image pool ('img2pdf' encode job, see prepare.ts); a small window
// of encodes runs ahead while pages are embedded strictly in order, so
// peak memory stays at a few encoded images, not the whole batch.
import { getImagePool } from '../../../shared/image/image-pool'
import type { Lang } from '../../../shared/i18n'
import type { BuildNotes, Img2PdfSettings, PageItem } from '../types'
import type { EncodePayload, EncodeResult } from './prepare'
import { encodeParams } from './settings'
import { layoutPage, placementMatrix } from './layout'

export const PRODUCER = 'Image Compressor (local)'
const GROUP = 'img2pdf-build'

export class BuildCancelled extends Error {
  constructor() {
    super('cancelled')
    this.name = 'AbortError'
  }
}

export interface BuildProgress {
  /** Pages finished (embedded or skipped). */
  done: number
  total: number
}

export interface BuiltFile {
  /** Index into the input pages (per-image mode) or -1 (single PDF). */
  page: number
  bytes: Uint8Array
  pages: number
}

export interface BuildOutput {
  files: BuiltFile[]
  notes: BuildNotes
  /** Ids of the pages that made it into the output, in order. */
  included: string[]
}

type PdfLib = typeof import('@cantoo/pdf-lib')
let pdfLib: Promise<PdfLib> | null = null
/** The lazy pdf-lib chunk (also warmed on hover of Generate). */
export function loadPdfLib(): Promise<PdfLib> {
  if (!pdfLib) {
    const p = import('@cantoo/pdf-lib')
    pdfLib = p
    p.catch(() => { if (pdfLib === p) pdfLib = null })
  }
  return pdfLib
}

function newDoc(lib: PdfLib, title: string) {
  return lib.PDFDocument.create({ updateMetadata: false }).then((doc) => {
    const now = new Date()
    doc.setTitle(title)
    doc.setProducer(PRODUCER)
    doc.setCreator(PRODUCER)
    doc.setCreationDate(now)
    doc.setModificationDate(now)
    return doc
  })
}

/**
 * Build one PDF (or one per page). Pages whose image cannot be decoded are
 * skipped and counted; when nothing is left the call throws. Cancelling the
 * signal stops the running encodes and rejects with BuildCancelled.
 */
export async function buildPdf(
  pages: PageItem[],
  s: Img2PdfSettings,
  opts: { title: string; titles?: string[]; lang: Lang; signal?: AbortSignal; onProgress?: (p: BuildProgress) => void; concurrency?: number },
): Promise<BuildOutput> {
  const { signal } = opts
  const pool = getImagePool()
  const lib = await loadPdfLib()
  if (signal?.aborted) throw new BuildCancelled()
  const onAbort = () => pool.cancel(GROUP)
  signal?.addEventListener('abort', onAbort)
  const notes: BuildNotes = { heic: 0, landscape: 0, skipped: 0, downscaled: 0, firstFrame: 0 }
  const { q, maxEdge } = encodeParams(s)
  const ahead = Math.max(1, opts.concurrency ?? 2)
  const total = pages.length
  const jobs: (Promise<EncodeResult | null> | undefined)[] = []
  const start = (i: number) => {
    if (i >= total || jobs[i]) return
    const it = pages[i]
    const payload: EncodePayload = { op: 'encode', file: it.file, lang: opts.lang, format: it.format, quality: s.quality, q, maxEdge }
    jobs[i] = pool.run<EncodeResult>('img2pdf', payload, { group: GROUP }).then((r) => {
      if (r.ok) return r.result
      if (r.cancelled) throw new BuildCancelled()
      console.warn('[img-to-pdf] page skipped:', it.name, r.error)
      return null
    })
  }
  const files: BuiltFile[] = []
  const included: string[] = []
  try {
    let single = s.output === 'single' ? await newDoc(lib, opts.title) : null
    for (let i = 0; i < Math.min(ahead, total); i++) start(i)
    for (let i = 0; i < total; i++) {
      start(i + ahead - 1)
      const res = await jobs[i]!
      jobs[i] = undefined // let the encoded bytes go once embedded
      if (signal?.aborted) throw new BuildCancelled()
      const it = pages[i]
      if (!res) {
        notes.skipped++
        opts.onProgress?.({ done: i + 1, total })
        continue
      }
      const doc = single ?? await newDoc(lib, opts.titles?.[i] ?? opts.title)
      const img = res.kind === 'jpg' ? await doc.embedJpg(res.bytes) : await doc.embedPng(res.bytes)
      // Layout from the probed size (what the grid previews show), so the
      // page does not depend on the quality setting; the embedded image is
      // scaled into the rectangle.
      const l = layoutPage(it.w || res.w, it.h || res.h, it.rotation, s)
      const page = doc.addPage([l.pageW, l.pageH])
      const name = page.node.newXObject('Im', img.ref)
      const [a, b, c, d, e, f] = placementMatrix(l, l.pageH, it.rotation, res.orientation)
      page.pushOperators(
        lib.pushGraphicsState(),
        lib.concatTransformationMatrix(a, b, c, d, e, f),
        lib.drawObject(name),
        lib.popGraphicsState(),
      )
      if (it.format === 'heic') notes.heic++
      if (it.animated) notes.firstFrame++
      if (res.downscaled) notes.downscaled++
      if (s.paper !== 'fit' && s.orientation === 'auto' && l.landscape) notes.landscape++
      included.push(it.id)
      if (!single) {
        files.push({ page: i, bytes: await doc.save(), pages: 1 })
      }
      opts.onProgress?.({ done: i + 1, total })
      // Yield so progress paints and Cancel stays responsive.
      await new Promise((r) => setTimeout(r, 0))
    }
    if (!included.length) throw new Error('nothing to build')
    if (single) {
      files.push({ page: -1, bytes: await single.save(), pages: included.length })
      single = null
    }
    return { files, notes, included }
  } catch (err) {
    pool.cancel(GROUP)
    // Settle the encodes still in flight so none rejects unhandled.
    for (const j of jobs) j?.catch(() => {})
    throw signal?.aborted ? new BuildCancelled() : err
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}

export function isCancel(err: unknown): boolean {
  return err instanceof BuildCancelled || (err instanceof Error && err.name === 'AbortError')
}
