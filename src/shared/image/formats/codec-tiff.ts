// TIFF in and out for the format converter.
//
// Decode: UTIF (utif2, photopea) covers the compressions and layouts real
// files use (none / LZW / Deflate / PackBits / JPEG / CCITT, strips and
// tiles, 1–16 bit, grey / RGB / palette / CMYK). One page is decoded per
// call; the view expands a multi-page TIFF into one row per page. Its
// `pako` dependency is redirected to a tiny fflate shim (vite.config.ts),
// so no second deflate library ships.
//
// Encode: our own writer, lossless: 8-bit RGB (or RGBA with unassociated
// alpha when the image has transparency), Deflate (Adobe, 8) with the
// horizontal differencing predictor, strips of ~256 KB. Readable by
// libtiff, Photoshop, Preview, Windows Photos, Pillow, tifffile.
//
// Lazy: loaded only when a TIFF is read or written (chunk name prefix
// "codec-" keeps it out of the precache).
import UTIF from 'utif2'
import { orientRgba, readTiff, tiffOrientation, tiffPageIndexes } from './codec-tiff-ifd'

export interface Rgba {
  data: Uint8ClampedArray
  width: number
  height: number
}

/** Decode page `page` (0-based, among full-resolution pages) to upright RGBA. */
export function decodeTiff(bytes: Uint8Array, page = 0): Rgba & { pages: number } {
  const t = readTiff(bytes)
  if (!t) throw new Error('not a TIFF')
  const pages = tiffPageIndexes(t)
  if (!pages.length) throw new Error('TIFF has no image')
  const want = pages[Math.min(Math.max(0, page), pages.length - 1)]
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const ifds = UTIF.decode(buf)
  const ifd = ifds[want]
  if (!ifd) throw new Error('TIFF page missing')
  UTIF.decodeImage(buf, ifd)
  const w = ifd.width
  const h = ifd.height
  if (!w || !h) throw new Error('TIFF page has no size')
  // UTIF's CMYK branch reads `window.UDOC` (an optional colour engine);
  // workers have no `window`, so give it an empty one for this sync call.
  const g = globalThis as { window?: unknown }
  const shim = typeof g.window === 'undefined'
  if (shim) g.window = {}
  let rgba: Uint8Array
  try {
    rgba = UTIF.toRGBA8(ifd)
  } finally {
    if (shim) delete g.window
  }
  const data = new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, w * h * 4)
  // Alpha only when ExtraSamples says so (1 associated, 2 unassociated).
  // Without it UTIF may still write junk alpha: its CMYK branch reads one
  // byte past the last pixel, leaving that pixel transparent, which would
  // make a plain CMYK scan look like it has transparency.
  const extra = ifd['t338'] as number[] | undefined
  const alphaKind = extra?.[0]
  if (alphaKind === 1) unpremultiply(data)
  else if (alphaKind !== 2) forceOpaque(data)
  // Orientation lives in IFD0 for single images; per page otherwise.
  const ori = (ifd['t274'] as number[] | undefined)?.[0] ?? (want === 0 ? tiffOrientation(t) : 1)
  const up = orientRgba(data, w, h, ori)
  return { ...up, pages: pages.length }
}

function forceOpaque(d: Uint8ClampedArray) {
  for (let i = 3; i < d.length; i += 4) d[i] = 255
}

function unpremultiply(d: Uint8ClampedArray) {
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]
    if (a === 0 || a === 255) continue
    d[i] = Math.round((d[i] * 255) / a)
    d[i + 1] = Math.round((d[i + 1] * 255) / a)
    d[i + 2] = Math.round((d[i + 2] * 255) / a)
  }
}

// ---- writer ----

const STRIP_BYTES = 256 * 1024

