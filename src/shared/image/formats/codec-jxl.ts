// JPEG XL through @jsquash/jxl (libjxl compiled to wasm), single-threaded:
// the multithreaded build needs COOP/COEP headers that GitHub Pages does
// not send. Both directions load lazily; the wasm binaries are imported as
// `?url` assets (named jxl_enc / jxl_dec: kept out of the precache and
// cached on first use, like the other encoders).
//
// Decoding tries the browser first (Safari 17+ decodes JPEG XL natively)
// in the caller; this module is the fallback everywhere else.
import jxlEncWasmUrl from '@jsquash/jxl/codec/enc/jxl_enc.wasm?url'
import jxlDecWasmUrl from '@jsquash/jxl/codec/dec/jxl_dec.wasm?url'
import { initEmscriptenModule } from '@jsquash/jxl/utils.js'

export interface Rgba {
  data: Uint8ClampedArray
  width: number
  height: number
}

async function compileModule(url: string): Promise<WebAssembly.Module> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load codec (${res.status})`)
  return WebAssembly.compile(await res.arrayBuffer())
}

type EncModule = { encode: (data: Uint8Array | Uint8ClampedArray, w: number, h: number, opts: Record<string, unknown>) => Uint8Array | null }
type DecModule = { decode: (data: ArrayBuffer) => ImageData | null }

let enc: Promise<EncModule> | null = null
let dec: Promise<DecModule> | null = null

function loadEnc(): Promise<EncModule> {
  if (!enc) {
    const p = (async () => {
      const { default: factory } = await import('@jsquash/jxl/codec/enc/jxl_enc.js')
      return (await initEmscriptenModule(factory as never, await compileModule(jxlEncWasmUrl))) as unknown as EncModule
    })()
    enc = p
    void p.catch(() => { if (enc === p) enc = null })
  }
  return enc
}

function loadDec(): Promise<DecModule> {
  if (!dec) {
    const p = (async () => {
      const { default: factory } = await import('@jsquash/jxl/codec/dec/jxl_dec.js')
      return (await initEmscriptenModule(factory as never, await compileModule(jxlDecWasmUrl))) as unknown as DecModule
    })()
    dec = p
    void p.catch(() => { if (dec === p) dec = null })
  }
  return dec
}

/**
 * libjxl's wasm heap is capped at 2 GiB and an effort-7 encode needs about
 * 100 bytes per pixel: 18 MP peaks near 1.8 GiB, 24 MP aborts. Callers check
 * this before decoding work is wasted on an encode that cannot finish.
 */
export const JXL_MAX_PIXELS = 18_000_000
/** Above this the encoder instance is dropped afterwards (wasm memory never shrinks). */
const JXL_RELEASE_PIXELS = 4_000_000

/** Big encodes run one at a time across all workers (a wasm heap each). */
function serialized<T>(px: number, fn: () => Promise<T>): Promise<T> {
  const locks = (globalThis as { navigator?: { locks?: { request: (name: string, cb: () => Promise<T>) => Promise<T> } } }).navigator?.locks
  return px > JXL_RELEASE_PIXELS && locks ? locks.request('ic-jxl-encode', fn) : fn()
}

/** Quality 1–99 = lossy (VarDCT, effort 7); 100 = mathematically lossless. */
export async function encodeJxl(img: { data: Uint8Array | Uint8ClampedArray; width: number; height: number }, quality: number): Promise<Uint8Array> {
  const px = img.width * img.height
  if (px > JXL_MAX_PIXELS) throw new Error('JPEG XL: image too large for the wasm encoder')
  return serialized(px, async () => {
    const m = await loadEnc()
    const lossless = quality >= 100
    let out: Uint8Array | null = null
    try {
      out = m.encode(img.data, img.width, img.height, {
        effort: 7,
        quality: lossless ? 100 : quality,
        progressive: false,
        epf: -1,
        lossyPalette: false,
        decodingSpeedTier: 0,
        photonNoiseIso: 0,
        lossyModular: false,
        lossless,
      })
    } catch (err) {
      // An aborted emscripten module stays unusable: start fresh next time.
      enc = null
      throw err
    }
    // Let a heap grown by a big image be collected instead of pinned.
    if (px > JXL_RELEASE_PIXELS) enc = null
    if (!out) throw new Error('JPEG XL encode failed')
    return out.slice()
  })
}

export async function decodeJxl(bytes: Uint8Array): Promise<Rgba> {
  const m = await loadDec()
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const img = m.decode(buf)
  if (!img) throw new Error('JPEG XL decode failed')
  return { data: new Uint8ClampedArray(img.data), width: img.width, height: img.height }
}

/** JPEG XL signatures: bare codestream (FF 0A) or ISOBMFF container. */
export function isJxl(b: Uint8Array): boolean {
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0x0a) return true
  return b.length >= 12 && b[0] === 0 && b[1] === 0 && b[2] === 0 && b[3] === 0x0c && b[4] === 0x4a && b[5] === 0x58 && b[6] === 0x4c && b[7] === 0x20
}

/** EXIF (TIFF block) from a JPEG XL container's "Exif" box; null for bare codestreams. */
export function jxlExif(b: Uint8Array): Uint8Array | null {
  if (!isJxl(b) || b[0] === 0xff) return null
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let p = 0
  while (p + 8 <= b.length) {
    let size = dv.getUint32(p)
    const type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7])
    let head = 8
    if (size === 1 && p + 16 <= b.length) { size = Number(dv.getBigUint64(p + 8)); head = 16 } else if (size === 0) size = b.length - p
    if (size < head || p + size > b.length) return null
    if (type === 'Exif' && size >= head + 4) {
      const skip = dv.getUint32(p + head)
      const tiff = b.subarray(p + head + 4 + skip, p + size)
      return tiff.length >= 8 ? tiff : null
    }
    p += size
  }
  return null
}
