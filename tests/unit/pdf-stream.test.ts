import { describe, expect, it, vi } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { buildDocx, DocxSession, type BuildOptions } from '../../src/features/pdf-to-word/lib/docx-builder'
import { BodySizeTally, bodySizeOf, blocksText, finishPage, joinPageBreaks, layoutDocument, layoutPage, preparePage } from '../../src/features/pdf-to-word/lib/layout'
import { DocxStream, pageTransfer } from '../../src/features/pdf-to-word/lib/convert'
import type { DocxRequest, DocxResponse, WirePage } from '../../src/features/pdf-to-word/worker/docx.worker'
import type { PageModel } from '../../src/features/pdf-to-word/types'
import { fixturePages, PNG_1PX } from './pdf-fixture'

// docx numbers drawings with a process-wide counter (docPr / cNvPr ids), so
// two builds in one test process differ there; the browser builds every
// file in a fresh worker. Everything else must match exactly.
async function docXml(blob: Blob) {
  return strFromU8(unzipSync(new Uint8Array(await blob.arrayBuffer()))['word/document.xml'])
    .replace(/(<wp:docPr|<pic:cNvPr) id="\d+"/g, '$1 id="#"')
}

const clonePages = (pages: PageModel[]) => pages.map((p) => ({ ...p, items: p.items.map((i) => ({ ...i })), images: p.images.map((i) => ({ ...i, data: i.data.slice() })) }))

describe('incremental layout analysis', () => {
  it('prepare + finish per page equals the one-shot page analysis', async () => {
    for (const name of ['report.pdf', 'two-column.pdf']) {
      const pages = await fixturePages(name)
      const body = bodySizeOf(pages.flatMap((p) => p.items))
      for (const p of pages) {
        expect(finishPage(preparePage(p, { stripPageNumbers: true }), body)).toEqual(layoutPage(p, { bodySize: body, stripPageNumbers: true }))
      }
    }
  })
  it('the page-by-page body size tally matches the whole-document one', async () => {
    const pages = await fixturePages('report.pdf')
    const tally = new BodySizeTally()
    for (const p of pages) tally.add(p.items)
    expect(tally.size).toBe(bodySizeOf(pages.flatMap((p) => p.items)))
    expect(new BodySizeTally().size).toBe(11)
  })
  it('layoutDocument still joins a paragraph split by a page break', async () => {
    const pages = await fixturePages('report.pdf')
    const { pages: ls, bodySize } = layoutDocument(pages, { stripPageNumbers: true })
    const manual = joinPageBreaks(pages.map((p) => finishPage(preparePage(p, { stripPageNumbers: true }), bodySize)))
    expect(ls.map((l) => blocksText(l.blocks))).toEqual(manual.map((l) => blocksText(l.blocks)))
  })
})

describe('streamed docx build', () => {
  const cases: BuildOptions[] = [
    { mode: 'editable', keepImages: true, title: 't' },
    { mode: 'editable', keepImages: false },
    { mode: 'layout', keepImages: true },
  ]
  for (const opts of cases) {
    it(`page-by-page session equals the one-shot build (${opts.mode}, images ${opts.keepImages})`, async () => {
      const pages = await fixturePages('report.pdf')
      const once = await buildDocx(clonePages(pages), opts)
      const session = new DocxSession(opts)
      for (const p of clonePages(pages)) session.addPage(p)
      const streamed = await session.finish()
      expect(streamed.stats).toEqual(once.stats)
      expect(await docXml(streamed.blob)).toBe(await docXml(once.blob))
    })
  }
  it('counts OCR and picture-only pages as they arrive', async () => {
    const s = new DocxSession({ mode: 'editable', keepImages: true })
    const bg = { x: 0, y: 0, w: 100, h: 100, data: PNG_1PX.slice(), type: 'png' as const }
    s.addPage({ num: 1, width: 100, height: 100, items: [], images: [], background: bg })
    s.addPage({ num: 2, width: 100, height: 100, items: [{ str: 'Hello', x: 10, y: 10, w: 30, h: 12, size: 10, bold: false, italic: false }], images: [], ocr: true })
    const { stats } = await s.finish()
    expect(stats).toMatchObject({ pages: 2, ocrPages: 1, imagePages: 1, images: 1 })
  })
})

class FakeWorker {
  sent: { msg: DocxRequest; transfer: Transferable[] }[] = []
  terminated = false
  onmessage: ((e: MessageEvent<DocxResponse>) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null
  postMessage(msg: unknown, transfer: Transferable[] = []) { this.sent.push({ msg: msg as DocxRequest, transfer }) }
  terminate() { this.terminated = true }
  reply(m: DocxResponse) { this.onmessage?.({ data: m } as MessageEvent<DocxResponse>) }
}

const page = (num: number): WirePage => ({
  num, width: 100, height: 100, items: [],
  images: [{ x: 0, y: 0, w: 10, h: 10, type: 'png', data: PNG_1PX.slice() }],
  background: { x: 0, y: 0, w: 100, h: 100, type: 'jpg', data: PNG_1PX.slice() },
})

describe('DocxStream (main-thread side of the docx worker)', () => {
  it('posts start, each page with its buffers transferred, then finish', async () => {
    const w = new FakeWorker()
    const s = new DocxStream({ mode: 'editable', keepImages: true }, undefined, () => w)
    const p1 = page(1)
    s.addPage(p1)
    s.addPage(page(2))
    const done = s.finish()
    expect(w.sent.map((x) => x.msg.type)).toEqual(['start', 'page', 'page', 'finish'])
    expect(w.sent[1].transfer).toEqual([p1.images[0].data!.buffer, p1.background!.data!.buffer])
    const blob = new Blob(['x'])
    w.reply({ type: 'done', blob, stats: { pages: 2 } as never })
    await expect(done).resolves.toMatchObject({ blob })
    expect(w.terminated).toBe(true)
  })
  it('a worker error stops the next page and fails the build', async () => {
    const w = new FakeWorker()
    const s = new DocxStream({ mode: 'layout', keepImages: true }, undefined, () => w)
    s.addPage(page(1))
    w.reply({ type: 'error', error: 'boom' })
    expect(() => s.addPage(page(2))).toThrow('boom')
    await expect(s.finish()).rejects.toThrow('boom')
    expect(w.terminated).toBe(true)
  })
  it('cancel terminates the worker and rejects with an AbortError', async () => {
    const w = new FakeWorker()
    const ctrl = new AbortController()
    const s = new DocxStream({ mode: 'editable', keepImages: true }, ctrl.signal, () => w)
    s.addPage(page(1))
    ctrl.abort()
    expect(w.terminated).toBe(true)
    await expect(s.finish()).rejects.toMatchObject({ name: 'AbortError' })
    expect(w.sent.map((x) => x.msg.type)).toEqual(['start', 'page'])
  })
  it('an already aborted signal never spawns a worker', () => {
    const spawn = vi.fn(() => new FakeWorker())
    const ctrl = new AbortController()
    ctrl.abort()
    expect(() => new DocxStream({ mode: 'editable', keepImages: true }, ctrl.signal, spawn)).toThrow()
    expect(spawn).not.toHaveBeenCalled()
  })
  it('transfers bitmaps as they are', () => {
    const bitmap = { close() {} } as unknown as ImageBitmap
    const p: WirePage = { num: 1, width: 1, height: 1, items: [], images: [{ x: 0, y: 0, w: 1, h: 1, type: 'jpg', bitmap }] }
    expect(pageTransfer(p)).toEqual([bitmap])
  })
})
