// The one image worker build. Each message names a job kind (see jobs.ts);
// the job module loads on first use and stays cached for the worker's
// life. Built by Vite as a module worker: its wasm `?url` imports resolve
// against the chunk's own URL, and its dynamic imports (jobs, encoders,
// piexifjs) load as sibling chunks; heic2any is a shared hashed asset
// (see heic.ts).
import { loadJob, type JobError, type JobKind } from './jobs'

export interface WorkerRequest {
  id: number
  kind: JobKind
  payload: unknown
}

export type WorkerReply =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string; retryable?: boolean }

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, kind, payload } = e.data
  try {
    const job = await loadJob(kind)
    const { result, transfer } = await job.run(payload)
    ;(self as unknown as Worker).postMessage({ id, ok: true, result } satisfies WorkerReply, transfer ?? [])
  } catch (err) {
    const retryable = (err as JobError | null)?.retryable
    ;(self as unknown as Worker).postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      ...(retryable === false ? { retryable: false } : {}),
    } satisfies WorkerReply)
  }
}
