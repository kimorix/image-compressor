// EXIF across containers, for tools that change the format (format
// conversion first). restoreExif (exif.ts) stays the compressor's
// JPEG -> JPEG path; this module reads the raw TIFF block out of any
// supported source and writes a sanitized copy into JPEG / PNG / WebP.
//
//   read:  JPEG APP1 "Exif\0\0", PNG eXIf, WebP EXIF chunk, HEIC/HEIF Exif item
//   write: JPEG (piexifjs), PNG eXIf (before the first IDAT), WebP EXIF chunk
//          (VP8X flag set, created when the file is a simple VP8/VP8L)
//   AVIF:  not written (no cheap container surgery), callers say so.
//
// sanitizeExif goes through piexifjs (lazy) so every output gets the same
// rules as the compressor: GPS removed, Orientation = 1 (the pixels are
// already rotated), embedded thumbnail dropped. Everything fails soft:
// unknown layout -> null / input unchanged, never an exception.

const ascii = (b: Uint8Array, at: number, len: number) => {
  let s = ''
  for (let i = 0; i < len && at + i < b.length; i++) s += String.fromCharCode(b[at + i])
  return s
}
const be16 = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1]
const be32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0
const le32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0

const EXIF_HEAD = [0x45, 0x78, 0x69, 0x66, 0, 0] // "Exif\0\0"

function startsWithExifHead(b: Uint8Array, at = 0): boolean {
  return EXIF_HEAD.every((v, i) => b[at + i] === v)
}

/** A TIFF header ("II*\0" / "MM\0*") at offset. */
function isTiff(b: Uint8Array, at = 0): boolean {
  return b.length >= at + 8 && ((b[at] === 0x49 && b[at + 1] === 0x49 && b[at + 2] === 0x2a && b[at + 3] === 0) || (b[at] === 0x4d && b[at + 1] === 0x4d && b[at + 2] === 0 && b[at + 3] === 0x2a))
}

function tiffFrom(data: Uint8Array): Uint8Array | null {
  if (startsWithExifHead(data) && isTiff(data, 6)) return data.slice(6)
  if (isTiff(data)) return data.slice()
  return null
}

// ---- read ----

function readJpeg(b: Uint8Array): Uint8Array | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null
  let o = 2
  while (o + 4 <= b.length && b[o] === 0xff) {
    const m = b[o + 1]
    if (m === 0xda || m === 0xd9) break
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { o += 2; continue }
    const len = be16(b, o + 2)
    if (len < 2 || o + 2 + len > b.length) break
    if (m === 0xe1 && startsWithExifHead(b, o + 4)) return tiffFrom(b.subarray(o + 4, o + 2 + len))
    o += 2 + len
  }
  return null
}

function readPng(b: Uint8Array): Uint8Array | null {
  let o = 8
  while (o + 12 <= b.length) {
    const len = be32(b, o)
    const type = ascii(b, o + 4, 4)
    if (o + 12 + len > b.length) break
    if (type === 'eXIf') return tiffFrom(b.subarray(o + 8, o + 8 + len))
    if (type === 'IDAT' || type === 'IEND') {
      // eXIf may legally follow IDAT; keep scanning to IEND.
      if (type === 'IEND') break
    }
    o += 12 + len
  }
  return null
}

interface RiffChunk { type: string; start: number; dataStart: number; dataEnd: number; size: number }

