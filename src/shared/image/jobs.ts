// Job registry for the app-wide image pool. One worker build serves every
// image tool: a task names its job kind, and the worker (or the main-thread
// fallback) loads that job's module on first use. Each loader is a dynamic
// import, so a job's code — and its encoder chunks — only download when a
// tool actually runs that job. A new tool adds one line here.
//
// Jobs are plain async functions that work in both contexts (worker and
// main thread); the pool falls back to the main thread when a worker cannot
// run a task (no Worker support, SVG on older Safari, a worker crash).

export interface JobOutput<R> {
  result: R
  /** Transferables to move instead of copy (ArrayBuffers, ImageBitmaps). */
  transfer?: Transferable[]
}

/** Thrown by a job: `retryable: false` skips the main-thread retry. */
export interface JobError extends Error {
  retryable?: boolean
}

export interface ImageJob<P = unknown, R = unknown> {
  run(payload: P): Promise<JobOutput<R>>
}

export type JobKind = 'compress'

const LOADERS: Record<JobKind, () => Promise<ImageJob>> = {
  compress: () => import('../../features/image-compressor/lib/compress-job').then((m) => m.compressJob as ImageJob),
}

const cache = new Map<JobKind, Promise<ImageJob>>()

export function loadJob(kind: JobKind): Promise<ImageJob> {
  let p = cache.get(kind)
  if (!p) {
    const loader = LOADERS[kind]
    if (!loader) return Promise.reject(new Error(`unknown image job: ${kind}`))
    p = loader()
    p.catch(() => cache.delete(kind))
    cache.set(kind, p)
  }
  return p
}

export function jobError(message: string, retryable?: boolean): JobError {
  const err = new Error(message) as JobError
  if (retryable === false) err.retryable = false
  return err
}
