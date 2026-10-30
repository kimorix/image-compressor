// Main-thread side of merge.worker.ts: run one job with progress and
// cancel (AbortSignal → worker.terminate()). Kept free of Vue.
import type { MergeRequest, MergeResponse } from '../worker/merge.worker'
import type { WriteJob, WriteResult } from './write'

export interface WorkerLike {
  postMessage(msg: unknown, transfer?: Transferable[]): void
  terminate(): void
  onmessage: ((e: MessageEvent) => void) | null
  onerror: ((e: ErrorEvent) => void) | null
}

export class CancelledError extends Error {
  constructor() {
    super('cancelled')
    this.name = 'AbortError'
  }
}

export class SourceLockedError extends Error {
  constructor(public readonly source: string) {
    super('source needs a password')
    this.name = 'SourceLockedError'
  }
}

export function spawnMergeWorker(): WorkerLike {
  return new Worker(new URL('../worker/merge.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike
}

export function runInWorker(
  job: WriteJob,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
  spawn: () => WorkerLike = spawnMergeWorker,
): Promise<WriteResult> {
  return new Promise<WriteResult>((resolve, reject) => {
    if (signal?.aborted) { reject(new CancelledError()); return }
    const w = spawn()
    const finish = () => {
      signal?.removeEventListener('abort', onAbort)
      w.terminate()
    }
    const onAbort = () => { finish(); reject(new CancelledError()) }
    signal?.addEventListener('abort', onAbort)
    w.onmessage = (e: MessageEvent<MergeResponse>) => {
      const m = e.data
      if (m.type === 'progress') onProgress(m.done, m.total)
      else if (m.type === 'done') { finish(); resolve(m.result) }
      else { finish(); reject(m.needsPassword ? new SourceLockedError(m.needsPassword) : new Error(m.error)) }
    }
    w.onerror = (e) => { finish(); reject(new Error(e.message || 'worker failed')) }
    const msg: MergeRequest = { type: 'run', job }
    w.postMessage(msg, job.sources.map((s) => s.bytes))
  })
}

export function isCancel(err: unknown): boolean {
  return (err as Error)?.name === 'AbortError'
}
