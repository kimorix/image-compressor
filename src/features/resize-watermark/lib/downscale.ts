// High-quality downscaling with plain canvas: a single drawImage from a
// much larger image (scale < 0.5) samples too few source pixels and
// aliases (jaggies, moiré on fine textures), most visibly in Safari whose
// 'high' smoothing is weak. Halving step by step (each step ≥ 0.5) and
// finishing at the exact target keeps every step a good filter.
import { get2d, makeCanvas, type AnyCanvas, type Ctx2D } from '../../../shared/image/codec'
import type { Rect } from './geometry'

/** Intermediate sizes (excluding the final one) for a sw×sh → dw×dh scale. */
export function planSteps(sw: number, sh: number, dw: number, dh: number): { w: number; h: number }[] {
  const steps: { w: number; h: number }[] = []
  let w = sw
  let h = sh
  // Halve while the next halving still stays at or above the target.
  while (w / 2 >= dw && h / 2 >= dh && steps.length < 12) {
    w = Math.max(1, Math.round(w / 2))
    h = Math.max(1, Math.round(h / 2))
    if (w === dw && h === dh) break
    steps.push({ w, h })
  }
  return steps
}

function smooth(ctx: Ctx2D) {
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
}

/**
 * Draw `crop` of `src` into `dst` at `draw`, halving through scratch
 * canvases when the reduction is large. Scratch canvases are released
 * (sized to 0) before returning. `scratch` is the context settings of the
 * scratch canvases (display-p3 for a P3 pipeline, so no step clips to sRGB).
 */
export function drawScaled(dst: Ctx2D, src: CanvasImageSource, crop: Rect, draw: Rect, scratch: CanvasRenderingContext2DSettings = {}): void {
  smooth(dst)
  const steps = planSteps(crop.w, crop.h, draw.w, draw.h)
  if (!steps.length) {
    dst.drawImage(src, crop.x, crop.y, crop.w, crop.h, draw.x, draw.y, draw.w, draw.h)
    return
  }
  let cur: AnyCanvas | null = null
  let prev: AnyCanvas | null = null
  let sx = crop.x
  let sy = crop.y
  let sw = crop.w
  let sh = crop.h
  let from: CanvasImageSource = src
  for (const st of steps) {
    cur = makeCanvas()
    cur.width = st.w
    cur.height = st.h
    const c = get2d(cur, scratch)
    smooth(c)
    c.drawImage(from, sx, sy, sw, sh, 0, 0, st.w, st.h)
    if (prev) { prev.width = 0; prev.height = 0 }
    prev = cur
    from = cur
    sx = 0
    sy = 0
    sw = st.w
    sh = st.h
  }
  dst.drawImage(from, 0, 0, sw, sh, draw.x, draw.y, draw.w, draw.h)
  if (cur) { cur.width = 0; cur.height = 0 }
}
