// Decode the small upright preview image (made by the probe) into
// something the stage canvas can draw. createImageBitmap first: it decodes
// off the main thread and the result is ready to draw. Where it rejects or
// is missing (older iOS Safari rejected some blob types; a closed or
// purged bitmap after memory pressure), an <img> decoded with
// img.decode() is just as drawable. A failure here used to be swallowed,
// leaving the phone preview stuck on "Reading…" with no way out.

export type PreviewImage = CanvasImageSource & { width: number; height: number }

export interface LoadedPreview {
  img: PreviewImage
  close: () => void
}

export interface PreviewDecoders {
  bitmap?: ((b: Blob) => Promise<ImageBitmap>) | null
  element?: ((b: Blob) => Promise<PreviewImage>) | null
}

function hasSize(img: { width: number; height: number } | null | undefined): img is PreviewImage {
  return !!img && img.width > 0 && img.height > 0
}

export function decodeWithImg(blob: Blob): Promise<PreviewImage> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    const done = (ok: boolean) => {
      URL.revokeObjectURL(url)
      if (ok && img.naturalWidth > 0) {
        // naturalWidth/Height are what drawImage samples; width/height
        // mirror them on an image that is not in the document.
        resolve(img as PreviewImage)
      } else reject(new Error('preview decode failed'))
    }
    img.onload = () => {
      if (typeof img.decode === 'function') img.decode().then(() => done(true), () => done(img.naturalWidth > 0))
      else done(true)
    }
    img.onerror = () => done(false)
    img.src = url
  })
}

const defaultBitmap = typeof createImageBitmap === 'function' ? (b: Blob) => createImageBitmap(b) : null
const defaultElement = typeof Image === 'function' ? decodeWithImg : null

export async function loadPreviewImage(blob: Blob, dec: PreviewDecoders = {}): Promise<LoadedPreview> {
  const bitmap = dec.bitmap === undefined ? defaultBitmap : dec.bitmap
  const element = dec.element === undefined ? defaultElement : dec.element
  let firstErr: unknown = null
  if (bitmap) {
    try {
      const bmp = await bitmap(blob)
      if (hasSize(bmp)) return { img: bmp, close: () => bmp.close() }
      bmp.close?.()
    } catch (err) {
      firstErr = err
    }
  }
  if (element) {
    const img = await element(blob)
    if (hasSize(img)) return { img, close: () => { if ('src' in img) (img as HTMLImageElement).src = '' } }
  }
  throw firstErr ?? new Error('preview decode failed')
}
