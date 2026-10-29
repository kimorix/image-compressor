import { describe, expect, it } from 'vitest'
import { readExifBasics, swapsAxes } from '../../src/features/resize-watermark/lib/exif-basics'

// Minimal JPEG: SOI + APP1(Exif, TIFF with IFD0 [Orientation, ExifIFD ptr]
// and an Exif IFD [DateTimeOriginal]) + SOS.
function jpeg(orientation: number, date: string | null, le = true): Uint8Array {
  const t: number[] = []
  const u16 = (v: number) => (le ? t.push(v & 255, v >> 8) : t.push(v >> 8, v & 255))
  const u32 = (v: number) => (le ? t.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24) : t.push(v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255))
  t.push(...(le ? [0x49, 0x49] : [0x4d, 0x4d]))
  u16(42)
  u32(8)
  // IFD0 at 8: 2 entries
  u16(2)
  u16(0x0112); u16(3); u32(1); u16(orientation); u16(0)
  const exifIfdOff = 8 + 2 + 2 * 12 + 4
  u16(0x8769); u16(4); u32(1); u32(exifIfdOff)
  u32(0)
  // Exif IFD: 1 entry
  const dateOff = exifIfdOff + 2 + 12 + 4
  u16(date ? 1 : 0)
  if (date) { u16(0x9003); u16(2); u32(20); u32(dateOff) }
  u32(0)
  if (date) { for (const c of date) t.push(c.charCodeAt(0)); t.push(0) }
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...t]
  const len = exif.length + 2
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xe1, len >> 8, len & 255, ...exif, 0xff, 0xda, 0, 2])
}

describe('readExifBasics', () => {
  it('reads orientation and date (little endian)', () => {
    expect(readExifBasics(jpeg(6, '2025:10:26 14:30:22'))).toEqual({ orientation: 6, date: '2025-10-26' })
  })
  it('reads big endian', () => {
    expect(readExifBasics(jpeg(8, '2024:01:02 00:00:00', false))).toEqual({ orientation: 8, date: '2024-01-02' })
  })
  it('no date', () => {
    expect(readExifBasics(jpeg(3, null))).toEqual({ orientation: 3, date: null })
  })
  it('non-JPEG and truncated input are safe', () => {
    expect(readExifBasics(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toEqual({ orientation: 1, date: null })
    const full = jpeg(6, '2025:10:26 14:30:22')
    for (let n = 0; n < full.length; n += 7) {
      const r = readExifBasics(full.slice(0, n))
      expect(r.orientation).toBeGreaterThanOrEqual(1)
      expect(r.orientation).toBeLessThanOrEqual(8)
    }
  })
  it('swapsAxes', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(swapsAxes)).toEqual([false, false, false, false, true, true, true, true])
  })
})
