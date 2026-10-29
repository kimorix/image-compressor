// "Estimated size" before generating: a cheap model of what prepare.ts
// will produce, per page, from the probed size and the settings. It mirrors
// prepare's decisions (embed original / downscale / JPEG vs PNG / keep the
// original when the re-encode would be larger) and uses typical bytes per
// pixel for the encoders. Shown as "about"; the real size replaces it
// after generating. Pure, unit tested.
import type { ImageFormat } from '../../../shared/image/sniff'
import type { Img2PdfSettings } from '../types'
import { encodeParams } from './settings'

export interface EstimateInput {
  /** Source file size in bytes. */
  bytes: number
  format: ImageFormat | null
  /** Displayed size in px (0 while still probing). */
  w: number
  h: number
  hasAlpha: boolean
}

/** PDF structure: header, catalog, xref, info dict, plus per-page objects. */
export const PDF_BASE_BYTES = 900
export const PDF_PAGE_BYTES = 420

/** Typical MozJPEG bytes per pixel for a photo at quality q (4:2:0). */
export function jpegBytesPerPixel(q: number): number {
  const x = Math.min(100, Math.max(1, q)) / 100
  return 0.05 + 0.3 * x ** 4
}
/** Lossless PNG (photo-like content with alpha) / palette PNG. */
export const PNG_BYTES_PER_PIXEL = 1.2
export const PNG_QUANT_BYTES_PER_PIXEL = 0.45

/** Scale factor prepare applies for a longest edge cap (0 = none). */
export function downscale(w: number, h: number, maxEdge: number): number {
  const long = Math.max(w, h)
  return maxEdge > 0 && long > maxEdge ? maxEdge / long : 1
}

/** Embeddable as-is on the "original" setting (pdf-lib takes JPEG and PNG). */
export function embedsOriginal(format: ImageFormat | null): boolean {
  return format === 'jpeg' || format === 'png'
}

/** Estimated bytes one image adds to the PDF (image stream only). */
export function estimateImage(img: EstimateInput, s: Img2PdfSettings): number {
  if (s.quality === 'original' && embedsOriginal(img.format)) return img.bytes
  const { q, maxEdge } = encodeParams(s)
  if (!(img.w > 0 && img.h > 0)) return img.bytes
  const k = downscale(img.w, img.h, maxEdge)
  const px = img.w * img.h * k * k
  const est = img.hasAlpha
    ? px * (s.quality === 'small' ? PNG_QUANT_BYTES_PER_PIXEL : PNG_BYTES_PER_PIXEL)
    : px * jpegBytesPerPixel(q)
  // prepare keeps the (stripped) original when re-encoding at full size
  // would only make it bigger.
  if (k === 1 && embedsOriginal(img.format)) return Math.min(img.bytes, est)
  return est
}

/**
 * Total estimated output bytes. `single`: one PDF; `perImage`: the sum of
 * one PDF per image (each with its own structure overhead; the zip adds
 * ~100 B per entry on top, ignored).
 */
export function estimateTotal(imgs: EstimateInput[], s: Img2PdfSettings): number {
  if (!imgs.length) return 0
  const images = imgs.reduce((n, i) => n + estimateImage(i, s), 0)
  const docs = s.output === 'perImage' ? imgs.length : 1
  return Math.round(images + docs * PDF_BASE_BYTES + imgs.length * PDF_PAGE_BYTES)
}
