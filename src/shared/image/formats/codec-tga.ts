// TGA (Truevision Targa) reader: colour-mapped, true-colour and greyscale,
// raw or RLE (types 1, 2, 3, 9, 10, 11), 8/15/16/24/32 bits, any origin.
// TGA has no magic number, so `looksLikeTga` validates the header fields
// (used together with the file extension or the TGA 2.0 footer).
// Lazy chunk ("codec-" prefix: not precached).

export interface Rgba {
  data: Uint8ClampedArray
  width: number
  height: number
}

const le16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8)

/** TGA 2.0 files end with "TRUEVISION-XFILE.\0". */
export function hasTgaFooter(tail: Uint8Array): boolean {
  if (tail.length < 18) return false
  const s = String.fromCharCode(...tail.subarray(tail.length - 18, tail.length - 2))
  return s === 'TRUEVISION-XFILE'
}

/** Header sanity check (TGA has no signature). */
export function looksLikeTga(b: Uint8Array): boolean {
  if (b.length < 18) return false
  const cmType = b[1]
  const type = b[2]
  const cmDepth = b[7]
  const w = le16(b, 12)
  const h = le16(b, 14)
  const depth = b[16]
  if (![1, 2, 3, 9, 10, 11].includes(type) || cmType > 1 || !w || !h) return false
  if ((type === 1 || type === 9) && (cmType !== 1 || ![15, 16, 24, 32].includes(cmDepth) || depth !== 8)) return false
  if ((type === 2 || type === 10) && ![15, 16, 24, 32].includes(depth)) return false
  if ((type === 3 || type === 11) && depth !== 8 && depth !== 16) return false
  return (b[17] & 0xc0) === 0
}

export function decodeTga(b: Uint8Array): Rgba {
  if (!looksLikeTga(b)) throw new Error('not a TGA')
  const idLen = b[0]
  const type = b[2]
  const cmFirst = le16(b, 3)
  const cmLen = le16(b, 5)
  const cmDepth = b[7]
  const w = le16(b, 12)
  const h = le16(b, 14)
  const depth = b[16]
  const desc = b[17]
  const attrBits = desc & 0x0f
  const topDown = (desc & 0x20) !== 0
  const rightToLeft = (desc & 0x10) !== 0
  let p = 18 + idLen

  const readColor = (bits: number, at: number, out: number[]) => {
    if (bits === 24) { out[0] = b[at + 2]; out[1] = b[at + 1]; out[2] = b[at]; out[3] = 255 }
    else if (bits === 32) { out[0] = b[at + 2]; out[1] = b[at + 1]; out[2] = b[at]; out[3] = b[at + 3] }
    else { // 15/16: ARRRRRGG GGGBBBBB
      const v = le16(b, at)
      out[0] = (((v >> 10) & 31) * 255 / 31) | 0
      out[1] = (((v >> 5) & 31) * 255 / 31) | 0
      out[2] = ((v & 31) * 255 / 31) | 0
      out[3] = bits === 16 && attrBits ? (v & 0x8000 ? 255 : 0) : 255
    }
  }

  const palette: number[][] = []
  if (b[1] === 1) {
    const eb = Math.ceil(cmDepth / 8)
    for (let i = 0; i < cmLen; i++) {
      const c = [0, 0, 0, 255]
      readColor(cmDepth, p + i * eb, c)
      palette[cmFirst + i] = c
    }
    p += cmLen * eb
  }

  const n = w * h
  const bpp = Math.ceil(depth / 8)
  const px = new Uint8ClampedArray(n * 4)
  const c = [0, 0, 0, 255]
  const pixel = (at: number) => {
    if (type === 1 || type === 9) {
      const e = palette[b[at]] ?? [0, 0, 0, 255]
      c[0] = e[0]; c[1] = e[1]; c[2] = e[2]; c[3] = e[3]
    } else if (type === 3 || type === 11) {
      c[0] = c[1] = c[2] = b[at]
      c[3] = depth === 16 && attrBits ? b[at + 1] : 255
    } else readColor(depth, at, c)
  }
  const rle = type >= 9
  let i = 0
  while (i < n) {
    if (rle) {
      if (p >= b.length) break
      const hdr = b[p++]
      const count = (hdr & 0x7f) + 1
      if (hdr & 0x80) {
        pixel(p)
        p += bpp
        for (let k = 0; k < count && i < n; k++, i++) px.set(c, i * 4)
      } else {
        for (let k = 0; k < count && i < n; k++, i++, p += bpp) { pixel(p); px.set(c, i * 4) }
      }
    } else {
      if (p + bpp > b.length) break
      pixel(p)
      px.set(c, i * 4)
      p += bpp
      i++
    }
  }

  // 32-bit files without alpha attribute bits often carry garbage (or all
  // zero) in the fourth byte: only trust it when the header declares it,
  // and never let an all-transparent result hide the picture.
  if (depth === 32 && (!attrBits || allZeroAlpha(px))) for (let k = 3; k < px.length; k += 4) px[k] = 255

  // Reorder to top-left origin.
  const out = new Uint8ClampedArray(n * 4)
  for (let y = 0; y < h; y++) {
    const sy = topDown ? y : h - 1 - y
    for (let x = 0; x < w; x++) {
      const sx = rightToLeft ? w - 1 - x : x
      const s = (sy * w + sx) * 4
      const o = (y * w + x) * 4
      out[o] = px[s]; out[o + 1] = px[s + 1]; out[o + 2] = px[s + 2]; out[o + 3] = px[s + 3]
    }
  }
  return { data: out, width: w, height: h }
}

function allZeroAlpha(px: Uint8ClampedArray): boolean {
  for (let k = 3; k < px.length; k += 4) if (px[k]) return false
  return true
}
