// Off-main-thread merge / split. One worker per run: the sources arrive as
// transferred ArrayBuffers, progress is posted per page, and every output
// goes back as a transferred buffer. Cancelling terminates the worker.
// @cantoo/pdf-lib is imported here only, so it never reaches a page chunk.
import { NeedsPasswordError, runJob, type WriteJob, type WriteResult } from '../lib/write'

export type MergeRequest = { type: 'run'; job: WriteJob }
export type MergeResponse =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; result: WriteResult }
  | { type: 'error'; error: string; needsPassword?: string }

const post = (msg: MergeResponse, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(msg, transfer)

self.onmessage = (e: MessageEvent<MergeRequest>) => {
  if (e.data?.type !== 'run') return
  let last = 0
  runJob(e.data.job, (done, total) => {
    // Throttle to ~60 messages per run.
    const now = Date.now()
    if (done === total || now - last > 16) {
      last = now
      post({ type: 'progress', done, total })
    }
  }).then((result) => {
    post({ type: 'done', result }, result.outputs.map((o) => o.bytes.buffer as ArrayBuffer))
  }, (err: unknown) => {
    if (err instanceof NeedsPasswordError) post({ type: 'error', error: err.message, needsPassword: err.source })
    else post({ type: 'error', error: err instanceof Error ? err.message : String(err) })
  })
}
