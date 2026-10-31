// Small TIFF structure reader shared by the TIFF-based inputs of the
// format converter (multi-page TIFF, DNG and the TIFF-based camera RAWs):
// walk the IFD chain (and SubIFDs), count pages, rebuild a compact EXIF
// block from a whole TIFF file, and apply an Orientation tag to RGBA
// pixels. No pixel decoding here (codec-tiff.ts does that with UTIF).
//
// Lazy: only imported when a TIFF / RAW file is converted (the file name
// prefix keeps the chunk out of the service-worker precache).

export interface IfdEntry {
  tag: number
  type: number
  count: number
  /** Absolute offset of the value bytes (inline or pointed to). */
  valueOffset: number
}

export interface Ifd {
  offset: number
  entries: Map<number, IfdEntry>
  /** SubIFDs (tag 330) of this IFD, parsed recursively. */
  sub: Ifd[]
}

export interface TiffFile {
  le: boolean
  ifds: Ifd[]
  bytes: Uint8Array
}

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4, 16: 8, 17: 8, 18: 8 }

/** Classic TIFF header ("II*\0" / "MM\0*"). BigTIFF is not handled. */
export function isTiffHeader(b: Uint8Array): boolean {
  return b.length >= 8 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a))
}

export function reader(b: Uint8Array, le: boolean) {
  const u16 = (o: number) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1])
  const u32 = (o: number) => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0)
  return { u16, u32 }
}

function parseIfd(b: Uint8Array, le: boolean, at: number, depth: number, seen: Set<number>): Ifd | null {
  if (at < 8 || at + 2 > b.length || seen.has(at)) return null
  seen.add(at)
  const { u16, u32 } = reader(b, le)
  const n = u16(at)
  if (n === 0 || at + 2 + n * 12 > b.length) return null
  const entries = new Map<number, IfdEntry>()
  for (let i = 0; i < n; i++) {
    const e = at + 2 + i * 12
    const tag = u16(e)
    const type = u16(e + 2)
    const count = u32(e + 4)
    const size = (TYPE_SIZE[type] ?? 0) * count
    if (!TYPE_SIZE[type]) continue
    const valueOffset = size <= 4 ? e + 8 : u32(e + 8)
    if (valueOffset + size > b.length) continue
    entries.set(tag, { tag, type, count, valueOffset })
  }
  const ifd: Ifd = { offset: at, entries, sub: [] }
  const subTag = entries.get(330)
  if (subTag && depth < 3) {
    for (const off of readInts(b, le, subTag)) {
      const s = parseIfd(b, le, off, depth + 1, seen)
      if (s) ifd.sub.push(s)
    }
  }
  return ifd
}

/** Parse the main IFD chain (max 512 pages); null when not a TIFF. */
export function readTiff(b: Uint8Array): TiffFile | null {
  if (!isTiffHeader(b)) return null
  const le = b[0] === 0x49
  const { u16, u32 } = reader(b, le)
  const ifds: Ifd[] = []
  const seen = new Set<number>()
  let at = u32(4)
  while (at && ifds.length < 512) {
    const ifd = parseIfd(b, le, at, 0, seen)
    if (!ifd) break
    ifds.push(ifd)
    const nextAt = at + 2 + u16(at) * 12
    if (nextAt + 4 > b.length) break
    at = u32(nextAt)
  }
  return ifds.length ? { le, ifds, bytes: b } : null
}

/** Integer values of an entry (BYTE / SHORT / LONG / IFD). */
export function readInts(b: Uint8Array, le: boolean, e: IfdEntry | undefined, max = 4096): number[] {
  if (!e) return []
  const { u16, u32 } = reader(b, le)
  const out: number[] = []
  const n = Math.min(e.count, max)
  for (let i = 0; i < n; i++) {
    if (e.type === 3 || e.type === 8) out.push(u16(e.valueOffset + i * 2))
    else if (e.type === 4 || e.type === 9 || e.type === 13) out.push(u32(e.valueOffset + i * 4))
    else if (e.type === 1 || e.type === 6 || e.type === 7) out.push(b[e.valueOffset + i])
    else break
  }
  return out
}

export function intTag(t: TiffFile, ifd: Ifd, tag: number): number | null {
  const v = readInts(t.bytes, t.le, ifd.entries.get(tag), 1)
  return v.length ? v[0] : null
}

/**
 * Full-resolution pages: IFDs with a size that are not marked as reduced
 * resolution (NewSubfileType bit 0) — scanners and Photoshop add those as
 * thumbnails, and they are not pages.
 */
export function tiffPageIndexes(t: TiffFile): number[] {
  const out: number[] = []
  t.ifds.forEach((ifd, i) => {
    if (intTag(t, ifd, 256) === null || intTag(t, ifd, 257) === null) return
    const nst = intTag(t, ifd, 254) ?? 0
    if (nst & 1) return
    out.push(i)
  })
  return out
}

/** Page count of a TIFF file (1 for anything unreadable). */
export function tiffPageCount(b: Uint8Array): number {
  const t = readTiff(b)
  if (!t) return 1
  return Math.max(1, tiffPageIndexes(t).length)
}

/** IFD0 Orientation (1–8; 1 when absent). */
export function tiffOrientation(t: TiffFile): number {
  const v = intTag(t, t.ifds[0], 274)
  return v && v >= 1 && v <= 8 ? v : 1
}

