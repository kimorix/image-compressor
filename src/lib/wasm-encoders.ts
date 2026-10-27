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
    avifModule = (async () => {
      const [{ default: avifFactory }, { initEmscriptenModule }, { defaultOptions }] = await Promise.all([
        import('@jsquash/avif/codec/enc/avif_enc.js'),
        import('@jsquash/avif/utils.js'),
        import('@jsquash/avif/meta.js'),
      ])
      const module = await initEmscriptenModule(avifFactory, await compileModule(avifWasmUrl))
      return { encode: module.encode.bind(module), defaults: defaultOptions as unknown as Record<string, unknown> }
    })()
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
export async function encodePngQuantized(img: RgbaImage, quality: number): Promise<ArrayBuffer> {
  if (!quantReady) {
    quantReady = (async () => {
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
    liq.set_speed(10)
    const image = makeImage(new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength), img.width, img.height)
    const png = liq.process(image)
    // Note: do not free the image here — this binding's process() already
    // consumes it, and freeing it again throws "null pointer passed to rust".
    return png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer
  } finally {
    liq.free()
  }
}

// ---- HEIC/HEIF decode (iPhone photos; Chrome cannot decode them) ----
// heic2any is self-contained (worker + libheif wasm bundled in its dist),
// but it was written for the main thread: at import time it stores its
// nested worker on `window`, and it converts ImageData to a blob with
// `document.createElement("canvas")` + `canvas.toBlob`; gifshot (bundled
// for its GIF path) also probes video codecs with createElement("video")
// at import time. None of window/document exist in a worker, so without
// shims every HEIC task throws here and the pool falls back to the main
// thread (the ~0.7s hitch).
//
// The shims are strictly scoped to each heic2any call and removed right
// after: this file's own decode/canvas code branches on
// `typeof document === 'undefined'` to pick the worker path
// (createImageBitmap / OffscreenCanvas), and a lingering fake document
// would flip it to the main-thread path (new Image), which does not
// exist in a worker. The nested worker handle is captured on first import
// and re-attached to a minimal window object on later calls, so the
// worker global is never left polluted between tasks. On the main thread
// window/document already exist and this is all a no-op.
let heicWorkerHandle: Worker | null = null

function heicShimDocument(): { createElement: (tag: string) => unknown } {
  return {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        const canvas = new OffscreenCanvas(1, 1)
        ;(canvas as any).toBlob = (
          cb: (blob: Blob | null) => void,
          type?: string,
          quality?: number,
        ) => {
          canvas
            .convertToBlob({ type, quality })
            .then((b) => cb(b), () => cb(null))
        }
        return canvas
      }
      // gifshot's import-time video-codec probe; we never use its GIF path.
      if (tag === 'video') return { canPlayType: () => '' }
      throw new Error(`heic2any shim: unsupported element ${tag}`)
    },
  }
}

export async function decodeHeicToPngBlob(file: File | Blob): Promise<Blob> {
  const g = globalThis as any
  const prevWindow = g.window
  const prevDocument = g.document
  if (typeof g.window === 'undefined') {
    g.window = heicWorkerHandle ? { __heic2any__worker: heicWorkerHandle } : g
  }
  if (typeof g.document === 'undefined') g.document = heicShimDocument()
  try {
    const { default: heic2any } = await import('heic2any')
    if (!heicWorkerHandle && g.window?.__heic2any__worker) {
      heicWorkerHandle = g.window.__heic2any__worker as Worker
    }
    const out = await heic2any({ blob: file, toType: 'image/png' })
    return (Array.isArray(out) ? out[0] : out) as Blob
  } finally {
    if (prevWindow === undefined) delete g.window
    else g.window = prevWindow
    if (prevDocument === undefined) delete g.document
    else g.document = prevDocument
  }
}

export function isHeic(file: File): boolean {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.hei[cf]$/i.test(file.name)
  )
}
