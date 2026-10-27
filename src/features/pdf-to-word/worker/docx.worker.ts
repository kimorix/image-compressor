// Off-main-thread Word build: layout analysis + docx packing for one
// document. The page models arrive as plain data (image bytes transferred),
// the finished .docx goes back as a Blob.
import { buildDocx, type BuildOptions } from '../lib/docx-builder'
import type { PageModel } from '../types'

export interface DocxRequest { id: number; pages: PageModel[]; opts: BuildOptions }
export type DocxResponse =
  | { id: number; ok: true; blob: Blob; stats: Awaited<ReturnType<typeof buildDocx>>['stats'] }
  | { id: number; ok: false; error: string }

self.onmessage = async (e: MessageEvent<DocxRequest>) => {
  const { id, pages, opts } = e.data
  try {
    const { blob, stats } = await buildDocx(pages, opts)
    ;(self as unknown as Worker).postMessage({ id, ok: true, blob, stats } satisfies DocxResponse)
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) } satisfies DocxResponse)
  }
}
