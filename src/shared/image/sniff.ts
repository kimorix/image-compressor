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
