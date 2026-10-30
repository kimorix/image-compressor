// Decode / canvas / encode helpers shared by every image tool (compressor,
// format conversion, resize & watermark, images to PDF). They run in either
// context — main thread or an image-pool worker — and branch on
// `typeof document === 'undefined'` only where the two differ.

type T = (key: string, ...args: (string | number)[]) => string

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export function loadImage(blob: Blob, t: T): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t('decodeError'))) }
    img.src = url
  })
}

// Decode to something a 2d context can draw. Workers have no <img>, so they
// use createImageBitmap (which also decodes off the caller's thread); the
// main thread keeps <img> for its wider format coverage (SVG on older
// Safari). Either way the caller gets a drawable source plus its size.
export async function decodeSource(blob: Blob, t: T, keepValues = false): Promise<{ src: CanvasImageSource; w: number; h: number }> {
  if (typeof document === 'undefined') {
    try {
      // P3 path: 'none' keeps the source values intact for the display-p3
      // canvas; the default would pre-convert them to sRGB, which the P3
      // tag would then mislabel.
      const bmp = await createImageBitmap(blob, keepValues ? { colorSpaceConversion: 'none' } : undefined)
      return { src: bmp, w: bmp.width, h: bmp.height }
    } catch {
      throw new Error(t('decodeError'))
    }
  }
  const img = await loadImage(blob, t)
  return { src: img, w: img.naturalWidth, h: img.naturalHeight }
}

// getContext on the AnyCanvas union types as the generic RenderingContext;
// every call here asks for '2d', so narrow it once.
export function get2d(c: AnyCanvas, opts: CanvasRenderingContext2DSettings): Ctx2D {
  return c.getContext('2d', opts) as Ctx2D
}

export function makeCanvas(): AnyCanvas {
  if (typeof document === 'undefined') return new OffscreenCanvas(1, 1)
  return document.createElement('canvas')
}

export async function canvasToBlob(c: AnyCanvas, type: string, q?: number): Promise<Blob | null> {
  if (typeof (c as OffscreenCanvas).convertToBlob === 'function') {
    return (c as OffscreenCanvas).convertToBlob({ type, quality: q })
  }
  return new Promise((res) => (c as HTMLCanvasElement).toBlob(res, type, type === 'image/png' ? undefined : q))
}
