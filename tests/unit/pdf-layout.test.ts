import { describe, expect, it } from 'vitest'
import { blocksText, bodySizeOf, buildLines, chineseNumber, detectColumns, joinLines, layoutDocument, layoutPage, listMarker, stripPageNumbers, tableColumns } from '../../src/features/pdf-to-word/lib/layout'
import type { PageModel, TextItem } from '../../src/features/pdf-to-word/types'

// Text item helper: approximate Helvetica widths (0.5 em per char).
function T(str: string, x: number, y: number, size = 11, extra: Partial<TextItem> = {}): TextItem {
  return { str, x, y, w: str.length * size * 0.5, h: size * 1.1, size, bold: false, italic: false, ...extra }
}
function page(items: TextItem[], extra: Partial<PageModel> = {}): PageModel {
  return { num: 1, width: 595, height: 842, items, images: [], ...extra }
}

describe('text joining', () => {
  it('spaces Latin words, not CJK', () => {
    expect(joinLines('hello', 'world')).toBe('hello world')
    expect(joinLines('中文', '继续')).toBe('中文继续')
    expect(joinLines('exam-', 'ple')).toBe('example')
    expect(joinLines('Jean-', 'Paul')).toBe('Jean- Paul')
  })
  it('body size is the size with most characters', () => {
    expect(bodySizeOf([T('Title', 0, 0, 24), T('a long body line of text', 0, 40, 11), T('another body line', 0, 60, 11)])).toBe(11)
  })
})

describe('lines', () => {
  it('groups items on one baseline and splits at wide gaps', () => {
    const lines = buildLines([T('Hello', 72, 100), T('world', 72 + 5 * 5.5 + 3, 100.5), T('Cell', 400, 100)])
    expect(lines.map((l) => l.text)).toEqual(['Hello world', 'Cell'])
    expect(lines[0].row).toBe(lines[1].row)
  })
  it('keeps bold/italic runs and puts the gap space on the previous run', () => {
    const lines = buildLines([T('Key', 72, 100), T('bold', 72 + 16.5 + 3, 100, 11, { bold: true }), T('end', 72 + 16.5 + 3 + 22 + 3, 100, 11, { italic: true })])
    expect(lines[0].spans.map((s) => [s.text, s.bold, s.italic])).toEqual([['Key ', false, false], ['bold ', true, false], ['end', false, true]])
  })
  it('drops bare page numbers in the margins only', () => {
    const lines = buildLines([T('3', 297, 800), T('12', 297, 400), T('Page 2 of 9', 260, 20), T('第 3 页', 280, 30)])
    expect(stripPageNumbers(lines, 842).map((l) => l.text)).toEqual(['12'])
  })
})

describe('list markers', () => {
  it('recognises bullets and numbering styles', () => {
    expect(listMarker('• Item')).toMatchObject({ ordered: false, format: 'bullet' })
    expect(listMarker('- dash item')).toMatchObject({ ordered: false })
    expect(listMarker('3. Third')).toMatchObject({ ordered: true, format: 'decimal', pattern: '%1.', start: 3 })
    expect(listMarker('(2) Two')).toMatchObject({ pattern: '(%1)', start: 2 })
    expect(listMarker('b) Bee')).toMatchObject({ format: 'lowerLetter', start: 2 })
    expect(listMarker('三、总结')).toMatchObject({ format: 'chineseCounting', start: 3 })
    expect(listMarker('（十二）附则')).toMatchObject({ format: 'chineseCounting', start: 12 })
    expect(chineseNumber('二十一')).toBe(21)
  })
  it('does not take numbers for markers', () => {
    expect(listMarker('1.5 million users')).toBeNull()
    expect(listMarker('2026 plan')).toBeNull()
    expect(listMarker('-5 degrees')).toBeNull()
    expect(listMarker('•')).toBeNull()
  })
})

