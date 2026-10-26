import { baseName, extOf } from './format'
import { restoreExif } from './exif'
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

// Pure with respect to shared state: it never mutates the item, it returns the
// result for the caller to apply. Callers snapshot the settings and guard with a
// generation counter, so a stale concurrent run can neither mix settings nor
// overwrite a newer run's result.
//
// Encoding is WASM-first: MozJPEG for JPEG, libwebp (method 6) for WebP, aom
// for AVIF, Rust png for lossless PNG, libimagequant for palette PNG. If a
// WASM encoder fails to load, the browser canvas encoder is the fallback for
// JPEG/WebP/PNG (Safari's canvas silently falls back WebP -> PNG, so the
// canvas path keeps the old WebP -> JPEG probe). AVIF has no reliable canvas
// fallback, so an AVIF failure surfaces as an error instead of silently
// changing the output format.
export async function compressItem(item: CompressItem, s: Settings, t: T): Promise<CompressResult> {
  try {
    // iPhone photos arrive as HEIC, which Chrome cannot decode: decode them
    // to a PNG first, then run the normal pipeline on the decoded pixels.
    // Sizes and names still refer to the original HEIC file.
    const source: Blob = isHeic(item.file)
      ? await decodeHeicToPngBlob(item.file)
      : item.file
    const img = await loadImage(source, t)
    const origW = img.naturalWidth
    const origH = img.naturalHeight
    let width = origW
    let height = origH
    const max = s.maxSize || 0
    if (max > 0) {
      const m = Math.max(width, height)
      if (m > max) {
        const scale = max / m
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      } else if (m < max && !s.noUpscale) {
        // noUpscale off means upscaling to the longest side is genuinely allowed.
        const scale = max / m
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
    }
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!

    let outType = s.format === 'original' ? item.file.type : s.format
    if (isHeic(item.file) && s.format === 'original') outType = 'image/jpeg'
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(outType)) outType = 'image/png'
    let targetNote: string | null = null
    let typeNote: string | null = null

    const canvasEncode = (type: string, q?: number): Promise<Blob | null> =>
      new Promise((res) => {
        canvas.toBlob(res, type, type === 'image/png' ? undefined : q)
      })

    // Draw at (w, h), read pixels, encode. Mutates outType/typeNote only on
    // the canvas fallback path (Safari WebP -> JPEG).
    const encodeAt = async (w: number, h: number, q?: number): Promise<Blob> => {
      canvas.width = w
      canvas.height = h
      if (outType === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h) }
      ctx.drawImage(img, 0, 0, w, h)
      const pixels: RgbaImage = ctx.getImageData(0, 0, w, h)
      try {
        let buf: ArrayBuffer
        if (outType === 'image/jpeg') buf = await encodeMozjpeg(pixels, Math.round((q ?? 0.8) * 100))
        else if (outType === 'image/webp') buf = await encodeWebp(pixels, Math.round((q ?? 0.8) * 100))
        else if (outType === 'image/avif') buf = await encodeAvif(pixels, Math.round((q ?? 0.8) * 100))
        else if (s.quantize) buf = await encodePngQuantized(pixels, Math.round((q ?? 0.8) * 100))
        else buf = await encodePng(pixels)
        return new Blob([buf], { type: outType })
      } catch (err) {
        // WASM unavailable: canvas fallback for the formats canvas can do.
        // A warning, not silence: a fallback that nobody can see is a bug
        // that never gets fixed.
        console.warn(`[image-compressor] ${outType} WASM encode failed, canvas fallback:`, err)
        const fallback = await canvasEncode(outType, outType === 'image/png' ? undefined : q)
        if (!fallback) throw new Error(t('formatError'))
        if (fallback.type !== outType) {
          if (outType === 'image/webp') {
            outType = 'image/jpeg'
            typeNote = t('typeNoteWebp')
            const jpeg = await canvasEncode('image/jpeg', q)
            if (!jpeg) throw new Error(t('formatError'))
            return jpeg
          }
          throw new Error(t('formatError'))
        }
        return fallback
      }
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
          let lo = 10, hi = 100, bestBlob: Blob | null = null, bestQ = 10
          while (lo <= hi) {
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
          for (let i = 0; i < 7; i++) {
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
    if (s.keepExif && outType === 'image/jpeg' && item.file.type === 'image/jpeg') {
      blob = await restoreExif(item.file, blob!)
    }
    // Never output something bigger than the input: re-encoding an already
    // compressed JPG (or PNG -> PNG) often grows the file.
    // In that case return the original file itself and mark it already optimal.
    // A fresh object URL is used so callers can revoke it without touching item.url.
    if (blob!.size >= item.file.size) {
      return {
        done: true,
        error: null,
        origW,
        origH,
        outUrl: URL.createObjectURL(item.file),
        outSize: item.file.size,
        outW: origW,
        outH: origH,
        outName: item.file.name,
        view: 'comp',
        targetNote: t('alreadyBest'),
        typeNote: null,
      }
    }
    return {
      done: true,
      error: null,
      origW,
      origH,
      outUrl: URL.createObjectURL(blob!),
      outSize: blob!.size,
      outW: width,
      outH: height,
      outName: baseName(item.file.name) + '-compressed.' + extOf(outType),
      view: 'comp',
      targetNote,
      typeNote,
    }
  } catch (err) {
    return { done: false, error: err instanceof Error ? err.message : t('compressFail') }
  }
}
