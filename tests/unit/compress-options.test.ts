import { describe, expect, it } from 'vitest'
import { initialOutType, keepsOriginal } from '../../src/features/image-compressor/lib/compress'

const jpg = { type: 'image/jpeg', name: 'a.jpg' }
const gif = { type: 'image/gif', name: 'a.gif' }
const heic = { type: 'image/heic', name: 'a.heic' }

describe('compress output type (forceFormat off = compressor behaviour)', () => {
  it('auto, original, explicit', () => {
    expect(initialOutType(jpg, 'auto', false)).toBe('image/webp')
    expect(initialOutType(jpg, 'original', false)).toBe('image/jpeg')
    expect(initialOutType(heic, 'original', true)).toBe('image/jpeg')
    expect(initialOutType(jpg, 'image/avif', false)).toBe('image/avif')
  })
  it('unsupported types fall back to PNG unless the format is forced', () => {
    expect(initialOutType(gif, 'original', false)).toBe('image/png')
    expect(initialOutType(gif, 'image/bmp', false)).toBe('image/png')
    expect(() => initialOutType(gif, 'image/bmp', false, { forceFormat: true })).toThrow()
    expect(initialOutType(gif, 'image/webp', false, { forceFormat: true })).toBe('image/webp')
  })
  it('bigger output keeps the original only without forceFormat', () => {
    expect(keepsOriginal(120, 100)).toBe(true)
    expect(keepsOriginal(100, 100)).toBe(true)
    expect(keepsOriginal(99, 100)).toBe(false)
    expect(keepsOriginal(120, 100, { forceFormat: true })).toBe(false)
    expect(keepsOriginal(120, 100, { forceFormat: false })).toBe(true)
  })
})
