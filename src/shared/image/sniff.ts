// Magic-byte image format detection: trust the file's bytes, not its name
// or the browser-reported MIME type (a ".jpg" that is really HEIC, a WebP
// saved without an extension, an empty `file.type` on some platforms).
// Pure on a byte prefix; sniffFile reads only the first 256 bytes (SVG may open with a long XML prolog).

export type ImageFormat = 'jpeg' | 'png' | 'gif' | 'webp' | 'avif' | 'heic' | 'bmp' | 'tiff' | 'svg' | 'ico'

export const FORMAT_MIME: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  heic: 'image/heic',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
}

/** Prefix sniffFile reads: fits an ISOBMFF ftyp box and an SVG prolog. */
export const SNIFF_BYTES = 256

const ascii = (b: Uint8Array, at: number, len: number) => String.fromCharCode(...b.subarray(at, at + len))

// HEIF family brands. 'mif1'/'msf1' are generic HEIF containers: they only
// count as HEIC when no AVIF brand is present (AVIF files list mif1 too).
const HEIC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs'])
const AVIF_BRANDS = new Set(['avif', 'avis'])
const HEIF_GENERIC = new Set(['mif1', 'msf1', 'miaf'])

function sniffFtyp(b: Uint8Array): ImageFormat | null {
  if (b.length < 12 || ascii(b, 4, 4) !== 'ftyp') return null
  const boxSize = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0
  const end = Math.min(b.length, boxSize >= 16 ? boxSize : b.length)
  const brands = [ascii(b, 8, 4)]
  for (let i = 16; i + 4 <= end; i += 4) brands.push(ascii(b, i, 4))
  if (brands.some((x) => AVIF_BRANDS.has(x))) return 'avif'
  if (brands.some((x) => HEIC_BRANDS.has(x))) return 'heic'
  if (brands.some((x) => HEIF_GENERIC.has(x))) return 'heic'
  return null
}

/** Detect the image format from the first bytes; null when unknown. */
export function sniffFormat(bytes: Uint8Array): ImageFormat | null {
  const b = bytes
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png'
  if (b.length >= 6 && (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a')) return 'gif'
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp'
  const ftyp = sniffFtyp(b)
  if (ftyp) return ftyp
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d && b.length >= 14) return 'bmp'
  if (b.length >= 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a))) return 'tiff'
  if (b.length >= 4 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return 'ico'
  // SVG is text: skip a BOM and whitespace, then look for <svg or an XML
  // prolog / comment / doctype followed by <svg within the prefix.
  let i = 0
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) i = 3
  while (i < b.length && (b[i] === 0x20 || b[i] === 0x09 || b[i] === 0x0a || b[i] === 0x0d)) i++
  if (b[i] === 0x3c) {
    const head = ascii(b, i, b.length - i).toLowerCase()
    if (head.startsWith('<svg') || ((head.startsWith('<?xml') || head.startsWith('<!--') || head.startsWith('<!doctype svg')) && head.includes('<svg'))) return 'svg'
  }
  return null
}

/** Read a file's first bytes and sniff them. */
export async function sniffFile(file: Blob): Promise<ImageFormat | null> {
  const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer())
  return sniffFormat(head)
}

// ---- Extended detection (format converter) ----
// Formats only the converter reads, with its own decoders. Kept apart from
// sniffFormat on purpose: the other tools treat these files as unknown,
// exactly as before.

/** Every input the format converter recognises. */
export type AnyImageFormat = ImageFormat | 'jxl' | 'psd' | 'qoi' | 'tga' | 'raw'

/** Camera RAW extensions (TIFF-based ones sniff as TIFF by their bytes). */
export const RAW_EXT = /\.(dng|cr2|cr3|nef|nrw|arw|srf|sr2|pef|orf|rw2|rwl|raf|srw|erf|3fr|fff|iiq|mef|mos|kdc|dcr|x3f)$/i

function looksLikeTgaHeader(b: Uint8Array): boolean {
  if (b.length < 18) return false
  const cmType = b[1], type = b[2], w = b[12] | (b[13] << 8), h = b[14] | (b[15] << 8), depth = b[16]
  if (![1, 2, 3, 9, 10, 11].includes(type) || cmType > 1 || !w || !h || (b[17] & 0xc0) !== 0) return false
  if (type === 1 || type === 9) return cmType === 1 && depth === 8
  if (type === 2 || type === 10) return [15, 16, 24, 32].includes(depth)
  return depth === 8 || depth === 16
}

/**
 * sniffFormat plus JPEG XL, PSD/PSB, QOI, camera RAW (CR2/ORF/RW2/RAF/CR3
 * by their bytes; DNG/NEF/ARW and other TIFF-based RAWs by DNGVersion in
 * IFD0 or by extension) and TGA (no signature: extension + a sane header,
 * or the TGA 2.0 footer in `tail`).
 */
export function sniffAny(head: Uint8Array, name = '', tail?: Uint8Array): AnyImageFormat | null {
  const b = head
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0x0a) return 'jxl'
  if (b.length >= 12 && b[0] === 0 && b[1] === 0 && b[2] === 0 && b[3] === 0x0c && ascii(b, 4, 4) === 'JXL ') return 'jxl'
  if (b.length >= 26 && ascii(b, 0, 4) === '8BPS' && b[4] === 0 && (b[5] === 1 || b[5] === 2)) return 'psd'
  if (b.length >= 14 && ascii(b, 0, 4) === 'qoif') return 'qoi'
  if (b.length >= 16) {
    if (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0 && b[8] === 0x43 && b[9] === 0x52) return 'raw' // CR2
    const m4 = ascii(b, 0, 4)
    if (m4 === 'IIRO' || m4 === 'IIRS' || m4 === 'MMOR') return 'raw' // ORF
    if (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x55 && b[3] === 0) return 'raw' // RW2
    if (ascii(b, 0, 15) === 'FUJIFILMCCD-RAW') return 'raw' // RAF
    if (ascii(b, 4, 8) === 'ftypcrx ') return 'raw' // CR3
  }
  const base = sniffFormat(b)
  if (base === 'tiff' && (RAW_EXT.test(name) || hasDngVersion(b))) return 'raw'
  if (base) return base
  const tga = tail && tail.length >= 18 && ascii(tail, tail.length - 18, 16) === 'TRUEVISION-XFILE'
  if ((tga || /\.(tga|icb|vda|vst|tpic)$/i.test(name)) && looksLikeTgaHeader(b)) return 'tga'
  return null
}

/** IFD0 has a DNGVersion (50706) tag, when IFD0 lies inside the prefix. */
function hasDngVersion(b: Uint8Array): boolean {
  const le = b[0] === 0x49
  const u16 = (o: number) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1])
  const u32 = (o: number) => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0)
  const at = u32(4)
  if (at < 8 || at + 2 > b.length) return false
  const n = u16(at)
  for (let i = 0; i < n && at + 2 + i * 12 + 2 <= b.length; i++) if (u16(at + 2 + i * 12) === 50706) return true
  return false
}
