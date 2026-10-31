// Camera RAW input = the embedded JPEG preview. Developing the sensor data
// (demosaic, white balance, camera colour matrices) is a RAW converter's
// job; every camera already stores a camera-rendered JPEG of the shot, and
// for most bodies it is full size. That preview is what we convert, and
// the UI says so.
//
// Search order:
//  1. TIFF-structured RAWs (DNG, CR2, NEF, ARW, PEF, SRW, ERF, 3FR …): every
//     IFD and SubIFD, both as JPEGInterchangeFormat (513/514) and as
//     single-strip JPEG data (Compression 6/7 whose strip is a baseline or
//     progressive JFIF — never the lossless-JPEG raw data itself).
//  2. Anything else (ORF, RW2, RAF, CR3 …): scan the bytes for complete
//     JPEG streams, walking their segments.
// The candidate with the most pixels wins.
// Lazy chunk ("codec-" prefix: not precached).
import { intTag, readTiff, tiffOrientation, type Ifd, type TiffFile } from './codec-tiff-ifd'

export interface RawPreview {
  jpeg: Uint8Array
  width: number
  height: number
  /** Orientation from the RAW container (1 when unknown). */
  orientation: number
}

const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n))

/** RAW containers recognised by their bytes (TIFF-based ones are told apart by the caller). */
export function sniffRawHead(b: Uint8Array): boolean {
  if (b.length < 16) return false
  if (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0 && b[8] === 0x43 && b[9] === 0x52) return true // CR2
  if (ascii(b, 0, 4) === 'IIRO' || ascii(b, 0, 4) === 'IIRS' || ascii(b, 0, 4) === 'MMOR') return true // ORF
  if (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x55 && b[3] === 0) return true // RW2 / RWL
  if (ascii(b, 0, 15) === 'FUJIFILMCCD-RAW') return true // RAF
  if (ascii(b, 4, 8) === 'ftypcrx ') return true // CR3
  return false
}

/** JPEG SOF dimensions, and whether it is a baseline/progressive (displayable) stream. */
export function jpegInfo(b: Uint8Array, at: number, end: number): { width: number; height: number; end: number } | null {
  if (b[at] !== 0xff || b[at + 1] !== 0xd8) return null
  let p = at + 2
  let width = 0
  let height = 0
  while (p + 4 <= end) {
    if (b[p] !== 0xff) return null
    const m = b[p + 1]
    if (m === 0xff) { p++; continue }
    if (m === 0xd9) return null
    if (m >= 0xd0 && m <= 0xd7) { p += 2; continue }
    const len = (b[p + 2] << 8) | b[p + 3]
    if (len < 2) return null
    // SOF0/1/2 decode in every browser; SOF3 (lossless, the raw data of
    // DNG/CR2) and arithmetic SOFs do not.
    if (m === 0xc0 || m === 0xc1 || m === 0xc2) {
      height = (b[p + 5] << 8) | b[p + 6]
      width = (b[p + 7] << 8) | b[p + 8]
    } else if ((m >= 0xc3 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return null
    if (m === 0xda) {
      if (!width || !height) return null
      // Entropy-coded data: find EOI (0xFFD9), skipping stuffed 0xFF00 and RSTn.
      let q = p + 2 + len
      while (q + 1 < end) {
        if (b[q] === 0xff) {
          const n = b[q + 1]
          if (n === 0xd9) return { width, height, end: q + 2 }
          if (n === 0x00 || (n >= 0xd0 && n <= 0xd7) || n === 0xff) { q += n === 0xff ? 1 : 2; continue }
          // Another marker after scan (progressive: DHT/SOS …): keep walking segments.
          p = q
          break
        }
        q++
      }
      if (q + 1 >= end) return null
      continue
    }
    p += 2 + len
  }
  return null
}

function tiffCandidates(t: TiffFile): { at: number; len: number }[] {
  const out: { at: number; len: number }[] = []
  const visit = (ifd: Ifd) => {
    const jif = intTag(t, ifd, 513)
    const jifLen = intTag(t, ifd, 514)
    if (jif && jifLen) out.push({ at: jif, len: jifLen })
    const comp = intTag(t, ifd, 259)
    const off = intTag(t, ifd, 273)
    const cnt = intTag(t, ifd, 279)
    const strips = ifd.entries.get(273)?.count ?? 0
    if ((comp === 6 || comp === 7 || comp === 99) && off && cnt && strips === 1) out.push({ at: off, len: cnt })
    ifd.sub.forEach(visit)
  }
  t.ifds.forEach(visit)
  // NEF / ARW keep more previews behind the Exif IFD's maker note; the
  // generic scan below finds those when the IFDs hold nothing usable.
  return out
}

function scanJpegs(b: Uint8Array): { at: number; len: number }[] {
  const out: { at: number; len: number }[] = []
  for (let i = 0; i + 3 < b.length; i++) {
    if (b[i] !== 0xff || b[i + 1] !== 0xd8 || b[i + 2] !== 0xff) continue
    const info = jpegInfo(b, i, b.length)
    if (!info) continue
    out.push({ at: i, len: info.end - i })
    i = info.end - 1
  }
  return out
}

/** Largest displayable embedded JPEG, or null. */
export function extractRawPreview(b: Uint8Array): RawPreview | null {
  const t = readTiff(b)
  const orientation = t ? tiffOrientation(t) : 1
  let best: RawPreview | null = null
  const consider = (c: { at: number; len: number }) => {
    if (c.at + c.len > b.length) return
    const info = jpegInfo(b, c.at, c.at + c.len)
    if (!info) return
    if (!best || info.width * info.height > best.width * best.height) {
      best = { jpeg: b.subarray(c.at, info.end), width: info.width, height: info.height, orientation }
    }
  }
  if (t) tiffCandidates(t).forEach(consider)
  // Nothing usable in the IFDs (or a non-TIFF RAW): scan the bytes.
  if (!best || (best as RawPreview).width * (best as RawPreview).height < 640 * 480) scanJpegs(b).forEach(consider)
  return best
}

/** DNG: IFD0 carries DNGVersion (50706). */
export function isDng(t: TiffFile): boolean {
  return t.ifds[0].entries.has(50706)
}

/** Whether a JPEG carries an EXIF Orientation tag (then the browser applies it). */
export function jpegHasOrientation(b: Uint8Array): boolean {
  let p = 2
  while (p + 4 <= b.length && b[p] === 0xff) {
    const m = b[p + 1]
    const len = (b[p + 2] << 8) | b[p + 3]
    if (m === 0xda || len < 2) break
    if (m === 0xe1 && b[p + 4] === 0x45 && b[p + 5] === 0x78 && b[p + 6] === 0x69 && b[p + 7] === 0x66) {
      const t = p + 10
      const le = b[t] === 0x49
      const u16 = (o: number) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1])
      const u32 = (o: number) => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0)
      const ifd = t + u32(t + 4)
      if (ifd + 2 > p + 2 + len) return false
      const n = u16(ifd)
      for (let i = 0; i < n; i++) if (u16(ifd + 2 + i * 12) === 0x0112) return true
      return false
    }
    p += 2 + len
  }
  return false
}
