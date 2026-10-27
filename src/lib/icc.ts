// ICC preservation, Display P3 only. iPhone photos are Display P3; the
// canvas pipeline drops their profile, so on a P3 screen the output looks
// duller ("washed out") than the original. The fix is end-to-end P3:
// decode without converting, draw into a display-p3 canvas, and embed the
// source profile into the output. Any other profile (sRGB, AdobeRGB, ...)
// keeps the current sRGB path: a wrong tag is worse than no tag.
// Formats: JPEG (APP2 splice) and WebP (VP8X + ICCP) always; PNG (iCCP)
// only where CompressionStream exists; AVIF has no cheap container
// surgery, so AVIF output stays sRGB. Every function fails soft: on any
// parse surprise it returns the input unchanged or null, never an error.

const ICC_HEAD = 'ICC_PROFILE'

function ascii(b: Uint8Array, off: number, len: number): string {
  let s = ''
  for (let i = 0; i < len; i++) s += String.fromCharCode(b[off + i])
  return s
}

function be32(b: Uint8Array, off: number): number {
  return (b[off] << 24) | (b[off + 1] << 16) | (b[off + 2] << 8) | b[off + 3]
}

function le32(b: Uint8Array, off: number): number {
  return b[off] | (b[off + 1] << 8) | (b[off + 2] << 16) | (b[off + 3] << 24)
}

// ---- JPEG ----

interface JpegSeg { marker: number; start: number; dataStart: number; dataEnd: number }

function jpegSegments(b: Uint8Array): JpegSeg[] {
  const segs: JpegSeg[] = []
  if (b.length < 2 || b[0] !== 0xff || b[1] !== 0xd8) return segs
  let off = 2
  while (off + 4 <= b.length) {
    if (b[off] !== 0xff) break
    const marker = b[off + 1]
    if (marker === 0xd9 || marker === 0xda) break // EOI, SOS: scan data follows
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue }
    const len = (b[off + 2] << 8) | b[off + 3]
    if (len < 2 || off + 2 + len > b.length) break
    segs.push({ marker, start: off, dataStart: off + 4, dataEnd: off + 2 + len })
    off += 2 + len
  }
  return segs
}

function isIccApp2(b: Uint8Array, s: JpegSeg): boolean {
  if (s.marker !== 0xe2 || s.dataEnd - s.dataStart < 14) return false
  return ascii(b, s.dataStart, 11) === ICC_HEAD && b[s.dataStart + 11] === 0
}

function extractIccJpeg(b: Uint8Array): ArrayBuffer | null {
  const chunks = new Map<number, Uint8Array>()
  let total = 0
  for (const s of jpegSegments(b)) {
    if (!isIccApp2(b, s)) continue
    const d = b.subarray(s.dataStart, s.dataEnd)
    const chunk = d[12]
    total = d[13]
    if (chunk < 1 || chunk > total) return null
    chunks.set(chunk, d.subarray(14))
  }
  if (total === 0 || chunks.size !== total) return null
  const parts: Uint8Array[] = []
  for (let i = 1; i <= total; i++) parts.push(chunks.get(i)!)
  const len = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(len)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out.buffer
}

export function embedIccJpeg(input: Uint8Array, icc: ArrayBuffer): Uint8Array {
  if (input.length < 2 || input[0] !== 0xff || input[1] !== 0xd8) return input
  const segs = jpegSegments(input)
  const prof = new Uint8Array(icc)
  const PER_SEG = 65533 - 14
  const total = Math.max(1, Math.ceil(prof.length / PER_SEG))
  const app2: Uint8Array[] = []
  for (let i = 0; i < total; i++) {
    const part = prof.subarray(i * PER_SEG, (i + 1) * PER_SEG)
    const seg = new Uint8Array(2 + 2 + 12 + 2 + part.length)
    seg[0] = 0xff
    seg[1] = 0xe2
    const len = 12 + 2 + part.length + 2
    seg[2] = (len >> 8) & 0xff
    seg[3] = len & 0xff
    seg.set([73, 67, 67, 95, 80, 82, 79, 70, 73, 76, 69, 0], 4) // 'ICC_PROFILE\0'
    seg[16] = i + 1
    seg[17] = total
    seg.set(part, 18)
    app2.push(seg)
  }
  const out: Uint8Array[] = [input.subarray(0, 2)]
  let inserted = false
  for (const s of segs) {
    if (isIccApp2(input, s)) continue // drop any old profile first
    out.push(input.subarray(s.start, s.dataEnd))
    if (!inserted) { out.push(...app2); inserted = true }
  }
  if (!inserted) out.push(...app2)
  // Tail: SOS + scan data + EOI, verbatim. Segments are contiguous, so the
  // byte after the last parsed segment is the SOS marker (or EOF).
  const tailStart = segs.length ? segs[segs.length - 1].dataEnd : 2
  out.push(input.subarray(tailStart))
  const len = out.reduce((n, p) => n + p.length, 0)
  const res = new Uint8Array(len)
  let o = 0
  for (const p of out) { res.set(p, o); o += p.length }
  return res
}

