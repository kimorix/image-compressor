import { baseName, extOf } from './format'
import type { CompressItem, Settings } from '../types'

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

function loadImage(file: File, t: T): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t('decodeError'))) }
    img.src = url
  })
}

// Pure with respect to shared state: it never mutates the item, it returns the
// result for the caller to apply. Callers snapshot the settings and guard with a
// generation counter, so a stale concurrent run can neither mix settings nor
// overwrite a newer run's result. Logic mirrors the original single-file version:
// probe the real encoder output first (Safari silently falls back WebP -> PNG),
// then quality mode or target mode (binary-search quality, then shrink dimensions).
export async function compressItem(item: CompressItem, s: Settings, t: T): Promise<CompressResult> {
  try {
    const img = await loadImage(item.file, t)
    const origW = img.naturalWidth
    const origH = img.naturalHeight
    let width = origW
    let height = origH
    const max = s.maxSize || 0
    if (max > 0 && Math.max(width, height) > max) {
      const scale = max / Math.max(width, height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }
    const canvas = document.createElement('canvas')
    const encodeAt = (w: number, h: number, type: string, q?: number): Promise<Blob | null> =>
      new Promise((res) => {
        canvas.width = w
        canvas.height = h
        const c = canvas.getContext('2d')!
        if (type === 'image/jpeg') { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h) }
        c.drawImage(img, 0, 0, w, h)
        canvas.toBlob(res, type, type === 'image/png' ? undefined : q)
      })

    let outType = s.format === 'original' ? item.file.type : s.format
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(outType)) outType = 'image/png'
    let targetNote: string | null = null
    let typeNote: string | null = null

    const probeQ = s.mode === 'target' ? 0.8 : s.quality / 100
    const probe = await encodeAt(width, height, outType, outType === 'image/png' ? undefined : probeQ)
    if (!probe) throw new Error(t('formatError'))
    if (probe.type !== outType) {
      if (outType === 'image/webp') {
        outType = 'image/jpeg'
        typeNote = t('typeNoteWebp')
      } else {
        outType = probe.type
      }
    }

    let blob: Blob | null = null
    if (s.mode === 'target') {
      const targetBytes = (s.targetSize || 200) * 1024
      let fitted = false
      if (outType !== 'image/png') {
        const q100 = await encodeAt(width, height, outType, 1)
        if (!q100) throw new Error(t('formatError'))
        if (q100.size <= targetBytes) {
          blob = q100; targetNote = t('targetBest'); fitted = true
        } else {
          let lo = 10, hi = 100, bestBlob: Blob | null = null, bestQ = 10
          while (lo <= hi) {
            const mid = Math.floor((lo + hi) / 2)
            const b = await encodeAt(width, height, outType, mid / 100)
            if (!b) throw new Error(t('formatError'))
            if (b.size <= targetBytes) { bestQ = mid; bestBlob = b; lo = mid + 1 }
            else hi = mid - 1
          }
          if (bestBlob) { blob = bestBlob; targetNote = t('targetAutoQ', bestQ); fitted = true }
        }
      }
      if (!fitted) {
        const q = outType === 'image/png' ? undefined : 0.1
        const full = outType === 'image/png' ? await encodeAt(width, height, outType, q) : null
        if (full && full.size <= targetBytes) {
          blob = full; targetNote = t('targetUnder')
        } else {
          let lo = 0.1, hi = 1, best: Blob | null = null, bestW = width, bestH = height
          for (let i = 0; i < 7; i++) {
            const sc = (lo + hi) / 2
            const w = Math.max(1, Math.round(width * sc)), h = Math.max(1, Math.round(height * sc))
            const b = await encodeAt(w, h, outType, q)
            if (!b) throw new Error(t('formatError'))
            if (b.size <= targetBytes) { best = b; bestW = w; bestH = h; lo = sc }
            else hi = sc
          }
          if (best) {
            blob = best; width = bestW; height = bestH
            targetNote = outType === 'image/png' ? t('targetAutoSize', width, height) : t('targetAutoSizeLow', width, height)
          } else {
            width = Math.max(1, Math.round(width * 0.1)); height = Math.max(1, Math.round(height * 0.1))
            blob = await encodeAt(width, height, outType, q)
            targetNote = t('targetMin')
          }
        }
      }
    } else {
      const quality = s.quality / 100
      blob = await encodeAt(width, height, outType, outType === 'image/png' ? undefined : quality)
      if (!blob) throw new Error(t('formatError'))
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
