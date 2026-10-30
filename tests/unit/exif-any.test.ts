import { describe, expect, it } from 'vitest'
import piexif from 'piexifjs'
import { canWriteExif, crc32, readExif, readHeicExif, sanitizeExif, writeExif } from '../../src/shared/image/exif-any'

// ---- builders (synthetic containers, no binary fixtures) ----
const bin = (u: Uint8Array) => String.fromCharCode(...u)
const unbin = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff)
const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0))
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
const be16 = (n: number) => [(n >>> 8) & 255, n & 255]
const le32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]
const cat = (...parts: (Uint8Array | number[])[]) => {
  const out: number[] = []
  for (const p of parts) out.push(...p)
  return new Uint8Array(out)
}

/** A TIFF block with camera tags, Orientation 6, GPS and a thumbnail IFD. */
function tiffWithGps(): Uint8Array {
  const exif = {
    '0th': { [piexif.ImageIFD.Make]: 'Hark', [piexif.ImageIFD.Model]: 'Test Cam', [piexif.ImageIFD.Orientation]: 6 },
    Exif: { [piexif.ExifIFD.DateTimeOriginal]: '2026:10:29 08:00:00' },
    GPS: { [piexif.GPSIFD.GPSLatitudeRef]: 'N', [piexif.GPSIFD.GPSLatitude]: [[31, 1], [14, 1], [0, 1]] },
  }
  return unbin(piexif.dump(exif)).slice(6)
}

// SOI + JFIF APP0 + a bare SOS + EOI: enough segment structure for piexif.
const EOI_JPEG = new Uint8Array([
  0xff, 0xd8,
  0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0xff, 0xda, 0x00, 0x02,
  0xff, 0xd9,
])

function jpegWith(tiff: Uint8Array): Uint8Array {
  return unbin(piexif.insert('Exif\0\0' + bin(tiff), bin(EOI_JPEG)))
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const t = ascii(type)
  return cat(be32(data.length), t, data, be32(crc32([t, data])))
}
function tinyPng(extra: Uint8Array[] = []): Uint8Array {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const ihdr = new Uint8Array([...be32(1), ...be32(1), 8, 6, 0, 0, 0])
  return cat(sig, pngChunk('IHDR', ihdr), ...extra, pngChunk('IDAT', new Uint8Array([1, 2, 3])), pngChunk('IEND', new Uint8Array()))
}

function riff(chunks: Uint8Array[]): Uint8Array {
  const body = cat(ascii('WEBP'), ...chunks)
  return cat(ascii('RIFF'), le32(body.length), body)
}
function riffChunk(type: string, data: number[]): Uint8Array {
  return cat(ascii(type), le32(data.length), data, data.length % 2 ? [0] : [])
}
/** Simple lossless WebP: VP8L header for a 3×2 image with alpha. */
function tinyWebpLossless(): Uint8Array {
  const w = 3 - 1
  const h = 2 - 1
  const bits = w | (h << 14) | (1 << 28) // alpha_is_used
  return riff([riffChunk('VP8L', [0x2f, bits & 255, (bits >>> 8) & 255, (bits >>> 16) & 255, (bits >>> 24) & 255, 0, 0])])
}

function box(type: string, ...body: (Uint8Array | number[])[]): Uint8Array {
  const b = cat(...body)
  return cat(be32(b.length + 8), ascii(type), b)
}
/** HEIF with an 'Exif' item (id 2) stored in mdat, located by iloc v0. */
function tinyHeic(tiff: Uint8Array): Uint8Array {
  const ftyp = box('ftyp', ascii('heic'), be32(0), ascii('mif1'), ascii('heic'))
  const infe = (id: number, type: string) => box('infe', [2, 0, 0, 0], be16(id), be16(0), ascii(type), [0])
  const iinf = box('iinf', [0, 0, 0, 0], be16(2), infe(1, 'hvc1'), infe(2, 'Exif'))
  const payload = cat(be32(6), ascii('Exif'), [0, 0], tiff)
  // iloc v0: offset_size 4, length_size 4, base_offset_size 0
  const ilocFor = (offset: number) => box('iloc', [0, 0, 0, 0], [0x44, 0x00], be16(1), be16(2), be16(0), be16(1), be32(offset), be32(payload.length))
  const metaFor = (offset: number) => box('meta', [0, 0, 0, 0], box('hdlr', [0, 0, 0, 0], be32(0), ascii('pict'), new Uint8Array(13)), iinf, ilocFor(offset))
  const meta0 = metaFor(0)
  const offset = ftyp.length + meta0.length + 8
  return cat(ftyp, metaFor(offset), box('mdat', payload))
}

// ---- tests ----

