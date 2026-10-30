// Live preview (main thread). Draws the output from the small upright
// preview bitmap with the SAME computeGeometry + drawWatermark the worker
// uses, so what the stage shows is what gets written. Everything is drawn
// in output-pixel coordinates under one canvas transform; the stage only
// needs `frame` and `ds` to map pointer positions back.
import type { Focus, RwSettings } from '../types'
import { computeGeometry, type Geometry, type Rect } from './geometry'
import { drawWatermark, type WmLayout } from './watermark'
import { keepsAlpha } from './settings'

export interface StageLayout {
  g: Geometry
  /** Where the output sits on the stage (CSS px). */
  frame: Rect
  /** Stage CSS px per output px. */
  ds: number
  /** Stage CSS px per source px (context mode), for the dimmed surround. */
  sc: number
  /** Whole-source rectangle on the stage when the crop context is shown. */
  context: Rect | null
  cssW: number
  cssH: number
}

/**
 * Fit the output (or, with `context`, the whole source with the crop
 * window inside it) into a maxW × maxH box. Pure.
 */
export function stageLayout(srcW: number, srcH: number, s: RwSettings, focus: Focus, maxW: number, maxH: number, context: boolean): StageLayout {
  const g = computeGeometry(srcW, srcH, s.resize, focus)
  const W = g.canvas.w
  const H = g.canvas.h
  if (context && g.cropped) {
    const sc = Math.min(maxW / srcW, maxH / srcH)
    const cssW = srcW * sc
    const cssH = srcH * sc
    const frame = { x: g.crop.x * sc, y: g.crop.y * sc, w: g.crop.w * sc, h: g.crop.h * sc }
    return { g, frame, ds: frame.w / W, sc, context: { x: 0, y: 0, w: cssW, h: cssH }, cssW, cssH }
  }
  const ds = Math.min(maxW / W, maxH / H)
  const cssW = W * ds
  const cssH = H * ds
  return { g, frame: { x: 0, y: 0, w: cssW, h: cssH }, ds, sc: ds * g.scale, context: null, cssW, cssH }
}

export interface RenderOptions {
  bmp: CanvasImageSource & { width: number; height: number }
  srcW: number
  srcH: number
  settings: RwSettings
  focus: Focus
  /** Output type (decides alpha vs fill). */
  outType: string
  text: string
  logo: (CanvasImageSource & { width: number; height: number }) | null
  dpr: number
}

/**
 * Backing-store pixel ratio for a cssW × cssH stage: the device ratio
 * (1–3), lowered so the canvas never exceeds `maxPx` pixels. iOS Safari
 * refuses canvases above ~16.7 MP and shares a small canvas-memory budget
 * across the page; a canvas that blows it stays blank without any error.
 */
export const STAGE_MAX_PX = 6_000_000
export function stageDpr(cssW: number, cssH: number, dpr: number, maxPx = STAGE_MAX_PX): number {
  const d = Math.max(1, Math.min(3, Number.isFinite(dpr) ? dpr : 1))
  const area = Math.max(1, cssW) * Math.max(1, cssH)
  return Math.max(0.25, Math.min(d, Math.sqrt(maxPx / area)))
}

/**
 * Clamp a source rectangle to the image. Float rounding (crop × preview
 * ratio) can overshoot the bitmap by a hair; some WebKit builds drop a
 * drawImage whose source rect leaves the image instead of clipping it.
 */
export function clampSrc(x: number, y: number, w: number, h: number, iw: number, ih: number): [number, number, number, number] {
  const x0 = Math.min(Math.max(0, x), iw)
  const y0 = Math.min(Math.max(0, y), ih)
  const x1 = Math.min(Math.max(x0, x + w), iw)
  const y1 = Math.min(Math.max(y0, y + h), ih)
  return [x0, y0, Math.max(1e-3, x1 - x0), Math.max(1e-3, y1 - y0)]
}