/** Lossless TIFF: RGB, or RGBA (unassociated alpha) when `alpha`. */
export async function encodeTiff(img: { data: Uint8Array | Uint8ClampedArray; width: number; height: number }, alpha: boolean): Promise<Uint8Array> {
  const { zlibSync } = await import('fflate')
  const { width: w, height: h, data: d } = img
  const spp = alpha ? 4 : 3
  const stride = w * spp
  const rowsPerStrip = Math.max(1, Math.min(h, Math.floor(STRIP_BYTES / stride)))
  const strips: Uint8Array[] = []
  for (let y0 = 0; y0 < h; y0 += rowsPerStrip) {
    const rows = Math.min(rowsPerStrip, h - y0)
    const raw = new Uint8Array(rows * stride)
    for (let r = 0; r < rows; r++) {
      const src = (y0 + r) * w * 4
      const dst = r * stride
      // Pack, then horizontal differencing (Predictor 2), per sample.
      for (let x = 0, s = src, o = dst; x < w; x++, s += 4, o += spp) {
        raw[o] = d[s]
        raw[o + 1] = d[s + 1]
        raw[o + 2] = d[s + 2]
        if (alpha) raw[o + 3] = d[s + 3]
      }
      for (let o = dst + stride - 1; o >= dst + spp; o--) raw[o] = (raw[o] - raw[o - spp]) & 0xff
    }
    strips.push(zlibSync(raw, { level: 6 }))
  }

  // Tags (sorted): 256 W, 257 H, 258 BPS, 259 Compression=8, 262 RGB,
  // 273 StripOffsets, 277 SPP, 278 RowsPerStrip, 279 StripByteCounts,
  // 282/283 resolution 72 dpi, 284 chunky, 296 inch, 317 Predictor=2,
  // 338 ExtraSamples=2 (unassociated alpha) when alpha.
  const n = strips.length
  type E = [tag: number, type: number, count: number, value: number[] | 'rational72']
  const entries: E[] = [
    [256, 4, 1, [w]],
    [257, 4, 1, [h]],
    [258, 3, spp, new Array(spp).fill(8)],
    [259, 3, 1, [8]],
    [262, 3, 1, [2]],
    [273, 4, n, []],
    [277, 3, 1, [spp]],
    [278, 4, 1, [rowsPerStrip]],
    [279, 4, n, strips.map((s) => s.length)],
    [282, 5, 1, 'rational72'],
    [283, 5, 1, 'rational72'],
    [284, 3, 1, [1]],
    [296, 3, 1, [2]],
    [317, 3, 1, [2]],
  ]
  if (alpha) entries.push([338, 3, 1, [2]])

  const size = (e: E) => (e[3] === 'rational72' ? 8 : e[2] * (e[1] === 3 ? 2 : 4))
  const ifdAt = 8
  const ifdLen = 2 + entries.length * 12 + 4
  let extAt = ifdAt + ifdLen
  const extOffsets = new Map<number, number>()
  for (const e of entries) {
    if (size(e) > 4) {
      extOffsets.set(e[0], extAt)
      extAt += size(e)
    }
  }
  let dataAt = extAt
  const stripOffsets = strips.map((s) => {
    const o = dataAt
    dataAt += s.length
    return o
  })
  entries[5][3] = stripOffsets

  const out = new Uint8Array(dataAt)
  const dv = new DataView(out.buffer)
  out[0] = 0x49
  out[1] = 0x49
  dv.setUint16(2, 42, true)
  dv.setUint32(4, ifdAt, true)
  dv.setUint16(ifdAt, entries.length, true)
  entries.forEach((e, i) => {
    const p = ifdAt + 2 + i * 12
    const [tag, type, count, value] = e
    dv.setUint16(p, tag, true)
    dv.setUint16(p + 2, type, true)
    dv.setUint32(p + 4, count, true)
    const at = size(e) > 4 ? extOffsets.get(tag)! : p + 8
    if (size(e) > 4) dv.setUint32(p + 8, at, true)
    if (value === 'rational72') {
      dv.setUint32(at, 72, true)
      dv.setUint32(at + 4, 1, true)
    } else {
      value.forEach((v, k) => (type === 3 ? dv.setUint16(at + k * 2, v, true) : dv.setUint32(at + k * 4, v, true)))
    }
  })
  dv.setUint32(ifdAt + 2 + entries.length * 12, 0, true)
  strips.forEach((s, i) => out.set(s, stripOffsets[i]))
  return out
}
