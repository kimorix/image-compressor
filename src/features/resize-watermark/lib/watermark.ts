// Watermark layout (pure) and drawing. Sizes are relative to the OUTPUT's
// short side and positions relative to its width/height, so the same
// settings look the same on a 400 px thumbnail, the 1200 px preview and a
// 6000 px original.
import type { Ctx2D } from '../../../shared/image/codec'
import type { WatermarkSettings, WmPos } from '../types'
import { fontCss } from './fonts'

export interface Placement {
  /** Centre of the mark, output pixels. */
  cx: number
  cy: number
  /** Unrotated size of the mark. */
  w: number
  h: number
  /** Radians. */
  angle: number
}

export interface WmLayout {
  items: Placement[]
  /** Text font size in px (0 for a logo). */
  fontPx: number
  /** Axis-aligned bounds of one rotated mark (for hit tests / clamping). */
  bw: number
  bh: number
}

/** Measures text width at a font size (canvas measureText in practice). */
export type Measure = (text: string, fontPx: number) => number

/** Line height of the text box relative to the font size. */
export const LINE = 1.25
/** Safety cap on tiled marks (a 2 % mark on a huge panorama). */
export const MAX_TILES = 1500

const GRID: Record<string, [number, number]> = {
  tl: [0, 0], tc: [1, 0], tr: [2, 0],
  ml: [0, 1], mc: [1, 1], mr: [2, 1],
  bl: [0, 2], bc: [1, 2], br: [2, 2],
}
export const GRID_POSITIONS: readonly WmPos[] = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br']

/** Replace {name} (file name without extension) and {date} (YYYY-MM-DD). */
export function expandText(text: string, vars: { name: string; date: string }): string {
  return text.replace(/\{name\}/g, vars.name).replace(/\{date\}/g, vars.date).trim()
}

