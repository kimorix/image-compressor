// The compressor's job for the shared image pool (shared/image/jobs.ts):
// compressToBlob in whichever context the pool runs it (worker or the
// main-thread fallback). A failed compress becomes a thrown JobError so the
// pool's retry rules (main-thread retry unless retryable === false) apply.
import { compressToBlob, type CompressBlobSuccess, type CompressOptions } from './compress'
import { t as translate, type Lang } from '../../../shared/i18n'
import { jobError, type ImageJob } from '../../../shared/image/jobs'
import type { Settings } from '../types'

export interface CompressPayload {
  file: File
  settings: Settings
  lang: Lang
  canvasWebp: boolean
  options?: CompressOptions
}

export const compressJob: ImageJob<CompressPayload, CompressBlobSuccess> = {
  async run({ file, settings, lang, canvasWebp, options }) {
    const tx = (key: string, ...args: (string | number)[]) => translate(lang, key, ...args)
    const res = await compressToBlob(file, settings, tx, canvasWebp, options)
    if (!res.done) throw jobError(res.error, res.retryable)
    return { result: res }
  },
}
