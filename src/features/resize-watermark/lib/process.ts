// One image through the resize & watermark pipeline. Runs in an image-pool
// worker (normal path) or on the main thread (the pool's fallback); only
// the decode and canvas helpers differ between the two.
//
//   decode (HEIC via heic2any, EXIF orientation applied by the decoder)
//   → pixel cap → geometry (same pure function as the preview)
//   → high-quality downscale into the output canvas (pad / alpha fill)
//   → watermark → encode (wasm, canvas fallback) → ICC (P3) → EXIF (JPEG)
//
// Errors are thrown as JobErrors whose message is an i18n key of this
// feature ("errTooLarge:80" carries its argument after the colon), so the
// view translates them in the current language.
import { decodeHeicToPngBlob } from '../../../shared/image/heic'
import { gifFrameCount } from '../../../shared/image/gif'
import { canEmbedPng, embedIcc, extractIcc, isDisplayP3 } from '../../../shared/image/icc'
import { restoreExif } from '../../../shared/image/exif'
import { exceedsPixelLimit, MAX_PIXELS_MB } from '../../../shared/image/limits'
import { sniffFile, type ImageFormat } from '../../../shared/image/sniff'
import { canvasToBlob, get2d, loadImage, makeCanvas, type AnyCanvas, type Ctx2D } from '../../../shared/image/codec'
import { jobError } from '../../../shared/image/jobs'
import { encodeAvif, encodeMozjpeg, encodePng, encodeWebp, type RgbaImage } from '../../../shared/image/wasm-encoders'
import type { Focus, RwSettings } from '../types'
import { computeGeometry } from './geometry'
import { drawScaled } from './downscale'
import { drawWatermark, expandText, textVars } from './watermark'
import { EXIF_HEAD_BYTES, readExifBasics } from './exif-basics'
import { keepsAlpha, outputName, resolveOutType } from './settings'

type Drawable = CanvasImageSource & { width: number; height: number }

export interface Decoded {
  src: Drawable
  w: number
  h: number
  close: () => void
}

const isWorker = () => typeof document === 'undefined'

/**
 * Decode upright. Workers: createImageBitmap with imageOrientation
 * 'from-image' (the EXIF rotation is applied, so w/h are the displayed
 * size). Main thread: <img>, which applies EXIF orientation by default in
 * every current browser and also decodes SVG.
 */
export async function decodeUpright(blob: Blob, keepValues = false): Promise<Decoded> {
  if (isWorker()) {
    const opts: ImageBitmapOptions = { imageOrientation: 'from-image', ...(keepValues ? { colorSpaceConversion: 'none' } : {}) }
    let bmp: ImageBitmap
    try {
      bmp = await createImageBitmap(blob, opts)
    } catch {
      try {
        // Older engines reject unknown option values; the default is
        // 'from-image' in current specs.
        bmp = await createImageBitmap(blob)
      } catch {
        throw jobError('errDecode')
      }
    }
    return { src: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() }
  }
  try {
    const img = await loadImage(blob, () => 'errDecode')
    return { src: img as unknown as Drawable, w: img.naturalWidth, h: img.naturalHeight, close: () => { img.src = '' } }
  } catch {
    throw jobError('errDecode')
  }
}

export interface SourceInfo {
  format: ImageFormat | null
  /** Decodable blob (the decoded PNG for HEIC). */
  blob: Blob
  orientation: number
  date: string | null
  gifFrames: number
}

/** Sniff, read EXIF basics and GIF frames, and turn HEIC into a decodable PNG. */
export async function readSource(file: File): Promise<SourceInfo> {
  const format = await sniffFile(file)
  let orientation = 1
  let date: string | null = null
  if (format === 'jpeg') {
    const ex = readExifBasics(new Uint8Array(await file.slice(0, EXIF_HEAD_BYTES).arrayBuffer()))
    orientation = ex.orientation
    date = ex.date
  }
  const gifFrames = format === 'gif' ? gifFrameCount(new Uint8Array(await file.arrayBuffer())) : 0
  let blob: Blob = file
  if (format === 'heic' || (!format && /\.hei[cf]$/i.test(file.name))) {
    try {
      blob = await decodeHeicToPngBlob(file)
    } catch {
      throw jobError('errHeic')
    }
  }
  return { format, blob, orientation, date, gifFrames }
}

