// Lazy pdf.js loader. The legacy build keeps older iOS Safari working; the
// library, its worker and its data files (CMaps for CJK fonts, standard
// fonts, JPX/JBIG2 decoders) load only when the PDF feature first opens a
// file. The data files are copied to docs/pdfjs/ by the build (see
// vite.config.ts) and stay out of the PWA precache.
import type * as PdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

export type Pdfjs = typeof PdfjsLib
export type PdfDoc = Awaited<ReturnType<Pdfjs['getDocument']>['promise']>

let loading: Promise<Pdfjs> | null = null

export function loadPdfjs(): Promise<Pdfjs> {
  if (!loading) {
    loading = (async () => {
      const [lib, worker] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
      ])
      lib.GlobalWorkerOptions.workerSrc = worker.default
      return lib
    })()
    loading.catch(() => { loading = null })
  }
  return loading
}

/** docs/pdfjs/ next to docs/assets/, wherever the page itself lives. */
// (Built from a variable on purpose: Vite rewrites `new URL('literal',
// import.meta.url)` into a bundled asset, which these folders are not.)
const DATA_DIR = '../pdfjs/'
function dataUrl(sub: string): string {
  return new URL(DATA_DIR + sub + '/', import.meta.url).href
}

export class PdfPasswordError extends Error {
  constructor(public readonly incorrect: boolean) {
    super(incorrect ? 'incorrect password' : 'password required')
    this.name = 'PdfPasswordError'
  }
}

/** Open a PDF from bytes; password errors come back as PdfPasswordError. */
export async function openPdf(data: ArrayBuffer | Uint8Array, password?: string): Promise<PdfDoc> {
  const pdfjs = await loadPdfjs()
  const task = pdfjs.getDocument({
    data: data instanceof Uint8Array ? data : new Uint8Array(data),
    password: password || undefined,
    cMapUrl: dataUrl('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: dataUrl('standard_fonts'),
    wasmUrl: dataUrl('wasm'),
    enableXfa: false,
    // Real font names (bold/italic detection for standard fonts).
    fontExtraProperties: true,
  })
  try {
    return await task.promise
  } catch (err) {
    const e = err as { name?: string; code?: number }
    if (e?.name === 'PasswordException') {
      void task.destroy()
      throw new PdfPasswordError(e.code === pdfjs.PasswordResponses.INCORRECT_PASSWORD)
    }
    void task.destroy()
    throw err
  }
}
