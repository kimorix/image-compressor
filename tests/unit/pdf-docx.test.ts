import { describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { buildDocx } from '../../src/features/pdf-to-word/lib/docx-builder'
import { fixturePages, PNG_1PX } from './pdf-fixture'

async function docXml(blob: Blob) {
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  return { xml: strFromU8(files['word/document.xml']), files }
}

describe('docx builder', () => {
  it('editable: headings, lists, table, picture, bold/italic, CJK text', async () => {
    const pages = await fixturePages('report.pdf')
    const { blob, stats } = await buildDocx(pages, { mode: 'editable', keepImages: true, title: 'report' })
    const { xml, files } = await docXml(blob)
    expect(stats).toMatchObject({ pages: 3, tables: 1, images: 1 })
    expect(stats.headings).toBeGreaterThanOrEqual(6)
    expect(stats.lists).toBe(6)
    expect(xml).toContain('w:val="Heading1"')
    expect(xml).toContain('w:val="Heading2"')
    expect(xml).toContain('<w:numPr>')
    expect(xml).toContain('<w:tbl>')
    expect(xml).toContain('<w:drawing>')
    expect(xml).toContain('<w:b/>')
    expect(xml).toContain('<w:i/>')
    expect(xml).toContain('本报告介绍明年的产品规划')
    expect(xml).not.toMatch(/<w:t[^>]*>\s*1\s*<\/w:t>/) // page number gone
    expect(Object.keys(files).some((f) => f.startsWith('word/media/'))).toBe(true)
    expect(strFromU8(files['word/numbering.xml'])).toContain('w:val="decimal"')
  })
  it('editable without pictures', async () => {
    const pages = await fixturePages('report.pdf')
    const { blob, stats } = await buildDocx(pages, { mode: 'editable', keepImages: false })
    expect(stats.images).toBe(0)
    expect((await docXml(blob)).xml).not.toContain('<w:drawing>')
  })
  it('layout: one section per page at the PDF size, framed lines, floating picture', async () => {
    const pages = await fixturePages('report.pdf')
    const { blob, stats } = await buildDocx(pages, { mode: 'layout', keepImages: true })
    const { xml } = await docXml(blob)
    expect(stats.images).toBe(1)
    expect((xml.match(/<w:sectPr/g) ?? []).length).toBe(3)
    expect(xml).toContain('w:w="11906"') // 595.28pt A4 width in twips
    expect(xml).toContain('<w:framePr')
    expect(xml).toContain('<wp:anchor')
  })
  it('layout: frames follow the reading order of two columns', async () => {
    const pages = await fixturePages('two-column.pdf')
    const { xml } = await docXml((await buildDocx(pages, { mode: 'layout', keepImages: true })).blob)
    expect(xml.indexOf('LEFTEND')).toBeGreaterThan(0)
    expect(xml.indexOf('LEFTEND')).toBeLessThan(xml.indexOf('RIGHTSTART'))
  })
  it('scanned page without OCR becomes a picture', async () => {
    const page = { num: 1, width: 595, height: 842, items: [], images: [], background: { x: 0, y: 0, w: 595, h: 842, data: PNG_1PX, type: 'png' as const } }
    const r = await buildDocx([page], { mode: 'editable', keepImages: true })
    expect(r.stats).toMatchObject({ images: 1, imagePages: 1 })
    const l = await buildDocx([{ ...page, background: { ...page.background, data: PNG_1PX.slice() } }], { mode: 'layout', keepImages: false })
    expect((await docXml(l.blob)).xml).toContain('behindDoc="1"')
  })
})
