import { describe, expect, it } from 'vitest'
import { FORMAT_MIME, sniffFile, sniffFormat } from '../../src/shared/image/sniff'

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)))
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
const ftyp = (major: string, ...compat: string[]) => bytes(be32(16 + 4 * compat.length), 'ftyp', major, [0, 0, 0, 0], ...compat)

describe('sniffFormat', () => {
  it('raster signatures', () => {
    expect(sniffFormat(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg')
    expect(sniffFormat(bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png')
    expect(sniffFormat(bytes('GIF89a', [1, 0]))).toBe('gif')
    expect(sniffFormat(bytes('GIF87a'))).toBe('gif')
    expect(sniffFormat(bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 '))).toBe('webp')
    expect(sniffFormat(bytes('BM', new Array(12).fill(0)))).toBe('bmp')
    expect(sniffFormat(bytes([0x49, 0x49, 0x2a, 0]))).toBe('tiff')
    expect(sniffFormat(bytes([0x4d, 0x4d, 0, 0x2a]))).toBe('tiff')
    expect(sniffFormat(bytes([0, 0, 1, 0, 1, 0]))).toBe('ico')
  })
  it('ISOBMFF brands: AVIF wins over the generic mif1, HEIC brands', () => {
    expect(sniffFormat(ftyp('avif', 'mif1', 'miaf'))).toBe('avif')
    expect(sniffFormat(ftyp('mif1', 'avif'))).toBe('avif')
    expect(sniffFormat(ftyp('heic', 'mif1'))).toBe('heic')
    expect(sniffFormat(ftyp('mif1', 'heic'))).toBe('heic')
    expect(sniffFormat(ftyp('heix'))).toBe('heic')
    expect(sniffFormat(ftyp('isom', 'mp41'))).toBeNull() // an MP4, not an image
  })
  it('SVG text with BOM, whitespace, XML prolog or comment', () => {
    expect(sniffFormat(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBe('svg')
    expect(sniffFormat(bytes([0xef, 0xbb, 0xbf], '\n  <svg>'))).toBe('svg')
    expect(sniffFormat(bytes('<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<!-- x -->\n<svg width="1">'))).toBe('svg')
    expect(sniffFormat(bytes('<html><body>'))).toBeNull()
  })
  it('unknown, empty and truncated input', () => {
    expect(sniffFormat(new Uint8Array())).toBeNull()
    expect(sniffFormat(bytes([0xff, 0xd8]))).toBeNull()
    expect(sniffFormat(bytes('%PDF-1.7'))).toBeNull()
    expect(sniffFormat(bytes('RIFF', [0, 0, 0, 0], 'WAVE'))).toBeNull()
  })
  it('sniffFile reads the bytes, not the name or type', async () => {
    const heicNamedJpg = new File([ftyp('heic', 'mif1'), new Uint8Array(500)], 'IMG_1.jpg', { type: 'image/jpeg' })
    expect(await sniffFile(heicNamedJpg)).toBe('heic')
    expect(FORMAT_MIME.heic).toBe('image/heic')
  })
})
