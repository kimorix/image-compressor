// Scanned-page OCR with tesseract.js, loaded only when a scanned page is
// converted with OCR on. The engine and the language data come from the
// jsDelivr CDN on first use (about 15 MB for Chinese + English) and are
// cached by the browser (language data in IndexedDB), so later runs work
// offline. One recogniser is kept for the session and replaced when the
// language changes.
import type { Worker as TessWorker } from 'tesseract.js'
import type { OcrLang, TextItem } from '../types'

let current: { lang: OcrLang; worker: Promise<TessWorker> } | null = null

export interface OcrProgress { status: string; progress: number }

async function getWorker(lang: OcrLang, onProgress?: (p: OcrProgress) => void): Promise<TessWorker> {
  if (current && current.lang === lang) return current.worker
  if (current) {
    const old = current.worker
    current = null
    void old.then((w) => w.terminate()).catch(() => {})
  }
  const worker = (async () => {
    // The ESM browser build: no CommonJS interop chunk shared with the app.
    const mod = await import('tesseract.js/dist/tesseract.esm.min.js') as unknown as { default?: typeof import('tesseract.js') } & typeof import('tesseract.js')
    const T = mod.default ?? mod
    return T.createWorker(lang.split('+'), 1, {
      logger: (m: { status: string; progress: number }) => onProgress?.({ status: m.status, progress: m.progress }),
    })
  })()
  current = { lang, worker }
  worker.catch(() => { if (current?.worker === worker) current = null })
  return worker
}

/**
 * Recognise a rendered page. `scale` is canvas pixels per PDF point, so the
 * returned items are in points like the text layer of a digital PDF.
 */
export async function ocrCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  scale: number,
  lang: OcrLang,
  onProgress?: (p: OcrProgress) => void,
): Promise<TextItem[]> {
  const worker = await getWorker(lang, onProgress)
  const { data } = await worker.recognize(canvas, {}, { blocks: true, text: false })
  return ocrItems(data.blocks ?? [], scale)
}

interface OcrBox { x0: number; y0: number; x1: number; y1: number }
interface OcrBlockLike {
  paragraphs: { lines: { bbox: OcrBox; words: { text: string; confidence: number; bbox: OcrBox }[] }[] }[]
}

/** tesseract blocks → text items (one per word, line-height boxes). */
export function ocrItems(blocks: OcrBlockLike[], scale: number): TextItem[] {
  const out: TextItem[] = []
  for (const b of blocks) {
    for (const p of b.paragraphs) {
      for (const line of p.lines) {
        const lh = (line.bbox.y1 - line.bbox.y0) / scale
        if (lh <= 0) continue
        for (const w of line.words) {
          const text = w.text.trim()
          if (!text || w.confidence < 20) continue
          out.push({
            str: text,
            x: w.bbox.x0 / scale,
            y: line.bbox.y0 / scale,
            w: (w.bbox.x1 - w.bbox.x0) / scale,
            h: lh,
            size: Math.max(4, lh * 0.82),
            bold: false,
            italic: false,
          })
        }
      }
    }
  }
  return out
}

export async function terminateOcr(): Promise<void> {
  if (!current) return
  const w = current.worker
  current = null
  try { (await w).terminate() } catch { /* never started */ }
}
