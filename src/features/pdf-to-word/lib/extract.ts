// pdf.js page → PageModel: the positioned text layer (with bold/italic
// from the real font names), picture boxes found by replaying the
// operator list's transform stack, and crops of those pictures from a
// rendered copy of the page. Scanned pages (no text, one big picture) are
// rendered once and either OCR'd or kept whole.
import type { OcrLang, TextItem } from '../types'
import type { WireImage, WirePage } from '../worker/docx.worker'
import type { Pdfjs, PdfDoc } from './pdf-loader'
import { loadPdfjs } from './pdf-loader'

type Matrix = [number, number, number, number, number, number]
type PdfPage = Awaited<ReturnType<PdfDoc['getPage']>>

export interface Box { x: number; y: number; w: number; h: number }

function mul(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ]
}

function unitBox(m: Matrix): Box {
  const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]])
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

/**
 * Picture boxes in viewport space (points, top-left origin): replay
 * save/restore/transform and form XObject matrices, take the unit square
 * of every image paint op through the current matrix.
 */
export function imageBoxes(OPS: Pdfjs['OPS'], fnArray: number[], argsArray: unknown[][], viewportTransform: number[]): Box[] {
  let ctm: Matrix = [1, 0, 0, 1, 0, 0]
  const stack: Matrix[] = []
  const boxes: Box[] = []
  const vt = viewportTransform as Matrix
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i]
    const args = argsArray[i] as unknown[]
    switch (fn) {
      case OPS.save: stack.push(ctm); break
      case OPS.restore: ctm = stack.pop() ?? ctm; break
      case OPS.transform: ctm = mul(ctm, args as unknown as Matrix); break
      case OPS.paintFormXObjectBegin:
        stack.push(ctm)
        if (Array.isArray(args?.[0]) && (args[0] as number[]).length === 6) ctm = mul(ctm, args[0] as Matrix)
        break
      case OPS.paintFormXObjectEnd: ctm = stack.pop() ?? ctm; break
      case OPS.paintImageXObject:
      case OPS.paintInlineImageXObject:
      case OPS.paintImageMaskXObject:
      case OPS.paintImageXObjectRepeat:
        boxes.push(unitBox(mul(vt, ctm)))
        break
      default: break
    }
  }
  return boxes
}

/** Keep useful picture boxes: clipped to the page, not tiny, not duplicates or nested. */
export function cleanBoxes(boxes: Box[], pageW: number, pageH: number, dropBackground: boolean): Box[] {
  const clipped = boxes.map((b) => {
    const x = Math.max(0, b.x)
    const y = Math.max(0, b.y)
    return { x, y, w: Math.min(pageW, b.x + b.w) - x, h: Math.min(pageH, b.y + b.h) - y }
  }).filter((b) => b.w >= 12 && b.h >= 12)
  const kept = clipped.filter((b) => !(dropBackground && b.w * b.h > pageW * pageH * 0.85))
  kept.sort((a, b) => b.w * b.h - a.w * a.h)
  const out: Box[] = []
  for (const b of kept) {
    const inside = out.some((o) => b.x >= o.x - 1 && b.y >= o.y - 1 && b.x + b.w <= o.x + o.w + 1 && b.y + b.h <= o.y + o.h + 1)
    if (!inside) out.push(b)
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x)
}

const BOLD = /bold|black|heavy|semibold|demibold|demi|extrabold|ultrabold|W[6-9]\b|-B$|,B$/i
const ITALIC = /italic|oblique|-It$|,I$|Ital/i

interface FontLike { name?: string; bold?: boolean; black?: boolean; italic?: boolean }

export function fontStyle(font: FontLike | null, fallbackName = ''): { bold: boolean; italic: boolean } {
  const name = (font?.name ?? fallbackName).replace(/^[A-Z]{6}\+/, '')
  return {
    bold: !!font?.bold || !!font?.black || BOLD.test(name),
    italic: !!font?.italic || ITALIC.test(name),
  }
}

interface TextContentItem { str: string; transform: number[]; width: number; height: number; fontName: string }

