import { describe, expect, it } from 'vitest'
import { blocksText, layoutDocument } from '../../src/features/pdf-to-word/lib/layout'
import { cleanBoxes, imageBoxes, isScannedPage, textChars } from '../../src/features/pdf-to-word/lib/extract'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { fixturePages, openFixture } from './pdf-fixture'

describe('sample PDFs through pdf.js', () => {
  it('report.pdf: structure in reading order', async () => {
    const pages = await fixturePages('report.pdf')
    const { pages: ls } = layoutDocument(pages, { stripPageNumbers: true })
    const kinds = ls.flatMap((p) => p.blocks.map((b) => b.kind))
    expect(kinds.slice(0, 3)).toEqual(['heading', 'heading', 'para'])
    expect(kinds).toContain('table')
    expect(kinds).toContain('image')
    const text = ls.map((p) => blocksText(p.blocks)).join('\n')
    expect(text).toContain('Key terms are bold and notes are italic.')
    expect(text).toContain('所有数据均为示例。')
    expect(text.indexOf('2 Goals')).toBeLessThan(text.indexOf('3 Results'))
  })
  it('two-column.pdf: left column read before the right one', async () => {
    const pages = await fixturePages('two-column.pdf')
    const { pages: ls } = layoutDocument(pages)
    expect(ls[0].twoColumn).toBe(true)
    const text = blocksText(ls[0].blocks)
    expect(text.indexOf('LEFTEND')).toBeGreaterThan(0)
    expect(text.indexOf('LEFTEND')).toBeLessThan(text.indexOf('RIGHTSTART'))
    expect(text.startsWith('Attention Is Mostly What You Need')).toBe(true)
  })
  it('locked.pdf: needs the password, opens with it', async () => {
    await expect(openFixture('locked.pdf')).rejects.toMatchObject({ name: 'PasswordException', code: 1 })
    await expect(openFixture('locked.pdf', 'nope')).rejects.toMatchObject({ name: 'PasswordException', code: 2 })
    const pages = await fixturePages('locked.pdf', 'secret')
    expect(pages).toHaveLength(1)
    expect(textChars(pages[0].items)).toBeGreaterThan(100)
  })
  it('scanned.pdf: detected as a scanned page', async () => {
    const doc = await openFixture('scanned.pdf')
    const page = await doc.getPage(1)
    const vp = page.getViewport({ scale: 1 })
    const ops = await page.getOperatorList()
    const boxes = cleanBoxes(imageBoxes(pdfjs.OPS, ops.fnArray, ops.argsArray as unknown[][], vp.transform), vp.width, vp.height, false)
    expect(isScannedPage(0, boxes, vp.width, vp.height)).toBe(true)
    await doc.loadingTask.destroy()
  })
})
