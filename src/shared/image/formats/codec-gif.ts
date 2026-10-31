// Static GIF writer (GIF89a, one frame). GIF holds at most 256 colours and
// 1-bit transparency, so:
//   - alpha is thresholded at 50 % (fully transparent or fully opaque);
//     `semi` tells the caller that soft edges were hardened;
//   - an image with ≤ 256 colours (after that) is written exactly;
//   - anything else is quantized by libimagequant (with dithering), the
//     same wasm the compressor uses for palette PNGs. Its output is a
//     palette PNG, which we unpack here (inflate + unfilter) into
//     palette + indices.
// Then standard variable-width LZW.
// Lazy chunk ("codec-" prefix: not precached).

export interface Rgba {
  data: Uint8ClampedArray
  width: number
  height: number
}

export interface Indexed {
  /** RGB triplets, length = 3 × colours. */
  palette: Uint8Array
  indices: Uint8Array
  /** Index of the transparent colour, -1 when none. */
  transparent: number
}

/** Threshold alpha in place; returns whether any pixel was semi-transparent / transparent. */
export function hardenAlpha(d: Uint8ClampedArray): { semi: boolean; transparent: boolean } {
  let semi = false
  let transparent = false
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]
    if (a === 255) continue
    if (a !== 0) semi = true
    if (a < 128) {
      transparent = true
      d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0
    } else d[i + 3] = 255
  }
  return { semi, transparent }
}

/** Exact palette when the image has ≤ 256 colours; null otherwise. */
export function exactPalette(img: Rgba): Indexed | null {
  const d = img.data
  const n = img.width * img.height
  const map = new Map<number, number>()
  const indices = new Uint8Array(n)
  let transparent = -1
  for (let i = 0, o = 0; i < n; i++, o += 4) {
    const key = d[o + 3] === 0 ? -1 : (d[o] << 16) | (d[o + 1] << 8) | d[o + 2]
    let idx = map.get(key)
    if (idx === undefined) {
      if (map.size === 256) return null
      idx = map.size
      map.set(key, idx)
      if (key === -1) transparent = idx
    }
    indices[i] = idx
  }
  const palette = new Uint8Array(map.size * 3)
  for (const [key, idx] of map) {
    if (key < 0) continue
    palette[idx * 3] = (key >> 16) & 255
    palette[idx * 3 + 1] = (key >> 8) & 255
    palette[idx * 3 + 2] = key & 255
  }
  return { palette, indices, transparent }
}

const be32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0

/** Unpack an 8-or-fewer-bit palette PNG (as libimagequant writes) into palette + indices. */
export async function indexedFromPng(png: Uint8Array): Promise<Indexed> {
  const { unzlibSync } = await import('fflate')
  let o = 8
  let w = 0, h = 0, depth = 8, ct = 3
  let plte: Uint8Array | null = null
  let trns: Uint8Array | null = null
  const idat: Uint8Array[] = []
  while (o + 8 <= png.length) {
    const len = be32(png, o)
    const type = String.fromCharCode(png[o + 4], png[o + 5], png[o + 6], png[o + 7])
    const body = png.subarray(o + 8, o + 8 + len)
    if (type === 'IHDR') { w = be32(body, 0); h = be32(body, 4); depth = body[8]; ct = body[9] }
    else if (type === 'PLTE') plte = body
    else if (type === 'tRNS') trns = body
    else if (type === 'IDAT') idat.push(body)
    else if (type === 'IEND') break
    o += 12 + len
  }
  if (ct !== 3 || !plte || !w || !h) throw new Error('expected a palette PNG')
  const total = idat.reduce((s, c) => s + c.length, 0)
  const z = new Uint8Array(total)
  let k = 0
  for (const c of idat) { z.set(c, k); k += c.length }
  const raw = unzlibSync(z)
  const stride = Math.ceil((w * depth) / 8)
  const rows = new Uint8Array(stride * h)
  let prev = new Uint8Array(stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const cur = rows.subarray(y * stride, (y + 1) * stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= 1 ? cur[x - 1] : 0
      const b = prev[x]
      const c = x >= 1 ? prev[x - 1] : 0
      let v = src[x]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      cur[x] = v & 255
    }
    prev = cur
  }
  const colours = plte.length / 3
  // Merge every (mostly) transparent palette entry into one transparent index.
  let transparent = -1
  const remap = new Uint8Array(256)
  const palette: number[] = []
  for (let i = 0; i < colours; i++) {
    const alpha = trns && i < trns.length ? trns[i] : 255
    if (alpha < 128) {
      if (transparent < 0) { transparent = palette.length / 3; palette.push(0, 0, 0) }
      remap[i] = transparent
    } else {
      remap[i] = palette.length / 3
      palette.push(plte[i * 3], plte[i * 3 + 1], plte[i * 3 + 2])
    }
  }
  const indices = new Uint8Array(w * h)
  const mask = (1 << depth) - 1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const bit = x * depth
      const v = (rows[y * stride + (bit >> 3)] >> (8 - depth - (bit & 7))) & mask
      indices[y * w + x] = remap[v]
    }
  }
  return { palette: Uint8Array.from(palette), indices, transparent }
}

