// Off-main-thread Word build, one worker per conversion. Pages stream in as
// the main thread extracts them (image bytes or bitmaps transferred, never
// copied) and are analysed on arrival by a DocxSession; `finish` packs the
// .docx and posts it back as a Blob. Cancelling terminates the worker.
//
// Cropped pictures may arrive as ImageBitmaps instead of encoded bytes:
// where OffscreenCanvas exists, the main thread only cuts the crop out of
// the rendered page and the JPEG/PNG encoding happens here.
import { DocxSession, type BuildOptions } from '../lib/docx-builder'
import type { ConvertStats, PageImage, PageModel } from '../types'

/** A picture on the wire: encoded bytes, or a bitmap this worker encodes. */
export type WireImage = Omit<PageImage, 'data'> & ({ data: Uint8Array; bitmap?: undefined } | { data?: undefined; bitmap: ImageBitmap })
export type WirePage = Omit<PageModel, 'images' | 'background'> & { images: WireImage[]; background?: WireImage }

export type DocxRequest =
  | { type: 'start'; opts: BuildOptions }
  | { type: 'page'; page: WirePage }
  | { type: 'finish' }

export type DocxResponse =
  | { type: 'done'; blob: Blob; stats: ConvertStats }
  | { type: 'error'; error: string }

async function encodeBitmap(bitmap: ImageBitmap, type: 'png' | 'jpg'): Promise<Uint8Array> {
  const c = new OffscreenCanvas(bitmap.width, bitmap.height)
  c.getContext('2d')!.drawImage(bitmap, 0, 0)
  bitmap.close()
  const blob = await c.convertToBlob(type === 'png' ? { type: 'image/png' } : { type: 'image/jpeg', quality: 0.9 })
  return new Uint8Array(await blob.arrayBuffer())
}

async function toImage(w: WireImage): Promise<PageImage> {
  const { bitmap, data, ...box } = w
  return { ...box, data: bitmap ? await encodeBitmap(bitmap, w.type) : data! }
}

let session: DocxSession | null = null
let failed: string | null = null
// Messages are handled strictly in order: a page's pictures may need an
// async encode, and `finish` must wait for every page before it.
let chain: Promise<void> = Promise.resolve()

const post = (msg: DocxResponse) => (self as unknown as Worker).postMessage(msg)
const errText = (err: unknown) => (err instanceof Error ? err.message : String(err))

async function handle(msg: DocxRequest): Promise<void> {
  if (msg.type === 'start') {
    session = new DocxSession(msg.opts)
    failed = null
    return
  }
  if (failed) return
  try {
    if (!session) throw new Error('docx session not started')
    if (msg.type === 'page') {
      const { images, background, ...rest } = msg.page
      const page: PageModel = { ...rest, images: [] }
      for (const img of images) page.images.push(await toImage(img))
      if (background) page.background = await toImage(background)
      session.addPage(page)
      return
    }
    const { blob, stats } = await session.finish()
    session = null
    post({ type: 'done', blob, stats })
  } catch (err) {
    failed = errText(err)
    session = null
    // Report right away: the main thread stops extracting the remaining pages.
    post({ type: 'error', error: failed })
  }
}

self.onmessage = (e: MessageEvent<DocxRequest>) => {
  chain = chain.then(() => handle(e.data))
}
