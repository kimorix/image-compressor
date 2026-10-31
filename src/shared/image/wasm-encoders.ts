// WASM encoders, loaded lazily so the first page load stays light.
// Every wasm binary is imported via `?url`: Vite emits it as an asset next
// to the chunk and references it with `new URL(..., import.meta.url)`, so it
// resolves correctly from any page (including localized subpages). The
// Emscripten modules get a compiled WebAssembly.Module directly, so they
// never have to locate a .wasm file themselves.
import webpWasmUrl from '@jsquash/webp/codec/enc/webp_enc.wasm?url'
import webpSimdWasmUrl from '@jsquash/webp/codec/enc/webp_enc_simd.wasm?url'
import mozjpegWasmUrl from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?url'
import avifWasmUrl from '@jsquash/avif/codec/enc/avif_enc.wasm?url'
import pngWasmUrl from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm?url'
import quantWasmUrl from 'imagequant/imagequant_bg.wasm?url'

export interface RgbaImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

async function compileModule(url: string): Promise<WebAssembly.Module> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load encoder (${res.status})`)
  return WebAssembly.compile(await res.arrayBuffer())
}

// ---- WebP (libwebp, method 6 beats the browser's default canvas encode) ----
let webpEncodeFn: ((data: RgbaImage, opts: Record<string, unknown>) => Promise<ArrayBuffer>) | null = null
// alphaQuality 100 keeps the alpha plane lossless: logo and icon edges
// stay clean while the color planes are still lossy.
export async function encodeWebp(img: RgbaImage, quality: number, alphaQuality = 100): Promise<ArrayBuffer> {
  if (!webpEncodeFn) {
    const [{ init, default: encode }, { simd }] = await Promise.all([
      import('@jsquash/webp/encode.js'),
      import('wasm-feature-detect'),
    ])
    const mod = await compileModule((await simd()) ? webpSimdWasmUrl : webpWasmUrl)
    await init(mod)
    webpEncodeFn = encode as unknown as typeof webpEncodeFn
  }
  return webpEncodeFn!(img, {
    quality,
    // Method 4 (libwebp default, what canvas uses): method 6 squeezes ~3%
    // more but costs ~2.7s CPU per photo — 20 phone photos then take ~1
    // minute instead of seconds. Not worth it.
    method: 4,
    alpha_quality: alphaQuality,
  })
}

// ---- JPEG (MozJPEG: progressive, optimized coding) ----
let mozjpegEncodeFn: ((data: RgbaImage, opts: Record<string, unknown>) => Promise<ArrayBuffer>) | null = null
export async function encodeMozjpeg(img: RgbaImage, quality: number): Promise<ArrayBuffer> {
  if (!mozjpegEncodeFn) {
    const { init, default: encode } = await import('@jsquash/jpeg/encode.js')
    await init(await compileModule(mozjpegWasmUrl))
    mozjpegEncodeFn = encode as unknown as typeof mozjpegEncodeFn
  }
  return mozjpegEncodeFn!(img, { quality })
}

// ---- AVIF (aom, single-thread) ----
// The package wrapper pulls in the multithread glue, whose worker file breaks
// the Vite build, and Pages doesn't send COOP/COEP anyway — so drive the
// single-thread Emscripten glue directly, mirroring the wrapper's call.
let avifModule: Promise<{
  encode: (data: Uint8Array, w: number, h: number, opts: Record<string, unknown>) => Uint8Array
  defaults: Record<string, unknown>
}> | null = null
export async function encodeAvif(img: RgbaImage, quality: number): Promise<ArrayBuffer> {
  if (!avifModule) {
    const p = (async () => {
      const [{ default: avifFactory }, { initEmscriptenModule }, { defaultOptions }] = await Promise.all([
        import('@jsquash/avif/codec/enc/avif_enc.js'),
        import('@jsquash/avif/utils.js'),
        import('@jsquash/avif/meta.js'),
      ])
      const module = await initEmscriptenModule(avifFactory, await compileModule(avifWasmUrl))
      return { encode: module.encode.bind(module), defaults: defaultOptions as unknown as Record<string, unknown> }
    })()
    avifModule = p
    // Do not cache a failed load: one offline hiccup or a transient 404 would
    // otherwise poison AVIF for the rest of the session, even after the
    // network is back.
    void p.catch(() => { if (avifModule === p) avifModule = null })
  }
  const { encode, defaults } = await avifModule!
  const out = encode(
    new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength),
    img.width,
    img.height,
    { ...defaults, quality, speed: 6 },
  )
  // Copy out of wasm memory (the view may sit inside the heap buffer).
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer
}

// ---- PNG, lossless (Rust png encoder) ----
let pngEncodeFn: ((data: RgbaImage, opts: Record<string, unknown>) => Promise<ArrayBuffer>) | null = null
export async function encodePng(img: RgbaImage): Promise<ArrayBuffer> {
  if (!pngEncodeFn) {
    const { init, default: encode } = await import('@jsquash/png/encode.js')
    await init(pngWasmUrl)
    pngEncodeFn = encode as unknown as typeof pngEncodeFn
  }
  return pngEncodeFn!(img, {})
}

// ---- PNG, palette quantization (the TinyPNG approach) ----
// Returns finished palette-PNG bytes directly.
let quantReady: Promise<{
  Imagequant: new () => {
    set_quality: (min: number, max: number) => void
    set_speed: (speed: number) => void
    process: (img: unknown) => Uint8Array
    free: () => void
  }
  makeImage: (data: Uint8Array, w: number, h: number) => { free: () => void }
}> | null = null
export async function encodePngQuantized(img: RgbaImage, quality: number, speed = 10): Promise<ArrayBuffer> {
  if (!quantReady) {
    const p = (async () => {
      const bg = await import('imagequant/imagequant_bg.js')
      const mod = await compileModule(quantWasmUrl)
      // wasm-pack bundler output has no init: instantiate manually. The module
      // imports only two helpers, both exported by the glue itself.
      const instance = await WebAssembly.instantiate(mod, {
        './imagequant_bg.js': {
          __wbindgen_error_new: bg.__wbindgen_error_new,
          __wbindgen_throw: bg.__wbindgen_throw,
        },
      })
      bg.__wbg_set_wasm(instance.exports)
      return {
        Imagequant: bg.Imagequant,
        makeImage: (data: Uint8Array, w: number, h: number) =>
          new bg.ImagequantImage(data, w, h, 0),
      }
    })()
    quantReady = p
    // Same as AVIF: a failed first load must be retryable.
    void p.catch(() => { if (quantReady === p) quantReady = null })
  }
  const { Imagequant, makeImage } = await quantReady
  const liq = new Imagequant()
  try {
    // libimagequant quality is 0-100 like JPEG; min 0 = best effort, never abort.
    liq.set_quality(0, quality)
    // Speed 10 (fastest): quantization cost is per-pixel, so a full-size
    // photo takes ~3s at the default speed 3 — and the target-size search
    // runs ~15 probes, which used to mean a ~50s silent wait. Speed 10 is
    // ~3x faster with a slightly less optimal palette; flat screenshots
    // (the main quantize use case) are unaffected in practice.
    liq.set_speed(speed)
    const image = makeImage(new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength), img.width, img.height)
    const png = liq.process(image)
    // Note: do not free the image here — this binding's process() already
    // consumes it, and freeing it again throws "null pointer passed to rust".
    return png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer
  } finally {
    liq.free()
  }
}

// HEIC/HEIF decode lives in heic.ts (one heic2any copy for both the worker
// and the main-thread fallback).

export function isHeic(file: File): boolean {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.hei[cf]$/i.test(file.name)
  )
}
