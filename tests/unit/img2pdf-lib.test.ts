import { describe, expect, it } from 'vitest'
import {
  PDF_BASE_BYTES, PDF_PAGE_BYTES, PNG_BYTES_PER_PIXEL, PNG_QUANT_BYTES_PER_PIXEL, downscale, embedsOriginal,
  estimateImage, estimateTotal, jpegBytesPerPixel,
} from '../../src/features/img-to-pdf/lib/estimate'
import { MAX_STEM, cleanStem, defaultStem, pdfName, perImageNames, stemOf, zipName } from '../../src/features/img-to-pdf/lib/filename'
import { jpegOrientation, jpegSize, stripJpegMetadata } from '../../src/features/img-to-pdf/lib/jpeg'
import { defaultPaper, defaultSettings, encodeParams, normalizeSettings, withQuality } from '../../src/features/img-to-pdf/lib/settings'
import { anyAlpha } from '../../src/features/img-to-pdf/lib/prepare'
import type { Img2PdfSettings } from '../../src/features/img-to-pdf/types'

const base = defaultSettings('zh-CN')
const set = (o: Partial<Img2PdfSettings>): Img2PdfSettings => ({ ...base, ...o })

describe('settings', () => {
  it('Letter for US-style locales, A4 elsewhere', () => {
    expect(defaultPaper('en-US')).toBe('letter')
    expect(defaultPaper('en_CA')).toBe('letter')
    expect(defaultPaper('en-GB')).toBe('a4')
    expect(defaultPaper('zh-CN')).toBe('a4')
    expect(defaultPaper('fr')).toBe('a4')
    expect(defaultPaper(undefined)).toBe('a4')
  })
  it('normalizes stored junk to defaults and clamps numbers', () => {
    const n = normalizeSettings({ paper: 'a3', quality: 'small', jpegQuality: 400, maxEdge: 'x', output: 'perImage' }, base)
    expect(n.paper).toBe('a4')
    expect(n.quality).toBe('small')
    expect(n.jpegQuality).toBe(100)
    expect(n.maxEdge).toBe(base.maxEdge)
    expect(n.output).toBe('perImage')
    expect(normalizeSettings(null, base)).toEqual(base)
  })
  it('quality presets reset the advanced values; original keeps full size', () => {
    expect(withQuality(base, 'small')).toMatchObject({ quality: 'small', jpegQuality: 70, maxEdge: 1600 })
    expect(encodeParams(withQuality(base, 'original'))).toEqual({ q: 92, maxEdge: 0 })
    expect(encodeParams(base)).toEqual({ q: 82, maxEdge: 2000 })
  })
})

describe('estimate', () => {
  const photo = { bytes: 3_000_000, format: 'jpeg' as const, w: 4032, h: 3024, hasAlpha: false }
  it('bytes per pixel grow with quality', () => {
    expect(jpegBytesPerPixel(70)).toBeLessThan(jpegBytesPerPixel(82))
    expect(jpegBytesPerPixel(82)).toBeLessThan(jpegBytesPerPixel(92))
    expect(jpegBytesPerPixel(500)).toBe(jpegBytesPerPixel(100))
  })
  it('downscale factor', () => {
    expect(downscale(4032, 3024, 2000)).toBeCloseTo(2000 / 4032, 6)
    expect(downscale(1000, 800, 2000)).toBe(1)
    expect(downscale(4032, 3024, 0)).toBe(1)
  })
  it('original embeds JPEG / PNG as-is, re-encodes the rest', () => {
    const o = set({ quality: 'original' })
    expect(embedsOriginal('jpeg') && embedsOriginal('png') && !embedsOriginal('heic')).toBe(true)
    expect(estimateImage(photo, o)).toBe(3_000_000)
    const heic = { ...photo, format: 'heic' as const, bytes: 1_500_000 }
    expect(estimateImage(heic, o)).toBeCloseTo(4032 * 3024 * jpegBytesPerPixel(92), 0)
  })
  it('balanced downscales to the long edge', () => {
    const k = 2000 / 4032
    expect(estimateImage(photo, base)).toBeCloseTo(4032 * 3024 * k * k * jpegBytesPerPixel(82), 0)
  })
  it('never more than a small JPEG that is kept as-is', () => {
    const small = { bytes: 50_000, format: 'jpeg' as const, w: 1200, h: 900, hasAlpha: false }
    expect(estimateImage(small, base)).toBe(50_000)
  })
  it('alpha → PNG (palette on small)', () => {
    const logo = { bytes: 2_000_000, format: 'webp' as const, w: 1000, h: 1000, hasAlpha: true }
    expect(estimateImage(logo, base)).toBeCloseTo(1e6 * PNG_BYTES_PER_PIXEL, 0)
    expect(estimateImage(logo, withQuality(base, 'small'))).toBeCloseTo(1e6 * PNG_QUANT_BYTES_PER_PIXEL, 0)
  })
  it('unknown size falls back to the file size', () => {
    expect(estimateImage({ ...photo, w: 0, h: 0, format: 'webp' }, base)).toBe(3_000_000)
  })
  it('totals add structure overhead per document and page', () => {
    const o = set({ quality: 'original' })
    expect(estimateTotal([], o)).toBe(0)
    expect(estimateTotal([photo, photo], o)).toBe(6_000_000 + PDF_BASE_BYTES + 2 * PDF_PAGE_BYTES)
    expect(estimateTotal([photo, photo], { ...o, output: 'perImage' })).toBe(6_000_000 + 2 * PDF_BASE_BYTES + 2 * PDF_PAGE_BYTES)
  })
})

