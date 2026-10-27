// ---- HEIC/HEIF decode (iPhone photos; Chrome cannot decode them) ----
// heic2any (~1.3 MB, libheif inside) is loaded from ONE emitted file for
// both callers: the encode worker (normal path) and the main-thread
// fallback in compress-pool. Importing the package from both used to make
// Vite bundle it twice (the worker is a separate build), shipping two
// identical 1.3 MB chunks. Its prebuilt UMD file is emitted once as a
// hashed `?url` asset instead (Vite dedupes assets by content, exactly like
// the encoder wasm files), and loaded with a dynamic import: as an ES
// module its UMD wrapper sees no CommonJS/AMD and attaches itself to
// `self.heic2any`, which works on the main thread and in a module worker.
//
// heic2any was written for the main thread: at import time it stores its
// nested worker on `window`, and it converts ImageData to a blob with
// `document.createElement("canvas")` + `canvas.toBlob`; gifshot (bundled
// for its GIF path) also probes video codecs with createElement("video")
// at import time. None of window/document exist in a worker, so without
// shims every HEIC task throws there and the pool falls back to the main
// thread (the ~0.7s hitch).
//
// The shims are strictly scoped to each heic2any call and removed right
// after: compress.ts's own decode/canvas code branches on
// `typeof document === 'undefined'` to pick the worker path
// (createImageBitmap / OffscreenCanvas), and a lingering fake document
// would flip it to the main-thread path (new Image), which does not
// exist in a worker. The nested worker handle is captured on first import
// and re-attached to a minimal window object on later calls, so the
// worker global is never left polluted between tasks. On the main thread
// window/document already exist and this is all a no-op.
import heic2anyUrl from 'heic2any/dist/heic2any.min.js?url'

type Heic2any = (opts: { blob: Blob; toType?: string }) => Promise<Blob | Blob[]>

let heicWorkerHandle: Worker | null = null
let loaded: Promise<Heic2any> | null = null

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

function loadHeic2any(): Promise<Heic2any> {
  if (!loaded) {
    const p = (async () => {
      await import(/* @vite-ignore */ heic2anyUrl)
      const fn = (globalThis as any).heic2any as Heic2any | undefined
      if (typeof fn !== 'function') throw new Error('heic2any failed to load')
      return fn
    })()
    loaded = p
    // A failed load (offline, transient 404) must stay retryable.
    void p.catch(() => { if (loaded === p) loaded = null })
  }
  return loaded
}

export async function decodeHeicToPngBlob(file: File | Blob): Promise<Blob> {
  const g = globalThis as any
  // Only touch what is missing: on the main thread `window` is a
  // getter-only global, and assigning it back in `finally` threw
  // ("Cannot set property window of #<Window>"), which broke the
  // main-thread HEIC fallback outright.
  const shimWindow = typeof g.window === 'undefined'
  const shimDocument = typeof g.document === 'undefined'
  if (shimWindow) g.window = heicWorkerHandle ? { __heic2any__worker: heicWorkerHandle } : g
  if (shimDocument) g.document = heicShimDocument()
  try {
    const heic2any = await loadHeic2any()
    if (!heicWorkerHandle && g.window?.__heic2any__worker) {
      heicWorkerHandle = g.window.__heic2any__worker as Worker
    }
    const out = await heic2any({ blob: file, toType: 'image/png' })
    return (Array.isArray(out) ? out[0] : out) as Blob
  } finally {
    if (shimWindow) delete g.window
    if (shimDocument) delete g.document
  }
}
