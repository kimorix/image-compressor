// QOI ("Quite OK Image", qoiformat.org) in and out: lossless RGBA in a
// few dozen lines. Encoder writes 4 channels when the image has alpha,
// 3 otherwise; colorspace byte 0 (sRGB with linear alpha).
// Lazy chunk ("codec-" prefix: not precached).

export interface Rgba {
  data: Uint8ClampedArray
  width: number
  height: number
}

const hash = (r: number, g: number, b: number, a: number) => (r * 3 + g * 5 + b * 7 + a * 11) % 64

export function isQoi(b: Uint8Array): boolean {
  return b.length >= 14 && b[0] === 0x71 && b[1] === 0x6f && b[2] === 0x69 && b[3] === 0x66
}

export function decodeQoi(b: Uint8Array): Rgba {
  if (!isQoi(b)) throw new Error('not a QOI')
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const w = dv.getUint32(4)
  const h = dv.getUint32(8)
  if (!w || !h || w * h > 400_000_000) throw new Error('bad QOI size')
  const out = new Uint8ClampedArray(w * h * 4)
  const index = new Uint8Array(256)
  let r = 0, g = 0, bl = 0, a = 255, run = 0
  let p = 14
  const end = b.length - 8
  for (let o = 0; o < out.length; o += 4) {
    if (run > 0) run--
    else if (p < end) {
      const b1 = b[p++]
      if (b1 === 0xfe) { r = b[p++]; g = b[p++]; bl = b[p++] }
      else if (b1 === 0xff) { r = b[p++]; g = b[p++]; bl = b[p++]; a = b[p++] }
      else if ((b1 & 0xc0) === 0x00) { const i = b1 * 4; r = index[i]; g = index[i + 1]; bl = index[i + 2]; a = index[i + 3] }
      else if ((b1 & 0xc0) === 0x40) { r = (r + ((b1 >> 4) & 3) - 2) & 255; g = (g + ((b1 >> 2) & 3) - 2) & 255; bl = (bl + (b1 & 3) - 2) & 255 }
      else if ((b1 & 0xc0) === 0x80) {
        const b2 = b[p++]
        const vg = (b1 & 0x3f) - 32
        r = (r + vg - 8 + ((b2 >> 4) & 0x0f)) & 255
        g = (g + vg) & 255
        bl = (bl + vg - 8 + (b2 & 0x0f)) & 255
      } else run = b1 & 0x3f
      const i = hash(r, g, bl, a) * 4
      index[i] = r; index[i + 1] = g; index[i + 2] = bl; index[i + 3] = a
    }
    out[o] = r; out[o + 1] = g; out[o + 2] = bl; out[o + 3] = a
  }
  return { data: out, width: w, height: h }
}

export function encodeQoi(img: { data: Uint8Array | Uint8ClampedArray; width: number; height: number }, alpha: boolean): Uint8Array {
  const { width: w, height: h, data: d } = img
  const px = w * h
  const out = new Uint8Array(14 + px * (alpha ? 5 : 4) + 8)
  const dv = new DataView(out.buffer)
  out.set([0x71, 0x6f, 0x69, 0x66])
  dv.setUint32(4, w)
  dv.setUint32(8, h)
  out[12] = alpha ? 4 : 3
  out[13] = 0
  let p = 14
  const index = new Uint8Array(256)
  let pr = 0, pg = 0, pb = 0, pa = 255, run = 0
  for (let i = 0, o = 0; i < px; i++, o += 4) {
    const r = d[o], g = d[o + 1], b = d[o + 2], a = alpha ? d[o + 3] : 255
    if (r === pr && g === pg && b === pb && a === pa) {
      run++
      if (run === 62 || i === px - 1) { out[p++] = 0xc0 | (run - 1); run = 0 }
      continue
    }
    if (run > 0) { out[p++] = 0xc0 | (run - 1); run = 0 }
    const h6 = hash(r, g, b, a)
    const k = h6 * 4
    if (index[k] === r && index[k + 1] === g && index[k + 2] === b && index[k + 3] === a) out[p++] = h6
    else {
      index[k] = r; index[k + 1] = g; index[k + 2] = b; index[k + 3] = a
      if (a === pa) {
        const vr = ((r - pr + 384) & 255) - 128
        const vg = ((g - pg + 384) & 255) - 128
        const vb = ((b - pb + 384) & 255) - 128
        const vgr = vr - vg
        const vgb = vb - vg
        if (vr > -3 && vr < 2 && vg > -3 && vg < 2 && vb > -3 && vb < 2) out[p++] = 0x40 | ((vr + 2) << 4) | ((vg + 2) << 2) | (vb + 2)
        else if (vgr > -9 && vgr < 8 && vg > -33 && vg < 32 && vgb > -9 && vgb < 8) { out[p++] = 0x80 | (vg + 32); out[p++] = ((vgr + 8) << 4) | (vgb + 8) }
        else { out[p++] = 0xfe; out[p++] = r; out[p++] = g; out[p++] = b }
      } else { out[p++] = 0xff; out[p++] = r; out[p++] = g; out[p++] = b; out[p++] = a }
    }
    pr = r; pg = g; pb = b; pa = a
  }
  out.set([0, 0, 0, 0, 0, 0, 0, 1], p)
  return out.slice(0, p + 8)
}
