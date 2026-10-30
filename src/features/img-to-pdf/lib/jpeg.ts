// JPEG byte surgery for the "original" quality path, where a JPEG goes into
// the PDF as its own bytes (no re-encode): read the EXIF orientation, read
// the stored size, and drop the metadata segments before embedding.
// Pure functions on bytes (unit tested); every parse fails soft.

interface Seg { marker: number; start: number; end: number; dataStart: number }

/** Marker segments up to SOS (scan data follows, never touched). */
function segments(b: Uint8Array): { segs: Seg[]; sos: number } {
  const segs: Seg[] = []
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return { segs, sos: -1 }
  let off = 2
  while (off + 4 <= b.length) {
    if (b[off] !== 0xff) return { segs, sos: -1 }
    const marker = b[off + 1]
    if (marker === 0xff) { off++; continue } // fill byte
    if (marker === 0xda) return { segs, sos: off }
    if (marker === 0xd9) return { segs, sos: -1 }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue }
    const len = (b[off + 2] << 8) | b[off + 3]
    if (len < 2 || off + 2 + len > b.length) return { segs, sos: -1 }
    segs.push({ marker, start: off, end: off + 2 + len, dataStart: off + 4 })
    off += 2 + len
  }
  return { segs, sos: -1 }
}

const isExif = (b: Uint8Array, s: Seg) =>
  s.marker === 0xe1 && s.end - s.dataStart >= 14 &&
  b[s.dataStart] === 0x45 && b[s.dataStart + 1] === 0x78 && b[s.dataStart + 2] === 0x69 && b[s.dataStart + 3] === 0x66 &&
  b[s.dataStart + 4] === 0 && b[s.dataStart + 5] === 0

/** EXIF Orientation (1–8) of a JPEG; 1 when absent or unreadable. */
export function jpegOrientation(b: Uint8Array): number {
  for (const s of segments(b).segs) {
    if (!isExif(b, s)) continue
    const t = s.dataStart + 6 // TIFF header
    if (t + 8 > s.end) return 1
    const le = b[t] === 0x49 && b[t + 1] === 0x49
    if (!le && !(b[t] === 0x4d && b[t + 1] === 0x4d)) return 1
    const u16 = (o: number) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1])
    const u32 = (o: number) => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0)
    const ifd = t + u32(t + 4)
    if (ifd + 2 > s.end) return 1
    const n = u16(ifd)
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12
      if (e + 12 > s.end) break
      if (u16(e) === 0x0112) {
        const v = u16(e + 8)
        return v >= 1 && v <= 8 ? v : 1
      }
    }
    return 1
  }
  return 1
}

/** Stored (pre-orientation) pixel size from the SOF segment; null if none. */
export function jpegSize(b: Uint8Array): { w: number; h: number } | null {
  for (const s of segments(b).segs) {
    const m = s.marker
    // SOF0–SOF15 except DHT (C4), JPG (C8), DAC (CC).
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc && s.dataStart + 5 <= s.end) {
      const h = (b[s.dataStart + 1] << 8) | b[s.dataStart + 2]
      const w = (b[s.dataStart + 3] << 8) | b[s.dataStart + 4]
      return w && h ? { w, h } : null
    }
  }
  return null
}

/**
 * Remove metadata segments before embedding the JPEG as-is: APP1 (EXIF
 * with GPS, XMP), APP13 (IPTC / Photoshop) and COM comments. APP0 (JFIF),
 * APP2 (ICC profile) and APP14 (Adobe, needed for CMYK/YCCK colour
 * transforms) stay. Returns the input unchanged when it does not parse.
 */
export function stripJpegMetadata(b: Uint8Array): Uint8Array {
  const { segs, sos } = segments(b)
  if (sos < 0) return b
  const drop = segs.filter((s) => s.marker === 0xe1 || s.marker === 0xed || s.marker === 0xfe)
  if (!drop.length) return b
  const removed = drop.reduce((n, s) => n + (s.end - s.start), 0)
  const out = new Uint8Array(b.length - removed)
  let o = 0
  let at = 0
  for (const s of drop) {
    out.set(b.subarray(at, s.start), o)
    o += s.start - at
    at = s.end
  }
  out.set(b.subarray(at), o)
  return out
}
