// Our own decoders (TIFF, PSD, TGA, QOI, ICO, JPEG XL, RAW preview, SVG
// sizing) against fixtures made by other tools (tests/fixtures/
// make-format-fixtures.py), and against an independent decoder of the same
// file (Pillow / imagecodecs) where one exists.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { decodeTiff } from '../../src/shared/image/formats/codec-tiff'
import { hasAlpha, recommendFormat } from '../../src/features/format-convert/lib/convert'
import { exifFromTiff, orientRgba, readTiff, tiffPageCount, tiffPageIndexes } from '../../src/shared/image/formats/codec-tiff-ifd'
import { decodePsd, isPsd } from '../../src/shared/image/formats/codec-psd'
import { decodeTga, hasTgaFooter, looksLikeTga } from '../../src/shared/image/formats/codec-tga'
import { decodeQoi } from '../../src/shared/image/formats/codec-qoi'
import { decodeDib, decodeIco, pickLargest, readIcoDir } from '../../src/shared/image/formats/codec-ico'
import { extractRawPreview, jpegHasOrientation, jpegInfo, sniffRawHead } from '../../src/shared/image/formats/codec-raw'
import { decodeJxl, isJxl, jxlExif } from '../../src/shared/image/formats/codec-jxl'
import { pinSvgSize, rootTag, svgIntrinsicSize, svgLength, svgRasterSize } from '../../src/shared/image/formats/codec-svg'
import { sniffAny, sniffFormat } from '../../src/shared/image/sniff'
import { sanitizeExif } from '../../src/shared/image/exif-any'
import { maxDiff, meanDiff, pyAvailable, pyDecode } from './helpers/pyimg'

const FX = join(__dirname, 'fixtures', 'formats')
const fx = (name: string) => new Uint8Array(readFileSync(join(FX, name)))
const BASE = fx('base-rgba.raw') // 48×32 RGBA, see the fixture script
const W = 48
const H = 32
const opaque = (d: Uint8Array) => {
  const o = new Uint8Array(d)
  for (let i = 3; i < o.length; i += 4) o[i] = 255
  return o
}
// The RGB fixtures were made from the opaque base: alpha 255, and the
// "hole" pixels kept their colour (0,0,0 is what base(False) has there? no:
// base(False) never punches the hole, so compare to a fresh opaque base).
const BASE_RGB = (() => {
  const o = new Uint8Array(BASE)
  // base(alpha=False) == base(True) without the hole/soft edge.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      o[i] = Math.floor((x * 255) / (W - 1))
      o[i + 1] = Math.floor((y * 255) / (H - 1))
      o[i + 2] = ((x + y) * 3) % 256
      o[i + 3] = 255
      if (x >= 4 && x < 12 && y >= 4 && y < 12) { o[i] = 200; o[i + 1] = 30; o[i + 2] = 60 }
    }
  }
  return o
})()

describe('base fixture', () => {
  it('BASE_RGB matches the opaque part of BASE', () => {
    expect(maxDiff(opaque(BASE).subarray(0, 4 * W * 20), BASE_RGB.subarray(0, 4 * W * 20))).toBe(0)
  })
})

describe('sniffAny', () => {
  it('recognises the new formats by their bytes', () => {
    expect(sniffAny(fx('rgba.psd'))).toBe('psd')
    expect(sniffAny(fx('rgba.qoi'))).toBe('qoi')
    expect(sniffAny(fx('rgba-lossless.jxl'))).toBe('jxl')
    expect(sniffAny(fx('rgb-lossy.jxl'))).toBe('jxl')
    expect(sniffAny(fx('synthetic.dng'), 'x.bin')).toBe('raw') // DNGVersion in IFD0
    expect(sniffAny(fx('scan.orf'))).toBe('raw')
    expect(sniffAny(fx('multipage.tif'), 'a.tif')).toBe('tiff')
    expect(sniffAny(fx('rgb-lzw.tif'), 'photo.NEF')).toBe('raw') // TIFF-based RAW by extension
    expect(sniffAny(fx('png-multi.ico'))).toBe('ico')
    expect(sniffAny(fx('viewbox-only.svg'))).toBe('svg')
  })
  it('detects TGA only with an extension or the 2.0 footer', () => {
    const tga = fx('rgb.tga')
    expect(sniffAny(tga, 'noext')).toBeNull()
    expect(sniffAny(tga, 'a.TGA')).toBe('tga')
    const footer = new TextEncoder().encode('\0\0\0\0\0\0\0\0TRUEVISION-XFILE.\0')
    expect(sniffAny(tga, 'noext', footer)).toBe('tga')
    expect(sniffAny(new Uint8Array(32), 'a.tga')).toBeNull() // header not sane
    expect(looksLikeTga(tga)).toBe(true)
    expect(hasTgaFooter(footer)).toBe(true)
  })
  it('leaves sniffFormat (used by the other tools) unchanged', () => {
    expect(sniffFormat(fx('rgba.psd'))).toBeNull()
    expect(sniffFormat(fx('rgba.qoi'))).toBeNull()
    expect(sniffFormat(fx('rgba-lossless.jxl'))).toBeNull()
    expect(sniffFormat(fx('synthetic.dng'))).toBe('tiff')
  })
})