/** Checkerboard behind transparent output (the stage CSS shows it). */
export function renderStage(canvas: HTMLCanvasElement, L: StageLayout, o: RenderOptions): WmLayout {
  const { g } = L
  const W = g.canvas.w
  const H = g.canvas.h
  const dpr = stageDpr(L.cssW, L.cssH, o.dpr)
  const pw = Math.max(1, Math.round(L.cssW * dpr))
  const ph = Math.max(1, Math.round(L.cssH * dpr))
  if (canvas.width !== pw) canvas.width = pw
  if (canvas.height !== ph) canvas.height = ph
  canvas.style.width = `${L.cssW}px`
  canvas.style.height = `${L.cssH}px`
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, pw, ph)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // Source px → preview-bitmap px.
  const kx = o.bmp.width / Math.max(1, o.srcW)
  const ky = o.bmp.height / Math.max(1, o.srcH)
  if (L.context) {
    // Whole source, dimmed: what the crop cuts away.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.drawImage(o.bmp, 0, 0, o.bmp.width, o.bmp.height, 0, 0, L.cssW, L.cssH)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)'
    ctx.fillRect(0, 0, L.cssW, L.cssH)
    ctx.clearRect(L.frame.x, L.frame.y, L.frame.w, L.frame.h)
  }
  // Output coordinates from here on.
  ctx.setTransform(dpr * L.ds, 0, 0, dpr * L.ds, dpr * L.frame.x, dpr * L.frame.y)
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, W, H)
  ctx.clip()
  const alpha = keepsAlpha(o.outType)
  const pad = o.settings.resize.padColor
  if (!alpha) {
    ctx.fillStyle = pad
    ctx.fillRect(0, 0, W, H)
  } else if (g.padded && !o.settings.resize.padTransparent) {
    ctx.fillStyle = pad
    ctx.fillRect(0, 0, W, H)
    ctx.clearRect(g.draw.x, g.draw.y, g.draw.w, g.draw.h)
  }
  const [sx, sy, sw, sh] = clampSrc(g.crop.x * kx, g.crop.y * ky, g.crop.w * kx, g.crop.h * ky, o.bmp.width, o.bmp.height)
  ctx.drawImage(o.bmp, sx, sy, sw, sh, g.draw.x, g.draw.y, g.draw.w, g.draw.h)
  let layout: WmLayout = { items: [], fontPx: 0, bw: 0, bh: 0 }
  const wm = o.settings.wm
  if (wm.enabled) {
    if (wm.kind === 'logo') {
      if (o.logo) layout = drawWatermark(ctx, W, H, wm, '', o.logo)
    } else if (o.text) layout = drawWatermark(ctx, W, H, wm, o.text, null)
  }
  ctx.restore()
  if (L.context) {
    // Crop window outline.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 2
    ctx.strokeRect(L.frame.x + 1, L.frame.y + 1, L.frame.w - 2, L.frame.h - 2)
  }
  return layout
}

/** Original view: the whole upright source, fitted. */
export function renderOriginal(canvas: HTMLCanvasElement, bmp: CanvasImageSource & { width: number; height: number }, srcW: number, srcH: number, maxW: number, maxH: number, dpr: number): void {
  const k = Math.min(maxW / srcW, maxH / srcH)
  const cssW = srcW * k
  const cssH = srcH * k
  const d = stageDpr(cssW, cssH, dpr)
  canvas.width = Math.max(1, Math.round(cssW * d))
  canvas.height = Math.max(1, Math.round(cssH * d))
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
}

/**
 * Rough output size: encode the output at preview resolution and scale by
 * the pixel ratio. AVIF (no canvas encoder) is estimated from WebP.
 */
export async function estimateSize(L: StageLayout, o: RenderOptions): Promise<number | null> {
  const W = L.g.canvas.w
  const H = L.g.canvas.h
  // Encode at the preview's own resolution (never above the output's).
  const k = Math.min(1, (o.bmp.width / Math.max(1, o.srcW)) / Math.max(1e-6, L.g.scale))
  const tw = Math.max(1, Math.round(W * k))
  const th = Math.max(1, Math.round(H * k))
  const c = document.createElement('canvas')
  const ds = tw / W
  const layout: StageLayout = { ...L, frame: { x: 0, y: 0, w: tw, h: th }, ds, context: null, cssW: tw, cssH: th }
  renderStage(c, layout, { ...o, dpr: 1 })
  const type = o.outType === 'image/avif' ? 'image/webp' : o.outType
  const q = type === 'image/png' ? undefined : o.settings.out.quality / 100
  const b = await new Promise<Blob | null>((r) => c.toBlob(r, type, q))
  c.width = 0
  c.height = 0
  if (!b) return null
  const ratio = (W * H) / (tw * th)
  // Bigger images compress better per pixel; a mild exponent keeps the
  // estimate from overshooting on large upscales of the preview.
  const est = b.size * Math.pow(ratio, 0.9)
  return Math.round(o.outType === 'image/avif' ? est * 0.75 : est)
}
