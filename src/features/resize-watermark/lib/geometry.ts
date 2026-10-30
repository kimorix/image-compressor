// Output geometry: one pure function shared by the live preview (main
// thread, on a downscaled preview bitmap) and the worker job (full size),
// so what the preview shows is what gets written.
//
//   crop   source rectangle that is drawn (float, source pixels)
//   canvas output size (integers)
//   draw   where the crop lands on the output (pad mode letterboxes)
import type { Focus, ResizeSettings } from '../types'
import { findPreset, isLongSidePreset } from './presets'

export interface Rect { x: number; y: number; w: number; h: number }

export interface Geometry {
  crop: Rect
  canvas: { w: number; h: number }
  draw: Rect
  /** Effective scale from source to output pixels. */
  scale: number
  /** The image is smaller than the target and noUpscale kept it as is. */
  notUpscaled: boolean
  /** Crop (cover) applied: the preview can show what is cut away. */
  cropped: boolean
  /** Letterboxed (pad) output. */
  padded: boolean
}

export const MAX_SIDE = 16384

const CENTER: Focus = { x: 0.5, y: 0.5 }
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5)
const dim = (v: number) => Math.min(MAX_SIDE, Math.max(1, Math.round(v)))

type Effective =
  | { kind: 'none' }
  | { kind: 'scale'; scale: number }
  | { kind: 'long'; long: number }
  | { kind: 'box'; w: number; h: number; fit: ResizeSettings['fit'] }

/** Reduce the four UI modes (and presets) to one of three operations. */
export function effectiveResize(r: ResizeSettings): Effective {
  if (!r.enabled) return { kind: 'none' }
  switch (r.mode) {
    case 'long': return { kind: 'long', long: Math.max(1, r.long) }
    case 'pct': return { kind: 'scale', scale: Math.max(1, r.pct) / 100 }
    case 'preset': {
      const p = findPreset(r.preset)
      if (!p) return { kind: 'none' }
      if (isLongSidePreset(p)) return { kind: 'long', long: p.w }
      return { kind: 'box', w: p.w, h: p.h, fit: 'cover' }
    }
    default: return { kind: 'box', w: Math.max(1, r.w), h: Math.max(1, r.h), fit: r.fit }
  }
}

function whole(srcW: number, srcH: number, scale: number, notUpscaled: boolean): Geometry {
  const w = dim(srcW * scale)
  const h = dim(srcH * scale)
  return {
    crop: { x: 0, y: 0, w: srcW, h: srcH },
    canvas: { w, h },
    draw: { x: 0, y: 0, w, h },
    scale,
    notUpscaled,
    cropped: false,
    padded: false,
  }
}

export function computeGeometry(srcW: number, srcH: number, r: ResizeSettings, focus: Focus = CENTER): Geometry {
  const W = Math.max(1, srcW)
  const H = Math.max(1, srcH)
  const e = effectiveResize(r)
  if (e.kind === 'none') return whole(W, H, 1, false)
  if (e.kind === 'scale' || e.kind === 'long') {
    let s = e.kind === 'scale' ? e.scale : e.long / Math.max(W, H)
    const blocked = r.noUpscale && s > 1
    if (blocked) s = 1
    // Never exceed the canvas limit, whatever the percentage says.
    s = Math.min(s, MAX_SIDE / Math.max(W, H))
    return whole(W, H, s, blocked)
  }
  const bw = dim(e.w)
  const bh = dim(e.h)
  if (e.fit === 'contain') {
    let s = Math.min(bw / W, bh / H)
    const blocked = r.noUpscale && s > 1
    if (blocked) s = 1
    return whole(W, H, s, blocked)
  }
  if (e.fit === 'pad') {
    let s = Math.min(bw / W, bh / H)
    const blocked = r.noUpscale && s > 1
    if (blocked) s = 1
    const dw = Math.min(bw, dim(W * s))
    const dh = Math.min(bh, dim(H * s))
    return {
      crop: { x: 0, y: 0, w: W, h: H },
      canvas: { w: bw, h: bh },
      draw: { x: Math.round((bw - dw) / 2), y: Math.round((bh - dh) / 2), w: dw, h: dh },
      scale: s,
      notUpscaled: blocked,
      cropped: false,
      padded: dw < bw || dh < bh,
    }
  }
  // cover: fill the box, cut the overflow; focus slides the crop window.
  let s = Math.max(bw / W, bh / H)
  let ow = bw
  let oh = bh
  let blocked = false
  if (r.noUpscale && s > 1) {
    // Too small to fill the box without enlarging: keep the box's aspect
    // ratio at the source's own resolution (largest window that fits).
    blocked = true
    const k = Math.min(W / bw, H / bh)
    ow = dim(bw * k)
    oh = dim(bh * k)
    s = 1
  }
  const cw = Math.min(W, ow / s)
  const ch = Math.min(H, oh / s)
  const fx = clamp01(focus.x)
  const fy = clamp01(focus.y)
  return {
    crop: { x: (W - cw) * fx, y: (H - ch) * fy, w: cw, h: ch },
    canvas: { w: ow, h: oh },
    draw: { x: 0, y: 0, w: ow, h: oh },
    scale: s,
    notUpscaled: blocked,
    cropped: cw < W - 0.5 || ch < H - 0.5,
    padded: false,
  }
}

/**
 * Move the crop window by a drag of (dx, dy) source pixels: returns the new
 * focus. Positive dx drags the picture right, i.e. the window moves left.
 */
export function panFocus(g: Geometry, srcW: number, srcH: number, focus: Focus, dx: number, dy: number): Focus {
  const spareX = srcW - g.crop.w
  const spareY = srcH - g.crop.h
  return {
    x: spareX > 0.5 ? clamp01((g.crop.x - dx) / spareX) : 0.5,
    y: spareY > 0.5 ? clamp01((g.crop.y - dy) / spareY) : 0.5,
  }
}

/** Box-mode height for a width with the ratio locked to the source. */
export function lockedHeight(w: number, srcW: number, srcH: number): number {
  return dim((w * srcH) / Math.max(1, srcW))
}
export function lockedWidth(h: number, srcW: number, srcH: number): number {
  return dim((h * srcW) / Math.max(1, srcH))
}
