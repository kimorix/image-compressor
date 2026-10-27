import { baseName, extOf } from './format'
import { restoreExif } from './exif'
import { gifFrameCount } from './gif'
import { canEmbedPng, embedIcc, extractIcc, isDisplayP3 } from './icc'
import type { CompressItem, Settings } from '../types'
import {
  decodeHeicToPngBlob,
  encodeAvif,
  encodeMozjpeg,
  encodePng,
  encodePngQuantized,
  encodeWebp,
  isHeic,
  type RgbaImage,
} from './wasm-encoders'

type T = (key: string, ...args: (string | number)[]) => string

export interface CompressBlobSuccess {
  done: true
  error: null
  origW: number
  origH: number
  // The encoded bytes, or null when alreadyBest (caller reuses the input).
  outBlob: Blob | null
  alreadyBest: boolean
  outSize: number
  outW: number
  outH: number
  outName: string
  targetNote: string | null
  typeNote: string | null
  // Final output type (after any canvas fallback flip), whether any pixel
  // was transparent, and whether the input was an animated GIF.
  outType: string
  hasAlpha: boolean
  isAnimatedGif: boolean
}

export interface CompressBlobFailure {
  done: false
  error: string
}

export type CompressBlobResult = CompressBlobSuccess | CompressBlobFailure

export interface CompressSuccess {
  done: true
  error: null
  origW: number
  origH: number
  outUrl: string
  outSize: number
  outW: number
  outH: number
  outName: string
  view: 'comp'
  targetNote: string | null
  typeNote: string | null
  outType: string
  hasAlpha: boolean
  isAnimatedGif: boolean
}

export interface CompressFailure {
  done: false
  error: string
}

export type CompressResult = CompressSuccess | CompressFailure

