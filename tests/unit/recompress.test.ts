import { describe, expect, it } from 'vitest'
import { isUnaffected } from '../../src/features/image-compressor/lib/recompress'
import { DEFAULT_SETTINGS } from '../../src/features/image-compressor/lib/presets'
import type { CompressItem, Settings } from '../../src/features/image-compressor/types'

// Only the fields read by isUnaffected are populated; a real CompressItem has
// object URLs and UI flags that are irrelevant to this decision.
function makeItem(overrides: Partial<CompressItem> = {}, lastSettings: Settings = DEFAULT_SETTINGS): CompressItem {
  return {
    done: true,
    outSize: 100,
    file: { size: 100, type: 'image/jpeg' } as unknown as File,
    origW: 1600,
    origH: 1000,
    lastSettings: { ...lastSettings },
    ...overrides,
  } as CompressItem
}

const prev = { ...DEFAULT_SETTINGS }

describe('isUnaffected', () => {
  it('never skips a non-optimal or unfinished item', () => {
    expect(isUnaffected(makeItem({ done: false }), prev)).toBe(false)
    expect(isUnaffected(makeItem({ outSize: 99 }), prev)).toBe(false)
  })

  it('skips when a size limit gets looser', () => {
    const item = makeItem({}, { ...prev, maxSize: 1280 })
    expect(isUnaffected(item, { ...prev, maxSize: 1920 })).toBe(true)
  })

  it('re-runs on format, mode or quantize changes', () => {
    const item = makeItem()
    expect(isUnaffected(item, { ...prev, format: 'image/webp' })).toBe(false)
    expect(isUnaffected(item, { ...prev, mode: 'quality' })).toBe(false)
    expect(isUnaffected(item, { ...prev, quantize: false })).toBe(false)
  })

  it('re-runs on a lower quality or smaller target', () => {
    const quality = makeItem({}, { ...prev, mode: 'quality', quality: 80 })
    expect(isUnaffected(quality, { ...prev, mode: 'quality', quality: 60 })).toBe(false)
    expect(isUnaffected(quality, { ...prev, mode: 'quality', quality: 90 })).toBe(true)
    const target = makeItem({}, { ...prev, mode: 'target', targetSize: 500 })
    expect(isUnaffected(target, { ...prev, mode: 'target', targetSize: 300 })).toBe(false)
    expect(isUnaffected(target, { ...prev, mode: 'target', targetSize: 800 })).toBe(true)
  })

  it('re-runs when dimensions tighten', () => {
    const item = makeItem({}, { ...prev, maxSize: 1920 })
    expect(isUnaffected(item, { ...prev, maxSize: 1280 })).toBe(false)
    expect(isUnaffected(item, { ...prev, maxSize: 2560 })).toBe(true)
  })

  it('re-runs when a crop box changes', () => {
    const item = makeItem({}, { ...prev, resizeMode: 'exact', maxSize: 295, maxHeight: 413 })
    expect(isUnaffected(item, { ...prev, resizeMode: 'exact', maxSize: 413, maxHeight: 579 })).toBe(false)
    expect(isUnaffected(item, { ...prev, resizeMode: 'exact', maxSize: 295, maxHeight: 413 })).toBe(true)
  })

  it('re-runs when EXIF injection is lost', () => {
    const item = makeItem({}, { ...prev, format: 'image/jpeg', keepExif: true })
    expect(isUnaffected(item, { ...prev, format: 'image/jpeg', keepExif: false })).toBe(false)
  })

  it('ignores settings that cannot change the output size', () => {
    const item = makeItem()
    expect(isUnaffected(item, { ...prev, jpegFill: '#123456' })).toBe(true)
    expect(isUnaffected(item, { ...prev, keepOriginalName: true })).toBe(true)
  })
})