/** Formats whose pixels can carry transparency (alpha scan worth doing). */
const ALPHA_CAPABLE = new Set<string | null>(['png', 'webp', 'gif', 'avif', 'svg', 'ico', 'heic', 'tiff', null])

function hasAlphaIn(ctx: Ctx2D, x: number, y: number, w: number, h: number): boolean {
  if (w < 1 || h < 1) return false
  const d = ctx.getImageData(x, y, w, h).data
  for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true
  return false
}

async function encode(canvas: AnyCanvas, pixels: RgbaImage, type: string, quality: number): Promise<Blob> {
  try {
    let buf: ArrayBuffer
    if (type === 'image/jpeg') buf = await encodeMozjpeg(pixels, quality)
    else if (type === 'image/webp') buf = await encodeWebp(pixels, quality)
    else if (type === 'image/avif') buf = await encodeAvif(pixels, quality)
    else buf = await encodePng(pixels)
    return new Blob([buf], { type })
  } catch (err) {
    // No AVIF canvas fallback: browsers that encode AVIF from canvas are
    // rare, and a silent format change would surprise.
    console.warn(`[resize] ${type} wasm encode failed, canvas fallback:`, err)
    const b = await canvasToBlob(canvas, type, type === 'image/png' ? undefined : quality / 100)
    if (!b || b.type !== type) throw jobError('errEncode')
    return b
  }
}

export interface ProcessInput {
  file: File
  settings: RwSettings
  focus: Focus
  /** Decoded-ready logo image (PNG/WebP; SVG logos are rasterised on upload). */
  logo: Blob | null
}

export interface ProcessResult {
  blob: Blob
  type: string
  name: string
  srcW: number
  srcH: number
  outW: number
  outH: number
  /** Feature i18n keys of informational notes. */
  notes: string[]
}