describe('TIFF', () => {
  it('decodes LZW / PackBits / Deflate+predictor / 16-bit exactly', () => {
    for (const f of ['rgb-lzw.tif', 'rgb-packbits.tif', 'rgb16.tif']) {
      const img = decodeTiff(fx(f))
      expect([img.width, img.height], f).toEqual([W, H])
      expect(maxDiff(img.data, BASE_RGB), f).toBe(0)
    }
    const a = decodeTiff(fx('rgba-deflate-pred.tif'))
    expect(maxDiff(a.data, BASE)).toBe(0)
  })
  it('decodes grey, CMYK and JPEG-compressed TIFFs like Pillow does', () => {
    for (const f of ['gray.tif', 'cmyk.tif', 'jpeg.tif']) {
      const img = decodeTiff(fx(f))
      expect([img.width, img.height], f).toEqual([W, H])
      if (pyAvailable) expect(meanDiff(img.data, pyDecode(fx(f)).data), f).toBeLessThan(f === 'jpeg.tif' ? 3 : 1.5)
    }
  })
  it('reports a CMYK TIFF without ExtraSamples as fully opaque (auto must not pick PNG)', () => {
    const img = decodeTiff(fx('cmyk.tif'))
    expect(hasAlpha(img.data)).toBe(false)
    expect(recommendFormat('tiff', hasAlpha(img.data))).not.toBe('png')
    // A real alpha channel (ExtraSamples = 2) is still kept.
    expect(hasAlpha(decodeTiff(fx('rgba-deflate-pred.tif')).data)).toBe(true)
  })
  it('counts pages without the reduced-resolution thumbnail and decodes each', () => {
    const b = fx('multipage.tif')
    const t = readTiff(b)!
    expect(t.ifds.length).toBe(4)
    expect(tiffPageIndexes(t)).toEqual([0, 2, 3])
    expect(tiffPageCount(b)).toBe(3)
    const p0 = decodeTiff(b, 0)
    const p1 = decodeTiff(b, 1)
    const p2 = decodeTiff(b, 2)
    expect(p0.pages).toBe(3)
    expect(maxDiff(p0.data, BASE_RGB)).toBe(0)
    expect([p1.width, p1.height]).toEqual([W, H])
    expect([...p1.data.subarray(0, 4)]).toEqual([...BASE_RGB.subarray((W - 1) * 4, W * 4)]) // mirrored
    expect([p2.width, p2.height]).toEqual([20, 10])
    expect([...p2.data.subarray(0, 4)]).toEqual([77, 77, 77, 255])
    expect(tiffPageCount(new Uint8Array(10))).toBe(1)
  })
  it('applies Orientation 6 and keeps camera EXIF without GPS', async () => {
    const b = fx('orient6-exif-gps.tif')
    const img = decodeTiff(b)
    expect([img.width, img.height]).toEqual([H, W])
    // Stored top-left pixel lands top-right after a 90° clockwise turn.
    expect([...img.data.subarray((H - 1) * 4, H * 4)]).toEqual([...BASE_RGB.subarray(0, 4)])
    const block = exifFromTiff(b)!
    expect(block).not.toBeNull()
    const clean = (await sanitizeExif(block))!
    const piexif = (await import('piexifjs')).default
    const bin = (u: Uint8Array) => String.fromCharCode(...u)
    const obj = piexif.load('Exif\0\0' + bin(clean))
    expect(obj['0th'][271]).toBe('FixtureCam')
    expect(obj['0th'][274]).toBe(1)
    expect(obj['0th'][34853]).toBeUndefined()
    expect(Object.keys(obj.GPS ?? {})).toHaveLength(0)
    expect(obj['0th'][273]).toBeUndefined() // no strip offsets copied
  })
  it('orientRgba covers all eight orientations', () => {
    const d = new Uint8ClampedArray([1, 0, 0, 255, 2, 0, 0, 255, 3, 0, 0, 255, 4, 0, 0, 255, 5, 0, 0, 255, 6, 0, 0, 255]) // 3×2: 1 2 3 / 4 5 6
    const r = (o: number) => { const u = orientRgba(d, 3, 2, o); return [u.width, u.height, ...[...u.data].filter((_, i) => i % 4 === 0)] }
    expect(r(1)).toEqual([3, 2, 1, 2, 3, 4, 5, 6])
    expect(r(2)).toEqual([3, 2, 3, 2, 1, 6, 5, 4])
    expect(r(3)).toEqual([3, 2, 6, 5, 4, 3, 2, 1])
    expect(r(4)).toEqual([3, 2, 4, 5, 6, 1, 2, 3])
    expect(r(5)).toEqual([2, 3, 1, 4, 2, 5, 3, 6])
    expect(r(6)).toEqual([2, 3, 4, 1, 5, 2, 6, 3])
    expect(r(7)).toEqual([2, 3, 6, 3, 5, 2, 4, 1])
    expect(r(8)).toEqual([2, 3, 3, 6, 2, 5, 1, 4])
  })
})