/** GIF LZW of `indices` with the given minimum code size. */
export function lzw(indices: Uint8Array, minCode: number): Uint8Array {
  const clear = 1 << minCode
  const eoi = clear + 1
  const out: number[] = []
  let cur = 0
  let nbits = 0
  let size = minCode + 1
  const emit = (code: number) => {
    cur |= code << nbits
    nbits += size
    while (nbits >= 8) { out.push(cur & 255); cur >>>= 8; nbits -= 8 }
  }
  let dict = new Map<number, number>()
  let next = eoi + 1
  emit(clear)
  let prefix = indices.length ? indices[0] : 0
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]
    const key = (prefix << 8) | k
    const hit = dict.get(key)
    if (hit !== undefined) { prefix = hit; continue }
    emit(prefix)
    if (next < 4096) {
      dict.set(key, next++)
      if (next > (1 << size) && size < 12) size++
    } else {
      emit(clear)
      dict = new Map()
      next = eoi + 1
      size = minCode + 1
    }
    prefix = k
  }
  if (indices.length) emit(prefix)
  emit(eoi)
  if (nbits > 0) out.push(cur & 255)
  return Uint8Array.from(out)
}

export function assembleGif(width: number, height: number, ix: Indexed): Uint8Array {
  const colours = Math.max(2, ix.palette.length / 3)
  let bits = 1
  while (1 << bits < colours) bits++
  const tableSize = 1 << bits
  const minCode = Math.max(2, bits)
  const data = lzw(ix.indices, minCode)
  const parts: number[] = []
  const push16 = (v: number) => parts.push(v & 255, (v >> 8) & 255)
  parts.push(...[0x47, 0x49, 0x46, 0x38, 0x39, 0x61]) // GIF89a
  push16(width)
  push16(height)
  parts.push(0x80 | ((bits - 1) << 4) | (bits - 1), 0, 0) // global table, colour resolution
  for (let i = 0; i < tableSize * 3; i++) parts.push(ix.palette[i] ?? 0)
  if (ix.transparent >= 0) parts.push(0x21, 0xf9, 4, 0x01, 0, 0, ix.transparent, 0)
  parts.push(0x2c)
  push16(0); push16(0); push16(width); push16(height)
  parts.push(0) // no local table, not interlaced
  parts.push(minCode)
  const head = Uint8Array.from(parts)
  const blocks = Math.ceil(data.length / 255)
  const out = new Uint8Array(head.length + data.length + blocks + 2)
  out.set(head)
  let o = head.length
  for (let i = 0; i < data.length; i += 255) {
    const n = Math.min(255, data.length - i)
    out[o++] = n
    out.set(data.subarray(i, i + n), o)
    o += n
  }
  out[o++] = 0
  out[o++] = 0x3b
  return out.subarray(0, o)
}

/**
 * Static GIF. `quantize` turns RGBA into a palette PNG (libimagequant,
 * injected so this chunk stays small and testable).
 */
export async function encodeGif(
  img: { data: Uint8Array | Uint8ClampedArray; width: number; height: number },
  quantize: (img: Rgba) => Promise<ArrayBuffer>,
): Promise<{ bytes: Uint8Array; semi: boolean; quantized: boolean }> {
  const work: Rgba = { data: new Uint8ClampedArray(img.data), width: img.width, height: img.height }
  const { semi } = hardenAlpha(work.data)
  let ix = exactPalette(work)
  const quantized = !ix
  if (!ix) ix = await indexedFromPng(new Uint8Array(await quantize(work)))
  return { bytes: assembleGif(img.width, img.height, ix), semi, quantized }
}
