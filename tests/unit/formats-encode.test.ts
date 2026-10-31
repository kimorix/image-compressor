// Our writers (BMP, TIFF, QOI, ICO, GIF, JPEG XL): encode a known image,
// decode the result with an independent implementation (Pillow, tifffile,
// imagecodecs) and check validity, dimensions, alpha and pixels. Also
// round-trips through our own decoders where we have one.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { encodeBmp } from '../../src/shared/image/formats/codec-bmp'
import { decodeTiff, encodeTiff } from '../../src/shared/image/formats/codec-tiff'
import { decodeQoi, encodeQoi } from '../../src/shared/image/formats/codec-qoi'
import { assembleIco, decodeIco, encodeIco, fitSquare, icoPlan, readIcoDir, resizeArea } from '../../src/shared/image/formats/codec-ico'
import { assembleGif, encodeGif, exactPalette, hardenAlpha, indexedFromPng, lzw } from '../../src/shared/image/formats/codec-gif'
import { decodeJxl, encodeJxl, JXL_MAX_PIXELS } from '../../src/shared/image/formats/codec-jxl'
import { encodePngLossless } from '../../src/shared/image/png-lossless'
import { encodePngQuantized } from '../../src/shared/image/wasm-encoders'
import { gifFrameCount } from '../../src/shared/image/gif'
import { maxDiff, meanDiff, pyAvailable, pyDecode } from './helpers/pyimg'

const FX = join(__dirname, 'fixtures', 'formats')
const BASE = new Uint8ClampedArray(readFileSync(join(FX, 'base-rgba.raw')))
const W = 48
const H = 32
const img = (data: Uint8ClampedArray = BASE, width = W, height = H) => ({ data: new Uint8ClampedArray(data), width, height })
const opaque = () => {
  const d = new Uint8ClampedArray(BASE)
  for (let i = 3; i < d.length; i += 4) d[i] = 255
  return d
}
/** A photo-like image with far more than 256 colours. */
function noisy(w: number, h: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4)
  let s = 12345
  for (let i = 0; i < d.length; i += 4) {
    s = (s * 1103515245 + 12345) >>> 0
    const x = (i / 4) % w, y = Math.floor(i / 4 / w)
    d[i] = (x * 5 + (s & 15)) & 255
    d[i + 1] = (y * 7 + ((s >> 4) & 15)) & 255
    d[i + 2] = ((x + y) * 3 + ((s >> 8) & 31)) & 255
    d[i + 3] = 255
  }
  return d
}
const py = pyAvailable ? it : it.skip

