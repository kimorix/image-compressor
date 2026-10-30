import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import piexif from 'piexifjs'
import { deflateForPng, encodePngLossless, filterRows, planPng, preparePng, SMALL_IMAGE_MAX_PIXELS, type PngInput } from '../../src/shared/image/png-lossless'
import { crc32, readExif, sanitizeExif, writeExif } from '../../src/shared/image/exif-any'

// ---- a small, strict PNG decoder (CRCs checked) back to RGBA ----
interface Decoded { width: number; height: number; bitDepth: number; colorType: number; chunks: string[]; trns: number; rgba: Uint8Array }
const be32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0
const str = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n))

function decodePng(b: Uint8Array): Decoded {
  expect([...b.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  let o = 8
  const chunks: string[] = []
  let ihdr: Uint8Array | null = null
  let plte: Uint8Array | null = null
  let trns: Uint8Array | null = null
  const idat: Uint8Array[] = []
  while (o < b.length) {
    const len = be32(b, o)
    const type = str(b, o + 4, 4)
    const body = b.subarray(o + 8, o + 8 + len)
    expect(be32(b, o + 8 + len)).toBe(crc32([b.subarray(o + 4, o + 8), body]))
    chunks.push(type)
    if (type === 'IHDR') ihdr = body
    else if (type === 'PLTE') plte = body
    else if (type === 'tRNS') trns = body
    else if (type === 'IDAT') idat.push(body)
    o += 12 + len
    if (type === 'IEND') break
  }
  const w = be32(ihdr!, 0), h = be32(ihdr!, 4), depth = ihdr![8], ct = ihdr![9]
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct as 0 | 2 | 3 | 4 | 6]
  const bits = ch * depth
  const stride = Math.ceil((w * bits) / 8)
  const bpp = Math.max(1, bits >> 3)
  const raw = inflateSync(Buffer.concat(idat))
  expect(raw.length).toBe((stride + 1) * h)
  const rows = new Uint8Array(stride * h)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i]
      const a = i >= bpp ? rows[y * stride + i - bpp] : 0
      const up = y ? rows[(y - 1) * stride + i] : 0
      const c = y && i >= bpp ? rows[(y - 1) * stride + i - bpp] : 0
      let v = x
      if (f === 1) v += a
      else if (f === 2) v += up
      else if (f === 3) v += (a + up) >> 1
      else if (f === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c }
      else expect(f).toBe(0)
      rows[y * stride + i] = v & 0xff
    }
  }
  const rgba = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o4 = (y * w + x) * 4
    const r = rows.subarray(y * stride)
    if (ct === 3) {
      const per = 8 / depth
      const idx = depth === 8 ? r[x] : (r[Math.floor(x / per)] >> (8 - depth * ((x % per) + 1))) & ((1 << depth) - 1)
      expect(idx * 3 + 2).toBeLessThan(plte!.length)
      rgba.set([plte![idx * 3], plte![idx * 3 + 1], plte![idx * 3 + 2], trns && idx < trns.length ? trns[idx] : 255], o4)
    } else if (ct === 0) rgba.set([r[x], r[x], r[x], 255], o4)
    else if (ct === 4) rgba.set([r[x * 2], r[x * 2], r[x * 2], r[x * 2 + 1]], o4)
    else if (ct === 2) rgba.set([r[x * 3], r[x * 3 + 1], r[x * 3 + 2], 255], o4)
    else rgba.set(r.subarray(x * 4, x * 4 + 4), o4)
  }
  return { width: w, height: h, bitDepth: depth, colorType: ct, chunks, trns: trns?.length ?? 0, rgba }
}

// ---- deterministic synthetic images ----
function rng(seed: number) { return () => ((seed = (seed * 1103515245 + 12345) >>> 0) >>> 8) & 0xff }
function image(w: number, h: number, px: (x: number, y: number, r: () => number) => [number, number, number, number], seed = 7): PngInput {
  const r = rng(seed)
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(px(x, y, r), (y * w + x) * 4)
  return { data, width: w, height: h }
}
const photo = (w: number, h: number) => image(w, h, (x, y, r) => [(x * 3 + r()) & 255, (y * 2 + (r() >> 2)) & 255, (x + y + (r() >> 3)) & 255, 255])