export async function processImage({ file, settings, focus, logo }: ProcessInput): Promise<ProcessResult> {
  const info = await readSource(file)
  const outType = resolveOutType(settings.out.format, info.format)
  // Display P3 end to end where the output can carry the profile (AVIF
  // cannot: it stays on the sRGB path rather than risk a mistag).
  const srcIcc = await extractIcc(info.blob)
  let useP3 = srcIcc !== null && isDisplayP3(srcIcc)
    && (outType === 'image/jpeg' || outType === 'image/webp' || (outType === 'image/png' && canEmbedPng()))
  const dec = await decodeUpright(info.blob, useP3)
  let logoImg: Decoded | null = null
  try {
    const srcW = dec.w
    const srcH = dec.h
    if (exceedsPixelLimit(srcW, srcH)) throw jobError(`errTooLarge:${MAX_PIXELS_MB}`, false)
    const g = computeGeometry(srcW, srcH, settings.resize, focus)
    const W = g.canvas.w
    const H = g.canvas.h
    if (exceedsPixelLimit(W, H)) throw jobError(`errTooLarge:${MAX_PIXELS_MB}`, false)
    const notes: string[] = []
    if (info.orientation > 1) notes.push('noteOriented')
    if (info.gifFrames > 1) notes.push('noteGifFirstFrame')
    if (g.notUpscaled) notes.push('notUpscaled')

    let canvas = makeCanvas()
    const ctxOpts: CanvasRenderingContext2DSettings = { willReadFrequently: true, ...(useP3 ? { colorSpace: 'display-p3' as const } : {}) }
    canvas.width = W
    canvas.height = H
    let ctx = get2d(canvas, ctxOpts)
    if (useP3) {
      // A P3 tag on sRGB pixels is worse than no tag: only proceed when the
      // canvas really is display-p3.
      const attrs = (ctx as unknown as { getContextAttributes?: () => { colorSpace?: string } }).getContextAttributes?.()
      if (!attrs || attrs.colorSpace !== 'display-p3') {
        useP3 = false
        canvas = makeCanvas()
        canvas.width = W
        canvas.height = H
        ctx = get2d(canvas, { willReadFrequently: true })
      }
    }
    drawScaled(ctx, dec.src, g.crop, g.draw, useP3 ? { colorSpace: 'display-p3' } : {})
    dec.close()

    // Fill: JPEG has no alpha, so the pad colour goes behind everything
    // (letterbox and any transparent pixels); alpha formats get the pad
    // colour only in the letterbox, unless "transparent" is chosen.
    const alphaOut = keepsAlpha(outType)
    const fillBehind = (x: number, y: number, w: number, h: number) => {
      ctx.save()
      ctx.globalCompositeOperation = 'destination-over'
      ctx.fillStyle = settings.resize.padColor
      ctx.fillRect(x, y, w, h)
      ctx.restore()
    }
    if (!alphaOut) {
      if (ALPHA_CAPABLE.has(info.format) && hasAlphaIn(ctx, g.draw.x, g.draw.y, g.draw.w, g.draw.h)) notes.push('noteAlphaFlatten')
      fillBehind(0, 0, W, H)
    } else if (g.padded && !settings.resize.padTransparent) {
      // Letterbox only: the bands around the drawn picture.
      const d = g.draw
      if (d.y > 0) fillBehind(0, 0, W, d.y)
      if (d.y + d.h < H) fillBehind(0, d.y + d.h, W, H - d.y - d.h)
      if (d.x > 0) fillBehind(0, d.y, d.x, d.h)
      if (d.x + d.w < W) fillBehind(d.x + d.w, d.y, W - d.x - d.w, d.h)
    }

    const wm = settings.wm
    if (wm.enabled) {
      if (wm.kind === 'logo') {
        if (logo) {
          logoImg = await decodeUpright(logo)
          drawWatermark(ctx, W, H, wm, '', logoImg.src)
        } else notes.push('wmNoLogo')
      } else {
        const text = expandText(wm.text, textVars(file, info.date))
        if (text) drawWatermark(ctx, W, H, wm, text, null)
        else notes.push('wmEmpty')
      }
    }

    const pixels: RgbaImage = ctx.getImageData(0, 0, W, H)
    let blob = await encode(canvas, pixels, outType, settings.out.quality)
    canvas.width = 0
    canvas.height = 0
    if (useP3 && srcIcc) {
      blob = new Blob([await embedIcc(new Uint8Array(await blob.arrayBuffer()), outType, srcIcc) as BlobPart], { type: outType })
    }
    // EXIF back into JPEG → JPEG (GPS stripped, Orientation 1, new size).
    if (settings.out.keepExif && outType === 'image/jpeg' && info.format === 'jpeg') {
      blob = await restoreExif(file, blob, { w: W, h: H })
    }
    return {
      blob,
      type: outType,
      name: outputName(file.name, settings.out.suffix, W, H, outType),
      srcW,
      srcH,
      outW: W,
      outH: H,
      notes,
    }
  } finally {
    dec.close()
    logoImg?.close()
  }
}

/** Long side of the preview bitmap the view draws its live preview from. */
export const PREVIEW_LONG = 1200

export interface ProbeResult {
  w: number
  h: number
  format: ImageFormat | null
  orientation: number
  gifFrames: number
  date: string | null
  /** Upright preview (long side ≤ PREVIEW_LONG), WebP or PNG. */
  preview: Blob
}

/** Decode once for the list: upright size, notes and a small preview image. */
export async function probeImage(file: File): Promise<ProbeResult> {
  const info = await readSource(file)
  const dec = await decodeUpright(info.blob)
  try {
    if (exceedsPixelLimit(dec.w, dec.h)) throw jobError(`errTooLarge:${MAX_PIXELS_MB}`, false)
    const k = Math.min(1, PREVIEW_LONG / Math.max(dec.w, dec.h))
    const pw = Math.max(1, Math.round(dec.w * k))
    const ph = Math.max(1, Math.round(dec.h * k))
    const c = makeCanvas()
    c.width = pw
    c.height = ph
    const ctx = get2d(c, {})
    drawScaled(ctx, dec.src, { x: 0, y: 0, w: dec.w, h: dec.h }, { x: 0, y: 0, w: pw, h: ph })
    let preview = await canvasToBlob(c, 'image/webp', 0.86)
    if (!preview || preview.type !== 'image/webp') preview = await canvasToBlob(c, 'image/png')
    c.width = 0
    c.height = 0
    if (!preview) throw jobError('errDecode')
    return { w: dec.w, h: dec.h, format: info.format, orientation: info.orientation, gifFrames: info.gifFrames, date: info.date, preview }
  } finally {
    dec.close()
  }
}