/** pdf.js text items → TextItem (points, top-left origin). */
export function textItems(
  pdfjs: Pick<Pdfjs, 'Util'>,
  items: unknown[],
  styles: Record<string, { ascent?: number; descent?: number; vertical?: boolean }>,
  viewportTransform: number[],
  fontOf: (name: string) => FontLike | null,
): TextItem[] {
  const out: TextItem[] = []
  for (const raw of items) {
    const it = raw as TextContentItem
    if (typeof it.str !== 'string' || !it.str.trim()) continue
    const style = styles[it.fontName] ?? {}
    if (style.vertical) continue
    const tx = pdfjs.Util.transform(viewportTransform, it.transform) as number[]
    const size = Math.hypot(tx[2], tx[3])
    if (!(size > 0.5)) continue
    // Rotated runs (vertical labels, stamps) do not take part in the flow.
    if (Math.abs(tx[1]) > Math.abs(tx[0]) * 0.2) continue
    const ascent = style.ascent && style.ascent > 0.3 ? style.ascent : 0.8
    const descent = style.descent && style.descent < 0 ? style.descent : -0.2
    const scaleX = Math.hypot(viewportTransform[0], viewportTransform[1])
    const st = fontStyle(fontOf(it.fontName))
    out.push({
      str: it.str,
      x: tx[4],
      y: tx[5] - size * ascent,
      w: it.width * scaleX,
      h: size * (ascent - descent),
      size,
      bold: st.bold,
      italic: st.italic,
    })
  }
  return out
}

export interface ExtractOptions {
  keepImages: boolean
  /** Layout mode keeps a scanned page as a whole-page picture when not OCR'd. */
  mode: 'editable' | 'layout'
  ocr: boolean
  ocrLang: OcrLang
  signal?: AbortSignal
  onOcr?: (progress: number) => void
  /** Pixel budget of one rendered page (see renderPixelCap). */
  maxPixels?: number
  /**
   * Hand pictures over as ImageBitmaps for the docx worker to encode
   * (OffscreenCanvas path), instead of encoding them here.
   */
  bitmaps?: boolean
}

/** Rendered-page pixel budgets: a phone keeps fewer big canvases alive. */
export const MAX_RENDER_PIXELS = 10_000_000
export const MAX_RENDER_PIXELS_MOBILE = 4_000_000

/**
 * ~4 MP on phones (narrow screens) and low-memory devices
 * (navigator.deviceMemory <= 4, Chromium only), ~10 MP elsewhere.
 */
export function renderPixelCap(env: { innerWidth?: number; deviceMemory?: number } = {}): number {
  const narrow = typeof env.innerWidth === 'number' && env.innerWidth < 720
  const lowMem = typeof env.deviceMemory === 'number' && env.deviceMemory <= 4
  return narrow || lowMem ? MAX_RENDER_PIXELS_MOBILE : MAX_RENDER_PIXELS
}

/** renderPixelCap for this browser. */
export function deviceRenderPixelCap(): number {
  if (typeof window === 'undefined') return MAX_RENDER_PIXELS
  return renderPixelCap({ innerWidth: window.innerWidth, deviceMemory: (navigator as { deviceMemory?: number }).deviceMemory })
}

/** Pixels per point for rendering: `want` (2× = sharp crops), capped at `maxPixels`. */
export function renderScale(w: number, h: number, want = 2, maxPixels = MAX_RENDER_PIXELS): number {
  return Math.max(0.5, Math.min(want, Math.sqrt(maxPixels / Math.max(1, w * h))))
}

/**
 * OffscreenCanvas (with convertToBlob) plus createImageBitmap: render into
 * an OffscreenCanvas and send crops to the docx worker as bitmaps. Older
 * Safari (< 16.4) has neither and keeps the <canvas> + toBlob path.
 */
export function canUseOffscreen(): boolean {
  return typeof OffscreenCanvas !== 'undefined'
    && typeof OffscreenCanvas.prototype.convertToBlob === 'function'
    && typeof createImageBitmap === 'function'
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas

function newCanvas(w: number, h: number, offscreen: boolean): AnyCanvas {
  if (offscreen) return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

interface OpListLike { fnArray: number[]; argsArray: unknown[]; separateAnnots?: unknown }

/**
 * pdf.js builds a page's operator list for getOperatorList() under its own
 * cache key, so a later render() asks the pdf.js worker to parse the page
 * (and decode its pictures) a second time. When the page is rendered right
 * after its analysis, hand the finished list to the render instead: render()
 * finds a ready display intent and draws it without another round trip.
 * This touches pdf.js internals (`_intentStates`, `_transport`), so every
 * step is checked and any surprise leaves pdf.js on its normal path.
 * `transparency: true` is the safe choice (blend modes composite through an
 * extra canvas, which is pixel-equivalent on opaque content).
 */
export function reuseOperatorList(page: unknown, pdfjs: Pick<Pdfjs, 'AnnotationMode'>, opList: OpListLike): boolean {
  try {
    const p = page as {
      _intentStates?: unknown
      _transport?: { getRenderingIntent?: (intent: string, mode: number, storage: null, editing: boolean) => { cacheKey?: string } }
    }
    const states = p._intentStates
    const getIntent = p._transport?.getRenderingIntent
    if (!(states instanceof Map) || typeof getIntent !== 'function') return false
    const key = getIntent.call(p._transport, 'display', pdfjs.AnnotationMode.ENABLE, null, false)?.cacheKey
    if (typeof key !== 'string' || states.has(key)) return false
    const state = Object.create(null) as Record<string, unknown>
    state.displayReadyCapability = { promise: Promise.resolve(true), resolve() {}, reject() {} }
    state.operatorList = { fnArray: opList.fnArray, argsArray: opList.argsArray, lastChunk: true, separateAnnots: opList.separateAnnots ?? null }
    state.renderTasks = new Set()
    state.streamReader = null
    states.set(key, state)
    return true
  } catch {
    return false
  }
}

async function renderPage(page: PdfPage, scale: number, offscreen: boolean): Promise<AnyCanvas> {
  const vp = page.getViewport({ scale })
  const canvas = newCanvas(Math.ceil(vp.width), Math.ceil(vp.height), offscreen)
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas: canvas as HTMLCanvasElement, canvasContext: ctx, viewport: vp }).promise
  return canvas
}

