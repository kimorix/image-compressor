import { describe, expect, it } from 'vitest'
import { fmtSizeShort } from '../../src/lib/format'

describe('fmtSizeShort', () => {
  it('keeps bytes and rounds KB for the narrow card meta line', () => {
    expect(fmtSizeShort(153)).toBe('153 B')
    expect(fmtSizeShort(388 * 1024)).toBe('388 KB')
    expect(fmtSizeShort(156 * 1024)).toBe('156 KB')
  })
  it('shows one decimal for MB and drops .0', () => {
    expect(fmtSizeShort(1.04 * 1024 * 1024)).toBe('1 MB')
    expect(fmtSizeShort(14.21 * 1024 * 1024)).toBe('14.2 MB')
  })
})
