// SVG input: decide a raster size and pin it on the root element, so the
// browser renders the vector at that resolution (an SVG with only a
// viewBox has no natural size at all in some engines, and a 24 px icon
// rasterised at 24 px is useless). Rendering itself is the browser's
// (<img> on the main thread: workers cannot decode SVG); as an image, an
// SVG runs no scripts and loads nothing external.
//
// Size rule: the intrinsic size (width/height, else the viewBox, else
// 300×150 like CSS), scaled up so the long side is at least 1024 px, and
// capped at 8192 px / 40 MP.
// Lazy chunk ("codec-" prefix: not precached).

export const SVG_MIN_LONG = 1024
export const SVG_MAX_LONG = 8192
export const SVG_MAX_PIXELS = 40_000_000

const UNIT: Record<string, number> = { '': 1, px: 1, pt: 4 / 3, pc: 16, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6, em: 16, ex: 8, rem: 16 }

/** CSS length in px; null for percentages, auto or garbage. */
export function svgLength(v: string | undefined): number | null {
  if (!v) return null
  const m = /^\s*([+]?\d*\.?\d+(?:e[+-]?\d+)?)\s*([a-z]*)\s*$/i.exec(v)
  if (!m) return null
  const k = UNIT[m[2].toLowerCase()]
  if (k === undefined) return null
  const n = parseFloat(m[1]) * k
  return n > 0 && Number.isFinite(n) ? n : null
}

/** The root <svg …> start tag (after any prolog, comments and doctype). */
export function rootTag(text: string): { start: number; end: number; attrs: Record<string, string> } | null {
  const re = /<svg\b([^>]*)>/i
  const m = re.exec(text)
  if (!m) return null
  const attrs: Record<string, string> = {}
  const ar = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g
  let a: RegExpExecArray | null
  while ((a = ar.exec(m[1]))) attrs[a[1].toLowerCase()] = a[3] ?? a[4] ?? ''
  return { start: m.index, end: m.index + m[0].length, attrs }
}

export function svgIntrinsicSize(text: string): { w: number; h: number } {
  const root = rootTag(text)
  if (!root) return { w: 300, h: 150 }
  let w = svgLength(root.attrs.width)
  let h = svgLength(root.attrs.height)
  const vb = (root.attrs.viewbox || '').trim().split(/[\s,]+/).map(Number)
  const vbOk = vb.length === 4 && vb[2] > 0 && vb[3] > 0 && vb.every(Number.isFinite)
  if (w && !h) h = vbOk ? (w * vb[3]) / vb[2] : 150
  else if (h && !w) w = vbOk ? (h * vb[2]) / vb[3] : 300
  else if (!w && !h) {
    if (vbOk) { w = vb[2]; h = vb[3] } else { w = 300; h = 150 }
  }
  return { w: w!, h: h! }
}

/** Raster size for an SVG of this intrinsic size. */
export function svgRasterSize(w: number, h: number): { w: number; h: number } {
  const long = Math.max(w, h)
  let k = long < SVG_MIN_LONG ? SVG_MIN_LONG / long : 1
  if (long * k > SVG_MAX_LONG) k = SVG_MAX_LONG / long
  if (w * k * h * k > SVG_MAX_PIXELS) k = Math.sqrt(SVG_MAX_PIXELS / (w * h))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

/**
 * SVG text with explicit pixel width/height on the root (a viewBox is added
 * from the old size when missing, so the drawing scales instead of being
 * cropped) and preserveAspectRatio left as authored.
 */
export function pinSvgSize(text: string, w: number, h: number): string {
  const root = rootTag(text)
  if (!root) return text
  const intrinsic = svgIntrinsicSize(text)
  let tag = text.slice(root.start, root.end)
  tag = tag.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, '')
  const add = [` width="${w}"`, ` height="${h}"`]
  if (!root.attrs.viewbox) add.push(` viewBox="0 0 ${intrinsic.w} ${intrinsic.h}"`)
  tag = tag.replace(/^<svg\b/i, `<svg${add.join('')}`)
  return text.slice(0, root.start) + tag + text.slice(root.end)
}
