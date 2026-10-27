// Perceptual quality check for smart quality: structural similarity (SSIM)
// between the source pixels and a decoded candidate, on luma only.
//
// Both images are box-downscaled to at most MAX_DIM on the long side first:
// SSIM at full resolution costs a lot and adds little for a pass/fail
// threshold. 1024 rather than 512: at 512 the box filter averages most
// compression artifacts away and every photo passes at the floor quality.
// Transparent pixels are composited on white so alpha edges count the way
// they render on a light page.

export interface Luma {
  data: Float32Array
  w: number
  h: number
}

const MAX_DIM = 1024

export function toLuma(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, maxDim = MAX_DIM): Luma {
  const f = Math.max(1, Math.ceil(Math.max(w, h) / maxDim))
  const ow = Math.max(1, Math.floor(w / f))
  const oh = Math.max(1, Math.floor(h / f))
  const out = new Float32Array(ow * oh)
  const n = f * f
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      let sum = 0
      for (let dy = 0; dy < f; dy++) {
        let i = ((y * f + dy) * w + x * f) * 4
        for (let dx = 0; dx < f; dx++, i += 4) {
          const a = rgba[i + 3] / 255
          const l = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]
          sum += l * a + 255 * (1 - a)
        }
      }
      out[y * ow + x] = sum / n
    }
  }
  return { data: out, w: ow, h: oh }
}

// Mean SSIM over 8x8 windows with stride 4 (Wang et al. 2004 constants).
// Returns 1 for identical inputs.
export function ssim(a: Luma, b: Luma): number {
  if (a.w !== b.w || a.h !== b.h) throw new Error('ssim: size mismatch')
  const { w, h } = a
  const C1 = (0.01 * 255) ** 2
  const C2 = (0.03 * 255) ** 2
  const WIN = 8
  const STEP = 4
  if (w < WIN || h < WIN) {
    // Too small for windows: one global window.
    return windowSsim(a.data, b.data, w, 0, 0, w, h, C1, C2)
  }
  let total = 0
  let count = 0
  for (let y = 0; y + WIN <= h; y += STEP) {
    for (let x = 0; x + WIN <= w; x += STEP) {
      total += windowSsim(a.data, b.data, w, x, y, WIN, WIN, C1, C2)
      count++
    }
  }
  return total / count
}

function windowSsim(a: Float32Array, b: Float32Array, stride: number, x0: number, y0: number, ww: number, wh: number, C1: number, C2: number): number {
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0
  for (let y = y0; y < y0 + wh; y++) {
    let i = y * stride + x0
    for (let x = 0; x < ww; x++, i++) {
      const va = a[i], vb = b[i]
      sa += va; sb += vb
      saa += va * va; sbb += vb * vb; sab += va * vb
    }
  }
  const n = ww * wh
  const ma = sa / n, mb = sb / n
  const va = saa / n - ma * ma
  const vb = sbb / n - mb * mb
  const cov = sab / n - ma * mb
  return ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2))
}

// Smallest integer quality in [lo, hi] whose candidate passes, by binary
// search to within `precision`. `test` encodes and scores one quality and
// reports whether it passes; the passing candidate with the lowest quality
// is returned, or the `hi` candidate when nothing passes (complex images
// keep the most detail the range allows, never less).
export async function searchQuality<T>(
  lo: number,
  hi: number,
  precision: number,
  test: (q: number) => Promise<{ pass: boolean; value: T }>,
): Promise<{ q: number; value: T }> {
  let best: { q: number; value: T } | null = null
  let top: { q: number; value: T } | null = null
  let l = lo, h = hi
  while (h - l > precision) {
    const mid = Math.round((l + h) / 2)
    const r = await test(mid)
    if (r.pass) { best = { q: mid, value: r.value }; h = mid }
    else l = mid
  }
  if (best) return best
  const r = await test(hi)
  top = { q: hi, value: r.value }
  return top
}
