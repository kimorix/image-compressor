// The format converter's job for the shared image pool (shared/image/jobs.ts).
// Its own small pipeline built from the shared primitives (the compressor
// is untouched): decode once at the original size, scan alpha, resolve the
// output format ('auto' = recommended by source), flatten transparency for
// JPEG, encode with the wasm encoder (canvas fallback for JPEG/PNG/WebP
// only, and only when it really produced the requested type), re-tag a
// Display P3 source, then carry EXIF across containers with GPS removed.
//
// Errors are thrown as feature dictionary keys (errDecode, errHeic, …); the
// view translates them. Deterministic failures (pixel cap) are marked
// non-retryable so the pool does not decode the same huge image twice.
import { canvasToBlob, decodeSource, get2d, makeCanvas, type AnyCanvas, type Ctx2D } from '../../../shared/image/codec'
import { canWriteExif, readExif, sanitizeExif, writeExif } from '../../../shared/image/exif-any'
import { decodeHeicToPngBlob } from '../../../shared/image/heic'
import { canEmbedPng, embedIcc, extractIcc, isDisplayP3 } from '../../../shared/image/icc'
import { jobError, type ImageJob } from '../../../shared/image/jobs'
import { exceedsPixelLimit } from '../../../shared/image/limits'
import { encodeAvif, encodeMozjpeg, encodePng, encodeWebp, type RgbaImage } from '../../../shared/image/wasm-encoders'
import type { ConvertJobPayload, ConvertJobResult, ExifOutcome, OutFormat } from '../types'
import { clampQuality, flattenAlpha, hasAlpha, isAnimated, OUT_MIME, qualityFor, recommendFormat } from './convert'

/** Error keys the job can throw (all present in the feature dictionary). */
export type ConvertErrorKey = 'errDecode' | 'errAvifDecode' | 'errHeic' | 'errTooLarge' | 'errEncode' | 'errUnsupported'

const keyT = (key: string) => key

async function encode(fmt: OutFormat, img: ImageData, quality: number | null, canvas: AnyCanvas, ctx: Ctx2D): Promise<Blob> {
  const mime = OUT_MIME[fmt]
  const q = clampQuality(quality ?? 90)
  try {
    const rgba: RgbaImage = { data: img.data, width: img.width, height: img.height }
    let buf: ArrayBuffer
    if (fmt === 'jpeg') buf = await encodeMozjpeg(rgba, q)
    else if (fmt === 'webp') buf = await encodeWebp(rgba, q)
    else if (fmt === 'avif') buf = await encodeAvif(rgba, q)
    else buf = await encodePng(rgba)
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
  let source: Blob = p.file
  if (p.src === 'heic') {
    try {
      source = await decodeHeicToPngBlob(p.file)
    } catch {
      throw jobError('errHeic')
    }
  }
  const animated = isAnimated(bytes, p.src)

  // Display P3 survives into every output that can carry the profile
  // (AVIF cannot, so it takes the safe sRGB path; auto lands on JPEG/WebP).
  const srcIcc = await extractIcc(source)
  const p3Source = srcIcc !== null && isDisplayP3(srcIcc)
  const early = p.format === 'auto' ? null : p.format
  let useP3 = p3Source && early !== 'avif' && (early !== 'png' || canEmbedPng())

  let decoded: Awaited<ReturnType<typeof decodeSource>>
  try {
    decoded = await decodeSource(source, keyT, useP3)
  } catch {
    throw jobError(p.src === 'avif' ? 'errAvifDecode' : 'errDecode')
  }
  const { w, h } = decoded
  if (!w || !h) throw jobError('errDecode')
  if (exceedsPixelLimit(w, h)) {
    ;(decoded.src as ImageBitmap).close?.()
    throw jobError('errTooLarge', false)
  }

  let canvas = makeCanvas()
  canvas.width = w
  canvas.height = h
  let ctx = get2d(canvas, { willReadFrequently: true, ...(useP3 ? { colorSpace: 'display-p3' as const } : {}) })
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
  const image = ctx.getImageData(0, 0, w, h)
  const alpha = hasAlpha(image.data)

  const format: OutFormat = p.format === 'auto' ? recommendFormat(p.src, alpha) : p.format
  if (format === 'avif') useP3 = false
  if (format === 'png' && !canEmbedPng()) useP3 = false
  const filled = format === 'jpeg' && alpha ? flattenAlpha(image.data, p.fill) : false
  const quality = qualityFor(p, format)

  let blob = await encode(format, image, quality, canvas, ctx)
  let out: Uint8Array | null = null
  if (useP3 && srcIcc) {
    out = await embedIcc(new Uint8Array(await blob.arrayBuffer()), OUT_MIME[format], srcIcc)
  }

  let exif: ExifOutcome = 'off'
  if (p.keepExif) {
    const raw = readExif(bytes, p.src)
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

  return { blob, format, width: w, height: h, quality, hasAlpha: alpha, filled, animated, exif, p3: useP3 }
}

export const convertJob: ImageJob<ConvertJobPayload, ConvertJobResult> = {
  async run(payload) {
    return { result: await convertImage(payload) }
  },
}
