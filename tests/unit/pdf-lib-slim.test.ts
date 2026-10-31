// Guards the slimmed @cantoo/pdf-lib (scripts/pdf-lib-slim.ts): culori,
// node-html-better-parser and html-entities resolve to
// src/shared/pdf/svg-stub.ts in the build and in these tests alike.
// 1. The stubs behave: import-time calls are harmless, SVG / XFA / colour
//    string parsing fails loudly, encode() matches html-entities.
// 2. pdf-lib still does what the app needs with them: images, merging pages
//    from loaded files, forms + flatten, object streams, PDF/A XMP (encode).
// 3. The committed build (docs/, which CI rebuilds and diffs) carries none of
//    the three packages and does carry the stub inside the pdf-lib chunk.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { colorString, PDFDocument, PDFName, PDFStream, rgb, StandardFonts, decodePDFRawStream, PDFRawStream } from '@cantoo/pdf-lib'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
// Bare specifiers on purpose: they go through the same alias as pdf-lib's own imports.
import { converter } from 'culori'
import { NodeType, parse } from 'node-html-better-parser'
import { encode } from 'html-entities'
import { SVG_UNSUPPORTED } from '../../src/shared/pdf/svg-stub'

const ROOT = join(dirname(new URL(import.meta.url).pathname), '..', '..')
const FIXTURES = join(ROOT, 'tests', 'fixtures')
const ASSETS = join(ROOT, 'docs', 'assets')

// 8×6 baseline JPEG and 1×1 PNG, enough for pdf-lib's embedders.
const JPEG = Uint8Array.from(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAGAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDiqKKK8A/Wz//Z', 'base64'))
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC', 'base64'))

async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise
  const out: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent()
    out.push(tc.items.map((it) => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' ').trim())
  }
  await doc.loadingTask.destroy()
  return out
}

describe('svg-stub', () => {
  it('culori: converter() is callable at import time, the converter throws', () => {
    const toRgb = converter('rgb')
    expect(() => toRgb('red')).toThrow(SVG_UNSUPPORTED)
    expect(() => colorString('#ff0000')).toThrow(SVG_UNSUPPORTED)
  })
  it('node-html-better-parser: parse throws, NodeType has the DOM values', () => {
    expect(() => parse('<svg/>')).toThrow(SVG_UNSUPPORTED)
    expect(NodeType).toEqual({ ELEMENT_NODE: 1, TEXT_NODE: 3, COMMENT_NODE: 8 })
  })
  it('html-entities: encode() matches the real default (specialChars, level all)', () => {
    // Expected strings are html-entities 2.6.0's own output for these inputs.
    expect(encode(`a&b<c>d"e'f é 中 😀 \u00a0`)).toBe(`a&amp;b&lt;c&gt;d&quot;e&apos;f é 中 😀 \u00a0`)
    expect(encode('&amp;')).toBe('&amp;amp;')
    expect(encode('')).toBe('')
    expect(encode(undefined)).toBe('')
    expect(() => encode('x', { mode: 'nonAscii' })).toThrow(SVG_UNSUPPORTED)
  })
})