function localYmd(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Variable values for one file: {name} without extension, {date} taken (or file date). */
export function textVars(file: { name: string; lastModified?: number }, date: string | null): { name: string; date: string } {
  return {
    name: file.name.replace(/\.[^.]+$/, '') || file.name,
    date: date ?? localYmd(file.lastModified || Date.now()),
  }
}

/** Bounding box of a w×h box rotated by `angle`. */
export function rotatedBounds(w: number, h: number, angle: number): { bw: number; bh: number } {
  const c = Math.abs(Math.cos(angle))
  const s = Math.abs(Math.sin(angle))
  return { bw: w * c + h * s, bh: w * s + h * c }
}

/**
 * Lay out the mark(s) on a outW×outH image. `content` is either the text
 * (with `measure`) or a logo aspect ratio (width / height). Returns no items
 * when there is nothing to draw (empty text).
 */
export function layoutWatermark(
  outW: number,
  outH: number,
  wm: WatermarkSettings,
  content: { text: string; measure: Measure } | { logoAspect: number },
): WmLayout {
  const short = Math.max(1, Math.min(outW, outH))
  const tile = wm.pos === 'tile'
  const angle = (wm.rotate * Math.PI) / 180
  let w: number
  let h: number
  let fontPx = 0
  if ('text' in content) {
    if (!content.text) return { items: [], fontPx: 0, bw: 0, bh: 0 }
    fontPx = (wm.size / 100) * short
    w = Math.max(1, content.measure(content.text, fontPx))
    h = fontPx * LINE
  } else {
    const aspect = content.logoAspect > 0 && Number.isFinite(content.logoAspect) ? content.logoAspect : 1
    w = (wm.logoSize / 100) * short
    h = w / aspect
  }
  const margin = tile ? 0 : (wm.margin / 100) * short
  let { bw, bh } = rotatedBounds(w, h, angle)
  // Too big for the image (long text, big logo): shrink to fit inside the
  // margins rather than spill over the edges.
  const room = Math.min((outW - 2 * margin) / bw, (outH - 2 * margin) / bh)
  if (room < 1 && room > 0) {
    w *= room
    h *= room
    fontPx *= room
    bw *= room
    bh *= room
  }
  const base = { w, h, angle }
  if (tile) {
    const gap = (wm.tileGap / 100) * short
    const stepX = bw + gap
    const stepY = bh + gap
    const cols = Math.ceil(outW / stepX) + 2
    const rows = Math.ceil(outH / stepY) + 2
    const items: Placement[] = []
    // Staggered rows (every other row shifted half a step), centred on the
    // image so the pattern is symmetric whatever the size.
    const x0 = outW / 2 - Math.floor(cols / 2) * stepX
    const y0 = outH / 2 - Math.floor(rows / 2) * stepY
    for (let r = 0; r < rows && items.length < MAX_TILES; r++) {
      const shift = r % 2 ? stepX / 2 : 0
      for (let c = 0; c < cols && items.length < MAX_TILES; c++) {
        const cx = x0 + c * stepX + shift
        const cy = y0 + r * stepY
        // Keep only marks that touch the image.
        if (cx + bw / 2 < 0 || cx - bw / 2 > outW || cy + bh / 2 < 0 || cy - bh / 2 > outH) continue
        items.push({ cx, cy, ...base })
      }
    }
    if (!items.length) items.push({ cx: outW / 2, cy: outH / 2, ...base })
    return { items, fontPx, bw, bh }
  }
  const clampC = (v: number, half: number, size: number) =>
    half * 2 >= size ? size / 2 : Math.min(size - half, Math.max(half, v))
  let cx: number
  let cy: number
  if (wm.pos === 'free') {
    cx = clampC(wm.x * outW, bw / 2, outW)
    cy = clampC(wm.y * outH, bh / 2, outH)
  } else {
    const [gx, gy] = GRID[wm.pos] ?? GRID.br
    cx = gx === 0 ? margin + bw / 2 : gx === 2 ? outW - margin - bw / 2 : outW / 2
    cy = gy === 0 ? margin + bh / 2 : gy === 2 ? outH - margin - bh / 2 : outH / 2
    cx = clampC(cx, bw / 2, outW)
    cy = clampC(cy, bh / 2, outH)
  }
  return { items: [{ cx, cy, ...base }], fontPx, bw, bh }
}

/** Relative (0–1) centre of the first mark: the "free" position it maps to. */
export function relativeCenter(layout: WmLayout, outW: number, outH: number): { x: number; y: number } | null {
  const p = layout.items[0]
  if (!p) return null
  return { x: p.cx / Math.max(1, outW), y: p.cy / Math.max(1, outH) }
}

/** Point inside the (rotated) mark? Used for drag hit tests. */
export function hitTest(layout: WmLayout, x: number, y: number, pad = 0): boolean {
  for (const p of layout.items) {
    const dx = x - p.cx
    const dy = y - p.cy
    const c = Math.cos(-p.angle)
    const s = Math.sin(-p.angle)
    const lx = dx * c - dy * s
    const ly = dx * s + dy * c
    if (Math.abs(lx) <= p.w / 2 + pad && Math.abs(ly) <= p.h / 2 + pad) return true
  }
  return false
}

/** Perceived lightness 0–1 of a #rrggbb colour (outline picks the opposite). */
export function lightness(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return 1
  const n = parseInt(m[1], 16)
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}

export function measureWith(ctx: Ctx2D, wm: WatermarkSettings): Measure {
  return (text, px) => {
    ctx.font = fontCss(wm.font, px, wm.bold)
    return ctx.measureText(text).width
  }
}

/**
 * Draw the watermark on ctx (an outW×outH image). `logo` is a decoded
 * bitmap for the logo kind. Returns the layout used (empty when skipped).
 */
export function drawWatermark(
  ctx: Ctx2D,
  outW: number,
  outH: number,
  wm: WatermarkSettings,
  text: string,
  logo: CanvasImageSource & { width: number; height: number } | null,
): WmLayout {
  const layout = wm.kind === 'logo'
    ? (logo ? layoutWatermark(outW, outH, wm, { logoAspect: logo.width / Math.max(1, logo.height) }) : { items: [], fontPx: 0, bw: 0, bh: 0 })
    : layoutWatermark(outW, outH, wm, { text, measure: measureWith(ctx, wm) })
  if (!layout.items.length) return layout
  ctx.save()
  ctx.globalAlpha = Math.min(1, Math.max(0.05, wm.opacity / 100))
  if (wm.kind === 'text') {
    ctx.font = fontCss(wm.font, layout.fontPx, wm.bold)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = wm.color
    const dark = lightness(wm.color) > 0.55
    const outline = dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)'
    for (const p of layout.items) {
      ctx.save()
      ctx.translate(p.cx, p.cy)
      ctx.rotate(p.angle)
      if (wm.stroke) {
        ctx.shadowColor = dark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)'
        ctx.shadowBlur = layout.fontPx * 0.18
        ctx.lineJoin = 'round'
        ctx.lineWidth = Math.max(1, layout.fontPx * 0.09)
        ctx.strokeStyle = outline
        ctx.strokeText(text, 0, 0)
        ctx.shadowBlur = 0
        ctx.shadowColor = 'transparent'
      }
      ctx.fillText(text, 0, 0)
      ctx.restore()
    }
  } else if (logo) {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    for (const p of layout.items) {
      ctx.save()
      ctx.translate(p.cx, p.cy)
      ctx.rotate(p.angle)
      ctx.drawImage(logo, -p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }
  }
  ctx.restore()
  return layout
}