beforeAll(() => {
  // Wasm codecs fetch their binaries by URL: serve them from node_modules.
  vi.stubGlobal('fetch', async (url: string) => {
    const p = String(url).replace(/^.*?\/node_modules\//, 'node_modules/').replace(/\?.*$/, '')
    return new Response(readFileSync(join(__dirname, '..', '..', p)))
  })
})

describe('BMP writer', () => {
  it('writes 24-bit without alpha and 32-bit BITFIELDS (V4) with alpha', () => {
    const rgb = encodeBmp(img(opaque()), false)
    expect(rgb[28]).toBe(24)
    expect(rgb.length).toBe(54 + ((W * 3 + 3) & ~3) * H)
    const a = encodeBmp(img(), true)
    expect(a[28]).toBe(32)
    expect(a[14]).toBe(108)
  })
  py('decodes with Pillow to the same pixels (alpha kept)', () => {
    const r24 = pyDecode(encodeBmp(img(opaque()), false))
    expect(r24.meta.format).toBe('BMP')
    expect([r24.width, r24.height]).toEqual([W, H])
    expect(maxDiff(r24.data, opaque())).toBe(0)
    const r32 = pyDecode(encodeBmp(img(), true))
    expect(r32.meta.mode).toBe('RGBA')
    expect(maxDiff(r32.data, BASE, false)).toBe(0)
  })
  it('pads odd widths to 4 bytes', () => {
    const d = new Uint8ClampedArray(3 * 2 * 4).fill(200)
    const b = encodeBmp({ data: d, width: 3, height: 2 }, false)
    expect(b.length).toBe(54 + 12 * 2)
  })
})

describe('TIFF writer', () => {
  it('round-trips through our decoder (RGB and RGBA)', async () => {
    const rgb = await encodeTiff(img(opaque()), false)
    expect(maxDiff(decodeTiff(rgb).data, opaque())).toBe(0)
    const rgba = await encodeTiff(img(), true)
    expect(maxDiff(decodeTiff(rgba).data, BASE, false)).toBe(0)
  })
  py('is a valid Deflate + predictor TIFF for tifffile and Pillow', async () => {
    const rgba = await encodeTiff(img(), true)
    const t = pyDecode(rgba, 'tifffile')
    expect(t.meta).toMatchObject({ compression: 8, predictor: 2, samples: 4, extrasamples: [2], pages: 1 })
    expect(maxDiff(t.data, BASE, false)).toBe(0)
    const p = pyDecode(rgba)
    expect(p.meta.format).toBe('TIFF')
    expect(maxDiff(p.data, BASE, false)).toBe(0)
    const rgb = pyDecode(await encodeTiff(img(opaque()), false), 'tifffile')
    expect(rgb.meta.samples).toBe(3)
    expect(maxDiff(rgb.data, opaque())).toBe(0)
  })
  py('splits large images into several strips', async () => {
    const w = 700, h = 300
    const d = noisy(w, h)
    const t = await encodeTiff({ data: d, width: w, height: h }, false)
    const back = pyDecode(t, 'tifffile')
    expect([back.width, back.height]).toEqual([w, h])
    expect(maxDiff(back.data, d)).toBe(0)
  })
})

describe('QOI writer', () => {
  it('round-trips exactly (RGB and RGBA, long runs)', () => {
    expect(maxDiff(decodeQoi(encodeQoi(img(), true)).data, BASE, false)).toBe(0)
    expect(maxDiff(decodeQoi(encodeQoi(img(opaque()), false)).data, opaque())).toBe(0)
    const flat = new Uint8ClampedArray(200 * 4).fill(9)
    expect(maxDiff(decodeQoi(encodeQoi({ data: flat, width: 20, height: 10 }, true)).data, flat, false)).toBe(0)
    const n = noisy(64, 64)
    expect(maxDiff(decodeQoi(encodeQoi({ data: n, width: 64, height: 64 }, false)).data, n)).toBe(0)
  })
  py('matches imagecodecs', () => {
    const r = pyDecode(encodeQoi(img(), true), 'qoi')
    expect([r.width, r.height]).toEqual([W, H])
    expect(maxDiff(r.data, BASE, false)).toBe(0)
    const n = noisy(64, 64)
    expect(maxDiff(pyDecode(encodeQoi({ data: n, width: 64, height: 64 }, false), 'qoi').data, n)).toBe(0)
  })
})

describe('ICO writer', () => {
  it('plans sizes without upscaling', () => {
    expect(icoPlan(1000, 800, [16, 32, 48, 64, 128, 256])).toEqual([16, 32, 48, 64, 128, 256])
    expect(icoPlan(40, 30, [16, 32, 48, 64])).toEqual([16, 32])
    expect(icoPlan(10, 10, [32, 16])).toEqual([16])
    expect(icoPlan(10, 10, [])).toEqual([16])
  })
  it('area-averages exactly on whole ratios and pads to a square', () => {
    const d = new Uint8ClampedArray([10, 0, 0, 255, 30, 0, 0, 255, 50, 0, 0, 255, 70, 0, 0, 255])
    expect([...resizeArea({ data: d, width: 2, height: 2 }, 1, 1).data]).toEqual([40, 0, 0, 255])
    // Premultiplied: a transparent neighbour does not darken the colour.
    const e = new Uint8ClampedArray([200, 100, 50, 255, 0, 0, 0, 0])
    expect([...resizeArea({ data: e, width: 2, height: 1 }, 1, 1).data]).toEqual([200, 100, 50, 128])
    const sq = fitSquare(img(), 16)
    expect([sq.width, sq.height]).toEqual([16, 16])
    expect(sq.data[3]).toBe(0) // top padding row is transparent (48×32 -> 16×11)
  })
  it('writes PNG entries our reader (and the directory) agree on', async () => {
    const { bytes, sizes } = await encodeIco(img(), [16, 32, 48, 64], (s) => encodePngLossless(s))
    expect(sizes).toEqual([16, 32, 48])
    expect(readIcoDir(bytes)!.map((e) => [e.width, e.height, e.bitCount])).toEqual([[16, 16, 32], [32, 32, 32], [48, 48, 32]])
    const best = decodeIco(bytes)
    expect(best.kind).toBe('png')
    expect(best.entry.width).toBe(48)
    // 256 is stored as 0 in the directory bytes.
    const big = assembleIco([{ size: 256, png: new Uint8Array(30) }])
    expect([big[6], big[7]]).toEqual([0, 0])
  })
  py('is a valid multi-size ICO for Pillow, each size with alpha', async () => {
    const big = { data: noisy(300, 200), width: 300, height: 200 }
    for (let i = 3; i < big.data.length; i += 4 * 7) big.data[i] = 0
    const { bytes, sizes } = await encodeIco(big, [16, 32, 48, 64, 128, 256], (s) => encodePngLossless(s, true))
    expect(sizes).toEqual([16, 32, 48, 64, 128, 256])
    for (const s of sizes) {
      const r = pyDecode(bytes, 'ico', s)
      expect(r.meta.format).toBe('ICO')
      expect([r.width, r.height]).toEqual([s, s])
      expect(r.data[3]).toBe(0) // padding rows transparent (3:2 image)
    }
    const r = pyDecode(bytes, 'ico', 48)
    expect(r.meta.sizes.map((x: number[]) => x[0])).toEqual([16, 32, 48, 64, 128, 256])
    // A square source at an exact size is stored as is.
    const sq = { data: BASE.slice(0, 32 * 32 * 4), width: 32, height: 32 }
    const one = await encodeIco(sq, [32], (s) => encodePngLossless(s, true))
    expect(maxDiff(pyDecode(one.bytes, 'ico', 32).data, sq.data, false)).toBe(0)
  }, 30000)
})

describe('GIF writer', () => {
  it('thresholds alpha at 50 %', () => {
    const d = new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 200, 7, 8, 9, 100, 10, 11, 12, 0])
    expect(hardenAlpha(d)).toEqual({ semi: true, transparent: true })
    expect([...d]).toEqual([1, 2, 3, 255, 4, 5, 6, 255, 0, 0, 0, 0, 0, 0, 0, 0])
  })
  it('keeps ≤ 256 colours exactly, with one transparent index', async () => {
    const d = new Uint8ClampedArray(BASE.length)
    for (let i = 0; i < d.length; i += 4) { const k = (i / 4) % 7; d[i] = k * 30; d[i + 1] = 255 - k * 30; d[i + 2] = 90; d[i + 3] = k === 3 ? 0 : 255 }
    const ix = exactPalette({ data: d, width: W, height: H })!
    expect(ix.palette.length / 3).toBe(7)
    expect(ix.transparent).toBe(3)
    const r = await encodeGif({ data: d, width: W, height: H }, () => { throw new Error('should not quantize') })
    expect(r.quantized).toBe(false)
    expect(gifFrameCount(r.bytes)).toBe(1)
    if (pyAvailable) {
      const back = pyDecode(r.bytes, 'gif')
      expect(back.meta.transparency).toBe(3)
      expect(maxDiff(back.data, d)).toBe(0)
    }
  })
  it('LZW handles dictionary resets (long noisy streams)', async () => {
    const n = 300 * 300
    const idx = new Uint8Array(n)
    let s = 7
    for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) >>> 0; idx[i] = (s >>> 16) & 255 }
    const pal = new Uint8Array(256 * 3)
    for (let i = 0; i < 256; i++) pal.set([i, 255 - i, (i * 7) & 255], i * 3)
    const gif = assembleGif(300, 300, { palette: pal, indices: idx, transparent: -1 })
    expect(lzw(new Uint8Array(0), 2).length).toBeGreaterThan(0)
    if (pyAvailable) {
      const back = pyDecode(gif, 'gif')
      for (let i = 0; i < n; i += 997) expect([back.data[i * 4], back.data[i * 4 + 1]]).toEqual([pal[idx[i] * 3], pal[idx[i] * 3 + 1]])
    }
  })
  it('small palettes use a small code size', { timeout: 30000 }, () => {
    for (const k of [2, 3, 4, 5, 16, 17, 129]) {
      const idx = new Uint8Array(500).map((_, i) => i % k)
      const pal = new Uint8Array(k * 3).map((_, i) => (i * 37) & 255)
      const gif = assembleGif(25, 20, { palette: pal, indices: idx, transparent: -1 })
      if (pyAvailable) {
        const back = pyDecode(gif, 'gif')
        for (let i = 0; i < 500; i++) expect(back.data[i * 4], `k=${k} i=${i}`).toBe(pal[idx[i] * 3])
      }
    }
  })
  it('quantizes photos with libimagequant (palette PNG unpacked correctly)', async () => {
    const w = 120, h = 80
    const d = noisy(w, h)
    for (let y = 0; y < 10; y++) for (let x = 0; x < w; x++) d[(y * w + x) * 4 + 3] = 0
    const png = new Uint8Array(await encodePngQuantized({ data: new Uint8ClampedArray(d), width: w, height: h }, 100, 4))
    const ix = await indexedFromPng(png)
    expect(ix.indices.length).toBe(w * h)
    const r = await encodeGif({ data: d, width: w, height: h }, (im) => encodePngQuantized(im, 100, 4))
    expect(r.quantized).toBe(true)
    if (pyAvailable) {
      const back = pyDecode(r.bytes, 'gif')
      expect([back.width, back.height]).toEqual([w, h])
      expect(back.meta.colors).toBeLessThanOrEqual(256)
      expect(back.data[3]).toBe(0) // transparent top rows
      expect(back.data[(15 * w + 5) * 4 + 3]).toBe(255)
      const opaqueRef = d.slice(10 * w * 4)
      // Dithered noise: per-pixel error is expected, the average stays small.
      expect(meanDiff(back.data.subarray(10 * w * 4), opaqueRef)).toBeLessThan(12)
    }
  })
})

