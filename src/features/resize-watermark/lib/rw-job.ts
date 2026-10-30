// Resize & watermark job for the shared image pool (shared/image/jobs.ts,
// kind 'resize'). Two operations: 'probe' decodes once for the list (size,
// notes, small upright preview) and 'process' writes the output. Both run
// in the worker, so HEIC decoding and big JPEGs never block the page; the
// pool retries on the main thread when a worker cannot decode (SVG).
import type { ImageJob } from '../../../shared/image/jobs'
import type { Focus, RwSettings } from '../types'
import { probeImage, processImage, type ProbeResult, type ProcessResult } from './process'

export type RwPayload =
  | { op: 'probe'; file: File }
  | { op: 'process'; file: File; settings: RwSettings; focus: Focus; logo: Blob | null }

export type RwJobResult =
  | { op: 'probe'; probe: ProbeResult }
  | { op: 'process'; out: ProcessResult }

export const rwJob: ImageJob<RwPayload, RwJobResult> = {
  async run(p) {
    if (p.op === 'probe') return { result: { op: 'probe', probe: await probeImage(p.file) } }
    return { result: { op: 'process', out: await processImage(p) } }
  },
}