describe('filename', () => {
  it('stemOf', () => {
    expect(stemOf('IMG_4021.HEIC')).toBe('IMG_4021')
    expect(stemOf('a/b/c.tar.gz')).toBe('c.tar')
    expect(stemOf('.hidden')).toBe('.hidden')
    expect(stemOf('noext')).toBe('noext')
  })
  it('cleanStem replaces illegal characters and trims', () => {
    expect(cleanStem('旅行收据 2026/10/28.pdf')).toBe('旅行收据 2026-10-28')
    expect(cleanStem('a:b*c?"d"<e>|f')).toBe('a-b-c-d-e-f')
    expect(cleanStem('  ..report..  ')).toBe('report')
    expect(cleanStem('x\u0000y\ttab')).toBe('x-y tab')
    expect(cleanStem('///')).toBe('')
    expect(cleanStem('Scan.PDF ')).toBe('Scan')
  })
  it('cleanStem caps the length by code point', () => {
    const long = '😀'.repeat(MAX_STEM + 10)
    const c = cleanStem(long)
    expect([...c].length).toBe(MAX_STEM)
    expect(c.endsWith('\ud83d')).toBe(false)
  })
  it('defaultStem: first image, else localised prefix + date', () => {
    const d = new Date(2026, 9, 28)
    expect(defaultStem('IMG_4021.HEIC', '图片', d)).toBe('IMG_4021')
    expect(defaultStem(undefined, '图片', d)).toBe('图片-20261028')
    expect(defaultStem('???.png', 'images', d)).toBe('images-20261028')
  })
  it('pdfName falls back when the typed name is unusable', () => {
    expect(pdfName('旅行收据-2026-10-28', 'x')).toBe('旅行收据-2026-10-28.pdf')
    expect(pdfName('  ', 'IMG_1')).toBe('IMG_1.pdf')
    expect(pdfName('***', '')).toBe('images.pdf')
  })
  it('per-image names are unique; zip name follows the PDF name', () => {
    expect(perImageNames(['a.jpg', 'a.png', 'b.heic', '?.png'])).toEqual(['a.pdf', 'a-2.pdf', 'b.pdf', 'image.pdf'])
    expect(zipName('收据.pdf')).toBe('收据.zip')
  })
})

