// The format converter's job for the shared image pool (shared/image/jobs.ts).
// Its own small pipeline built from the shared primitives (the compressor
// is untouched): decode once at the original size, scan alpha, resolve the
// output format ('auto' = recommended by source), flatten transparency for
// JPEG, encode with the wasm encoder (PNG: the lossless optimizing writer
// in shared/image/png-lossless.ts; canvas fallback for JPEG/PNG/WebP
// only, and only when it really produced the requested type), re-tag a
// Display P3 source, then carry EXIF across containers with GPS removed.
//
// Errors are thrown as feature dictionary keys (errDecode, errHeic, …); the
// view translates them. Deterministic failures (pixel cap) are marked
// non-retryable so the pool does not decode the same huge image twice.
//
// Inputs and outputs beyond the browser's own codecs (TIFF, PSD, TGA, QOI,
// ICO, JPEG XL, camera RAW previews, SVG sizing; BMP / GIF / TIFF / ICO /
// QOI / JPEG XL writers) live in shared/image/formats/codec-*.ts and are
// imported dynamically, each only when a file needs it: the JPEG / PNG /
// WebP / AVIF path below is the same code as before and loads none of them.
import { canvasToBlob, decodeSource, get2d, makeCanvas, type AnyCanvas, type Ctx2D } from '../../../shared/image/codec'
import { canWriteExif, readExif, sanitizeExif, writeExif } from '../../../shared/image/exif-any'
import { decodeHeicToPngBlob } from '../../../shared/image/heic'
import { canEmbedPng, embedIcc, extractIcc, isDisplayP3 } from '../../../shared/image/icc'
import { jobError, type ImageJob } from '../../../shared/image/jobs'
import { exceedsPixelLimit } from '../../../shared/image/limits'
import { encodePngLossless } from '../../../shared/image/png-lossless'
import { encodeAvif, encodeMozjpeg, encodePng, encodePngQuantized, encodeWebp, type RgbaImage } from '../../../shared/image/wasm-encoders'
import type { ConvertJobPayload, ConvertJobResult, ExifOutcome, NoteKey, OutFormat } from '../types'
import { clampQuality, flattenAlpha, hasAlpha, isAnimated, OUT_MIME, qualityFor, recommendFormat } from './convert'

/** Error keys the job can throw (all present in the feature dictionary). */
export type ConvertErrorKey = 'errDecode' | 'errAvifDecode' | 'errHeic' | 'errTooLarge' | 'errEncode' | 'errUnsupported' | 'errRawNoPreview' | 'errPsd' | 'errJxlTooLarge'

