import { describe, expect, it } from 'vitest'
import { isValidRangeSyntax, parsePageRange, parseRangeGroups } from '../../src/shared/pdf/page-range'

describe('page range', () => {
  it('empty means every page', () => {
    expect(parsePageRange('', 4)).toEqual({ ok: true, pages: [1, 2, 3, 4] })
    expect(parsePageRange('   ', 2)).toEqual({ ok: true, pages: [1, 2] })
  })
  it('singles, ranges, mixed separators, sorted and unique', () => {
    expect(parsePageRange('1-3,5', 10)).toEqual({ ok: true, pages: [1, 2, 3, 5] })
    expect(parsePageRange('5，1、2 3; 2', 10)).toEqual({ ok: true, pages: [1, 2, 3, 5] })
    expect(parsePageRange('2–4', 10)).toEqual({ ok: true, pages: [2, 3, 4] })
  })
  it('open ends and reversed ranges', () => {
    expect(parsePageRange('8-', 10)).toEqual({ ok: true, pages: [8, 9, 10] })
    expect(parsePageRange('-2', 10)).toEqual({ ok: true, pages: [1, 2] })
    expect(parsePageRange('4-2', 10)).toEqual({ ok: true, pages: [2, 3, 4] })
  })
  it('clips past the end, errors when nothing is left', () => {
    expect(parsePageRange('3-9', 4)).toEqual({ ok: true, pages: [3, 4] })
    expect(parsePageRange('7', 4)).toEqual({ ok: false, error: 'outOfRange' })
  })
  it('rejects junk', () => {
    expect(parsePageRange('abc', 4)).toEqual({ ok: false, error: 'syntax' })
    expect(parsePageRange('1-2-3', 4)).toEqual({ ok: false, error: 'syntax' })
    expect(parsePageRange('-', 4)).toEqual({ ok: false, error: 'syntax' })
    expect(isValidRangeSyntax('1-3,5')).toBe(true)
    expect(isValidRangeSyntax('')).toBe(true)
    expect(isValidRangeSyntax('1,,x')).toBe(false)
  })
})

describe('page range groups (split by ranges)', () => {
  it('keeps each part as its own group, in typed order', () => {
    expect(parseRangeGroups('1-3, 8, 4-6', 10)).toEqual({ ok: true, groups: [[1, 2, 3], [8], [4, 5, 6]] })
    expect(parseRangeGroups('11-', 12)).toEqual({ ok: true, groups: [[11, 12]] })
    expect(parseRangeGroups('-2；5～6', 10)).toEqual({ ok: true, groups: [[1, 2], [5, 6]] })
  })
  it('does not merge or de-duplicate across groups; reversed ranges keep direction', () => {
    expect(parseRangeGroups('1-2,2-3,1', 5)).toEqual({ ok: true, groups: [[1, 2], [2, 3], [1]] })
    expect(parseRangeGroups('5-3', 5)).toEqual({ ok: true, groups: [[5, 4, 3]] })
  })
  it('clips to the document and drops parts past the end', () => {
    expect(parseRangeGroups('3-9, 20, 1', 4)).toEqual({ ok: true, groups: [[3, 4], [1]] })
    expect(parseRangeGroups('9-12', 10)).toEqual({ ok: true, groups: [[9, 10]] })
    expect(parseRangeGroups('7, 9-', 4)).toEqual({ ok: false, error: 'outOfRange' })
  })
  it('empty input and junk', () => {
    expect(parseRangeGroups('', 4)).toEqual({ ok: false, error: 'empty' })
    expect(parseRangeGroups(' , ', 4)).toEqual({ ok: false, error: 'empty' })
    expect(parseRangeGroups('1-2-3', 4)).toEqual({ ok: false, error: 'syntax' })
    expect(parseRangeGroups('a', 4)).toEqual({ ok: false, error: 'syntax' })
  })
  it('agrees with parsePageRange on the selected set', () => {
    for (const input of ['1-3,5', '8-', '4-2, 2', '3-9', '1,1,1']) {
      const g = parseRangeGroups(input, 10)
      const r = parsePageRange(input, 10)
      expect(g.ok && r.ok).toBe(true)
      if (g.ok && r.ok) expect([...new Set(g.groups.flat())].sort((a, b) => a - b)).toEqual(r.pages)
    }
  })
})