describe('pdf-lib with the stubs', () => {
  it('drawSvg / embedSvg fail with the stub error instead of deep inside pdf-lib', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage()
    expect(() => page.drawSvg('<svg width="10" height="10"></svg>')).toThrow(SVG_UNSUPPORTED)
    await expect(doc.embedSvg('<svg width="10" height="10"></svg>')).rejects.toThrow(SVG_UNSUPPORTED)
  })

  it('builds from images, merges loaded files, keeps forms, round-trips', async () => {
    const doc = await PDFDocument.create()
    doc.setTitle('Slim & <test>')
    const jpg = await doc.embedJpg(JPEG)
    const png = await doc.embedPng(PNG)
    const p1 = doc.addPage([200, 150])
    p1.drawImage(jpg, { x: 10, y: 10, width: 80, height: 60 })
    p1.drawImage(png, { x: 100, y: 10, width: 40, height: 40 })
    p1.drawRectangle({ x: 5, y: 5, width: 20, height: 20, color: rgb(0, 0.5, 1) })
    const font = await doc.embedFont(StandardFonts.Helvetica)
    p1.drawText('slim build ok', { x: 10, y: 120, size: 12, font })

    // Pages from real files (text + fonts), like the merge writer does.
    for (const f of ['report.pdf', 'two-column.pdf']) {
      const src = await PDFDocument.load(readFileSync(join(FIXTURES, f)))
      const copied = await doc.copyPages(src, src.getPageIndices())
      copied.forEach((p) => doc.addPage(p))
    }

    // A form field, then flatten (the merge writer's "drop forms" path).
    const form = doc.getForm()
    const tf = form.createTextField('name')
    tf.setText('filled')
    tf.addToPage(p1, { x: 10, y: 80, width: 120, height: 24 })
    form.flatten()

    const bytes = await doc.save({ useObjectStreams: true })
    const back = await PDFDocument.load(bytes)
    const report = await PDFDocument.load(readFileSync(join(FIXTURES, 'report.pdf')))
    const two = await PDFDocument.load(readFileSync(join(FIXTURES, 'two-column.pdf')))
    expect(back.getPageCount()).toBe(1 + report.getPageCount() + two.getPageCount())
    expect(back.getTitle()).toBe('Slim & <test>')

    const texts = await pageTexts(bytes)
    expect(texts[0]).toContain('slim build ok')
    expect(texts[0]).toContain('filled')
    const srcTexts = [...(await pageTexts(readFileSync(join(FIXTURES, 'report.pdf')))), ...(await pageTexts(readFileSync(join(FIXTURES, 'two-column.pdf'))))]
    expect(texts.slice(1)).toEqual(srcTexts)
  })

  it('PDF/A XMP goes through the encode() stub and is escaped', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    doc.setTitle('A & B <c>')
    doc.convertToPDFA()
    const back = await PDFDocument.load(await doc.save())
    const meta = back.catalog.lookup(PDFName.of('Metadata'))
    expect(meta).toBeInstanceOf(PDFStream)
    const xml = new TextDecoder().decode(meta instanceof PDFRawStream ? decodePDFRawStream(meta).decode() : (meta as PDFStream).getContents())
    expect(xml).toContain('A &amp; B &lt;c&gt;')
  })
})

describe('built pdf-lib bundle (docs/)', () => {
  // Strings that only these packages put into a bundle: culori's named
  // colours / colour spaces, html-entities' named-reference table,
  // node-html-better-parser's block-element list and API.
  const SIGNATURES: Record<string, string[]> = {
    culori: ['rebeccapurple', 'cubehelix', 'lab65'],
    'html-entities': ['CounterClockwiseContourIntegral', 'ThickSpace'],
    // Not bare HTML tag names (figcaption, blockquote): the app's own
    // templates use those (the converter's detail sheet has <figcaption>).
    'node-html-better-parser': ['structuredText', 'rawTagName'],
  }
  const js = readdirSync(ASSETS).filter((f) => /\.m?js$/.test(f))
  const read = (f: string) => readFileSync(join(ASSETS, f), 'utf8')

  it('no emitted chunk contains culori, html-entities or node-html-better-parser', () => {
    const hits: string[] = []
    for (const f of js) {
      const src = read(f)
      for (const [pkg, sigs] of Object.entries(SIGNATURES)) for (const s of sigs) if (src.includes(s)) hits.push(`${f}: ${pkg} (${s})`)
    }
    expect(hits).toEqual([])
  }, 30_000) // scans every emitted chunk (now incl. the JPEG XL codecs); slow under a loaded full run

  it('the stub is inside the pdf-lib bundles and nowhere else', () => {
    // pdf-lib ships in at most two places: the page-side named chunk
    // (assets/pdf-lib-*.js, images to PDF) and the merge worker, which
    // Vite bundles on its own. Each carries the stub; nothing else does.
    const withPdfLib = js.filter((f) => read(f).includes('pdf-lib (https://github.com/Hopding/pdf-lib)'))
    const withStub = js.filter((f) => read(f).includes(SVG_UNSUPPORTED))
    expect(withPdfLib.length).toBeGreaterThanOrEqual(1)
    for (const f of withPdfLib) expect(f).toMatch(/^(pdf-lib|merge\.worker)-[\w-]+\.js$/)
    expect(new Set(withPdfLib.map((f) => f.split('-')[0])).size).toBe(withPdfLib.length)
    expect(withStub).toEqual(withPdfLib)
  })
})
