// ICO / CUR in and out for the format converter.
//
// Read: pick the largest entry (then the deepest colour). A PNG entry is
// handed back as PNG bytes (the browser decodes it); a BMP (DIB) entry is
// decoded here: 1/4/8-bit palette, 24-bit and 32-bit, with the AND mask
// for transparency when the image has no alpha channel of its own.
//
// Write: a multi-size favicon. Each size is the image fitted into a square
// (centred, transparent padding), area-averaged in premultiplied alpha so
// edges do not darken, and stored as PNG ("PNG-in-ICO", Windows Vista+,
// every browser). Sizes larger than the source are skipped (no blurry
// upscales) unless none would be left.
//
// Lazy chunk ("codec-" prefix: not precached).

export interface Rgba {
  data: Uint8ClampedArray
  width: number
  height: number
}

export interface IcoEntry {
  width: number
  height: number
  bitCount: number
  offset: number
  size: number
}

const le16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8)
const le32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
const isPng = (b: Uint8Array, o: number) => b[o] === 0x89 && b[o + 1] === 0x50 && b[o + 2] === 0x4e && b[o + 3] === 0x47

/** Directory of an ICO (type 1) or CUR (type 2) file; null when not one. */
export function readIcoDir(b: Uint8Array): IcoEntry[] | null {
  if (b.length < 6 || le16(b, 0) !== 0 || (le16(b, 2) !== 1 && le16(b, 2) !== 2)) return null
  const n = le16(b, 4)
  if (!n || 6 + n * 16 > b.length) return null
  const out: IcoEntry[] = []
  for (let i = 0; i < n; i++) {
    const e = 6 + i * 16
    const size = le32(b, e + 8)
    const offset = le32(b, e + 12)
    if (offset + size > b.length || size < 8) continue
    // Real size from the payload (directory bytes are 0 for 256 and often wrong).
    let width = b[e] || 256
    let height = b[e + 1] || 256
    let bitCount = le16(b, e + 6)
    if (isPng(b, offset) && size >= 24) {
      width = (b[offset + 16] << 24 | b[offset + 17] << 16 | b[offset + 18] << 8 | b[offset + 19]) >>> 0
      height = (b[offset + 20] << 24 | b[offset + 21] << 16 | b[offset + 22] << 8 | b[offset + 23]) >>> 0
      bitCount = 32
    } else if (le32(b, offset) >= 40) {
      width = Math.abs(le32(b, offset + 4) | 0)
      height = Math.abs(le32(b, offset + 8) | 0) / 2
      bitCount = le16(b, offset + 14) || bitCount
    }
    out.push({ width, height, bitCount, offset, size })
  }
  return out.length ? out : null
}

/** The entry an image viewer would show at full size: largest, then deepest. */
export function pickLargest(entries: IcoEntry[]): IcoEntry {
  return [...entries].sort((a, b) => b.width * b.height - a.width * a.height || b.bitCount - a.bitCount)[0]
}

export type IcoImage = { kind: 'png'; bytes: Uint8Array; entry: IcoEntry; count: number } | { kind: 'rgba'; image: Rgba; entry: IcoEntry; count: number }

export function decodeIco(b: Uint8Array): IcoImage {
  const dir = readIcoDir(b)
  if (!dir) throw new Error('not an ICO')
  const e = pickLargest(dir)
  const body = b.subarray(e.offset, e.offset + e.size)
  if (isPng(body, 0)) return { kind: 'png', bytes: body, entry: e, count: dir.length }
  return { kind: 'rgba', image: decodeDib(body), entry: e, count: dir.length }
}