// ---- JPEG surgery on a synthetic file ----
function seg(marker: number, data: number[]): number[] {
  const len = data.length + 2
  return [0xff, marker, len >> 8, len & 0xff, ...data]
}
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0))
function exifApp1(orientation: number, le: boolean): number[] {
  const u16 = (n: number) => (le ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff])
  const u32 = (n: number) => (le ? [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24] : [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff])
  const tiff = [...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8), ...u16(2),
    ...u16(0x010f), ...u16(2), ...u32(4), ...ascii('ACME'), // Make
    ...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientation), 0, 0,
    ...u32(0)]
  return seg(0xe1, [...ascii('Exif'), 0, 0, ...tiff])
}
function fakeJpeg(orientation = 6, le = true): Uint8Array {
  const sof = seg(0xc0, [8, 0x02, 0x58, 0x03, 0x20, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]) // 800 × 600
  return new Uint8Array([
    0xff, 0xd8,
    ...seg(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    ...exifApp1(orientation, le),
    ...seg(0xe2, [...ascii('ICC_PROFILE'), 0, 1, 1, 9, 9, 9]),
    ...seg(0xed, [...ascii('Photoshop 3.0'), 0, 1, 2, 3]),
    ...seg(0xfe, ascii('comment')),
    ...seg(0xee, [...ascii('Adobe'), 0, 100, 0, 0, 0, 0, 1]),
    ...sof,
    ...seg(0xda, [1, 1, 0, 0, 63, 0]),
    0x12, 0x34, 0xff, 0x00, 0x56, // scan data with a stuffed byte
    0xff, 0xd9,
  ])
}
const has = (b: Uint8Array, marker: number) => {
  for (let i = 2; i + 1 < b.length; i++) if (b[i] === 0xff && b[i + 1] === marker) return true
  return false
}

describe('jpeg', () => {
  it('reads the orientation (both byte orders)', () => {
    expect(jpegOrientation(fakeJpeg(6, true))).toBe(6)
    expect(jpegOrientation(fakeJpeg(8, false))).toBe(8)
    expect(jpegOrientation(fakeJpeg(42))).toBe(1)
    expect(jpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBe(1)
    expect(jpegOrientation(new Uint8Array([1, 2, 3]))).toBe(1)
  })
  it('reads the stored size from SOF', () => {
    expect(jpegSize(fakeJpeg())).toEqual({ w: 800, h: 600 })
    expect(jpegSize(new Uint8Array([0xff, 0xd8]))).toBeNull()
  })
  it('strips APP1 / APP13 / COM, keeps JFIF, ICC, Adobe and the scan', () => {
    const src = fakeJpeg()
    const out = stripJpegMetadata(src)
    expect(out.length).toBeLessThan(src.length)
    expect(has(out, 0xe1)).toBe(false)
    expect(has(out, 0xed)).toBe(false)
    expect(has(out, 0xfe)).toBe(false)
    expect(has(out, 0xe0) && has(out, 0xe2) && has(out, 0xee) && has(out, 0xc0)).toBe(true)
    expect(jpegOrientation(out)).toBe(1)
    expect(jpegSize(out)).toEqual({ w: 800, h: 600 })
    expect([...out.slice(-7)]).toEqual([0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9])
    expect(String.fromCharCode(...out)).not.toContain('ACME')
  })
  it('returns unparseable input unchanged', () => {
    const junk = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff])
    expect(stripJpegMetadata(junk)).toBe(junk)
    const clean = new Uint8Array([0xff, 0xd8, ...seg(0xda, [0]), 0xff, 0xd9])
    expect(stripJpegMetadata(clean)).toBe(clean)
  })
})

describe('anyAlpha', () => {
  it('detects any non-opaque pixel', () => {
    expect(anyAlpha(new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]))).toBe(false)
    expect(anyAlpha(new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 254]))).toBe(true)
  })
})

describe('i18n', async () => {
  const { IMG2PDF_MESSAGES, i2pT } = await import('../../src/features/img-to-pdf/i18n')
  const en = Object.keys(IMG2PDF_MESSAGES.en).sort()
  for (const [lang, msgs] of Object.entries(IMG2PDF_MESSAGES)) {
    it(`${lang} has exactly the English keys, same kinds`, () => {
      expect(Object.keys(msgs).sort()).toEqual(en)
      for (const k of en) expect(typeof msgs[k]).toBe(typeof IMG2PDF_MESSAGES.en[k])
    })
  }
  it('formats and falls back', () => {
    expect(i2pT('zh', 'generate', 8)).toBe('生成 PDF（8 页）')
    expect(i2pT('de', 'pagesCount', 3)).toBe('3 Seiten')
    expect(i2pT('zh', 'no-such-key')).toBe('no-such-key')
  })
})