async function roundTrip(img: PngInput): Promise<Decoded> {
  const out = new Uint8Array(await encodePngLossless(img))
  const d = decodePng(out)
  expect(d.width).toBe(img.width)
  expect(d.height).toBe(img.height)
  expect(Buffer.from(d.rgba).equals(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength))).toBe(true)
  return d
}

describe('png-lossless: colour type reduction (exact)', () => {
  it('opaque truecolour photo -> RGB 8-bit (alpha stripped), pixels identical', async () => {
    const d = await roundTrip(photo(97, 61))
    expect([d.colorType, d.bitDepth]).toEqual([2, 8])
  })

  it('truecolour with semi-transparency -> RGBA 8-bit', async () => {
    const d = await roundTrip(image(50, 40, (x, y, r) => [r(), r(), r(), (x * 5 + y) & 255]))
    expect([d.colorType, d.bitDepth]).toEqual([6, 8])
  })

  it('grey photo -> greyscale 8-bit; grey with alpha -> grey+alpha', async () => {
    expect((await roundTrip(image(64, 64, (x, y) => { const v = (x * 4 + y) & 255; return [v, v, v, 255] }))).colorType).toBe(0)
    const ga = await roundTrip(image(40, 30, (x, y, r) => { const v = r(); return [v, v, v, (x * 7 + y * 3) & 255] }))
    expect([ga.colorType, ga.bitDepth]).toEqual([4, 8])
  })

  it('two colours on an odd width -> 1-bit palette, row padding handled', async () => {
    const d = await roundTrip(image(13, 5, (x, y) => ((x + y) % 2 ? [255, 0, 0, 255] : [0, 0, 255, 255])))
    expect([d.colorType, d.bitDepth, d.trns]).toEqual([3, 1, 0])
  })

  it('picks 2- and 4-bit palettes by colour count', async () => {
    const four = await roundTrip(image(9, 7, (x) => [x % 4 * 60, 10, 20, 255]))
    expect([four.colorType, four.bitDepth]).toEqual([3, 2])
    const sixteen = await roundTrip(image(17, 3, (x) => [x % 16 * 15, 99, 1, 255]))
    expect([sixteen.colorType, sixteen.bitDepth]).toEqual([3, 4])
  })

  it('palette with transparency: transparent entries first, tRNS only as long as needed', async () => {
    // 1 fully transparent + 2 semi-transparent + 28 opaque colours.
    const img = image(30, 20, (x, y) => {
      if (x === 0) return [0, 0, 0, 0]
      if (x === 1) return [10, 20, 30, y % 2 ? 128 : 64]
      return [x * 8, 0, 200, 255]
    })
    const d = await roundTrip(img)
    expect([d.colorType, d.bitDepth]).toEqual([3, 8])
    expect(d.trns).toBe(3)
    expect(d.chunks).toEqual(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND'])
  })

  it('keeps the colour of fully transparent pixels exactly (no premultiply)', async () => {
    await roundTrip(image(8, 8, (x, y) => (x < 4 ? [x * 30, y * 30, 7, 0] : [1, 2, 3, 255])))
  })

  it('256 distinct colours stay palette, 257 fall back to RGB', async () => {
    const pal = await roundTrip(image(16, 16, (x, y) => [x * 16, y * 16, 5, 255]))
    expect([pal.colorType, pal.bitDepth]).toEqual([3, 8])
    const rgb = await roundTrip(image(257, 1, (x) => [x & 255, x >> 8, 5, 255]))
    expect(rgb.colorType).toBe(2)
  })

  it('grey without alpha: >16 levels -> greyscale (no PLTE), ≤16 -> small palette', () => {
    expect(planPng(image(32, 1, (x) => [x * 8, x * 8, x * 8, 255])).colorType).toBe('grey')
    expect(planPng(image(16, 1, (x) => [x * 16, x * 16, x * 16, 255]))).toMatchObject({ colorType: 'palette', bitDepth: 4 })
  })

  it('1×1 and single-colour images', async () => {
    expect((await roundTrip(image(1, 1, () => [9, 8, 7, 6]))).bitDepth).toBe(1)
    expect((await roundTrip(image(300, 2, () => [255, 255, 255, 255]))).colorType).toBe(3)
  })
})

describe('png-lossless: filtering and deflate', () => {
  it('adaptive filtering reverses exactly for every bpp', async () => {
    for (const img of [photo(33, 21), image(20, 9, (x, y, r) => [r(), r(), r(), r()]), image(40, 12, (x, y, r) => { const v = (x * y + r()) & 255; return [v, v, v, 255] })]) {
      await roundTrip(img)
    }
  })

  it('filterRows: non-adaptive writes filter 0 rows; adaptive picks per row', () => {
    const rows = Uint8Array.from({ length: 4 * 3 }, (_, i) => i * 10)
    const plain = filterRows(rows, 4, 3, 1, false)
    expect([plain[0], plain[5], plain[10]]).toEqual([0, 0, 0])
    expect([...plain.subarray(1, 5)]).toEqual([0, 10, 20, 30])
    const ad = filterRows(rows, 4, 3, 1, true)
    // A linear ramp: Sub (1) gives constant 10s, better than None.
    expect(ad[0]).not.toBe(0)
  })

  it('small images try both filter strategies; large truecolour only the usual one, large palette both', () => {
    expect(preparePng(photo(20, 20)).candidates).toHaveLength(2)
    const side = Math.ceil(Math.sqrt(SMALL_IMAGE_MAX_PIXELS)) + 1
    expect(preparePng(photo(side, side)).candidates).toHaveLength(1)
    expect(preparePng(image(side, side, (x) => [x % 3 * 100, 0, 0, 255])).candidates).toHaveLength(2)
  })

  it('a large photo (native deflate path) still round-trips exactly', async () => {
    const side = Math.ceil(Math.sqrt(SMALL_IMAGE_MAX_PIXELS)) + 1
    const d = await roundTrip(photo(side, side))
    expect(d.colorType).toBe(2)
  }, 30000)

  it('both deflate paths produce valid zlib streams', async () => {
    const data = Uint8Array.from({ length: 5000 }, (_, i) => (i * 7) & 255)
    for (const small of [true, false]) expect(Buffer.from(inflateSync(await deflateForPng(data, small))).equals(Buffer.from(data))).toBe(true)
  })

  it('a flat screenshot-like image compresses far below raw RGBA', async () => {
    const img = image(400, 300, (x, y) => (y < 40 ? [30, 30, 30, 255] : x % 100 < 2 ? [200, 200, 200, 255] : [255, 255, 255, 255]))
    const out = await encodePngLossless(img)
    expect(out.byteLength).toBeLessThan(1500)
  })
})

describe('png-lossless + EXIF', () => {
  it('eXIf goes in before IDAT, reads back, and GPS stays out', async () => {
    const exif = {
      '0th': { [piexif.ImageIFD.Make]: 'Hark', [piexif.ImageIFD.Orientation]: 6 },
      GPS: { [piexif.GPSIFD.GPSLatitudeRef]: 'N', [piexif.GPSIFD.GPSLatitude]: [[31, 1], [14, 1], [0, 1]] },
    }
    const tiff = Uint8Array.from(piexif.dump(exif), (c: string) => c.charCodeAt(0) & 0xff).slice(6)
    const clean = await sanitizeExif(tiff)
    expect(clean).not.toBeNull()
    const png = new Uint8Array(await encodePngLossless(photo(20, 20)))
    const withExif = await writeExif(png, 'image/png', clean!)
    expect(withExif).not.toBe(png)
    const d = decodePng(withExif)
    expect(d.chunks).toEqual(['IHDR', 'eXIf', 'IDAT', 'IEND'])
    const back = readExif(withExif, 'png')!
    const loaded = piexif.load('Exif\0\0' + String.fromCharCode(...back))
    expect(loaded['0th'][piexif.ImageIFD.Make]).toBe('Hark')
    expect(loaded['0th'][piexif.ImageIFD.Orientation]).toBe(1)
    expect(Object.keys(loaded.GPS ?? {})).toHaveLength(0)
  })
})