/** BITMAPINFOHEADER DIB as stored in an ICO (height doubled, AND mask after XOR). */
export function decodeDib(b: Uint8Array): Rgba {
  const hdr = le32(b, 0)
  const w = Math.abs(le32(b, 4) | 0)
  const h2 = le32(b, 8) | 0
  const h = Math.abs(h2) / 2
  const bpp = le16(b, 14)
  const compression = le32(b, 16)
  if (!w || !h || w > 4096 || h > 4096 || (compression !== 0 && compression !== 3)) throw new Error('unsupported ICO bitmap')
  let clrUsed = le32(b, 32)
  const palCount = bpp <= 8 ? (clrUsed || 1 << bpp) : 0
  let at = hdr + (compression === 3 && hdr === 40 ? 12 : 0)
  const palette: number[][] = []
  for (let i = 0; i < palCount; i++, at += 4) palette.push([b[at + 2], b[at + 1], b[at]])
  clrUsed = palCount
  const xorStride = ((w * bpp + 31) >> 5) << 2
  const andStride = ((w + 31) >> 5) << 2
  const xorAt = at
  const andAt = xorAt + xorStride * h
  const bottomUp = h2 > 0
  const out = new Uint8ClampedArray(w * h * 4)
  let anyAlpha = false
  for (let y = 0; y < h; y++) {
    const row = xorAt + (bottomUp ? h - 1 - y : y) * xorStride
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      let r = 0, g = 0, bl = 0, a = 255
      if (bpp === 32) { bl = b[row + x * 4]; g = b[row + x * 4 + 1]; r = b[row + x * 4 + 2]; a = b[row + x * 4 + 3]; if (a) anyAlpha = true }
      else if (bpp === 24) { bl = b[row + x * 3]; g = b[row + x * 3 + 1]; r = b[row + x * 3 + 2] }
      else if (bpp === 16) { const v = le16(b, row + x * 2); r = ((v >> 10) & 31) * 255 / 31 | 0; g = ((v >> 5) & 31) * 255 / 31 | 0; bl = (v & 31) * 255 / 31 | 0 }
      else {
        const bit = x * bpp
        const byte = b[row + (bit >> 3)]
        const idx = (byte >> (8 - bpp - (bit & 7))) & ((1 << bpp) - 1)
        const c = palette[idx] ?? [0, 0, 0]
        r = c[0]; g = c[1]; bl = c[2]
      }
      out[o] = r; out[o + 1] = g; out[o + 2] = bl; out[o + 3] = a
    }
  }
  // 32-bit with real alpha: the AND mask is redundant. Otherwise (or an
  // all-zero alpha channel, common in old 32-bit icons) the mask decides.
  const hasMask = andAt + andStride * h <= b.length
  if (bpp !== 32 || !anyAlpha) {
    for (let y = 0; y < h; y++) {
      const row = andAt + (bottomUp ? h - 1 - y : y) * andStride
      for (let x = 0; x < w; x++) {
        const masked = hasMask && (b[row + (x >> 3)] >> (7 - (x & 7))) & 1
        out[(y * w + x) * 4 + 3] = masked ? 0 : 255
      }
    }
  }
  return { data: out, width: w, height: h }
}

// ---- writer ----

export const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256] as const
export const DEFAULT_ICO_SIZES = [16, 32, 48, 64, 128, 256]

/** Sizes actually written for a source: no upscaling unless nothing would remain. */
export function icoPlan(srcW: number, srcH: number, wanted: number[]): number[] {
  const sizes = [...new Set(wanted.filter((s) => s >= 1 && s <= 256))].sort((a, b) => a - b)
  if (!sizes.length) return [Math.min(256, Math.max(srcW, srcH, 16))]
  const long = Math.max(srcW, srcH)
  const fit = sizes.filter((s) => s <= long)
  return fit.length ? fit : [sizes[0]]
}

/**
 * Resample to dw×dh by area averaging in premultiplied alpha (exact for
 * whole ratios, smooth for the rest; nearest-like when enlarging).
 */
