// PSD / PSB reader: the flattened composite ("Image Data" section) that
// Photoshop stores at the end of the file — what you see with every layer
// merged. Layers themselves are not rendered. Supported: Bitmap, Greyscale,
// Indexed, RGB, CMYK and Duotone (read as grey); 1/8/16/32-bit; raw or
// PackBits. The composite only exists when the file was saved with
// "Maximize compatibility" (Photoshop's default); otherwise it is blank
// white and `decodePsd` reports that with `empty`.
//
// Transparency: the merged image carries it in its first extra channel
// when the layer section says so (negative layer count), which is how
// Photoshop saves a document whose background is transparent.
// Lazy chunk ("codec-" prefix: not precached).

export interface Rgba {
  data: Uint8ClampedArray
  width: number
  height: number
}

export function isPsd(b: Uint8Array): boolean {
  return b.length >= 26 && b[0] === 0x38 && b[1] === 0x42 && b[2] === 0x50 && b[3] === 0x53 && (b[5] === 1 || b[5] === 2)
}

export class PsdError extends Error {}

/** Composite as RGBA; `empty` = layered file whose composite is blank. */
export function decodePsd(b: Uint8Array): Rgba & { empty: boolean } {
  if (!isPsd(b)) throw new PsdError('not a PSD')
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const psb = b[5] === 2
  const channels = dv.getUint16(12)
  const h = dv.getUint32(14)
  const w = dv.getUint32(18)
  const depth = dv.getUint16(22)
  const mode = dv.getUint16(24)
  if (!w || !h || ![1, 8, 16, 32].includes(depth)) throw new PsdError('unsupported PSD depth')
  if (![0, 1, 2, 3, 4, 8].includes(mode)) throw new PsdError('unsupported PSD colour mode')
  let p = 26
  const cmLen = dv.getUint32(p)
  const colorData = b.subarray(p + 4, p + 4 + cmLen)
  p += 4 + cmLen
  p += 4 + dv.getUint32(p) // image resources
  // Layer and mask information: only the layer count's sign matters here.
  let mergedAlpha = false
  let layers = 0
  const lmLen = psb ? Number(dv.getBigUint64(p)) : dv.getUint32(p)
  const lmStart = p + (psb ? 8 : 4)
  if (lmLen >= (psb ? 10 : 6)) {
    const liLen = psb ? Number(dv.getBigUint64(lmStart)) : dv.getUint32(lmStart)
    if (liLen >= 2) {
      layers = dv.getInt16(lmStart + (psb ? 8 : 4))
      mergedAlpha = layers < 0
    }
  }
  p = lmStart + lmLen
  if (p + 2 > b.length) throw new PsdError('truncated PSD')
  const compression = dv.getUint16(p)
  p += 2
  if (compression !== 0 && compression !== 1) throw new PsdError('unsupported PSD compression')

  const bytesPerSample = depth === 1 ? 0 : depth / 8
  const rowBytes = depth === 1 ? (w + 7) >> 3 : w * bytesPerSample
  const plane = rowBytes * h
  const colorChannels = mode === 4 ? 4 : mode === 3 ? 3 : 1
  const used = Math.min(channels, colorChannels + (mergedAlpha ? 1 : 0))
  const planes: Uint8Array[] = []
  if (compression === 0) {
    for (let c = 0; c < used; c++) {
      const at = p + c * plane
      if (at + plane > b.length) throw new PsdError('truncated PSD')
      planes.push(b.subarray(at, at + plane))
    }
  } else {
    const cntSize = psb ? 4 : 2
    const counts = p
    let data = p + channels * h * cntSize
    for (let c = 0; c < channels; c++) {
      const out = c < used ? new Uint8Array(plane) : null
      for (let y = 0; y < h; y++) {
        const k = counts + (c * h + y) * cntSize
        const len = psb ? dv.getUint32(k) : dv.getUint16(k)
        if (out) unpackBits(b, data, len, out, y * rowBytes, rowBytes)
        data += len
      }
      if (out) planes.push(out)
      else break
    }
    if (planes.length < used) throw new PsdError('truncated PSD')
  }

  const sample = (pl: Uint8Array, i: number): number => {
    if (depth === 8) return pl[i]
    if (depth === 16) return pl[i * 2]
    if (depth === 32) {
      const v = new DataView(pl.buffer, pl.byteOffset + i * 4, 4).getFloat32(0)
      // 32-bit documents are linear: encode to sRGB.
      const x = Math.min(1, Math.max(0, v))
      return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055))
    }
    return (pl[(Math.floor(i / w) * rowBytes) + ((i % w) >> 3)] >> (7 - ((i % w) & 7))) & 1 ? 0 : 255 // bitmap: 1 = black
  }

  const n = w * h
  const out = new Uint8ClampedArray(n * 4)
  let empty = true
  for (let i = 0; i < n; i++) {
    const o = i * 4
    let r: number, g: number, bl: number
    if (mode === 3) { r = sample(planes[0], i); g = sample(planes[1], i); bl = sample(planes[2], i) }
    else if (mode === 4) {
      // PSD stores CMYK inverted (255 = no ink): RGB = (inverted C) × (inverted K).
      const k = sample(planes[3], i) / 255
      r = Math.round(sample(planes[0], i) * k)
      g = Math.round(sample(planes[1], i) * k)
      bl = Math.round(sample(planes[2], i) * k)
    } else if (mode === 2) {
      const idx = sample(planes[0], i)
      r = colorData[idx] ?? 0; g = colorData[256 + idx] ?? 0; bl = colorData[512 + idx] ?? 0
    } else { r = g = bl = sample(planes[0], i) }
    out[o] = r; out[o + 1] = g; out[o + 2] = bl
    out[o + 3] = used > colorChannels ? sample(planes[colorChannels], i) : 255
    if (empty && (r !== 255 || g !== 255 || bl !== 255)) empty = false
  }
  // A blank white composite in a layered file means it was saved without
  // "Maximize compatibility": the layers hold the picture, the composite
  // does not.
  return { data: out, width: w, height: h, empty: empty && layers !== 0 }
}

/** PackBits: n >= 0 copies n+1 bytes, n < 0 repeats the next byte 1-n times. */
function unpackBits(src: Uint8Array, at: number, len: number, dst: Uint8Array, d: number, want: number) {
  const end = Math.min(src.length, at + len)
  const stop = d + want
  while (at < end && d < stop) {
    const n = (src[at++] << 24) >> 24
    if (n >= 0) {
      const k = Math.min(n + 1, stop - d, end - at)
      dst.set(src.subarray(at, at + k), d)
      d += k
      at += n + 1
    } else if (n !== -128) {
      const v = src[at++]
      const k = Math.min(1 - n, stop - d)
      dst.fill(v, d, d + k)
      d += k
    }
  }
}