/** Sources the browser decodes itself (the original pipeline). */
const NATIVE_INPUT = new Set(['jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'bmp'])
/** Outputs written by the original pipeline (wasm encoders + canvas fallback). */
const CLASSIC_OUTPUT = new Set<OutFormat>(['jpeg', 'png', 'webp', 'avif'])

interface Pixels { data: Uint8ClampedArray; width: number; height: number }

/** What a non-native source decodes to: an image the browser can draw, or our own pixels. */
type Prepared = { blob: Blob; orientation: number } | { pixels: Pixels }

function tooLarge(w: number, h: number) {
  if (exceedsPixelLimit(w, h)) throw jobError('errTooLarge', false)
}

/** Our own decoders are pure: a failure repeats on the main thread, so do not retry there. */
function undecodable(key: ConvertErrorKey = 'errDecode'): never {
  throw jobError(key, false)
}

async function prepareOther(p: ConvertJobPayload, bytes: Uint8Array, extra: NoteKey[], aux: { exifJpeg?: Uint8Array }): Promise<Prepared> {
  switch (p.src) {
    case 'tiff': {
      const { decodeTiff } = await import('../../../shared/image/formats/codec-tiff')
      const { readTiff, intTag, tiffPageIndexes } = await import('../../../shared/image/formats/codec-tiff-ifd')
      const t = readTiff(bytes)
      if (!t) undecodable()
      const pages = tiffPageIndexes(t)
      const ifd = t.ifds[pages[Math.min(p.page, pages.length - 1)] ?? 0]
      tooLarge(intTag(t, ifd, 256) ?? 0, intTag(t, ifd, 257) ?? 0)
      try {
        return { pixels: decodeTiff(bytes, p.page) }
      } catch (err) {
        console.warn('[format-convert] TIFF decode failed:', err)
        return undecodable()
      }
    }
    case 'raw': {
      const { extractRawPreview, jpegHasOrientation } = await import('../../../shared/image/formats/codec-raw')
      const prev = extractRawPreview(bytes)
      if (!prev) return undecodable('errRawNoPreview')
      extra.push('rawPreview')
      aux.exifJpeg = prev.jpeg
      return { blob: new Blob([prev.jpeg as BlobPart], { type: 'image/jpeg' }), orientation: jpegHasOrientation(prev.jpeg) ? 1 : prev.orientation }
    }
    case 'ico': {
      const { decodeIco } = await import('../../../shared/image/formats/codec-ico')
      let ico: Awaited<ReturnType<typeof decodeIco>>
      try { ico = decodeIco(bytes) } catch { return undecodable() }
      if (ico.count > 1) extra.push('icoLargest')
      if (ico.kind === 'png') return { blob: new Blob([ico.bytes as BlobPart], { type: 'image/png' }), orientation: 1 }
      return { pixels: ico.image }
    }
    case 'psd': {
      const { decodePsd } = await import('../../../shared/image/formats/codec-psd')
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      if (bytes.length >= 26) tooLarge(dv.getUint32(18), dv.getUint32(14))
      try {
        const img = decodePsd(bytes)
        extra.push(img.empty ? 'psdEmpty' : 'psdComposite')
        return { pixels: img }
      } catch (err) {
        console.warn('[format-convert] PSD decode failed:', err)
        return undecodable('errPsd')
      }
    }
    case 'tga': {
      const { decodeTga } = await import('../../../shared/image/formats/codec-tga')
      if (bytes.length >= 18) tooLarge(bytes[12] | (bytes[13] << 8), bytes[14] | (bytes[15] << 8))
      try { return { pixels: decodeTga(bytes) } } catch { return undecodable() }
    }
    case 'qoi': {
      const { decodeQoi } = await import('../../../shared/image/formats/codec-qoi')
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      if (bytes.length >= 14) tooLarge(dv.getUint32(4), dv.getUint32(8))
      try { return { pixels: decodeQoi(bytes) } } catch { return undecodable() }
    }
    case 'jxl': {
      // Native first (Safari 17+), libjxl wasm everywhere else.
      try {
        const d = await decodeSource(p.file, keyT)
        ;(d.src as ImageBitmap).close?.()
        if (d.w && d.h) return { blob: p.file, orientation: 1 }
      } catch { /* not native here */ }
      const { decodeJxl } = await import('../../../shared/image/formats/codec-jxl')
      try { return { pixels: await decodeJxl(bytes) } } catch (err) {
        console.warn('[format-convert] JPEG XL decode failed:', err)
        return undecodable()
      }
    }
    case 'svg': {
      // Workers cannot decode SVG: fail here so the pool reruns this job
      // on the main thread (retryable), where <img> renders it.
      if (typeof document === 'undefined') throw jobError('errDecode')
      const { svgIntrinsicSize, svgRasterSize, pinSvgSize } = await import('../../../shared/image/formats/codec-svg')
      const text = new TextDecoder().decode(bytes)
      const i = svgIntrinsicSize(text)
      const r = svgRasterSize(i.w, i.h)
      extra.push('svgRaster')
      return { blob: new Blob([pinSvgSize(text, r.w, r.h)], { type: 'image/svg+xml' }), orientation: 1 }
    }
    default:
      return undecodable('errUnsupported')
  }
}

/** EXIF source block for the non-native inputs (TIFF / RAW / JPEG XL); null = none. */
async function readOtherExif(src: string, bytes: Uint8Array, aux: { exifJpeg?: Uint8Array }): Promise<Uint8Array | null> {
  try {
    if (src === 'tiff' || src === 'raw') {
      const { exifFromTiff } = await import('../../../shared/image/formats/codec-tiff-ifd')
      return exifFromTiff(bytes) ?? (aux.exifJpeg ? readExif(aux.exifJpeg, 'jpeg') : null)
    }
    if (src === 'jxl') {
      const { jxlExif } = await import('../../../shared/image/formats/codec-jxl')
      return jxlExif(bytes)
    }
  } catch { /* fail soft: no EXIF */ }
  return null
}

/** Writers for the outputs beyond JPEG / PNG / WebP / AVIF (no canvas fallback). */
async function encodeOther(fmt: OutFormat, img: ImageData, alpha: boolean, quality: number | null, icoSizes: number[], extra: NoteKey[]): Promise<{ blob: Blob; sizes: number[] }> {
  const mime = OUT_MIME[fmt]
  const rgba: RgbaImage = { data: img.data, width: img.width, height: img.height }
  let sizes: number[] = []
  let out: Uint8Array
  try {
    if (fmt === 'bmp') out = (await import('../../../shared/image/formats/codec-bmp')).encodeBmp(rgba, alpha)
    else if (fmt === 'tiff') out = await (await import('../../../shared/image/formats/codec-tiff')).encodeTiff(rgba, alpha)
    else if (fmt === 'qoi') out = (await import('../../../shared/image/formats/codec-qoi')).encodeQoi(rgba, alpha)
    else if (fmt === 'jxl') {
      const { encodeJxl, JXL_MAX_PIXELS } = await import('../../../shared/image/formats/codec-jxl')
      // Same answer on every thread: do not rerun it on the main thread.
      if (rgba.width * rgba.height > JXL_MAX_PIXELS) throw jobError('errJxlTooLarge', false)
      out = await encodeJxl(rgba, clampQuality(quality ?? 80))
    }
    else if (fmt === 'ico') {
      const r = await (await import('../../../shared/image/formats/codec-ico')).encodeIco(rgba, icoSizes, (sq) => encodePngLossless(sq, true))
      out = r.bytes
      sizes = r.sizes
      extra.push('icoSizes')
    } else if (fmt === 'gif') {
      // Quantizing is one pass here (not a size search): libimagequant at
      // speed 4 gives a visibly better palette than the compressor's 10.
      const r = await (await import('../../../shared/image/formats/codec-gif')).encodeGif(rgba, (im) => encodePngQuantized(im, 100, 4))
      out = r.bytes
      if (r.semi) extra.push('gifAlpha')
      if (r.quantized) extra.push('gifColors')
    } else throw new Error(`no writer for ${fmt}`)
  } catch (err) {
    if ((err as Error)?.message === 'errJxlTooLarge') throw err
    console.warn(`[format-convert] ${fmt} encode failed:`, err)
    throw jobError('errEncode')
  }
  return { blob: new Blob([out as BlobPart], { type: mime }), sizes }
}

const keyT = (key: string) => key

// PNG output is always lossless (the plan hides quality for PNG): the
// optimizing writer shrinks the colour type exactly (palette / grey / RGB),
// and the Rust wasm encoder (RGBA, fast deflate) stays as the fallback.
// libimagequant is never used here: even at quality 100 it moves colours
// of semi-transparent edges.
async function encodePngStrictlyLossless(rgba: RgbaImage): Promise<ArrayBuffer> {
  try {
    return await encodePngLossless(rgba)
  } catch (err) {
    console.warn('[format-convert] optimized PNG failed, wasm fallback:', err)
    return encodePng(rgba)
  }
}

async function encode(fmt: OutFormat, img: ImageData, quality: number | null, canvas: AnyCanvas, ctx: Ctx2D): Promise<Blob> {
  const mime = OUT_MIME[fmt]
  const q = clampQuality(quality ?? 90)
  try {
    const rgba: RgbaImage = { data: img.data, width: img.width, height: img.height }
    let buf: ArrayBuffer
    if (fmt === 'jpeg') buf = await encodeMozjpeg(rgba, q)
    else if (fmt === 'webp') buf = await encodeWebp(rgba, q)
    else if (fmt === 'avif') buf = await encodeAvif(rgba, q)
    else buf = await encodePngStrictlyLossless(rgba)
    return new Blob([buf], { type: mime })
  } catch (err) {
    // AVIF has no dependable canvas encoder: fail instead of switching type.
    if (fmt === 'avif') throw jobError('errEncode')
    console.warn(`[format-convert] ${fmt} wasm encode failed, canvas fallback:`, err)
    ctx.putImageData(img, 0, 0)
    const out = await canvasToBlob(canvas, mime, fmt === 'png' ? undefined : q / 100)
    // Safari's canvas silently answers WebP with PNG: conversion must
    // output exactly the chosen format, so that is an error, not a swap.
    if (!out || out.type !== mime) throw jobError('errEncode')
    return out
  }
}

export async function convertImage(p: ConvertJobPayload): Promise<ConvertJobResult> {
  const bytes = new Uint8Array(await p.file.arrayBuffer())
  const extra: NoteKey[] = []
  const aux: { exifJpeg?: Uint8Array } = {}
  let source: Blob = p.file
  let pixels: Pixels | null = null
  let orientation = 1
  if (p.src === 'heic') {
    try {
      source = await decodeHeicToPngBlob(p.file)
    } catch {
      throw jobError('errHeic')
    }
  } else if (!NATIVE_INPUT.has(p.src)) {
    const prep = await prepareOther(p, bytes, extra, aux)
    if ('pixels' in prep) pixels = prep.pixels
    else {
      source = prep.blob
      orientation = prep.orientation
    }
  }
  const animated = isAnimated(bytes, p.src)

  // Display P3 survives into every output that can carry the profile
  // (JPEG, WebP, PNG where supported; AVIF and the newer outputs take the
  // safe sRGB path; auto lands on JPEG/WebP/PNG). Our own decoders give
  // plain sRGB pixels.
  const srcIcc = pixels ? null : await extractIcc(source)
  const p3Source = srcIcc !== null && isDisplayP3(srcIcc)
  const early = p.format === 'auto' ? null : p.format
  let useP3 = p3Source && (early === null || early === 'jpeg' || early === 'webp' || (early === 'png' && canEmbedPng()))

  let w: number
  let h: number
  let canvas = makeCanvas()
  let ctx: Ctx2D
  let image: ImageData
  if (pixels) {
    w = pixels.width
    h = pixels.height
    if (!w || !h) throw jobError('errDecode', false)
    tooLarge(w, h)
    canvas.width = w
    canvas.height = h
    ctx = get2d(canvas, { willReadFrequently: true })
    image = new ImageData(pixels.data as Uint8ClampedArray<ArrayBuffer>, w, h)
  } else {
    let decoded: Awaited<ReturnType<typeof decodeSource>>
    try {
      decoded = await decodeSource(source, keyT, useP3)
    } catch {
      throw jobError(p.src === 'avif' ? 'errAvifDecode' : 'errDecode')
    }
    w = decoded.w
    h = decoded.h
    if (!w || !h) throw jobError('errDecode')
    if (exceedsPixelLimit(w, h)) {
      ;(decoded.src as ImageBitmap).close?.()
      throw jobError('errTooLarge', false)
    }

    canvas.width = w
    canvas.height = h
    ctx = get2d(canvas, { willReadFrequently: true, ...(useP3 ? { colorSpace: 'display-p3' as const } : {}) })
    if (useP3) {
      // Only tag P3 when the canvas really works in P3 (a mistag is worse).
      const attrs = (ctx as unknown as { getContextAttributes?: () => { colorSpace?: string } }).getContextAttributes?.()
      if (!attrs || attrs.colorSpace !== 'display-p3') {
        useP3 = false
        canvas = makeCanvas()
        canvas.width = w
        canvas.height = h
        ctx = get2d(canvas, { willReadFrequently: true })
      }
    }
    ctx.drawImage(decoded.src, 0, 0, w, h)
    ;(decoded.src as ImageBitmap).close?.()
    image = ctx.getImageData(0, 0, w, h)
    // A RAW container's Orientation (its preview JPEG has none of its own).
    if (orientation > 1) {
      const { orientRgba } = await import('../../../shared/image/formats/codec-tiff-ifd')
      const up = orientRgba(image.data, w, h, orientation)
      w = up.width
      h = up.height
      canvas.width = w
      canvas.height = h
      image = new ImageData(up.data as Uint8ClampedArray<ArrayBuffer>, w, h, useP3 ? { colorSpace: 'display-p3' } : undefined)
    }
  }
  const alpha = hasAlpha(image.data)

  const format: OutFormat = p.format === 'auto' ? recommendFormat(p.src, alpha) : p.format
  if (format !== 'jpeg' && format !== 'webp' && format !== 'png') useP3 = false
  if (format === 'png' && !canEmbedPng()) useP3 = false
  const filled = format === 'jpeg' && alpha ? flattenAlpha(image.data, p.fill) : false
  const quality = qualityFor(p, format)

  let blob: Blob
  let icoSizes: number[] = []
  if (CLASSIC_OUTPUT.has(format)) blob = await encode(format, image, quality, canvas, ctx)
  else ({ blob, sizes: icoSizes } = await encodeOther(format, image, alpha, quality, p.icoSizes ?? [], extra))
  let out: Uint8Array | null = null
  if (useP3 && srcIcc) {
    out = await embedIcc(new Uint8Array(await blob.arrayBuffer()), OUT_MIME[format], srcIcc)
  }

  let exif: ExifOutcome = 'off'
  if (p.keepExif) {
    const raw = NATIVE_INPUT.has(p.src) ? readExif(bytes, p.src) : await readOtherExif(p.src, bytes, aux)
    const clean = raw ? await sanitizeExif(raw) : null
    if (!clean) exif = 'none'
    else if (!canWriteExif(OUT_MIME[format])) exif = 'avif'
    else {
      const before = out ?? new Uint8Array(await blob.arrayBuffer())
      out = await writeExif(before, OUT_MIME[format], clean)
      // writeExif hands back its input when the layout was unexpected.
      exif = out !== before ? 'kept' : 'none'
    }
  }
  if (out) blob = new Blob([out as BlobPart], { type: OUT_MIME[format] })

  return { blob, format, width: w, height: h, quality, hasAlpha: alpha, filled, animated, exif, p3: useP3, extra, icoSizes }
}

export const convertJob: ImageJob<ConvertJobPayload, ConvertJobResult> = {
  async run(payload) {
    return { result: await convertImage(payload) }
  },
}