describe('PSD composite', () => {
  it('reads RLE and raw RGB, 16-bit, grey', () => {
    for (const f of ['rgb.psd', 'rgb-raw.psd', 'rgb16.psd']) {
      expect(isPsd(fx(f))).toBe(true)
      const img = decodePsd(fx(f))
      expect([img.width, img.height], f).toEqual([W, H])
      expect(maxDiff(img.data, BASE_RGB), f).toBeLessThanOrEqual(1)
      expect(img.empty).toBe(false)
    }
    const g = decodePsd(fx('gray.psd'))
    if (pyAvailable) expect(maxDiff(g.data, pyDecode(fx('gray.psd')).data)).toBeLessThanOrEqual(1)
  })
  it('keeps the merged transparency of a transparent document', () => {
    const img = decodePsd(fx('rgba.psd'))
    expect(maxDiff(img.data, BASE)).toBeLessThanOrEqual(1)
    if (pyAvailable) expect(maxDiff(img.data, pyDecode(fx('rgba.psd')).data)).toBeLessThanOrEqual(1)
  })
  it('rejects what it cannot read', () => {
    const b = fx('rgb.psd').slice()
    b[25] = 9 // Lab
    expect(() => decodePsd(b)).toThrow()
    expect(() => decodePsd(new Uint8Array(30))).toThrow()
  })
})

describe('TGA', () => {
  it('reads raw / RLE / grey / colour-mapped, both origins', () => {
    expect(maxDiff(decodeTga(fx('rgb.tga')).data, BASE_RGB)).toBe(0)
    expect(maxDiff(decodeTga(fx('rgba-rle.tga')).data, BASE)).toBe(0)
    expect(maxDiff(decodeTga(fx('rgba-im.tga')).data, BASE)).toBe(0)
    for (const f of ['gray.tga', 'pal.tga']) {
      const img = decodeTga(fx(f))
      expect([img.width, img.height]).toEqual([W, H])
      if (pyAvailable) expect(maxDiff(img.data, pyDecode(fx(f)).data), f).toBe(0)
    }
  })
})

describe('QOI', () => {
  it('decodes RGB and RGBA exactly', () => {
    expect(maxDiff(decodeQoi(fx('rgba.qoi')).data, BASE, false)).toBe(0)
    expect(maxDiff(decodeQoi(fx('rgb.qoi')).data, BASE_RGB)).toBe(0)
  })
})

describe('ICO', () => {
  it('picks the largest PNG entry', () => {
    const dir = readIcoDir(fx('png-multi.ico'))!
    expect(dir.map((e) => e.width)).toEqual([16, 32, 64, 128])
    const r = decodeIco(fx('png-multi.ico'))
    expect(r.kind).toBe('png')
    expect(r.entry.width).toBe(128)
    expect(r.count).toBe(4)
  })
  it('decodes 32-bit, palette and 24-bit BMP entries (AND mask)', () => {
    for (const f of ['bmp32.ico', 'bmp-pal.ico', 'bmp24.ico']) {
      const r = decodeIco(fx(f))
      expect(r.kind, f).toBe('rgba')
      if (r.kind !== 'rgba') continue
      expect([r.image.width, r.image.height], f).toEqual([32, 32])
      if (pyAvailable) {
        const ref = pyDecode(fx(f), 'ico', 32)
        expect(maxDiff(r.image.data, ref.data), f).toBe(0)
      }
    }
    expect(pickLargest([{ width: 16, height: 16, bitCount: 32, offset: 0, size: 0 }, { width: 16, height: 16, bitCount: 8, offset: 0, size: 0 }]).bitCount).toBe(32)
    expect(() => decodeDib(new Uint8Array(40))).toThrow()
  })
})