// ---- PNG (iCCP, zlib-compressed) ----

export function canEmbedPng(): boolean {
  return typeof (globalThis as any).CompressionStream !== 'undefined'
    && typeof (globalThis as any).DecompressionStream !== 'undefined'
}

async function inflate(data: Uint8Array): Promise<ArrayBuffer | null> {
  try {
    const DS = (globalThis as any).DecompressionStream
    if (!DS) return null
    const stream = new Blob([data as any]).stream().pipeThrough(new DS('deflate'))
    return await new Response(stream).arrayBuffer()
  } catch {
    return null
  }
}

async function deflate(data: Uint8Array): Promise<Uint8Array | null> {
  try {
    const CS = (globalThis as any).CompressionStream
    if (!CS) return null
    const stream = new Blob([data as any]).stream().pipeThrough(new CS('deflate'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null
  }
}

async function extractIccPng(b: Uint8Array): Promise<ArrayBuffer | null> {
  if (b.length < 8 || b[0] !== 0x89 || ascii(b, 1, 3) !== 'PNG') return null
  let off = 8
  while (off + 8 <= b.length) {
    const len = be32(b, off)
    const type = ascii(b, off + 4, 4)
    if (type === 'iCCP') {
      const data = b.subarray(off + 8, off + 8 + len)
      const nul = data.indexOf(0)
      if (nul < 0 || nul + 2 > data.length || data[nul + 1] !== 0) return null
      return await inflate(data.subarray(nul + 2))
    }
    if (type === 'IDAT') break // iCCP must precede IDAT
    off += 12 + len
  }
  return null
}

// Standard CRC-32 (IEEE), for PNG chunks.
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c
  }
  return t
})()

