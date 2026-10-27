import { describe, expect, it } from 'vitest'
import { exceedsPixelLimit, MAX_PIXELS } from '../../src/lib/limits'

describe('exceedsPixelLimit', () => {
  it('accepts exactly the limit', () => {
    expect(exceedsPixelLimit(10_000, 8_000)).toBe(false) // 80 MP
  })
  it('rejects one pixel over the limit', () => {
    expect(exceedsPixelLimit(10_000, 8_001)).toBe(true)
  })
  it('ignores empty dimensions', () => {
    expect(exceedsPixelLimit(0, 10_000)).toBe(false)
    expect(exceedsPixelLimit(10_000, 0)).toBe(false)
  })
  it('exposes the limit in megapixels', () => {
    expect(MAX_PIXELS).toBe(80_000_000)
  })
})
