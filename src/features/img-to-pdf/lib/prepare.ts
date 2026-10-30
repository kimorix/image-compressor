// The images-to-PDF job for the shared image pool (kind 'img2pdf'). Runs in
// an image worker (or the pool's main-thread fallback) and never touches
// pdf-lib: it turns one image file into either
//   probe  → displayed size, EXIF orientation, alpha / animation flags and
//            a small white-backed paper-preview thumbnail, or
//   encode → the exact bytes to embed (JPEG or PNG) plus how to place them.
// Encode rules (kept in step with estimate.ts):
//   - "original" + JPEG: the file's own bytes with APP1/APP13/COM removed
//     (EXIF, GPS, XMP, IPTC gone; ICC and Adobe APP14 kept); the EXIF
//     orientation is applied by the PDF placement matrix, not by pixels.
//   - "original" + PNG: the file's own bytes (pdf-lib decodes and
//     re-deflates them, so no PNG metadata chunk reaches the PDF).
//   - everything else is decoded upright (HEIC via heic2any, GIF first
//     frame), scaled to the longest-edge cap and encoded: alpha → PNG
//     (palette PNG on "small"), otherwise MozJPEG. A JPEG / PNG source that
//     was not downscaled keeps its (stripped) original bytes when the
//     re-encode would be larger.
import { decodeSource, get2d, makeCanvas, canvasToBlob, type AnyCanvas } from '../../../shared/image/codec'
import { decodeHeicToPngBlob } from '../../../shared/image/heic'
import { gifFrameCount } from '../../../shared/image/gif'
import { exceedsPixelLimit, MAX_PIXELS_MB } from '../../../shared/image/limits'
import { sniffFormat, SNIFF_BYTES, type ImageFormat } from '../../../shared/image/sniff'
import { jobError, type ImageJob } from '../../../shared/image/jobs'
import { t as translate, type Lang } from '../../../shared/i18n'
import { jpegOrientation, jpegSize, stripJpegMetadata } from './jpeg'
import { downscale } from './estimate'
import type { Quality } from '../types'

/** Thumbnails: longest edge in px (2× a desktop tile). */
export const THUMB_EDGE = 360
/** SVGs are rasterised so their longest edge is at least this. */
export const SVG_MIN_EDGE = 2000

export interface ProbePayload {
  op: 'probe'
  file: File
  lang: Lang
}
export interface ProbeResult {
  format: ImageFormat | null
  /** Displayed size (EXIF orientation applied). */
  w: number
  h: number
  orientation: number
  hasAlpha: boolean
  animated: boolean
  thumb: Blob | null
}

export interface EncodePayload {
  op: 'encode'
  file: File
  lang: Lang
  format: ImageFormat | null
  quality: Quality
  /** JPEG quality 1–100 (also the palette-PNG quality on "small"). */
  q: number
  /** Longest edge cap in px; 0 = full size. */
  maxEdge: number
}
export interface EncodeResult {
  kind: 'jpg' | 'png'
  bytes: ArrayBuffer
  /** EXIF orientation still to apply when placing (1 = bytes are upright). */
  orientation: number
  /** Displayed pixel size of what was embedded. */
  w: number
  h: number
  downscaled: boolean
  /** True when the original file bytes were embedded (stripped). */
  original: boolean
}

export type Img2PdfPayload = ProbePayload | EncodePayload
export type Img2PdfResult = ProbeResult | EncodeResult

const ALPHA_FORMATS = new Set<ImageFormat | null>(['png', 'webp', 'gif', 'avif', 'svg', 'ico', 'tiff', 'heic', null])

function toArrayBuffer(u: Uint8Array): ArrayBuffer {
  return u.byteOffset === 0 && u.byteLength === u.buffer.byteLength
    ? (u.buffer as ArrayBuffer)
    : (u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer)
}

/** Any pixel not fully opaque? (Every 4th byte of RGBA data.) */
export function anyAlpha(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) return true
  return false
}

async function decoded(file: File, format: ImageFormat | null, tx: (k: string, ...a: (string | number)[]) => string) {
  const src: Blob = format === 'heic' ? await decodeHeicToPngBlob(file) : file
  const d = await decodeSource(src, tx)
  if (!(d.w > 0 && d.h > 0)) throw jobError(tx('decodeError'), false)
  if (exceedsPixelLimit(d.w, d.h)) {
    close(d.src)
    throw jobError(tx('tooManyPixels', MAX_PIXELS_MB), false)
  }
  return d
}

function close(src: CanvasImageSource) {
  if (typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap) src.close()
}