function webpChunks(b: Uint8Array): RiffChunk[] {
  const out: RiffChunk[] = []
  if (ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return out
  let o = 12
  while (o + 8 <= b.length) {
    const size = le32(b, o + 4)
    const dataEnd = o + 8 + size
    if (dataEnd > b.length) break
    out.push({ type: ascii(b, o, 4), start: o, dataStart: o + 8, dataEnd, size })
    o = dataEnd + (size % 2)
  }
  return out
}

function readWebp(b: Uint8Array): Uint8Array | null {
  const c = webpChunks(b).find((x) => x.type === 'EXIF')
  return c ? tiffFrom(b.subarray(c.dataStart, c.dataEnd)) : null
}

// ISOBMFF (HEIC/HEIF): meta -> iinf finds the 'Exif' item, iloc gives its
// extent(s). The item payload starts with a 4-byte offset to the TIFF
// header (usually 6, skipping "Exif\0\0").
interface Box { type: string; start: number; body: number; end: number }

function boxes(b: Uint8Array, from: number, to: number): Box[] {
  const out: Box[] = []
  let o = from
  while (o + 8 <= to) {
    let size = be32(b, o)
    const type = ascii(b, o + 4, 4)
    let body = o + 8
    if (size === 1) {
      if (o + 16 > to) break
      const hi = be32(b, o + 8)
      if (hi !== 0) break // > 4 GB: not a phone photo
      size = be32(b, o + 12)
      body = o + 16
    } else if (size === 0) size = to - o
    if (size < 8 || o + size > to) break
    out.push({ type, start: o, body, end: o + size })
    o += size
  }
  return out
}

function readUint(b: Uint8Array, o: number, n: number): number {
  let v = 0
  for (let i = 0; i < n; i++) v = v * 256 + b[o + i]
  return v
}

export function readHeicExif(b: Uint8Array): Uint8Array | null {
  const top = boxes(b, 0, b.length)
  if (!top.length || top[0].type !== 'ftyp') return null
  const meta = top.find((x) => x.type === 'meta')
  if (!meta) return null
  const kids = boxes(b, meta.body + 4, meta.end) // meta is a full box
  const iinf = kids.find((x) => x.type === 'iinf')
  const iloc = kids.find((x) => x.type === 'iloc')
  if (!iinf || !iloc) return null
  // iinf: version, entry count, then infe boxes.
  const iv = b[iinf.body]
  const entriesAt = iinf.body + 4 + (iv === 0 ? 2 : 4)
  let exifId = -1
  for (const infe of boxes(b, entriesAt, iinf.end)) {
    if (infe.type !== 'infe') continue
    const v = b[infe.body]
    if (v < 2) continue
    let o = infe.body + 4
    const id = v === 2 ? be16(b, o) : be32(b, o)
    o += (v === 2 ? 2 : 4) + 2 // item_ID + protection index
    if (ascii(b, o, 4) === 'Exif') { exifId = id; break }
  }
  if (exifId < 0) return null
  // iloc
  const v = b[iloc.body]
  let o = iloc.body + 4
  const offSize = b[o] >> 4
  const lenSize = b[o] & 15
  const baseSize = b[o + 1] >> 4
  const idxSize = v === 1 || v === 2 ? b[o + 1] & 15 : 0
  o += 2
  const count = v < 2 ? be16(b, o) : be32(b, o)
  o += v < 2 ? 2 : 4
  for (let i = 0; i < count && o < iloc.end; i++) {
    const id = v < 2 ? be16(b, o) : be32(b, o)
    o += v < 2 ? 2 : 4
    let method = 0
    if (v === 1 || v === 2) { method = be16(b, o) & 15; o += 2 }
    o += 2 // data_reference_index
    const base = readUint(b, o, baseSize)
    o += baseSize
    const extents = be16(b, o)
    o += 2
    const parts: Uint8Array[] = []
    for (let e = 0; e < extents; e++) {
      o += idxSize
      const eo = readUint(b, o, offSize)
      o += offSize
      const el = readUint(b, o, lenSize)
      o += lenSize
      parts.push(b.subarray(base + eo, base + eo + el))
    }
    if (id !== exifId) continue
    if (method !== 0 || !parts.length) return null
    const total = parts.reduce((n, p) => n + p.length, 0)
    const data = new Uint8Array(total)
    let w = 0
    for (const p of parts) { data.set(p, w); w += p.length }
    if (data.length < 8) return null
    const skip = be32(data, 0)
    if (4 + skip >= data.length) return null
    return tiffFrom(data.subarray(4 + skip)) ?? tiffFrom(data.subarray(4))
  }
  return null
}

/** Raw TIFF (EXIF) block of a source file, or null when it has none. */
export function readExif(bytes: Uint8Array, format: string): Uint8Array | null {
  try {
    if (format === 'jpeg') return readJpeg(bytes)
    if (format === 'png') return readPng(bytes)
    if (format === 'webp') return readWebp(bytes)
    if (format === 'heic' || format === 'avif') return readHeicExif(bytes)
  } catch {
    /* fail soft */
  }
  return null
}

// ---- sanitize (piexifjs) ----

const toBinary = (u: Uint8Array): string => {
  let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return s
}
const fromBinary = (s: string): Uint8Array => {
  const u = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff
  return u
}

/**
 * Privacy/orientation rules applied to a TIFF block: GPS removed,
 * Orientation = 1, thumbnail dropped. Null when nothing meaningful is left
 * (or the block cannot be parsed).
 */
export async function sanitizeExif(tiff: Uint8Array): Promise<Uint8Array | null> {
  try {
    const piexif = (await import('piexifjs')).default
    const obj = piexif.load('Exif\0\0' + toBinary(tiff))
    const has = ['0th', 'Exif', 'Interop'].some((k) => obj[k] && Object.keys(obj[k]).length > 0)
    if (!has) return null
    if (!obj['0th']) obj['0th'] = {}
    obj['0th'][piexif.ImageIFD.Orientation] = 1
    delete obj['1st']
    delete obj['thumbnail']
    delete obj['GPS']
    // The IFD0 pointer to GPS would dangle; piexif rebuilds pointers from
    // the dict, so removing the tag keeps the block consistent.
    delete obj['0th'][piexif.ImageIFD.GPSTag]
    const dumped = piexif.dump(obj) // "Exif\0\0" + TIFF
    return fromBinary(dumped).slice(6)
  } catch {
    return null
  }
}

// ---- write ----

let crcTable: Uint32Array | null = null
export function crc32(parts: Uint8Array[]): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (const p of parts) for (let i = 0; i < p.length; i++) c = crcTable[(c ^ p[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

function writePng(b: Uint8Array, tiff: Uint8Array): Uint8Array {
  if (b.length < 8 || b[0] !== 0x89) return b
  const parts: Uint8Array[] = [b.subarray(0, 8)]
  let o = 8
  let done = false
  while (o + 12 <= b.length) {
    const len = be32(b, o)
    const type = ascii(b, o + 4, 4)
    const end = o + 12 + len
    if (end > b.length) return b
    if (type === 'eXIf') { o = end; continue } // replace an existing block
    if (!done && type === 'IDAT') {
      const head = new Uint8Array(8)
      new DataView(head.buffer).setUint32(0, tiff.length)
      head.set([0x65, 0x58, 0x49, 0x66], 4) // eXIf
      const crc = new Uint8Array(4)
      new DataView(crc.buffer).setUint32(0, crc32([head.subarray(4), tiff]))
      parts.push(head, tiff, crc)
      done = true
    }
    parts.push(b.subarray(o, end))
    o = end
  }
  return done ? concat(parts) : b
}

function riffChunk(type: string, data: Uint8Array): Uint8Array {
  const c = new Uint8Array(8 + data.length + (data.length % 2))
  for (let i = 0; i < 4; i++) c[i] = type.charCodeAt(i)
  new DataView(c.buffer).setUint32(4, data.length, true)
  c.set(data, 8)
  return c
}

function webpCanvasSize(b: Uint8Array, chunks: RiffChunk[]): { w: number; h: number; alpha: boolean } | null {
  const vp8l = chunks.find((c) => c.type === 'VP8L')
  const vp8 = chunks.find((c) => c.type === 'VP8 ')
  if (vp8l) {
    const d = b.subarray(vp8l.dataStart, vp8l.dataEnd)
    if (d.length < 5 || d[0] !== 0x2f) return null
    return {
      w: (d[1] | ((d[2] & 0x3f) << 8)) + 1,
      h: (((d[2] >> 6) & 3) | (d[3] << 2) | ((d[4] & 0x0f) << 10)) + 1,
      alpha: ((d[4] >> 4) & 1) === 1,
    }
  }
  if (vp8) {
    const d = b.subarray(vp8.dataStart, vp8.dataEnd)
    if (d.length < 10 || d[3] !== 0x9d || d[4] !== 0x01 || d[5] !== 0x2a) return null
    const w = (d[6] | (d[7] << 8)) & 0x3fff
    const h = (d[8] | (d[9] << 8)) & 0x3fff
    return w && h ? { w, h, alpha: false } : null
  }
  return null
}

function writeWebp(b: Uint8Array, tiff: Uint8Array): Uint8Array {
  const chunks = webpChunks(b)
  if (!chunks.length) return b
  const parts: Uint8Array[] = [new Uint8Array(12)]
  const vp8x = chunks.find((c) => c.type === 'VP8X')
  if (!vp8x) {
    const size = webpCanvasSize(b, chunks)
    if (!size) return b
    const d = new Uint8Array(10)
    d[0] = 0x08 | (size.alpha ? 0x10 : 0)
    const w = size.w - 1
    const h = size.h - 1
    d.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 4)
    parts.push(riffChunk('VP8X', d))
  }
  for (const c of chunks) {
    if (c.type === 'EXIF') continue
    if (c.type === 'VP8X') {
      const d = new Uint8Array(b.subarray(c.dataStart, c.dataEnd))
      if (d.length < 10) return b
      d[0] |= 0x08 // EXIF flag
      parts.push(riffChunk('VP8X', d))
    } else {
      parts.push(b.subarray(c.start, c.dataEnd + (c.size % 2)))
    }
  }
  parts.push(riffChunk('EXIF', tiff)) // after the image data (and ICCP/ANIM), per the container spec
  const out = concat(parts)
  out.set([0x52, 0x49, 0x46, 0x46], 0)
  new DataView(out.buffer).setUint32(4, out.length - 8, true)
  out.set([0x57, 0x45, 0x42, 0x50], 8)
  return out
}

/**
 * Embed a (sanitized) TIFF block into encoded output. Returns the input
 * unchanged for unsupported types (AVIF) or an unexpected layout.
 */
export async function writeExif(bytes: Uint8Array, mime: string, tiff: Uint8Array): Promise<Uint8Array> {
  try {
    if (mime === 'image/png') return writePng(bytes, tiff)
    if (mime === 'image/webp') return writeWebp(bytes, tiff)
    if (mime === 'image/jpeg') {
      const piexif = (await import('piexifjs')).default
      return fromBinary(piexif.insert('Exif\0\0' + toBinary(tiff), toBinary(bytes)))
    }
  } catch (err) {
    console.warn('[exif] write failed, keeping stripped output:', err)
  }
  return bytes
}

/** Whether writeExif can carry EXIF in this output type. */
export function canWriteExif(mime: string): boolean {
  return mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp'
}
