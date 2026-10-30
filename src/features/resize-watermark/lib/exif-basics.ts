// The two EXIF facts this tool needs before decoding: the Orientation tag
// (to say "orientation corrected" in the list; the pixels themselves are
// turned upright by the decoder) and DateTimeOriginal (the {date} variable
// of the text watermark). A bounded walk over the JPEG APP1 segment and
// TIFF IFD0 / Exif IFD: no piexifjs, no full parse. Pure, unit tested.

export interface ExifBasics {
  /** 1–8; 1 when absent or unreadable. */
  orientation: number
  /** "YYYY-MM-DD" from DateTimeOriginal (or DateTime), or null. */
  date: string | null
}

const NONE: ExifBasics = { orientation: 1, date: null }

function tiff(b: Uint8Array, start: number, end: number): ExifBasics {
  if (start + 8 > end) return NONE
  const le = b[start] === 0x49 && b[start + 1] === 0x49
  if (!le && !(b[start] === 0x4d && b[start + 1] === 0x4d)) return NONE
  const u16 = (o: number) => (o + 2 > end ? -1 : le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1])
  const u32 = (o: number) => (o + 4 > end ? -1 : le
    ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
    : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0)
  const ascii = (o: number, n: number) => {
    let s = ''
    for (let i = 0; i < n && o + i < end; i++) {
      const c = b[o + i]
      if (!c) break
      s += String.fromCharCode(c)
    }
    return s
  }
  const toDate = (s: string) => {
    const m = /^(\d{4})[:-](\d{2})[:-](\d{2})/.exec(s)
    return m && m[1] !== '0000' ? `${m[1]}-${m[2]}-${m[3]}` : null
  }
  let orientation = 1
  let dateTime: string | null = null
  let original: string | null = null
  let exifIfd = -1
  const walk = (ifd: number, isExif: boolean) => {
    const n = u16(ifd)
    if (n < 0 || n > 512) return
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12
      if (e + 12 > end) return
      const tag = u16(e)
      const count = u32(e + 4)
      const valOff = start + u32(e + 8)
      if (!isExif && tag === 0x0112) {
        const v = u16(e + 8)
        if (v >= 1 && v <= 8) orientation = v
      } else if (!isExif && tag === 0x0132 && count >= 10) {
        dateTime = toDate(ascii(valOff, Math.min(count, 32)))
      } else if (!isExif && tag === 0x8769) {
        exifIfd = start + u32(e + 8)
      } else if (isExif && tag === 0x9003 && count >= 10) {
        original = toDate(ascii(valOff, Math.min(count, 32)))
      }
    }
  }
  const first = u32(start + 4)
  if (first < 0) return NONE
  walk(start + first, false)
  if (exifIfd > start && exifIfd < end) walk(exifIfd, true)
  return { orientation, date: original ?? dateTime }
}

/** Read Orientation and the capture date from the first bytes of a JPEG. */
export function readExifBasics(b: Uint8Array): ExifBasics {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return NONE
  let off = 2
  while (off + 4 <= b.length) {
    if (b[off] !== 0xff) return NONE
    const marker = b[off + 1]
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { off += 2; continue }
    if (marker === 0xda || marker === 0xd9) return NONE // image data: no EXIF before it
    const len = (b[off + 2] << 8) | b[off + 3]
    if (len < 2) return NONE
    const segEnd = Math.min(b.length, off + 2 + len)
    if (marker === 0xe1 && off + 10 <= b.length
      && b[off + 4] === 0x45 && b[off + 5] === 0x78 && b[off + 6] === 0x69 && b[off + 7] === 0x66 && b[off + 8] === 0 && b[off + 9] === 0) {
      return tiff(b, off + 10, segEnd)
    }
    off += 2 + len
  }
  return NONE
}

/** Orientations 5–8 swap width and height. */
export function swapsAxes(orientation: number): boolean {
  return orientation >= 5 && orientation <= 8
}

/** EXIF lives in the first 64 KB of a JPEG (APP1 is capped at 64 KB). */
export const EXIF_HEAD_BYTES = 128 * 1024
