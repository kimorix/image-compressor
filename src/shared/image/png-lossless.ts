// Lossless, size-optimized PNG writer (the oxipng recipe, minus the brute
// force): pick the smallest colour type that holds the pixels exactly,
// filter each row adaptively, then deflate (level 9 for small images, the
// browser's native deflate for photos — see SMALL_IMAGE_MAX_PIXELS).
//
//   ≤ 256 distinct RGBA colours -> palette (1/2/4/8-bit) + tRNS when needed
//   grey, no alpha              -> greyscale 8-bit
//   no alpha                    -> RGB 8-bit (alpha channel stripped)
//   grey with alpha             -> grey+alpha 8-bit
//   otherwise                   -> RGBA 8-bit
//
// Every reduction is exact: decoding the output gives back the input RGBA
// byte for byte (tests/unit/png-lossless.test.ts). fflate is imported
// lazily, so this file costs nothing until a PNG is written.
//
// The Rust png wasm encoder (`encodePng`) always writes RGBA with a fast
// deflate, which is why a 600 KB JPEG became a 5.6 MB PNG; libimagequant
// (`encodePngQuantized`) is lossy by design. Neither can do this job, so
// the format converter writes PNGs here and keeps those for the compressor.

export interface PngInput {
  data: Uint8Array | Uint8ClampedArray
  width: number
  height: number
}

export type PngColorType = 'palette' | 'grey' | 'rgb' | 'grey-alpha' | 'rgba'

export interface PngPlan {
  colorType: PngColorType
  bitDepth: 1 | 2 | 4 | 8
  /** Palette entries as packed 0xRRGGBBAA, transparent ones first. */
  palette?: Uint32Array
}

const CT_CODE: Record<PngColorType, number> = { grey: 0, rgb: 2, palette: 3, 'grey-alpha': 4, rgba: 6 }
const CHANNELS: Record<PngColorType, number> = { grey: 1, rgb: 3, palette: 1, 'grey-alpha': 2, rgba: 4 }

/** One pass over the pixels: alpha use, greyness and (up to 257) distinct colours. */
export function planPng(img: PngInput): PngPlan {
  const d = img.data
  const n = img.width * img.height
  let alpha = false
  let grey = true
  const seen = new Map<number, number>()
  let many = false
  for (let i = 0, o = 0; i < n; i++, o += 4) {
    const r = d[o], g = d[o + 1], b = d[o + 2], a = d[o + 3]
    if (a !== 255) alpha = true
    if (r !== g || g !== b) grey = false
    if (!many) {
      const key = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0
      if (!seen.has(key)) {
        if (seen.size === 256) many = true
        else seen.set(key, 0)
      }
    } else if (alpha && !grey) break // nothing left to learn
  }
  if (!many) {
    const colors = [...seen.keys()]
    // Transparent entries first keeps tRNS as short as possible.
    colors.sort((x, y) => (x & 0xff) - (y & 0xff) || x - y)
    const k = colors.length
    // Grey without alpha in 8 bits: greyscale needs no PLTE and filters
    // better than palette indices; palette only wins at low bit depths.
    if (grey && !alpha && k > 16) return { colorType: 'grey', bitDepth: 8 }
    const bitDepth = k <= 2 ? 1 : k <= 4 ? 2 : k <= 16 ? 4 : 8
    return { colorType: 'palette', bitDepth, palette: Uint32Array.from(colors) }
  }
  if (grey) return { colorType: alpha ? 'grey-alpha' : 'grey', bitDepth: 8 }
  return { colorType: alpha ? 'rgba' : 'rgb', bitDepth: 8 }
}

/** Raw scanlines (without filter bytes) for the chosen layout. */
function packRows(img: PngInput, plan: PngPlan): { rows: Uint8Array; stride: number; bpp: number } {
  const { width: w, height: h, data: d } = img
  const ch = CHANNELS[plan.colorType]
  const bits = plan.bitDepth * ch
  const stride = Math.ceil((w * bits) / 8)
  const bpp = Math.max(1, bits >> 3)
  const rows = new Uint8Array(stride * h)
  const ct = plan.colorType
  if (ct === 'palette') {
    const index = new Map<number, number>()
    plan.palette!.forEach((c, i) => index.set(c, i))
    const depth = plan.bitDepth
    const perByte = 8 / depth
    for (let y = 0; y < h; y++) {
      const rowOff = y * stride
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4
        const key = ((d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) >>> 0
        const idx = index.get(key)!
        if (depth === 8) rows[rowOff + x] = idx
        else {
          const shift = 8 - depth * ((x % perByte) + 1)
          rows[rowOff + Math.floor(x / perByte)] |= idx << shift
        }
      }
    }
  } else if (ct === 'rgba') {
    rows.set(d instanceof Uint8Array ? d : new Uint8Array(d.buffer, d.byteOffset, d.byteLength))
  } else {
    const n = w * h
    if (ct === 'rgb') for (let i = 0, o = 0, p = 0; i < n; i++, o += 4, p += 3) { rows[p] = d[o]; rows[p + 1] = d[o + 1]; rows[p + 2] = d[o + 2] }
    else if (ct === 'grey') for (let i = 0, o = 0; i < n; i++, o += 4) rows[i] = d[o]
    else for (let i = 0, o = 0, p = 0; i < n; i++, o += 4, p += 2) { rows[p] = d[o]; rows[p + 1] = d[o + 3] }
  }
  return { rows, stride, bpp }
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/**
 * Prefix every scanline with its filter type. Palette and sub-byte images
 * use filter 0 (filtering indices only hurts); the rest try all five
 * filters per row and keep the one with the smallest sum of absolute
 * signed bytes (libpng's / oxipng's "minimum sum" heuristic).
 */
export function filterRows(rows: Uint8Array, stride: number, height: number, bpp: number, adaptive: boolean): Uint8Array {
  const out = new Uint8Array((stride + 1) * height)
  if (!adaptive) {
    for (let y = 0; y < height; y++) out.set(rows.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1)
    return out
  }
  const cand = [0, 1, 2, 3, 4].map(() => new Uint8Array(stride))
  const zero = new Uint8Array(stride)
  for (let y = 0; y < height; y++) {
    const cur = rows.subarray(y * stride, (y + 1) * stride)
    const up = y ? rows.subarray((y - 1) * stride, y * stride) : zero
    let best = 0
    let bestSum = Infinity
    for (let f = 0; f < 5; f++) {
      const c = cand[f]
      let sum = 0
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? cur[i - bpp] : 0
        const b = up[i]
        const v = cur[i]
        let r: number
        if (f === 0) r = v
        else if (f === 1) r = v - a
        else if (f === 2) r = v - b
        else if (f === 3) r = v - ((a + b) >> 1)
        else r = v - paeth(a, b, i >= bpp ? up[i - bpp] : 0)
        r &= 0xff
        c[i] = r
        sum += r < 128 ? r : 256 - r
        if (sum >= bestSum) break
      }
      if (sum < bestSum) { bestSum = sum; best = f }
    }
    const o = y * (stride + 1)
    out[o] = best
    out.set(cand[best], o + 1)
  }
  return out
}

