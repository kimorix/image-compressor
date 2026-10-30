import { describe, expect, it } from 'vitest'
import { groupLabel, planSplit, specFor } from '../../src/features/pdf-merge/lib/split-plan'
import { mergeName, sanitize, splitName, stem, withPdf } from '../../src/features/pdf-merge/lib/names'
import { outlineSize, remapOutline, type OutlineNode } from '../../src/features/pdf-merge/lib/outline'

describe('split plan', () => {
  it('ranges keep typed groups and order (shared parseRangeGroups)', () => {
    expect(planSplit({ kind: 'ranges', text: '1-3, 4-10, 11-' }, 12)).toEqual({ ok: true, groups: [[1, 2, 3], [4, 5, 6, 7, 8, 9, 10], [11, 12]] })
    expect(planSplit({ kind: 'ranges', text: '5-3，1' }, 6)).toEqual({ ok: true, groups: [[5, 4, 3], [1]] })
    expect(planSplit({ kind: 'ranges', text: 'a-b' }, 6)).toEqual({ ok: false, error: 'syntax' })
    expect(planSplit({ kind: 'ranges', text: '9-' }, 6)).toEqual({ ok: false, error: 'outOfRange' })
    expect(planSplit({ kind: 'ranges', text: '' }, 6)).toEqual({ ok: false, error: 'empty' })
  })
  it('every N pages, last group shorter', () => {
    expect(planSplit({ kind: 'every', n: 2 }, 5)).toEqual({ ok: true, groups: [[1, 2], [3, 4], [5]] })
    expect(planSplit({ kind: 'every', n: 10 }, 3)).toEqual({ ok: true, groups: [[1, 2, 3]] })
    expect(planSplit({ kind: 'every', n: 0 }, 3)).toEqual({ ok: false, error: 'badN' })
    expect(planSplit({ kind: 'every', n: NaN }, 3)).toEqual({ ok: false, error: 'badN' })
  })
  it('selected pages give one file in grid order; one per page', () => {
    expect(planSplit({ kind: 'selected', positions: [4, 2, 9] }, 5)).toEqual({ ok: true, groups: [[4, 2]] })
    expect(planSplit({ kind: 'selected', positions: [] }, 5)).toEqual({ ok: false, error: 'noSelection' })
    expect(planSplit({ kind: 'single' }, 3)).toEqual({ ok: true, groups: [[1], [2], [3]] })
    expect(planSplit({ kind: 'single' }, 0)).toEqual({ ok: false, error: 'empty' })
  })
  it('builds specs from settings', () => {
    expect(specFor('every', '', 3)).toEqual({ kind: 'every', n: 3 })
    expect(specFor('selected', '', 2, [1])).toEqual({ kind: 'selected', positions: [1] })
  })
  it('labels groups compactly', () => {
    expect(groupLabel([1, 2, 3])).toBe('1-3')
    expect(groupLabel([7])).toBe('7')
    expect(groupLabel([5, 4, 3])).toBe('5-3')
    expect(groupLabel([1, 2, 3, 5, 8, 9])).toBe('1-3_5_8-9')
    expect(groupLabel([1, 2, 1])).toBe('1-2_1')
    expect(groupLabel([])).toBe('')
  })
})

describe('file names', () => {
  it('stems, sanitises and adds .pdf once', () => {
    expect(stem('报告.PDF')).toBe('报告')
    expect(withPdf('a.pdf')).toBe('a.pdf')
    expect(sanitize('a/b:c*?.pdf')).toBe('a_b_c_.pdf')
    expect(sanitize('  ...  ')).toBe('document')
    expect(sanitize('x'.repeat(300)).length).toBe(180)
  })
  it('merge name: typed, or first file + suffix', () => {
    expect(mergeName('', '2026年度报告.pdf', '-合并')).toBe('2026年度报告-合并.pdf')
    expect(mergeName('  季度汇总.pdf ', 'a.pdf', '-merged')).toBe('季度汇总.pdf')
    expect(mergeName('', undefined, '-merged')).toBe('merged-merged.pdf')
  })
  it('split names fill the template with padded numbers', () => {
    expect(splitName('{name}_{range}', { name: '规划报告.pdf', range: '1-3', n: 1, total: 3 })).toBe('规划报告_1-3.pdf')
    expect(splitName('{name}_{n}', { name: 'a.pdf', range: '1', n: 2, total: 12 })).toBe('a_02.pdf')
    expect(splitName('', { name: 'a.pdf', range: '4-5', n: 2, total: 2 })).toBe('a_4-5.pdf')
    expect(splitName('{name}/{range}', { name: 'a', range: '1', n: 1, total: 1 })).toBe('a_1.pdf')
  })
})

describe('outline remapping', () => {
  const tree: OutlineNode[] = [
    { title: 'Ch1', page: 0, children: [{ title: '1.1', page: 1, children: [] }, { title: '1.2', page: 2, children: [] }] },
    { title: 'Ch2', page: 3, view: ['XYZ', 0, 700, null], children: [] },
    { title: 'Remote', page: null, children: [] },
  ]
  it('maps pages, drops missing leaves and keeps parents of survivors', () => {
    // Page 0 deleted, page 2 moved first, page 3 deleted.
    const map = new Map([[1, 1], [2, 0]])
    const r = remapOutline(tree, (i) => map.get(i))
    expect(r).toEqual([{ title: 'Ch1', page: 1, children: [{ title: '1.1', page: 1, view: undefined, children: [] }, { title: '1.2', page: 0, view: undefined, children: [] }] }])
    expect(outlineSize(r)).toBe(3)
  })
  it('keeps the destination view', () => {
    const r = remapOutline(tree, (i) => i + 10)
    expect(r[1]).toEqual({ title: 'Ch2', page: 13, view: ['XYZ', 0, 700, null], children: [] })
    expect(outlineSize(r)).toBe(4)
  })
})
