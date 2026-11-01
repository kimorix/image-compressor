// Regression tests for the phone preview of resize & watermark (iOS
// Safari): preview-image decode fallbacks, canvas size caps, source-rect
// clamping and native-first HEIC decoding.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadPreviewImage } from '../../src/features/resize-watermark/lib/preview-bitmap'
import { clampSrc, renderStage, stageDpr, stageLayout, STAGE_MAX_PX } from '../../src/features/resize-watermark/lib/preview'
import { defaultSettings } from '../../src/features/resize-watermark/lib/settings'
import { decodeSource, type SourceInfo } from '../../src/features/resize-watermark/lib/process'

const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })

describe('loadPreviewImage', () => {
  it('uses createImageBitmap when it works', async () => {
    const close = vi.fn()
    const bmp = { width: 120, height: 80, close } as unknown as ImageBitmap
    const element = vi.fn()
    const r = await loadPreviewImage(blob, { bitmap: async () => bmp, element })
    expect(r.img).toBe(bmp)
    expect(element).not.toHaveBeenCalled()
    r.close()
    expect(close).toHaveBeenCalled()
  })
  it('falls back to <img> when createImageBitmap rejects (older iOS Safari)', async () => {
    const img = { width: 120, height: 80, src: 'blob:x' }
    const r = await loadPreviewImage(blob, { bitmap: async () => { throw new Error('InvalidStateError') }, element: async () => img as never })
    expect(r.img).toBe(img)
    r.close()
    expect(img.src).toBe('')
  })
  it('falls back when createImageBitmap is missing or returns an empty bitmap', async () => {
    const img = { width: 10, height: 10 }
    expect((await loadPreviewImage(blob, { bitmap: null, element: async () => img as never })).img).toBe(img)
    const empty = { width: 0, height: 0, close: vi.fn() } as unknown as ImageBitmap
    expect((await loadPreviewImage(blob, { bitmap: async () => empty, element: async () => img as never })).img).toBe(img)
    expect(empty.close).toHaveBeenCalled()
  })
  it('rejects when nothing can decode it', async () => {
    await expect(loadPreviewImage(blob, { bitmap: async () => { throw new Error('a') }, element: async () => { throw new Error('b') } })).rejects.toThrow()
  })
})

describe('stage canvas size', () => {
  it('keeps the device ratio for phone-sized stages (iPhone, dpr 3)', () => {
    expect(stageDpr(391, 293, 3)).toBe(3)
    expect(stageDpr(391, 520, 3) * 391 * stageDpr(391, 520, 3) * 520).toBeLessThan(STAGE_MAX_PX)
  })
  it('lowers the ratio so the backing store stays under the cap', () => {
    const d = stageDpr(2000, 1500, 3)
    expect(d).toBeLessThan(3)
    expect(2000 * d * 1500 * d).toBeLessThanOrEqual(STAGE_MAX_PX + 1)
  })
  it('clamps junk ratios', () => {
    expect(stageDpr(100, 100, Number.NaN)).toBe(1)
    expect(stageDpr(100, 100, 0.5)).toBe(1)
    expect(stageDpr(100, 100, 8)).toBe(3)
  })
})

describe('clampSrc', () => {
  it('trims float overshoot past the bitmap edge', () => {
    const [x, y, w, h] = clampSrc(0, 0, 1200.0000001, 800.00002, 1200, 800)
    expect([x, y, w, h]).toEqual([0, 0, 1200, 800])
  })
  it('keeps an in-bounds rect unchanged and clips negatives', () => {
    expect(clampSrc(10, 20, 30, 40, 100, 100)).toEqual([10, 20, 30, 40])
    expect(clampSrc(-2, -1, 50, 50, 100, 100)).toEqual([0, 0, 48, 49])
  })
})

describe('renderStage on a phone', () => {
  function fakeCanvas() {
    const calls: unknown[][] = []
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (t, k) => (k in t ? t[k as string] : (...a: unknown[]) => { calls.push([k, ...a]) }),
      set: (t, k, v) => { t[k as string] = v; return true },
    })
    const c = { width: 0, height: 0, style: {} as Record<string, string>, getContext: () => ctx }
    return { c, calls }
  }
  it('draws the picture with a non-zero canvas within the bitmap bounds', () => {
    const s = defaultSettings()
    const L = stageLayout(4032, 3024, s, { x: 0.5, y: 0.5 }, 391, 303, false)
    const { c, calls } = fakeCanvas()
    const bmp = { width: 1200, height: 900 } as unknown as ImageBitmap
    renderStage(c as unknown as HTMLCanvasElement, L, { bmp, srcW: 4032, srcH: 3024, settings: s, focus: { x: 0.5, y: 0.5 }, outType: 'image/jpeg', text: '', logo: null, dpr: 3 })
    expect(c.width).toBeGreaterThan(0)
    expect(c.height).toBeGreaterThan(0)
    expect(c.width * c.height).toBeLessThanOrEqual(STAGE_MAX_PX)
    const draw = calls.find((x) => x[0] === 'drawImage')!
    expect(draw).toBeTruthy()
    const [, , sx, sy, sw, sh] = draw as number[]
    expect(sx).toBeGreaterThanOrEqual(0)
    expect(sy).toBeGreaterThanOrEqual(0)
    expect(sx + sw).toBeLessThanOrEqual(1200)
    expect(sy + sh).toBeLessThanOrEqual(900)
  })
})

describe('decodeSource (HEIC native first)', () => {
  afterEach(() => vi.unstubAllGlobals())
  const heicInfo = (): SourceInfo => ({ format: 'heic', blob: new Blob([new Uint8Array(4)], { type: 'image/heic' }), heic: true, orientation: 1, date: null, gifFrames: 0 })

  it('decodes HEIC natively when the engine can (Safari) and never loads heic2any', async () => {
    const bmp = { width: 4032, height: 3024, close: vi.fn() }
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bmp))
    const fallback = vi.fn()
    const d = await decodeSource(heicInfo(), false, fallback)
    expect(d.w).toBe(4032)
    expect(fallback).not.toHaveBeenCalled()
  })
  it('falls back to heic2any where native decode fails (Chrome)', async () => {
    const png = new Blob([new Uint8Array(4)], { type: 'image/png' })
    const bmp = { width: 100, height: 50, close: vi.fn() }
    vi.stubGlobal('createImageBitmap', vi.fn(async (b: Blob) => { if (b.type === 'image/png') return bmp; throw new Error('unsupported') }))
    const fallback = vi.fn(async () => png)
    const d = await decodeSource(heicInfo(), false, fallback)
    expect(fallback).toHaveBeenCalledTimes(1)
    expect(d.w).toBe(100)
  })
  it('reports errHeic when both decoders fail', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('unsupported') }))
    await expect(decodeSource(heicInfo(), false, async () => { throw new Error('libheif') })).rejects.toThrow('errHeic')
  })
  it('leaves non-HEIC sources on the plain path', async () => {
    const bmp = { width: 10, height: 10, close: vi.fn() }
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bmp))
    const fallback = vi.fn()
    const d = await decodeSource({ ...heicInfo(), format: 'jpeg', heic: false }, false, fallback)
    expect(d.w).toBe(10)
    expect(fallback).not.toHaveBeenCalled()
  })
})
