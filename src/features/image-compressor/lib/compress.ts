import { baseName, extOf } from '../../../shared/lib/format'
import { exceedsPixelLimit, MAX_PIXELS_MB } from './limits'
import { restoreExif } from './exif'
import { gifFrameCount } from './gif'
import { canEmbedPng, embedIcc, extractIcc, isDisplayP3 } from './icc'
import { searchQuality, ssim, toLuma, type Luma } from './ssim'
import type { CompressItem, Settings } from '../types'
import { decodeHeicToPngBlob } from './heic'
import {
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
  // True when targetNote asks for the user's attention (the image was
  // resized to fit, or still misses the target at minimum size). Purely
  // informational notes (auto/smart quality, best quality) stay false, so
  // the phone card only shows its ⓘ marker for notes worth opening.
  targetNoteNotable: boolean
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
  retryable?: boolean
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
  targetNoteNotable: boolean
  typeNote: string | null
  outType: string
  hasAlpha: boolean
  isAnimatedGif: boolean
}

export interface CompressFailure {
  done: false
  error: string
  // Set when the user cancelled the run (the pool terminates its workers).
  cancelled?: boolean
  // False for a deterministic failure (e.g. pixel cap): retrying on the main
  // thread would decode the same huge image a second time.
  retryable?: boolean
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

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

// getContext on the AnyCanvas union types as the generic RenderingContext;
// every call here asks for '2d', so narrow it once.
function get2d(c: AnyCanvas, opts: CanvasRenderingContext2DSettings): Ctx2D {
  return c.getContext('2d', opts) as Ctx2D
}

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

// Smart quality bounds and threshold. Calibrated on 1920px photos with
// WebP: mean SSIM 0.985 on the 1024px luma lands smooth photos around
// q60-75 and detailed ones higher, while q80 scores 0.988-0.993. q50 is the
// floor (below it banding shows even when SSIM still passes), q90 the
// ceiling (above it sizes balloon for no visible gain).
const SMART_Q_MIN = 50
const SMART_Q_MAX = 90
const SMART_SSIM = 0.985

// Decode an encoded candidate back to pixels at (w, h) for scoring. Null
// when the browser cannot decode the type (AVIF on older Safari): the
// caller then keeps its fixed-quality result.
// p3: the reference pixels came from a display-p3 canvas, so read the
// candidate's raw values too (its embedded P3 tag must not be converted).
async function decodeLuma(blob: Blob, w: number, h: number, p3 = false): Promise<Luma | null> {
  try {
    const bmp = await createImageBitmap(blob, p3 ? { colorSpaceConversion: 'none' } : undefined)
    const c = makeCanvas()
    c.width = w
    c.height = h
    const cx = get2d(c, { willReadFrequently: true })
    cx.drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    return toLuma(cx.getImageData(0, 0, w, h).data, w, h)
  } catch {
    return null
  }
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
    const autoFormat = s.format === 'auto'
    // Smart format is decided after the pixel scan; WebP is a placeholder.
    let outType = autoFormat ? 'image/webp' : s.format === 'original' ? file.type : s.format
    if (isHeic(file) && s.format === 'original') outType = 'image/jpeg'
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(outType)) outType = 'image/png'
    // Smart format cannot use the placeholder for its P3 decision: it only
    // ever emits taggable types (WebP, or PNG when it can carry the
    // profile), so assume taggable here and re-decide after the scan.
    let useP3 = srcIcc !== null && isDisplayP3(srcIcc)
      && (autoFormat || outType === 'image/jpeg' || outType === 'image/webp'
        || (outType === 'image/png' && canEmbedPng()))
    const decoded = await decodeSource(source, t, useP3)
    const origW = decoded.w
    const origH = decoded.h
    // Fail before the smart scan / extra canvases / encoder copies. The
    // decode itself has happened (browsers have no cheap pixel-count API),
    // but a 100 MP source should not multiply into several 400 MB buffers.
    if (exceedsPixelLimit(origW, origH)) {
      const err = new Error(t('tooManyPixels', MAX_PIXELS_MB)) as Error & { retryable?: boolean }
      err.retryable = false
      throw err
    }
    let width = origW
    let height = origH
    const max = s.maxSize || 0
    const mode = s.resizeMode ?? 'longest'
    // Source rectangle drawn into the output: the whole image, except for
    // 'exact', which scales to cover the box and crops the overflow evenly.
    let crop = { sx: 0, sy: 0, sw: origW, sh: origH }
    if (mode === 'exact') {
      const bw = Math.max(1, max || origW)
      const bh = Math.max(1, s.maxHeight || origH)
      const scale = Math.max(bw / origW, bh / origH)
      const sw = Math.min(origW, Math.round(bw / scale))
      const sh = Math.min(origH, Math.round(bh / scale))
      crop = { sx: Math.floor((origW - sw) / 2), sy: Math.floor((origH - sh) / 2), sw, sh }
      width = bw
      height = bh
    } else if (mode === 'percent') {
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
    // Smart mode: pick the output format from the pixels, not the
    // settings. One bare-canvas pass (the same pass the JPEG alpha note
    // used to need): any transparency forces WebP (JPEG would flatten
    // it); few distinct colors mean a graphic (palette PNG wins);
    // anything else is a photo (WebP q80). Alpha is exact (every
    // pixel); the color count samples every 4th pixel, which is plenty
    // for a flat-vs-photo heuristic. PNG is only picked when it can
    // carry a P3 profile, so a P3 source never ends up untagged.
    let alphaScan: boolean | null = null
    let quantize = s.quantize
    const drawSrc = (c: Ctx2D, w: number, h: number) =>
      c.drawImage(decoded.src, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, w, h)
    if (autoFormat) {
      const sc = makeCanvas()
      sc.width = width
      sc.height = height
      const sctx = get2d(sc, { willReadFrequently: true })
      drawSrc(sctx, width, height)
      const d = sctx.getImageData(0, 0, width, height).data
      // Color key includes a coarse alpha level, so a transparent logo
      // with a few flat colors still counts as a graphic.
      // Flatness: share of pixels identical to their left neighbor.
      // Graphics and screenshots are mostly flat runs; photos (even
      // grayscale ones, whose coarse color count is always tiny) are not.
      let has = false
      let same = 0
      const colors = new Set<number>()
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 255) has = true
        if (i >= 4 && d[i] === d[i - 4] && d[i + 1] === d[i - 3] && d[i + 2] === d[i - 2] && d[i + 3] === d[i - 1]) same++
        if ((i >> 2) % 4 === 0 && colors.size <= 256) {
          colors.add(((d[i + 3] >> 5) << 12) | ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4))
        }
      }
      alphaScan = has
      const flat = same / Math.max(1, width * height)
      // Few colors in mostly flat areas (with or without transparency) is a
      // graphic: palette PNG keeps edges exact. Everything else is a photo:
      // WebP, whose alpha plane stays lossless (alpha_quality 100).
      if (colors.size <= 256 && flat >= 0.3 && canEmbedPng()) outType = 'image/png'
      else outType = 'image/webp'
      useP3 = srcIcc !== null && isDisplayP3(srcIcc)
        && (outType === 'image/webp' || (outType === 'image/png' && canEmbedPng()))
      // A graphic picked for PNG is always palette-quantized.
      quantize = outType === 'image/png'
    }
    let canvas = makeCanvas()
    let ctx = get2d(canvas, { willReadFrequently: true, ...(useP3 ? { colorSpace: 'display-p3' as const } : {}) })
    if (useP3) {
      // A mistagged output (P3 tag on sRGB pixels) is worse than no tag:
      // only proceed when the canvas really honors display-p3. Browsers
      // without getContextAttributes fall back to the sRGB path.
      const attrs = (ctx as unknown as { getContextAttributes?: () => { colorSpace?: string } }).getContextAttributes?.()
      if (!attrs || attrs.colorSpace !== 'display-p3') {
        useP3 = false
        canvas = makeCanvas()
        ctx = get2d(canvas, { willReadFrequently: true })
      }
    }
    let targetNote: string | null = null
    let targetNoteNotable = false
    let typeNote: string | null = null

    const canvasEncode = (type: string, q?: number): Promise<Blob | null> =>
      canvasToBlob(canvas, type, q)

    // Draw at (w, h), read pixels, encode. Mutates outType/typeNote only on
    // the canvas fallback path (Safari WebP -> JPEG).
    // Transparency scan: declared before canvas creation so the smart
    // pre-scan can feed it; the first encode then skips its own pass.
    let lastPixels: RgbaImage | null = null
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
        const actx = get2d(ac, { willReadFrequently: true })
        drawSrc(actx, w, h)
        const d = actx.getImageData(0, 0, w, h).data
        let has = false
        for (let i = 3; i < d.length; i += 4) {
          if (d[i] < 255) { has = true; break }
        }
        alphaScan = has
      }
      if (outType === 'image/jpeg') { ctx.fillStyle = s.jpegFill || '#ffffff'; ctx.fillRect(0, 0, w, h) }
      drawSrc(ctx, w, h)
      const pixels: RgbaImage = ctx.getImageData(0, 0, w, h)
      lastPixels = pixels
      let out: Blob
      try {
        let buf: ArrayBuffer
        if (outType === 'image/jpeg') buf = await encodeMozjpeg(pixels, Math.round((q ?? 0.8) * 100))
        else if (outType === 'image/webp') buf = await encodeWebp(pixels, Math.round((q ?? 0.8) * 100))
        else if (outType === 'image/avif') buf = await encodeAvif(pixels, Math.round((q ?? 0.8) * 100))
        else if (quantize) buf = await encodePngQuantized(pixels, Math.round((q ?? 0.8) * 100))
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
        out = new Blob([await embedIcc(bytes, outType, srcIcc) as BlobPart], { type: outType })
      }
      return out
    }

    let blob: Blob | null = null
    if (s.mode === 'target') {
      const targetBytes = (s.targetSize || 200) * 1024
      let fitted = false
      if (outType !== 'image/png' || quantize) {
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
        const q = outType === 'image/png' && !quantize ? undefined : 0.1
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
            targetNote = outType === 'image/png' && !quantize ? t('targetAutoSize', width, height) : t('targetAutoSizeLow', width, height)
            targetNoteNotable = true
          } else {
            width = Math.max(1, Math.round(width * 0.1)); height = Math.max(1, Math.round(height * 0.1))
            blob = await encodeAt(width, height, q)
            targetNote = t('targetMin')
            targetNoteNotable = true
          }
        }
      }
    } else if (s.mode === 'auto' && outType !== 'image/png') {
      // Smart quality: the lowest quality whose decoded result stays
      // structurally close to the source (SSIM on luma, see ssim.ts).
      // Simple images land well below q80, detailed ones go up to q90
      // rather than blur. Each step is one encode plus one decode.
      blob = await encodeAt(width, height, 0.8)
      const lp = lastPixels as RgbaImage | null
      const ref = lp ? toLuma(lp.data, width, height) : null
      const decodedLuma = ref ? await decodeLuma(blob, width, height, useP3) : null
      if (ref && decodedLuma) {
        // q80 is encoded above as the midpoint probe. Feed it to the search
        // as the initial result: starting the binary search at [50, 90] used
        // to test q70 first, so on most photos the q80 encode + decode were
        // pure overhead. This keeps the same answer with one fewer round.
        const pass80 = ssim(ref, decodedLuma) >= SMART_SSIM
        const found = await searchQuality(SMART_Q_MIN, SMART_Q_MAX, 4, async (q) => {
          const b = await encodeAt(width, height, q / 100)
          const l = await decodeLuma(b, width, height, useP3)
          return { pass: !!l && ssim(ref, l) >= SMART_SSIM, value: b }
        }, { q: 80, pass: pass80, value: blob })
        blob = found.value
        targetNote = t('smartQ', found.q)
      }
    } else {
      // Fixed quality; smart quality on PNG means palette quality 80.
      const quality = s.mode === 'auto' ? 0.8 : s.quality / 100
      blob = await encodeAt(width, height, outType === 'image/png' && !quantize ? undefined : quality)
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
        targetNoteNotable: false,
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
      targetNoteNotable,
      typeNote,
      outType,
      hasAlpha: alphaScan ?? false,
      isAnimatedGif,
    }
  } catch (err) {
    const retryable = (err as { retryable?: boolean } | null)?.retryable
    return {
      done: false,
      error: err instanceof Error ? err.message : t('compressFail'),
      ...(retryable === false ? { retryable: false } : {}),
    }
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
    targetNoteNotable: res.targetNoteNotable,
    typeNote: res.typeNote,
    outType: res.outType,
    hasAlpha: res.hasAlpha,
    isAnimatedGif: res.isAnimatedGif,
  }
}
