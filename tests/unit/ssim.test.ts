import { describe, expect, it } from 'vitest'
import { searchQuality, ssim, toLuma } from '../../src/features/image-compressor/lib/ssim'

function img(w: number, h: number, fn: (x: number, y: number) => number, alpha = 255): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4
    const v = fn(x, y)
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = alpha
  }
  return d
}

describe('ssim', () => {
  const grad = img(64, 64, (x, y) => (x * 4 + y * 2) % 256)
  it('is 1 for identical images', () => {
    const a = toLuma(grad, 64, 64)
    expect(ssim(a, a)).toBeCloseTo(1, 6)
  })
  it('drops for noisy copies, more noise drops more', () => {
    let seed = 7
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    const noisy = (amp: number) => img(64, 64, (x, y) => Math.min(255, Math.max(0, (x * 4 + y * 2) % 256 + (rnd() - 0.5) * amp)))
    const ref = toLuma(grad, 64, 64)
    const s1 = ssim(ref, toLuma(noisy(10), 64, 64))
    const s2 = ssim(ref, toLuma(noisy(80), 64, 64))
    expect(s1).toBeLessThan(1)
    expect(s2).toBeLessThan(s1)
  })
  it('composites transparency on white', () => {
    const clear = toLuma(img(16, 16, () => 0, 0), 16, 16)
    expect(clear.data[0]).toBeCloseTo(255)
  })
  it('downscales to at most 1024 on the long side', () => {
    const l = toLuma(new Uint8ClampedArray(4096 * 1024 * 4), 4096, 1024)
    expect(Math.max(l.w, l.h)).toBeLessThanOrEqual(1024)
  })
  it('rejects mismatched sizes', () => {
    expect(() => ssim(toLuma(grad, 64, 64), toLuma(img(32, 32, () => 0), 32, 32))).toThrow()
  })
})

describe('searchQuality', () => {
  it('finds the lowest passing quality within the precision', async () => {
    const tried: number[] = []
    const r = await searchQuality(50, 90, 4, async (q) => { tried.push(q); return { pass: q >= 72, value: q } })
    expect(r.q).toBeGreaterThanOrEqual(72)
    expect(r.q - 72).toBeLessThanOrEqual(4)
    expect(tried.length).toBeLessThanOrEqual(5)
  })
  it('falls back to the top of the range when nothing passes', async () => {
    const r = await searchQuality(50, 90, 4, async (q) => ({ pass: false, value: q }))
    expect(r.q).toBe(90)
  })
  it('starts from an initial passing probe without re-testing it', async () => {
    const tried: number[] = []
    const r = await searchQuality(50, 90, 4, async (q) => {
      tried.push(q)
      return { pass: q >= 72, value: q }
    }, { q: 80, pass: true, value: 80 })
    expect(tried).not.toContain(80)
    expect(r.q).toBeGreaterThanOrEqual(72)
    expect(r.q - 72).toBeLessThanOrEqual(4)
  })
  it('searches upward from a failing initial probe', async () => {
    const tried: number[] = []
    const r = await searchQuality(50, 90, 4, async (q) => {
      tried.push(q)
      return { pass: q >= 85, value: q }
    }, { q: 80, pass: false, value: 80 })
    expect(tried).not.toContain(80)
    expect(r.q).toBeGreaterThanOrEqual(85)
    expect(r.q).toBeLessThanOrEqual(90)
  })
})