async function toBytes(canvas: AnyCanvas, type: 'png' | 'jpg'): Promise<Uint8Array> {
  const mime = type === 'png' ? 'image/png' : 'image/jpeg'
  const blob = 'convertToBlob' in canvas
    ? await canvas.convertToBlob(type === 'png' ? { type: mime } : { type: mime, quality: 0.9 })
    : await new Promise<Blob | null>((r) => canvas.toBlob(r, mime, 0.9))
  if (!blob) throw new Error('canvas encode failed')
  return new Uint8Array(await blob.arrayBuffer())
}

function release(canvas: AnyCanvas) {
  canvas.width = canvas.height = 0
}

async function crop(src: AnyCanvas, box: Box, scale: number, bitmaps: boolean): Promise<WireImage> {
  const sx = Math.floor(box.x * scale)
  const sy = Math.floor(box.y * scale)
  const sw = Math.max(1, Math.min(src.width - sx, Math.ceil(box.w * scale)))
  const sh = Math.max(1, Math.min(src.height - sy, Math.ceil(box.h * scale)))
  // Photos are much smaller as JPEG; small graphics stay crisp as PNG.
  const type = sw * sh > 250_000 ? 'jpg' : 'png'
  if (bitmaps) return { ...box, type, bitmap: await createImageBitmap(src, sx, sy, sw, sh) }
  const c = newCanvas(sw, sh, false)
  ;(c.getContext('2d') as CanvasRenderingContext2D).drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh)
  const data = await toBytes(c, type)
  release(c)
  return { ...box, data, type }
}

/** The OCR engine or its language data could not load or run. */
export class OcrError extends Error {
  constructor(cause: unknown) {
    super(`OCR failed: ${cause instanceof Error ? cause.message : String(cause)}`)
    this.name = 'OcrError'
  }
}

function aborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('cancelled', 'AbortError')
}

/** Characters of real text on a page (scanned-page test). */
export function textChars(items: TextItem[]): number {
  return items.reduce((n, i) => n + i.str.replace(/\s/g, '').length, 0)
}

/** A page is scanned when it has (almost) no text and a picture covers most of it. */
export function isScannedPage(chars: number, boxes: Box[], pageW: number, pageH: number): boolean {
  if (chars > 10) return false
  const area = pageW * pageH
  return boxes.some((b) => b.w * b.h > area * 0.5)
}