function loadImage(blob: Blob, t: T): Promise<HTMLImageElement> {
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
async function decodeSource(blob: Blob, t: T, keepValues = false): Promise<{ src: CanvasImageSource; w: number; h: number }> {
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

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas

function makeCanvas(): AnyCanvas {
  if (typeof document === 'undefined') return new OffscreenCanvas(1, 1)
  return document.createElement('canvas')
}

async function canvasToBlob(c: AnyCanvas, type: string, q?: number): Promise<Blob | null> {
  if (typeof (c as OffscreenCanvas).convertToBlob === 'function') {
    return (c as OffscreenCanvas).convertToBlob({ type, quality: q })
  }
  return new Promise((res) => (c as HTMLCanvasElement).toBlob(res, type, type === 'image/png' ? undefined : q))
}

// Pure with respect to shared state: it never mutates its input, it returns
// the result for the caller to apply. Callers snapshot the settings and guard with a
// generation counter, so a stale concurrent run can neither mix settings nor
// overwrite a newer run's result. The core runs in either context — main
// thread or worker — and only the decode/canvas helpers branch on it.
//
// Encoding is WASM-first: MozJPEG for JPEG, libwebp (method 6) for WebP, aom
// for AVIF, Rust png for lossless PNG, libimagequant for palette PNG. If a
// WASM encoder fails to load, the browser canvas encoder is the fallback for
// JPEG/WebP/PNG (Safari's canvas silently falls back WebP -> PNG, so the
// canvas path keeps the old WebP -> JPEG probe). AVIF has no reliable canvas
// fallback, so an AVIF failure surfaces as an error instead of silently
// changing the output format.
export async function compressToBlob(file: File, s: Settings, t: T, canvasWebp: boolean): Promise<CompressBlobResult> {
  try {
    // iPhone photos arrive as HEIC, which Chrome cannot decode: decode them
    // to a PNG first, then run the normal pipeline on the decoded pixels.
    // Sizes and names still refer to the original HEIC file.
    const source: Blob = isHeic(file)
      ? await decodeHeicToPngBlob(file)
      : file
    // Animated GIF: walked from the file bytes (cheap, no decode), so the
    // row can carry the "first frame only" tag even before compressing.
    const isAnimatedGif = (file.type === 'image/gif' || /\.gif$/i.test(file.name))
      ? gifFrameCount(new Uint8Array(await file.arrayBuffer())) > 1
      : false
    // Display P3: extract the profile from the source blob (for HEIC this
    // is the decoded PNG, so a preserved iCCP still works). Only JPEG /
    // WebP / PNG-with-compression can carry the profile back out; AVIF
    // cannot, so it stays on the sRGB path rather than risk a mistag.
    const srcIcc = await extractIcc(source)
    let outType = s.format === 'original' ? file.type : s.format
    if (isHeic(file) && s.format === 'original') outType = 'image/jpeg'
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(outType)) outType = 'image/png'
    let useP3 = srcIcc !== null && isDisplayP3(srcIcc)
      && (outType === 'image/jpeg' || outType === 'image/webp'
        || (outType === 'image/png' && canEmbedPng()))
    const decoded = await decodeSource(source, t, useP3)
    const origW = decoded.w
    const origH = decoded.h
    let width = origW
    let height = origH
    const max = s.maxSize || 0
    const mode = s.resizeMode ?? 'longest'
    if (mode === 'percent') {
      // Percent: 100 = unchanged, 0 (legacy "no limit") = unchanged.
      if (max > 0 && max !== 100) {
        let scale = max / 100
        if (s.noUpscale && scale > 1) scale = 1
        width = Math.max(1, Math.round(width * scale))
        height = Math.max(1, Math.round(height * scale))
      }
    } else if (max > 0) {
      if (mode === 'width' || mode === 'height') {
        const dim = mode === 'width' ? width : height
        if (dim > max || !s.noUpscale) {
          const scale = max / dim
          width = Math.max(1, Math.round(width * scale))
          height = Math.max(1, Math.round(height * scale))
        }
      } else {
        const m = Math.max(width, height)
        if (m > max) {
          const scale = max / m
          width = Math.max(1, Math.round(width * scale))
          height = Math.max(1, Math.round(height * scale))
        } else if (m < max && !s.noUpscale) {
          // noUpscale off means upscaling to the longest side is genuinely allowed.
          const scale = max / m
          width = Math.max(1, Math.round(width * scale))
          height = Math.max(1, Math.round(height * scale))
        }
      }
    }
    let canvas = makeCanvas()
    let ctx = canvas.getContext('2d', { willReadFrequently: true, ...(useP3 ? { colorSpace: 'display-p3' } : {}) })!
    if (useP3) {
      // A mistagged output (P3 tag on sRGB pixels) is worse than no tag:
      // only proceed when the canvas really honors display-p3. Browsers
      // without getContextAttributes fall back to the sRGB path.
      const attrs = (ctx as unknown as { getContextAttributes?: () => { colorSpace?: string } }).getContextAttributes?.()
      if (!attrs || attrs.colorSpace !== 'display-p3') {
        useP3 = false
        canvas = makeCanvas()
        ctx = canvas.getContext('2d', { willReadFrequently: true })!
      }
    }
    let targetNote: string | null = null
    let typeNote: string | null = null

    const canvasEncode = (type: string, q?: number): Promise<Blob | null> =>
      canvasToBlob(canvas, type, q)

    // Draw at (w, h), read pixels, encode. Mutates outType/typeNote only on
    // the canvas fallback path (Safari WebP -> JPEG).
    // Transparency is scanned once per run, on a bare canvas before any
    // JPEG fill: the fill would destroy the alpha channel. It survives
    // resizing except for pathological single-pixel cases, and the flag
    // only feeds the JPEG note, so one pass is enough.
    let alphaScan: boolean | null = null
    const encodeAt = async (w: number, h: number, q?: number): Promise<Blob> => {
      canvas.width = w
      canvas.height = h
      if (alphaScan === null) {
        // Scan on a bare canvas: the JPEG white fill below would destroy
        // the alpha channel before the read, so the first candidate is
        // drawn twice (once unfilled, just for the scan).
        const ac = makeCanvas()
        ac.width = w
        ac.height = h
        const actx = ac.getContext('2d', { willReadFrequently: true })!
        actx.drawImage(decoded.src, 0, 0, w, h)
        const d = actx.getImageData(0, 0, w, h).data
        let has = false
        for (let i = 3; i < d.length; i += 4) {
          if (d[i] < 255) { has = true; break }
        }
        alphaScan = has
      }
      if (outType === 'image/jpeg') { ctx.fillStyle = s.jpegFill || '#ffffff'; ctx.fillRect(0, 0, w, h) }
      ctx.drawImage(decoded.src, 0, 0, w, h)
      const pixels: RgbaImage = ctx.getImageData(0, 0, w, h)
      let out: Blob
      try {
        let buf: ArrayBuffer
        if (outType === 'image/jpeg') buf = await encodeMozjpeg(pixels, Math.round((q ?? 0.8) * 100))
        else if (outType === 'image/webp') buf = await encodeWebp(pixels, Math.round((q ?? 0.8) * 100))
        else if (outType === 'image/avif') buf = await encodeAvif(pixels, Math.round((q ?? 0.8) * 100))
        else if (s.quantize) buf = await encodePngQuantized(pixels, Math.round((q ?? 0.8) * 100))
        else buf = await encodePng(pixels)
        out = new Blob([buf], { type: outType })
      } catch (err) {
        // WASM unavailable: canvas fallback for the formats canvas can do.
        // A warning, not silence: a fallback that nobody can see is a bug
        // that never gets fixed.
        console.warn(`[image-compressor] ${outType} WASM encode failed, canvas fallback:`, err)
        // canvasWebp is probed once on the main thread: a worker's
        // OffscreenCanvas cannot see the main canvas's behavior, and a
        // test double on HTMLCanvasElement would be invisible there. When
        // canvas cannot do WebP at all, go straight to JPEG with the note
        // instead of trusting the fallback's type.
        if (outType === 'image/webp' && !canvasWebp) {
          outType = 'image/jpeg'
          typeNote = t('typeNoteWebp')
          const jpeg = await canvasEncode('image/jpeg', q)
          if (!jpeg) throw new Error(t('formatError'))
          out = jpeg
        } else {
          const fallback = await canvasEncode(outType, outType === 'image/png' ? undefined : q)
          if (!fallback || fallback.type !== outType) throw new Error(t('formatError'))
          out = fallback
        }
      }
      // P3: tag every candidate, so the size search sees the true final
      // size (tag included) and the target guarantee still holds exactly.
      if (useP3 && srcIcc) {
        const bytes = new Uint8Array(await out.arrayBuffer())
        out = new Blob([await embedIcc(bytes, outType, srcIcc)], { type: outType })
      }
      return out
    }

    let blob: Blob | null = null
    if (s.mode === 'target') {
      const targetBytes = (s.targetSize || 200) * 1024
      let fitted = false
      if (outType !== 'image/png' || s.quantize) {
        const q100 = await encodeAt(width, height, 1)
        if (q100.size <= targetBytes) {
          blob = q100; targetNote = t('targetBest'); fitted = true
        } else {
          // Binary-search the whole [10,100] range down to a 1-wide
          // window: the exact highest fitting quality. An early stop
          // (window 4) saved ~2 encodes but left outputs up to ~30%
          // under target on graphic content, where adjacent quality
          // points jump in size; bestBlob only ever holds a fitting
          // encode, so the size guarantee (output <= target) is
          // unchanged. The two fancier options were evaluated and
          // rejected: starting from q80 averages the same (5 steps when
          // it fits, 7 when it misses, vs 6 always here), and a
          // downscaled probe needs stacked heuristics (cross-scale size
          // ratio + quality slope) yet its window would still need ~5
          // full-res encodes to verify.
          let lo = 10, hi = 100, bestBlob: Blob | null = null, bestQ = 10
          while (hi - lo > 1) {
            const mid = Math.floor((lo + hi) / 2)
            const b = await encodeAt(width, height, mid / 100)
            if (b.size <= targetBytes) { bestQ = mid; bestBlob = b; lo = mid + 1 }
            else hi = mid - 1
          }
          if (bestBlob) { blob = bestBlob; targetNote = t('targetAutoQ', bestQ); fitted = true }
        }
      }
      if (!fitted) {
        const q = outType === 'image/png' && !s.quantize ? undefined : 0.1
        const full = outType === 'image/png' ? await encodeAt(width, height, q) : null
        if (full && full.size <= targetBytes) {
          blob = full; targetNote = t('targetUnder')
        } else {
          let lo = 0.1, hi = 1, best: Blob | null = null, bestW = width, bestH = height
          // Same idea as the quality search: stop once the scale
          // interval is 0.02 wide (dimension within 2%), instead of a
          // fixed 7 rounds. best only holds fitting encodes, so the
          // size guarantee is unchanged.
          while (hi - lo > 0.02) {
            const sc = (lo + hi) / 2
            const w = Math.max(1, Math.round(width * sc)), h = Math.max(1, Math.round(height * sc))
            const b = await encodeAt(w, h, q)
            if (b.size <= targetBytes) { best = b; bestW = w; bestH = h; lo = sc }
            else hi = sc
          }
          if (best) {
            blob = best; width = bestW; height = bestH
            targetNote = outType === 'image/png' && !s.quantize ? t('targetAutoSize', width, height) : t('targetAutoSizeLow', width, height)
          } else {
            width = Math.max(1, Math.round(width * 0.1)); height = Math.max(1, Math.round(height * 0.1))
            blob = await encodeAt(width, height, q)
            targetNote = t('targetMin')
          }
        }
      }
    } else {
      const quality = s.quality / 100
      blob = await encodeAt(width, height, outType === 'image/png' && !s.quantize ? undefined : quality)
    }
    // Optional EXIF preservation (JPEG only): re-encoding strips metadata,
    // so copy the original EXIF block back into the compressed JPEG.
    // Runs before the never-bigger check, so injected bytes count: if the
    // EXIF block pushes it over the original, already-best still wins
    // (and the original keeps its EXIF anyway).
    if (s.keepExif && outType === 'image/jpeg' && file.type === 'image/jpeg') {
      blob = await restoreExif(file, blob!)
    }
    // Never output something bigger than the input: re-encoding an already
    // compressed JPG (or PNG -> PNG) often grows the file.
    // In that case return the original file itself and mark it already optimal.
    // The caller (main thread) makes a fresh object URL so revoking it
    // cannot touch the item's own preview URL.
    if (blob!.size >= file.size) {
      return {
        done: true,
        error: null,
        origW,
        origH,
        outBlob: null,
        alreadyBest: true,
        outSize: file.size,
        outW: origW,
        outH: origH,
        outName: file.name,
        targetNote: t('alreadyBest'),
        typeNote: null,
        outType: file.type,
        hasAlpha: alphaScan ?? false,
        isAnimatedGif,
      }
    }
    return {
      done: true,
      error: null,
      origW,
      origH,
      outBlob: blob!,
      alreadyBest: false,
      outSize: blob!.size,
      outW: width,
      outH: height,
      outName: baseName(file.name) + (s.keepOriginalName ? '' : '-compressed') + '.' + extOf(outType),
      targetNote,
      typeNote,
      outType,
      hasAlpha: alphaScan ?? false,
      isAnimatedGif,
    }
  } catch (err) {
    return { done: false, error: err instanceof Error ? err.message : t('compressFail') }
  }
}

// Main-thread entry point: the blob core plus object-URL ownership. Workers
// use compressToBlob directly and hand the blob back for the same treatment.
export async function compressItem(item: CompressItem, s: Settings, t: T, canvasWebp: boolean): Promise<CompressResult> {
  const res = await compressToBlob(item.file, s, t, canvasWebp)
  if (!res.done) return res
  return {
    done: true,
    error: null,
    origW: res.origW,
    origH: res.origH,
    outUrl: URL.createObjectURL(res.alreadyBest ? item.file : res.outBlob!),
    outSize: res.outSize,
    outW: res.outW,
    outH: res.outH,
    outName: res.outName,
    view: 'comp',
    targetNote: res.targetNote,
    typeNote: res.typeNote,
    outType: res.outType,
    hasAlpha: res.hasAlpha,
    isAnimatedGif: res.isAnimatedGif,
  }
}
