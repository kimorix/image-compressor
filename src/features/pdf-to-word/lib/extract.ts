// pdf.js page → PageModel: the positioned text layer (with bold/italic
// from the real font names), picture boxes found by replaying the
// operator list's transform stack, and crops of those pictures from a
// rendered copy of the page. Scanned pages (no text, one big picture) are
// rendered once and either OCR'd or kept whole.
import type { OcrLang, PageImage, PageModel, TextItem } from '../types'
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
}

/** Pixels per point for rendering: 2× (sharp crops), capped at ~10 MP. */
export function renderScale(w: number, h: number, want = 2): number {
  return Math.max(0.5, Math.min(want, Math.sqrt(10_000_000 / Math.max(1, w * h))))
}

async function renderPage(page: PdfPage, scale: number): Promise<HTMLCanvasElement> {
  const vp = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(vp.width)
  canvas.height = Math.ceil(vp.height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise
  return canvas
}

function toBytes(canvas: HTMLCanvasElement, type: 'png' | 'jpg'): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (!b) { reject(new Error('canvas encode failed')); return }
      void b.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject)
    }, type === 'png' ? 'image/png' : 'image/jpeg', 0.9)
  })
}

async function crop(src: HTMLCanvasElement, box: Box, scale: number): Promise<PageImage> {
  const sx = Math.floor(box.x * scale)
  const sy = Math.floor(box.y * scale)
  const sw = Math.max(1, Math.min(src.width - sx, Math.ceil(box.w * scale)))
  const sh = Math.max(1, Math.min(src.height - sy, Math.ceil(box.h * scale)))
  const c = document.createElement('canvas')
  c.width = sw
  c.height = sh
  c.getContext('2d')!.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh)
  // Photos are much smaller as JPEG; small graphics stay crisp as PNG.
  const type = sw * sh > 250_000 ? 'jpg' : 'png'
  const data = await toBytes(c, type)
  c.width = c.height = 0
  return { ...box, data, type }
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

export async function extractPage(doc: PdfDoc, num: number, opts: ExtractOptions): Promise<PageModel> {
  const pdfjs = await loadPdfjs()
  const page = await doc.getPage(num)
  try {
    const vp = page.getViewport({ scale: 1 })
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
    const model: PageModel = { num, width: vp.width, height: vp.height, items, images: [] }
    if (scanned) {
      const scale = renderScale(vp.width, vp.height, opts.ocr ? 2.5 : 1.6)
      const canvas = await renderPage(page, scale)
      aborted(opts.signal)
      if (opts.ocr) {
        const { ocrCanvas } = await import('./ocr')
        model.items = await ocrCanvas(canvas, scale, opts.ocrLang, (p) => { if (p.status.startsWith('recogniz')) opts.onOcr?.(p.progress) })
        model.ocr = true
      }
      if (!model.ocr || !model.items.length) {
        const data = await toBytes(canvas, 'jpg')
        model.background = { x: 0, y: 0, w: vp.width, h: vp.height, data, type: 'jpg' }
      }
      canvas.width = canvas.height = 0
      return model
    }
    const boxes = opts.keepImages ? cleanBoxes(allBoxes, vp.width, vp.height, true) : []
    if (boxes.length) {
      const scale = renderScale(vp.width, vp.height)
      const canvas = await renderPage(page, scale)
      aborted(opts.signal)
      for (const b of boxes) model.images.push(await crop(canvas, b, scale))
      canvas.width = canvas.height = 0
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
export async function probeDoc(doc: PdfDoc, thumbWidth = 132): Promise<ProbeResult> {
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

/** Render one page as a JPEG preview `width` CSS pixels wide (2× for sharpness). */
export async function renderThumb(doc: PdfDoc, num: number, width: number): Promise<Blob | null> {
  const page = await doc.getPage(num)
  try {
    const base = page.getViewport({ scale: 1 })
    const canvas = await renderPage(page, (width * 2) / base.width)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8))
    canvas.width = canvas.height = 0
    return blob
  } finally {
    page.cleanup()
  }
}