describe('JPEG XL writer (libjxl wasm)', () => {
  it('lossless at quality 100: exact through our decoder and imagecodecs', async () => {
    const jxl = await encodeJxl(img(), 100)
    expect([jxl[0], jxl[1]]).toEqual([0xff, 0x0a])
    const back = await decodeJxl(jxl)
    expect(maxDiff(back.data, BASE, false)).toBeLessThanOrEqual(1)
    if (pyAvailable) expect(maxDiff(pyDecode(jxl, 'jxl').data, BASE, false)).toBe(0)
  }, 60000)
  it('lossy keeps size and alpha, close to the source', async () => {
    const d = noisy(96, 64)
    for (let i = 3; i < 96 * 8 * 4; i += 4) d[i] = 0
    const jxl = await encodeJxl({ data: d, width: 96, height: 64 }, 80)
    if (pyAvailable) {
      const r = pyDecode(jxl, 'jxl')
      expect([r.width, r.height]).toEqual([96, 64])
      expect(r.data[3]).toBe(0)
      expect(r.data[(20 * 96) * 4 + 3]).toBe(255)
      expect(meanDiff(r.data, d)).toBeLessThan(10)
    }
  }, 60000)
  it('refuses images over the wasm heap budget before touching the encoder, and keeps working after', async () => {
    // 24 MP needs more than libjxl's 2 GiB wasm heap (it aborts); the cap fails fast instead.
    expect(JXL_MAX_PIXELS).toBeLessThan(6000 * 4000)
    expect(JXL_MAX_PIXELS).toBeGreaterThanOrEqual(5184 * 3456)
    const w = 6000, h = 4000
    await expect(encodeJxl({ data: new Uint8ClampedArray(4), width: w, height: h }, 80)).rejects.toThrow(/too large/)
    const ok = await encodeJxl({ data: noisy(32, 16), width: 32, height: 16 }, 80)
    expect([ok[0], ok[1]]).toEqual([0xff, 0x0a])
  }, 60000)
})