function draw(src: CanvasImageSource, w: number, h: number, white: boolean): AnyCanvas {
  const c = makeCanvas()
  c.width = w
  c.height = h
  const ctx = get2d(c, { willReadFrequently: !white })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (white) {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(src, 0, 0, w, h)
  return c
}

/** SVG upscale so a 24px icon is not a blur in the PDF. */
function svgScale(format: ImageFormat | null, w: number, h: number): number {
  return format === 'svg' && Math.max(w, h) < SVG_MIN_EDGE ? SVG_MIN_EDGE / Math.max(w, h) : 1
}

export async function probe({ file, lang }: ProbePayload): Promise<ProbeResult> {
  const tx = (key: string, ...a: (string | number)[]) => translate(lang, key, ...a)
  const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer())
  const format = sniffFormat(head)
  let orientation = 1
  if (format === 'jpeg') orientation = jpegOrientation(new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer()))
  const animated = format === 'gif' ? gifFrameCount(new Uint8Array(await file.arrayBuffer())) > 1 : false
  const d = await decoded(file, format, tx)
  try {
    const up = svgScale(format, d.w, d.h)
    const w = Math.round(d.w * up)
    const h = Math.round(d.h * up)
    // Alpha check on a reduced copy (≤ 512 px): enough to tell a
    // transparent logo from an opaque photo; encode re-checks at full size.
    let hasAlpha = false
    if (ALPHA_FORMATS.has(format)) {
      const k = Math.min(1, 512 / Math.max(d.w, d.h))
      const aw = Math.max(1, Math.round(d.w * k))
      const ah = Math.max(1, Math.round(d.h * k))
      const c = draw(d.src, aw, ah, false)
      hasAlpha = anyAlpha(get2d(c, { willReadFrequently: true }).getImageData(0, 0, aw, ah).data)
    }
    const k = Math.min(1, THUMB_EDGE / Math.max(d.w, d.h))
    const tw = Math.max(1, Math.round(d.w * k))
    const th = Math.max(1, Math.round(d.h * k))
    const thumb = await canvasToBlob(draw(d.src, tw, th, true), 'image/jpeg', 0.85)
    return { format, w, h, orientation, hasAlpha, animated, thumb }
  } finally {
    close(d.src)
  }
}

export async function encode(p: EncodePayload): Promise<EncodeResult> {
  const tx = (key: string, ...a: (string | number)[]) => translate(p.lang, key, ...a)
  const { file, format, quality } = p
  if (quality === 'original' && format === 'jpeg') {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const size = jpegSize(bytes)
    if (size) {
      const orientation = jpegOrientation(bytes)
      const swap = orientation >= 5
      return {
        kind: 'jpg', bytes: toArrayBuffer(stripJpegMetadata(bytes)), orientation,
        w: swap ? size.h : size.w, h: swap ? size.w : size.h, downscaled: false, original: true,
      }
    }
    // Unparseable JPEG: fall through to decode + re-encode.
  }
  const d = await decoded(file, format, tx)
  let W: number
  let H: number
  let k: number
  let rgba: ImageData
  try {
    const up = svgScale(format, d.w, d.h)
    const full = { w: Math.round(d.w * up), h: Math.round(d.h * up) }
    k = downscale(full.w, full.h, quality === 'original' ? 0 : p.maxEdge)
    W = Math.max(1, Math.round(full.w * k))
    H = Math.max(1, Math.round(full.h * k))
    if (quality === 'original' && format === 'png') {
      // Size known now; embed the PNG as it is.
      return { kind: 'png', bytes: await file.arrayBuffer(), orientation: 1, w: d.w, h: d.h, downscaled: false, original: true }
    }
    const c = draw(d.src, W, H, false)
    rgba = get2d(c, { willReadFrequently: true }).getImageData(0, 0, W, H)
  } finally {
    close(d.src)
  }
  const alpha = anyAlpha(rgba.data)
  const img = { data: rgba.data, width: W, height: H }
  const enc = await import('../../../shared/image/wasm-encoders')
  let out: ArrayBuffer
  if (alpha) out = quality === 'small' ? await enc.encodePngQuantized(img, p.q) : await enc.encodePng(img)
  else out = await enc.encodeMozjpeg(img, p.q)
  const kind: 'jpg' | 'png' = alpha ? 'png' : 'jpg'
  // Not downscaled: keep the original bytes when they are smaller (the
  // re-encode of an already-compressed JPEG is often bigger).
  if (k === 1 && (format === 'jpeg' || format === 'png')) {
    const src = new Uint8Array(await file.arrayBuffer())
    const orig = format === 'jpeg' ? stripJpegMetadata(src) : src
    if (orig.byteLength <= out.byteLength) {
      const size = format === 'jpeg' ? jpegSize(orig) : null
      if (format === 'png' || size) {
        const orientation = format === 'jpeg' ? jpegOrientation(src) : 1
        return {
          kind: format === 'jpeg' ? 'jpg' : 'png', bytes: toArrayBuffer(orig), orientation,
          w: W, h: H, downscaled: false, original: true,
        }
      }
    }
  }
  return { kind, bytes: out, orientation: 1, w: W, h: H, downscaled: k < 1, original: false }
}

export const img2pdfJob: ImageJob<Img2PdfPayload, Img2PdfResult> = {
  async run(payload) {
    if (payload.op === 'probe') return { result: await probe(payload) }
    const r = await encode(payload)
    return { result: r, transfer: [r.bytes] }
  },
}