export async function extractPage(doc: PdfDoc, num: number, opts: ExtractOptions): Promise<WirePage> {
  const pdfjs = await loadPdfjs()
  const page = await doc.getPage(num)
  const maxPixels = opts.maxPixels ?? MAX_RENDER_PIXELS
  const bitmaps = !!opts.bitmaps
  try {
    const vp = page.getViewport({ scale: 1 })
    // The operator list is needed even for text-only pages: it is what loads
    // the fonts into commonObjs (real names → bold/italic) and what finds
    // pictures and scanned pages.
    const ops = await page.getOperatorList()
    aborted(opts.signal)
    const tc = await page.getTextContent()
    aborted(opts.signal)
    const fontOf = (name: string): FontLike | null => {
      try { return page.commonObjs.has(name) ? page.commonObjs.get(name) as FontLike : null } catch { return null }
    }
    const items = textItems(pdfjs, tc.items, tc.styles as Record<string, { ascent?: number; descent?: number; vertical?: boolean }>, vp.transform, fontOf)
    const allBoxes = imageBoxes(pdfjs.OPS, ops.fnArray, ops.argsArray as unknown[][], vp.transform)
    const chars = textChars(items)
    const scanned = isScannedPage(chars, cleanBoxes(allBoxes, vp.width, vp.height, false), vp.width, vp.height)
    const model: WirePage = { num, width: vp.width, height: vp.height, items, images: [] }
    if (scanned) {
      const scale = renderScale(vp.width, vp.height, opts.ocr ? 2.5 : 1.6, maxPixels)
      reuseOperatorList(page, pdfjs, ops)
      const canvas = await renderPage(page, scale, bitmaps)
      aborted(opts.signal)
      if (opts.ocr) {
        try {
          const { ocrCanvas } = await import('./ocr')
          model.items = await ocrCanvas(canvas, scale, opts.ocrLang, (p) => { if (p.status.startsWith('recogniz')) opts.onOcr?.(p.progress) })
        } catch (err) {
          aborted(opts.signal)
          throw new OcrError(err)
        }
        model.ocr = true
      }
      if (!model.ocr || !model.items.length) {
        const box = { x: 0, y: 0, w: vp.width, h: vp.height, type: 'jpg' as const }
        model.background = bitmaps && 'transferToImageBitmap' in canvas
          ? { ...box, bitmap: canvas.transferToImageBitmap() }
          : { ...box, data: await toBytes(canvas, 'jpg') }
      }
      release(canvas)
      return model
    }
    // Text pages are rendered only when there is a picture to cut out:
    // pictures off, or none on the page, means no render at all.
    const boxes = opts.keepImages ? cleanBoxes(allBoxes, vp.width, vp.height, true) : []
    if (boxes.length) {
      const scale = renderScale(vp.width, vp.height, 2, maxPixels)
      reuseOperatorList(page, pdfjs, ops)
      const canvas = await renderPage(page, scale, bitmaps)
      aborted(opts.signal)
      for (const b of boxes) model.images.push(await crop(canvas, b, scale, bitmaps))
      release(canvas)
    }
    return model
  } finally {
    page.cleanup()
  }
}

export interface ProbeResult {
  pages: number
  kind: 'text' | 'scanned'
  thumb: Blob | null
}

/** First look at a file: page count, text or scanned, page-1 thumbnail. */
export async function probeDoc(doc: PdfDoc, thumbWidth = THUMB_WIDTH): Promise<ProbeResult> {
  const pdfjs = await loadPdfjs()
  const pages = doc.numPages
  let chars = 0
  let scannedPages = 0
  const sample = Math.min(pages, 3)
  for (let n = 1; n <= sample; n++) {
    const page = await doc.getPage(n)
    const vp = page.getViewport({ scale: 1 })
    const tc = await page.getTextContent()
    const c = tc.items.reduce((s, i) => s + ('str' in i ? i.str.replace(/\s/g, '').length : 0), 0)
    chars += c
    if (c <= 10) {
      const ops = await page.getOperatorList()
      const boxes = cleanBoxes(imageBoxes(pdfjs.OPS, ops.fnArray, ops.argsArray as unknown[][], vp.transform), vp.width, vp.height, false)
      if (isScannedPage(c, boxes, vp.width, vp.height)) scannedPages++
    }
    page.cleanup()
  }
  const kind = scannedPages > 0 && scannedPages >= sample / 2 && chars < 30 * sample ? 'scanned' : 'text'
  let thumb: Blob | null = null
  try {
    thumb = await renderThumb(doc, 1, thumbWidth)
  } catch { /* thumbnail is optional */ }
  return { pages, kind, thumb }
}

/**
 * Preview width in CSS pixels, rendered at 2×. One size serves the list
 * thumbnail and the phone detail sheet, so page 1 is rendered once per file
 * (at probe time) and the sheet reuses it instead of rendering it again.
 */
export const THUMB_WIDTH = 150

/** Render one page as a JPEG preview `width` CSS pixels wide (2× for sharpness). */
export async function renderThumb(doc: PdfDoc, num: number, width: number): Promise<Blob | null> {
  const page = await doc.getPage(num)
  try {
    const base = page.getViewport({ scale: 1 })
    const offscreen = canUseOffscreen()
    const canvas = await renderPage(page, (width * 2) / base.width, offscreen)
    const blob = 'convertToBlob' in canvas
      ? await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 })
      : await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8))
    release(canvas)
    return blob
  } finally {
    page.cleanup()
  }
}
