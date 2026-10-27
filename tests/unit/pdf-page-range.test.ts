import { describe, expect, it } from 'vitest'
import { isValidRangeSyntax, parsePageRange } from '../../src/features/pdf-to-word/lib/page-range'

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