describe('readExif', () => {
  const tiff = tiffWithGps()

  it('reads the TIFF block out of a JPEG APP1', () => {
    expect(readExif(jpegWith(tiff), 'jpeg')).toEqual(tiff)
  })
  it('reads PNG eXIf', () => {
    expect(readExif(tinyPng([pngChunk('eXIf', tiff)]), 'png')).toEqual(tiff)
  })
  it('reads a WebP EXIF chunk (with or without the Exif\\0\\0 prefix)', () => {
    const plain = riff([riffChunk('VP8X', Array(10).fill(0)), riffChunk('EXIF', [...tiff])])
    expect(readExif(plain, 'webp')).toEqual(tiff)
    const prefixed = riff([riffChunk('VP8X', Array(10).fill(0)), riffChunk('EXIF', [...ascii('Exif'), 0, 0, ...tiff])])
    expect(readExif(prefixed, 'webp')).toEqual(tiff)
  })
  it('reads the Exif item of a HEIC through iinf/iloc', () => {
    const heic = tinyHeic(tiff)
    expect(readHeicExif(heic)).toEqual(tiff)
    expect(readExif(heic, 'heic')).toEqual(tiff)
  })
  it('returns null when there is no EXIF, and never throws on junk', () => {
    expect(readExif(EOI_JPEG, 'jpeg')).toBeNull()
    expect(readExif(tinyPng(), 'png')).toBeNull()
    expect(readExif(tinyWebpLossless(), 'webp')).toBeNull()
    expect(readExif(new Uint8Array([0, 0, 0, 8, 1, 2, 3]), 'heic')).toBeNull()
    expect(readExif(new Uint8Array(3), 'gif')).toBeNull()
    expect(readExif(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]), 'jpeg')).toBeNull()
  })
})

describe('sanitizeExif', () => {
  it('removes GPS and the thumbnail and sets Orientation to 1, keeping camera tags', async () => {
    const clean = await sanitizeExif(tiffWithGps())
    expect(clean).not.toBeNull()
    const obj = piexif.load('Exif\0\0' + bin(clean!))
    expect(Object.keys(obj.GPS ?? {})).toHaveLength(0)
    expect(obj['0th'][piexif.ImageIFD.GPSTag]).toBeUndefined()
    expect(obj['0th'][piexif.ImageIFD.Orientation]).toBe(1)
    expect(obj['0th'][piexif.ImageIFD.Make]).toBe('Hark')
    expect(obj.Exif[piexif.ExifIFD.DateTimeOriginal]).toBe('2026:10:29 08:00:00')
  })
  it('returns null for an unreadable block', async () => {
    expect(await sanitizeExif(new Uint8Array([1, 2, 3, 4]))).toBeNull()
  })
})

describe('writeExif', () => {
  const tiff = tiffWithGps()

  it('JPEG: inserts an APP1 that reads back', async () => {
    const out = await writeExif(EOI_JPEG, 'image/jpeg', tiff)
    expect(readExif(out, 'jpeg')).toEqual(tiff)
  })
  it('PNG: puts eXIf before IDAT with a valid CRC, replacing an old block', async () => {
    const out = await writeExif(tinyPng([pngChunk('eXIf', new Uint8Array([0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8]))]), 'image/png', tiff)
    expect(readExif(out, 'png')).toEqual(tiff)
    const s = bin(out)
    expect(s.indexOf('eXIf')).toBeLessThan(s.indexOf('IDAT'))
    expect(s.split('eXIf').length - 1).toBe(1)
    const at = s.indexOf('eXIf') - 4
    const len = (out[at] << 24) | (out[at + 1] << 16) | (out[at + 2] << 8) | out[at + 3]
    const crcAt = at + 8 + len
    const crc = ((out[crcAt] << 24) | (out[crcAt + 1] << 16) | (out[crcAt + 2] << 8) | out[crcAt + 3]) >>> 0
    expect(crc).toBe(crc32([out.subarray(at + 4, at + 8 + len)]))
  })
  it('WebP: upgrades a simple VP8L file to VP8X with the EXIF flag, size and alpha kept', async () => {
    const out = await writeExif(tinyWebpLossless(), 'image/webp', tiff)
    expect(bin(out.subarray(12, 16))).toBe('VP8X')
    const flags = out[20]
    expect(flags & 0x08).toBe(0x08) // EXIF
    expect(flags & 0x10).toBe(0x10) // alpha
    expect((out[24] | (out[25] << 8) | (out[26] << 16)) + 1).toBe(3)
    expect((out[27] | (out[28] << 8) | (out[29] << 16)) + 1).toBe(2)
    expect(readExif(out, 'webp')).toEqual(tiff)
    // RIFF size covers the whole file.
    expect((out[4] | (out[5] << 8) | (out[6] << 16) | (out[7] << 24)) + 8).toBe(out.length)
  })
  it('WebP with VP8X already: sets the flag and replaces an old EXIF chunk', async () => {
    const src = riff([riffChunk('VP8X', [0, 0, 0, 0, 2, 0, 0, 1, 0, 0]), riffChunk('VP8L', [0x2f, 2, 0x40, 0, 0]), riffChunk('EXIF', [1, 2, 3])])
    const out = await writeExif(src, 'image/webp', tiff)
    expect(out[20] & 0x08).toBe(0x08)
    expect(bin(out).split('EXIF').length - 1).toBe(1)
    expect(readExif(out, 'webp')).toEqual(tiff)
  })
  it('AVIF and unknown layouts come back unchanged', async () => {
    const avif = new Uint8Array([0, 0, 0, 12, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66])
    expect(await writeExif(avif, 'image/avif', tiff)).toBe(avif)
    const junk = new Uint8Array([1, 2, 3])
    expect(await writeExif(junk, 'image/png', tiff)).toBe(junk)
    expect(await writeExif(junk, 'image/webp', tiff)).toBe(junk)
    expect(canWriteExif('image/avif')).toBe(false)
    expect(canWriteExif('image/png')).toBe(true)
  })
})