function crc32(b: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export async function embedIccPng(input: Uint8Array, icc: ArrayBuffer): Promise<Uint8Array> {
  if (input.length < 8 || input[0] !== 0x89 || ascii(input, 1, 3) !== 'PNG') return input
  const comp = await deflate(new Uint8Array(icc))
  if (!comp) return input
  const name = [73, 67, 67, 0] // 'ICC\0'
  const data = new Uint8Array(name.length + 1 + comp.length)
  data.set(name, 0)
  data[name.length] = 0 // compression method: deflate
  data.set(comp, name.length + 1)
  const chunk = new Uint8Array(12 + data.length)
  chunk[0] = (data.length >> 24) & 0xff
  chunk[1] = (data.length >> 16) & 0xff
  chunk[2] = (data.length >> 8) & 0xff
  chunk[3] = data.length & 0xff
  chunk.set([105, 67, 67, 80], 4) // 'iCCP'
  chunk.set(data, 8)
  const crc = crc32(chunk.subarray(4, 8 + data.length))
  chunk[8 + data.length] = (crc >> 24) & 0xff
  chunk[9 + data.length] = (crc >> 16) & 0xff
  chunk[10 + data.length] = (crc >> 8) & 0xff
  chunk[11 + data.length] = crc & 0xff
  const out: Uint8Array[] = [input.subarray(0, 8)]
  let off = 8
  let inserted = false
  while (off + 8 <= input.length) {
    const len = be32(input, off)
    const type = ascii(input, off + 4, 4)
    const end = off + 12 + len
    if (type === 'iCCP') { off = end; continue } // drop old profile
    out.push(input.subarray(off, end))
    if (!inserted && type === 'IHDR') { out.push(chunk); inserted = true }
    off = end
  }
  if (!inserted) out.push(chunk)
  const len = out.reduce((n, p) => n + p.length, 0)
  const res = new Uint8Array(len)
  let o = 0
  for (const p of out) { res.set(p, o); o += p.length }
  return res
}

// ---- WebP (ICCP) ----

interface WebpChunk { type: string; start: number; dataStart: number; dataEnd: number; size: number }

function webpChunks(b: Uint8Array): WebpChunk[] {
  const chunks: WebpChunk[] = []
  if (b.length < 12 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return chunks
  let off = 12
  while (off + 8 <= b.length) {
    const type = ascii(b, off, 4)
    const size = le32(b, off + 4)
    if (off + 8 + size > b.length) break
    chunks.push({ type, start: off, dataStart: off + 8, dataEnd: off + 8 + size, size })
    off += 8 + size + (size % 2)
  }
  return chunks
}

function extractIccWebp(b: Uint8Array): ArrayBuffer | null {
  for (const c of webpChunks(b)) {
    if (c.type === 'ICCP') return b.slice(c.dataStart, c.dataEnd).buffer
  }
  return null
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(8 + data.length + (data.length % 2))
  for (let i = 0; i < 4; i++) chunk[i] = type.charCodeAt(i)
  chunk[4] = data.length & 0xff
  chunk[5] = (data.length >> 8) & 0xff
  chunk[6] = (data.length >> 16) & 0xff
  chunk[7] = (data.length >> 24) & 0xff
  chunk.set(data, 8)
  return chunk
}

export function embedIccWebp(input: Uint8Array, icc: ArrayBuffer): Uint8Array {
  const chunks = webpChunks(input)
  if (!chunks.length) return input
  const prof = new Uint8Array(icc)
  const iccp = makeChunk('ICCP', prof)
  const vp8x = chunks.find((c) => c.type === 'VP8X')
  const parts: Uint8Array[] = [input.subarray(0, 12)]
  if (vp8x) {
    for (const c of chunks) {
      if (c.type === 'ICCP') continue
      if (c.type === 'VP8X') {
        const data = input.subarray(c.dataStart, c.dataEnd)
        if (data.length < 10) return input
        const fixed = new Uint8Array(data)
        fixed[0] |= 0x20 // ICC flag
        parts.push(makeChunk('VP8X', fixed))
        parts.push(iccp)
      } else {
        parts.push(input.subarray(c.start, c.dataEnd + ((c.size % 2) ? 1 : 0)))
      }
    }
  } else {
    const vp8 = chunks.find((c) => c.type === 'VP8 ')
    const vp8l = chunks.find((c) => c.type === 'VP8L')
    let w = 0
    let h = 0
    let alpha = false
    if (vp8l) {
      const d = input.subarray(vp8l.dataStart, vp8l.dataEnd)
      if (d.length < 5 || d[0] !== 0x2f) return input
      w = (d[1] | ((d[2] & 0x3f) << 8)) + 1
      h = (((d[2] >> 6) & 0x3) | (d[3] << 2) | ((d[4] & 0x0f) << 10)) + 1
      alpha = ((d[4] >> 4) & 1) === 1
    } else if (vp8) {
      const d = input.subarray(vp8.dataStart, vp8.dataEnd)
      if (d.length < 10 || d[3] !== 0x9d || d[4] !== 0x01 || d[5] !== 0x2a) return input
      w = (d[6] | (d[7] << 8)) & 0x3fff
      h = (d[8] | (d[9] << 8)) & 0x3fff
      if (!w || !h) return input
    } else {
      return input
    }
    const flags = 0x20 | (alpha ? 0x10 : 0)
    const vp8xData = new Uint8Array(10)
    vp8xData[0] = flags
    vp8xData[4] = (w - 1) & 0xff
    vp8xData[5] = ((w - 1) >> 8) & 0xff
    vp8xData[6] = ((w - 1) >> 16) & 0xff
    vp8xData[7] = (h - 1) & 0xff
    vp8xData[8] = ((h - 1) >> 8) & 0xff
    vp8xData[9] = ((h - 1) >> 16) & 0xff
    parts.push(makeChunk('VP8X', vp8xData))
    parts.push(iccp)
    for (const c of chunks) {
      if (c.type === 'ICCP') continue
      parts.push(input.subarray(c.start, c.dataEnd + ((c.size % 2) ? 1 : 0)))
    }
  }
  const bodyLen = parts.reduce((n, p) => n + p.length, 0) - 8
  const riff = new Uint8Array(12)
  riff.set([82, 73, 70, 70], 0) // 'RIFF'
  riff[4] = bodyLen & 0xff
  riff[5] = (bodyLen >> 8) & 0xff
  riff[6] = (bodyLen >> 16) & 0xff
  riff[7] = (bodyLen >> 24) & 0xff
  riff.set([87, 69, 66, 80], 8) // 'WEBP'
  parts[0] = riff
  const len = parts.reduce((n, p) => n + p.length, 0)
  const res = new Uint8Array(len)
  let o = 0
  for (const p of parts) { res.set(p, o); o += p.length }
  return res
}

// ---- Dispatch ----

// ICC lives in the header of all three formats, so a 512 KB prefix is
// plenty (a huge EXIF block before APP2 is the only realistic miss, and
// missing just means the safe sRGB path).
export async function extractIcc(blob: Blob): Promise<ArrayBuffer | null> {
  try {
    const head = new Uint8Array(await blob.slice(0, 512 * 1024).arrayBuffer())
    if (head.length >= 2 && head[0] === 0xff && head[1] === 0xd8) return extractIccJpeg(head)
    if (head.length >= 8 && head[0] === 0x89 && ascii(head, 1, 3) === 'PNG') return await extractIccPng(head)
    if (head.length >= 12 && ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WEBP') return extractIccWebp(head)
  } catch (err) {
    console.warn('[image-compressor] ICC extract failed, keeping sRGB path:', err)
  }
  return null
}

function decodeIccDesc(data: Uint8Array): string | null {
  if (data.length < 12) return null
  const type = ascii(data, 0, 4)
  if (type === 'desc') {
    const count = be32(data, 8)
    if (12 + count > data.length) return null
    return ascii(data, 12, count).replace(/\0/g, '')
  }
  if (type === 'mluc') {
    const count = be32(data, 8)
    let first: string | null = null
    for (let i = 0; i < count; i++) {
      const r = 16 + i * 12
      if (r + 12 > data.length) break
      const lang = ascii(data, r, 2)
      const len = be32(data, r + 4)
      const off = be32(data, r + 8)
      if (off + len > data.length) continue
      const raw = data.subarray(off, off + len)
      let s = ''
      for (let j = 0; j + 1 < raw.length; j += 2) s += String.fromCharCode((raw[j] << 8) | raw[j + 1])
      s = s.replace(/\0/g, '')
      if (lang === 'en') return s
      if (first === null) first = s
    }
    return first
  }
  return null
}

export function isDisplayP3(icc: ArrayBuffer): boolean {
  const b = new Uint8Array(icc)
  if (b.length < 132) return false
  const tagCount = be32(b, 128)
  let descText: string | null = null
  let redX: number | null = null
  for (let i = 0; i < tagCount; i++) {
    const e = 132 + i * 12
    if (e + 12 > b.length) break
    const sig = ascii(b, e, 4)
    const off = be32(b, e + 4)
    const size = be32(b, e + 8)
    if (off + size > b.length) continue
    if (sig === 'desc' && descText === null) descText = decodeIccDesc(b.subarray(off, off + size))
    if (sig === 'rXYZ' && size >= 20) {
      // XYZ tag: sig(4) + reserved(4) + X/Y/Z as s15Fixed16
      redX = be32(b, off + 8) / 65536
    }
  }
  if (descText && descText.includes('P3')) return true
  // Fallback: P3 red primary X ≈ 0.487 vs sRGB ≈ 0.412.
  return redX !== null && redX > 0.45
}

export async function embedIcc(input: Uint8Array, type: string, icc: ArrayBuffer): Promise<Uint8Array> {
  try {
    if (type === 'image/jpeg') return embedIccJpeg(input, icc)
    if (type === 'image/webp') return embedIccWebp(input, icc)
    if (type === 'image/png') return await embedIccPng(input, icc)
  } catch (err) {
    console.warn('[image-compressor] ICC embed failed, keeping untagged output:', err)
  }
  return input
}