// ---- chunk writing ----
let crcTable: Uint32Array | null = null
function crc32(bytes: Uint8Array, start: number, end: number): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = start; i < end; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length)
  const v = new DataView(out.buffer)
  v.setUint32(0, body.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(body, 8)
  v.setUint32(8 + body.length, crc32(out, 4, 8 + body.length))
  return out
}

const SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Assemble a PNG from a plan and an already-compressed zlib stream. */
export function assemblePng(width: number, height: number, plan: PngPlan, zdata: Uint8Array): Uint8Array {
  const ihdr = new Uint8Array(13)
  const v = new DataView(ihdr.buffer)
  v.setUint32(0, width)
  v.setUint32(4, height)
  ihdr[8] = plan.bitDepth
  ihdr[9] = CT_CODE[plan.colorType]
  const parts = [SIGNATURE, chunk('IHDR', ihdr)]
  if (plan.colorType === 'palette') {
    const pal = plan.palette!
    const plte = new Uint8Array(pal.length * 3)
    let trns = 0
    pal.forEach((c, i) => {
      plte[i * 3] = c >>> 24
      plte[i * 3 + 1] = (c >>> 16) & 0xff
      plte[i * 3 + 2] = (c >>> 8) & 0xff
      if ((c & 0xff) !== 255) trns = i + 1
    })
    parts.push(chunk('PLTE', plte))
    if (trns) parts.push(chunk('tRNS', Uint8Array.from(pal.subarray(0, trns), (c) => c & 0xff)))
  }
  parts.push(chunk('IDAT', zdata), chunk('IEND', new Uint8Array(0)))
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

/**
 * Up to this many pixels (a 1440×900 screenshot, logos, icons) the writer
 * goes for the smallest file: both filter strategies, fflate at level 9.
 * Above it (photos) the time matters more: one filter pass and the
 * browser's native deflate (CompressionStream, ~6× faster than level 9
 * in JS for ~3% more bytes), fflate level 6 where that is missing.
 */
export const SMALL_IMAGE_MAX_PIXELS = 1_500_000

/**
 * Filtered scanlines ready for deflate, plus the plan that produced them.
 * The first candidate is the usual best guess (no filter for palette /
 * sub-byte, adaptive otherwise). Small images, and palette images of any
 * size (one byte per pixel, cheap), also get the other strategy; the
 * smaller result wins.
 */
export function preparePng(img: PngInput, forceRgba = false): { plan: PngPlan; candidates: Uint8Array[] } {
  const plan: PngPlan = forceRgba ? { colorType: 'rgba', bitDepth: 8 } : planPng(img)
  const { rows, stride, bpp } = packRows(img, plan)
  const adaptiveFirst = plan.colorType !== 'palette' && plan.bitDepth === 8
  const candidates = [filterRows(rows, stride, img.height, bpp, adaptiveFirst)]
  if (img.width * img.height <= SMALL_IMAGE_MAX_PIXELS || plan.colorType === 'palette') {
    candidates.push(filterRows(rows, stride, img.height, bpp, !adaptiveFirst))
  }
  return { plan, candidates }
}

async function nativeDeflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** zlib stream for the filtered scanlines ('deflate' = zlib framing, as PNG wants). */
export async function deflateForPng(data: Uint8Array, small: boolean): Promise<Uint8Array> {
  if (!small && typeof CompressionStream === 'function') {
    try {
      return await nativeDeflate(data)
    } catch {
      // fall through to fflate
    }
  }
  const { zlibSync } = await import('fflate')
  return zlibSync(data, small ? { level: 9, mem: 12 } : { level: 6 })
}

/**
 * Encode RGBA pixels as the smallest exact PNG this writer can make.
 * `forceRgba` keeps 8-bit RGBA (no colour-type reduction): PNG-in-ICO
 * entries are expected to be 32-bit by Windows and several icon readers.
 */
export async function encodePngLossless(img: PngInput, forceRgba = false): Promise<ArrayBuffer> {
  const { plan, candidates } = preparePng(img, forceRgba)
  const small = img.width * img.height <= SMALL_IMAGE_MAX_PIXELS
  let best: Uint8Array | null = null
  for (const filtered of candidates) {
    const z = await deflateForPng(filtered, small)
    if (!best || z.length < best.length) best = z
  }
  const png = assemblePng(img.width, img.height, plan, best!)
  return png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer
}
