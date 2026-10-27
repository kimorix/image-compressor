// Encode worker: runs compressToBlob off the main thread, so batch encodes
// no longer freeze scrolling and taps. Built by Vite as a module worker;
// its wasm `?url` imports resolve against this chunk's own URL, and its
// dynamic imports (encoders, heic2any, piexifjs) load as sibling chunks.
import { compressToBlob } from './compress'
import { t as translate, type Lang } from '../i18n'
import type { Settings } from '../types'

export interface WorkerTask {
  id: number
  file: File
  settings: Settings
  lang: Lang
  canvasWebp: boolean
}

export interface WorkerResult {
  id: number
  ok: boolean
  origW?: number
  origH?: number
  outW?: number
  outH?: number
  outSize?: number
  outName?: string
  targetNote?: string | null
  typeNote?: string | null
  blob?: Blob | null
  alreadyBest?: boolean
  outType?: string
  hasAlpha?: boolean
  isAnimatedGif?: boolean
  error?: string
}

self.onmessage = async (e: MessageEvent<WorkerTask>) => {
  const { id, file, settings, lang, canvasWebp } = e.data
  const tx = (key: string, ...args: (string | number)[]) => translate(lang, key, ...args)
  try {
    const res = await compressToBlob(file, settings, tx, canvasWebp)
    if (!res.done) {
      self.postMessage({ id, ok: false, error: res.error })
      return
    }
    self.postMessage({
      id,
      ok: true,
      origW: res.origW,
      origH: res.origH,
      outW: res.outW,
      outH: res.outH,
      outSize: res.outSize,
      outName: res.outName,
      targetNote: res.targetNote,
      typeNote: res.typeNote,
      blob: res.alreadyBest ? null : res.outBlob,
      alreadyBest: res.alreadyBest,
      outType: res.outType,
      hasAlpha: res.hasAlpha,
      isAnimatedGif: res.isAnimatedGif,
    })
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : translate(lang, 'compressFail'),
    })
  }
}