describe('camera RAW preview', () => {
  it('takes the full-size preview from a DNG (not the thumbnail, not the CFA data)', () => {
    const b = fx('synthetic.dng')
    const r = extractRawPreview(b)!
    expect([r.width, r.height]).toEqual([96, 64])
    expect(r.orientation).toBe(6)
    expect(jpegHasOrientation(r.jpeg)).toBe(false)
    expect(r.jpeg[0]).toBe(0xff)
    expect(jpegInfo(r.jpeg, 0, r.jpeg.length)!.end).toBe(r.jpeg.length)
  })
  it('scans non-TIFF RAW containers for the embedded JPEG', () => {
    const b = fx('scan.orf')
    expect(sniffRawHead(b)).toBe(true)
    const r = extractRawPreview(b)!
    expect([r.width, r.height]).toEqual([96, 64])
    expect(r.orientation).toBe(1)
  })
  it('keeps camera EXIF of a DNG and drops GPS and the maker note', async () => {
    const block = exifFromTiff(fx('synthetic.dng'))!
    const clean = (await sanitizeExif(block))!
    const piexif = (await import('piexifjs')).default
    const obj = piexif.load('Exif\0\0' + String.fromCharCode(...clean))
    expect(obj['0th'][272]).toBe('DNG One')
    expect(obj.Exif[36867]).toBe('2024:05:06 07:08:09')
    expect(obj.Exif[37500]).toBeUndefined()
    expect(Object.keys(obj.GPS ?? {})).toHaveLength(0)
  })
  it('returns null when there is no JPEG at all', () => {
    expect(extractRawPreview(new Uint8Array(4096))).toBeNull()
  })
})

describe('JPEG XL decode (libjxl wasm)', () => {
  beforeAll(() => {
    // The codec fetches its wasm by URL; serve it from node_modules.
    vi.stubGlobal('fetch', async (url: string) => {
      const p = String(url).replace(/^.*?\/node_modules\//, 'node_modules/').replace(/\?.*$/, '')
      const body = readFileSync(join(__dirname, '..', '..', p.startsWith('node_modules') ? p : p.replace(/^\//, '')))
      return new Response(body)
    })
  })
  it('decodes lossless RGBA (within one level) and lossy RGB closely', async () => {
    expect(isJxl(fx('rgba-lossless.jxl'))).toBe(true)
    const a = await decodeJxl(fx('rgba-lossless.jxl'))
    expect([a.width, a.height]).toEqual([W, H])
    // libjxl's wasm build rounds through float output: a handful of
    // samples land one level off (imagecodecs' native libjxl is exact).
    expect(maxDiff(a.data, BASE, false)).toBeLessThanOrEqual(1)
    const b = await decodeJxl(fx('rgb-lossy.jxl'))
    expect(meanDiff(b.data, BASE_RGB)).toBeLessThan(4)
    expect(jxlExif(fx('rgb-lossy.jxl'))).toBeNull()
  })
})

describe('SVG sizing', () => {
  it('reads lengths and the root tag', () => {
    expect(svgLength('10mm')).toBeCloseTo(37.795, 2)
    expect(svgLength('2in')).toBe(192)
    expect(svgLength('100%')).toBeNull()
    expect(rootTag('<?xml?><!-- x --><svg a="1" viewBox=\'0 0 4 2\'>')!.attrs.viewbox).toBe('0 0 4 2')
  })
  it('derives an intrinsic size and a raster size of at least 1024 px', () => {
    const t = new TextDecoder().decode(fx('viewbox-only.svg'))
    expect(svgIntrinsicSize(t)).toEqual({ w: 24, h: 12 })
    expect(svgRasterSize(24, 12)).toEqual({ w: 1024, h: 512 })
    const mm = svgIntrinsicSize(new TextDecoder().decode(fx('mm.svg')))
    expect(mm.w).toBeCloseTo(188.98, 1)
    expect(svgRasterSize(3000, 1000)).toEqual({ w: 3000, h: 1000 })
    expect(svgRasterSize(20000, 100)).toEqual({ w: 8192, h: 41 })
    expect(svgRasterSize(8000, 8000).w).toBe(6325) // 40 MP cap
    expect(svgIntrinsicSize('<svg xmlns="http://www.w3.org/2000/svg">')).toEqual({ w: 300, h: 150 })
  })
  it('pins width/height and keeps the drawing scaled via viewBox', () => {
    const t = new TextDecoder().decode(fx('mm.svg'))
    const out = pinSvgSize(t, 1024, 512)
    expect(rootTag(out)!.attrs).toMatchObject({ width: '1024', height: '512', viewbox: '0 0 100 50' })
    const noVb = pinSvgSize('<svg width="24" height="12"><rect/></svg>', 1024, 512)
    expect(rootTag(noVb)!.attrs).toMatchObject({ width: '1024', height: '512', viewbox: '0 0 24 12' })
    expect(noVb.endsWith('<rect/></svg>')).toBe(true)
  })
})