export function resizeArea(img: { data: Uint8Array | Uint8ClampedArray; width: number; height: number }, dw: number, dh: number): Rgba {
  const { width: sw, height: sh, data: s } = img
  const out = new Uint8ClampedArray(dw * dh * 4)
  const fx = sw / dw
  const fy = sh / dh
  for (let y = 0; y < dh; y++) {
    const y0 = y * fy, y1 = y0 + fy
    for (let x = 0; x < dw; x++) {
      const x0 = x * fx, x1 = x0 + fx
      let r = 0, g = 0, b = 0, a = 0, wsum = 0
      for (let yy = Math.floor(y0); yy < Math.min(sh, Math.ceil(y1)); yy++) {
        const wy = Math.min(y1, yy + 1) - Math.max(y0, yy)
        if (wy <= 0) continue
        for (let xx = Math.floor(x0); xx < Math.min(sw, Math.ceil(x1)); xx++) {
          const wx = Math.min(x1, xx + 1) - Math.max(x0, xx)
          if (wx <= 0) continue
          const wgt = wx * wy
          const i = (yy * sw + xx) * 4
          const al = s[i + 3]
          r += s[i] * al * wgt
          g += s[i + 1] * al * wgt
          b += s[i + 2] * al * wgt
          a += al * wgt
          wsum += wgt
        }
      }
      const o = (y * dw + x) * 4
      if (a > 0) {
        out[o] = Math.round(r / a)
        out[o + 1] = Math.round(g / a)
        out[o + 2] = Math.round(b / a)
      }
      out[o + 3] = Math.round(a / wsum)
    }
  }
  return { data: out, width: dw, height: dh }
}

/** Fit the image into a size×size square: centred, transparent padding. */
export function fitSquare(img: { data: Uint8Array | Uint8ClampedArray; width: number; height: number }, size: number): Rgba {
  const scale = size / Math.max(img.width, img.height)
  const dw = Math.max(1, Math.round(img.width * scale))
  const dh = Math.max(1, Math.round(img.height * scale))
  const fitted = dw === img.width && dh === img.height ? { data: new Uint8ClampedArray(img.data), width: dw, height: dh } : resizeArea(img, dw, dh)
  if (dw === size && dh === size) return fitted
  const out = new Uint8ClampedArray(size * size * 4)
  const ox = (size - dw) >> 1
  const oy = (size - dh) >> 1
  for (let y = 0; y < dh; y++) out.set(fitted.data.subarray(y * dw * 4, (y + 1) * dw * 4), ((y + oy) * size + ox) * 4)
  return { data: out, width: size, height: size }
}

/** Assemble an ICO from PNG-encoded square images. */
export function assembleIco(images: { size: number; png: Uint8Array }[]): Uint8Array {
  const n = images.length
  let at = 6 + n * 16
  const total = images.reduce((s, i) => s + i.png.length, at)
  const out = new Uint8Array(total)
  const dv = new DataView(out.buffer)
  dv.setUint16(2, 1, true)
  dv.setUint16(4, n, true)
  images.forEach((img, i) => {
    const e = 6 + i * 16
    out[e] = img.size >= 256 ? 0 : img.size
    out[e + 1] = img.size >= 256 ? 0 : img.size
    dv.setUint16(e + 4, 1, true) // planes
    dv.setUint16(e + 6, 32, true) // bit count
    dv.setUint32(e + 8, img.png.length, true)
    dv.setUint32(e + 12, at, true)
    out.set(img.png, at)
    at += img.png.length
  })
  return out
}

/**
 * Multi-size ICO; `encodePng` is the lossless PNG writer (injected, so
 * this chunk stays small), called in 32-bit RGBA mode by the converter.
 */
export async function encodeIco(
  img: { data: Uint8Array | Uint8ClampedArray; width: number; height: number },
  wanted: number[],
  encodePng: (img: Rgba) => Promise<ArrayBuffer>,
): Promise<{ bytes: Uint8Array; sizes: number[] }> {
  const sizes = icoPlan(img.width, img.height, wanted)
  // A large photo is first area-reduced to a 1024 px long side: every icon
  // size then samples that (the result differs from a direct reduction by
  // well under one level, at a fraction of the cost).
  const long = Math.max(img.width, img.height)
  const base = long > 1024
    ? resizeArea(img, Math.max(1, Math.round((img.width * 1024) / long)), Math.max(1, Math.round((img.height * 1024) / long)))
    : img
  const images: { size: number; png: Uint8Array }[] = []
  for (const size of sizes) {
    const sq = fitSquare(base, size)
    images.push({ size, png: new Uint8Array(await encodePng(sq)) })
  }
  return { bytes: assembleIco(images), sizes }
}