describe('page layout', () => {
  it('headings by size, paragraphs by gap, lists, page numbers dropped', () => {
    const items = [
      T('Annual Report', 72, 60, 24, { bold: true }),
      T('Overview', 72, 110, 15, { bold: true }),
      T('This is the first line of a paragraph that runs wide', 72, 140),
      T('and this is its second line, ending here.', 72, 155),
      T('A second paragraph starts after a gap.', 72, 185),
      T('• first point', 72, 215), T('• second point', 72, 231),
      T('1. step one', 72, 255), T('2. step two', 72, 271),
      T('7', 297, 810, 9),
    ]
    const { pages } = layoutDocument([page(items)], { stripPageNumbers: true })
    const b = pages[0].blocks
    expect(b.map((x) => x.kind)).toEqual(['heading', 'heading', 'para', 'para', 'list', 'list', 'list', 'list'])
    expect(b[0]).toMatchObject({ level: 1 })
    expect(b[1]).toMatchObject({ level: 2 })
    expect(blocksText([b[2]])).toBe('This is the first line of a paragraph that runs wide and this is its second line, ending here.')
    expect(blocksText([b[4]])).toBe('first point')
    expect(b[6]).toMatchObject({ kind: 'list', marker: { ordered: true, start: 1 } })
    expect(blocksText(b)).not.toContain('7')
  })
  it('finds a simple table', () => {
    const rows = [['Item', 'Q1', 'Total'], ['Design', '12', '20'], ['Build', '40', '85']]
    const items = rows.flatMap((r, ri) => r.map((c, ci) => T(c, 72 + ci * 150, 100 + ri * 18)))
    const b = layoutPage(page(items), { bodySize: 11 }).blocks
    expect(b).toHaveLength(1)
    expect(b[0].kind).toBe('table')
    if (b[0].kind === 'table') expect(b[0].rows.map((r) => r.map((c) => c.map((s) => s.text).join('')))).toEqual(rows)
  })
  it('table columns need aligned cells', () => {
    const a = buildLines([T('aaaa', 72, 100), T('bbbb', 300, 100)])
    const b = buildLines([T('c'.repeat(60), 72, 120)])
    expect(tableColumns([a, b])).toBeNull()
  })
  it('reads two columns left then right, with a spanning title first', () => {
    const items: TextItem[] = [T('A Paper Title', 200, 50, 20)]
    for (let i = 0; i < 12; i++) {
      items.push(T(`left line ${i} with words in the left column`, 54, 100 + i * 13, 10))
      items.push(T(`right line ${i} with words in the right column`, 310, 100 + i * 13, 10))
    }
    expect(detectColumns(buildLines(items), 595)).not.toBeNull()
    const pl = layoutPage(page(items), { bodySize: 10 })
    expect(pl.twoColumn).toBe(true)
    const text = blocksText(pl.blocks)
    expect(text.indexOf('A Paper Title')).toBe(0)
    expect(text.indexOf('left line 11')).toBeLessThan(text.indexOf('right line 0'))
  })
  it('places pictures in reading order', () => {
    const items = [T('Before the chart.', 72, 100), T('After the chart.', 72, 400)]
    const img = { x: 72, y: 130, w: 300, h: 200, data: new Uint8Array(1), type: 'png' as const }
    const b = layoutPage(page(items, { images: [img] }), { bodySize: 11 }).blocks
    expect(b.map((x) => x.kind)).toEqual(['para', 'image', 'para'])
  })
  it('joins a paragraph split by a page break', () => {
    const p1 = page([T('The sentence starts on one page and', 72, 760)])
    const p2 = { ...page([T('finishes on the next one.', 72, 72)]), num: 2 }
    const { pages } = layoutDocument([p1, p2])
    expect(blocksText(pages[0].blocks)).toBe('The sentence starts on one page and finishes on the next one.')
    expect(pages[1].blocks).toHaveLength(0)
  })
  it('a lone letter item is a paragraph (initials)', () => {
    const b = layoutPage(page([T('A. Author wrote this', 72, 100)]), { bodySize: 11 }).blocks
    expect(b[0].kind).toBe('para')
    expect(blocksText(b)).toBe('A. Author wrote this')
  })
})
