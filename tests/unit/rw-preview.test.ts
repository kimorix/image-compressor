import { describe, expect, it } from 'vitest'
import { stageLayout } from '../../src/features/resize-watermark/lib/preview'
import { defaultSettings } from '../../src/features/resize-watermark/lib/settings'

describe('stageLayout', () => {
  const s = defaultSettings()
  s.resize = { ...s.resize, mode: 'box', w: 1080, h: 1080, fit: 'cover' }
  it('fits the output into the box', () => {
    const L = stageLayout(2400, 1600, s, { x: 0.5, y: 0.5 }, 500, 400, false)
    expect(L.cssW).toBeCloseTo(400)
    expect(L.cssH).toBeCloseTo(400)
    expect(L.ds).toBeCloseTo(400 / 1080)
    expect(L.context).toBeNull()
  })
  it('context mode shows the whole source with the crop window inside', () => {
    const L = stageLayout(2400, 1600, s, { x: 0.5, y: 0.5 }, 600, 600, true)
    expect(L.cssW).toBeCloseTo(600)
    expect(L.cssH).toBeCloseTo(400)
    expect(L.frame.x).toBeCloseTo(100)
    expect(L.frame.w).toBeCloseTo(400)
    // Output px map onto the frame.
    expect(L.ds * 1080).toBeCloseTo(L.frame.w)
  })
  it('context is ignored when nothing is cropped', () => {
    const t = defaultSettings()
    const L = stageLayout(2400, 1600, t, { x: 0.5, y: 0.5 }, 600, 600, true)
    expect(L.context).toBeNull()
  })
})