// ---- EXIF block from a whole TIFF / RAW file ----
// A TIFF file *is* a TIFF structure, but handing all of it to piexif would
// copy strip offsets, SubIFDs, DNG private data and maker notes (whose
// offsets would dangle). Rebuild a compact TIFF instead: IFD0 keeps the
// descriptive tags only, the Exif sub-IFD keeps its plain tags (no
// MakerNote, no Interop pointer), and GPS is never copied. sanitizeExif()
// then applies the usual rules (Orientation = 1, no thumbnail).

const IFD0_KEEP = new Set([270, 271, 272, 305, 306, 315, 33432])
const EXIF_DROP = new Set([37500 /* MakerNote */, 40965 /* Interop pointer */])

interface OutEntry { tag: number; type: number; count: number; data: Uint8Array }

function collect(t: TiffFile, ifd: Ifd, keep: (tag: number) => boolean): OutEntry[] {
  const out: OutEntry[] = []
  for (const e of [...ifd.entries.values()].sort((a, b) => a.tag - b.tag)) {
    if (!keep(e.tag)) continue
    const size = (TYPE_SIZE[e.type] ?? 0) * e.count
    if (!size || size > 65536) continue
    out.push({ tag: e.tag, type: e.type, count: e.count, data: t.bytes.slice(e.valueOffset, e.valueOffset + size) })
  }
  return out
}

/** Compact EXIF TIFF block (same byte order) or null when nothing is worth keeping. */
export function exifFromTiff(b: Uint8Array): Uint8Array | null {
  const t = readTiff(b)
  if (!t) return null
  const ifd0 = t.ifds[0]
  const zeroth = collect(t, ifd0, (tag) => IFD0_KEEP.has(tag))
  const exifPtr = intTag(t, ifd0, 34665)
  let exif: OutEntry[] = []
  if (exifPtr) {
    const sub = parseIfd(b, t.le, exifPtr, 3, new Set())
    if (sub) exif = collect(t, sub, (tag) => !EXIF_DROP.has(tag))
  }
  if (!zeroth.length && !exif.length) return null
  // Layout: header, IFD0 (+ Exif pointer), IFD0 values, Exif IFD, Exif values.
  const ifdSize = (n: number) => 2 + n * 12 + 4
  const valSize = (es: OutEntry[]) => es.reduce((s, e) => s + (e.data.length > 4 ? e.data.length + (e.data.length & 1) : 0), 0)
  const n0 = zeroth.length + (exif.length ? 1 : 0)
  const ifd0At = 8
  const val0At = ifd0At + ifdSize(n0)
  const exifAt = val0At + valSize(zeroth)
  const valEAt = exifAt + (exif.length ? ifdSize(exif.length) : 0)
  const total = valEAt + valSize(exif)
  const out = new Uint8Array(total)
  const dv = new DataView(out.buffer)
  const le = t.le
  out[0] = out[1] = le ? 0x49 : 0x4d
  dv.setUint16(2, 42, le)
  dv.setUint32(4, ifd0At, le)
  const writeIfd = (at: number, es: OutEntry[], valAt: number, extra?: OutEntry) => {
    const all = extra ? [...es, extra].sort((a, b) => a.tag - b.tag) : es
    dv.setUint16(at, all.length, le)
    let v = valAt
    all.forEach((e, i) => {
      const p = at + 2 + i * 12
      dv.setUint16(p, e.tag, le)
      dv.setUint16(p + 2, e.type, le)
      dv.setUint32(p + 4, e.count, le)
      if (e.data.length <= 4) out.set(e.data, p + 8)
      else {
        dv.setUint32(p + 8, v, le)
        out.set(e.data, v)
        v += e.data.length + (e.data.length & 1)
      }
    })
    dv.setUint32(at + 2 + all.length * 12, 0, le)
  }
  let ptr: OutEntry | undefined
  if (exif.length) {
    const d = new Uint8Array(4)
    new DataView(d.buffer).setUint32(0, exifAt, le)
    ptr = { tag: 34665, type: 4, count: 1, data: d }
  }
  writeIfd(ifd0At, zeroth, val0At, ptr)
  if (exif.length) writeIfd(exifAt, exif, valEAt)
  return out
}

// ---- Orientation on RGBA pixels ----

/** Apply an EXIF/TIFF Orientation (1–8) to RGBA pixels; returns the upright image. */
export function orientRgba(data: Uint8ClampedArray | Uint8Array, w: number, h: number, o: number): { data: Uint8ClampedArray; width: number; height: number } {
  let src = data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)
  if (o < 2 || o > 8) return { data: src, width: w, height: h }
  if (src.byteOffset % 4) src = src.slice()
  const swap = o >= 5
  const W = swap ? h : w
  const H = swap ? w : h
  const out = new Uint8ClampedArray(W * H * 4)
  const s32 = new Uint32Array(src.buffer, src.byteOffset, w * h)
  const d32 = new Uint32Array(out.buffer)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let X: number, Y: number
      switch (o) {
        case 2: X = w - 1 - x; Y = y; break
        case 3: X = w - 1 - x; Y = h - 1 - y; break
        case 4: X = x; Y = h - 1 - y; break
        case 5: X = y; Y = x; break
        case 6: X = h - 1 - y; Y = x; break
        case 7: X = h - 1 - y; Y = w - 1 - x; break
        default: X = y; Y = w - 1 - x // 8
      }
      d32[Y * W + X] = s32[y * w + x]
    }
  }
  return { data: out, width: W, height: H }
}
