import { describe, expect, it } from 'vitest'
import { computeGeometry, effectiveResize, lockedHeight, lockedWidth, MAX_SIDE, panFocus } from '../../src/features/resize-watermark/lib/geometry'
import { defaultSettings } from '../../src/features/resize-watermark/lib/settings'
import type { ResizeSettings } from '../../src/features/resize-watermark/types'

const R = (patch: Partial<ResizeSettings>): ResizeSettings => ({ ...defaultSettings().resize, ...patch })

describe('effectiveResize', () => {
  it('disabled is none', () => expect(effectiveResize(R({ enabled: false })).kind).toBe('none'))
  it('preset → exact cover box', () => expect(effectiveResize(R({ mode: 'preset', preset: 'xhs34' }))).toEqual({ kind: 'box', w: 1080, h: 1440, fit: 'cover' }))
  it('moments preset is a 1080 long side', () => expect(effectiveResize(R({ mode: 'preset', preset: 'moments' }))).toEqual({ kind: 'long', long: 1080 }))
  it('unknown preset is none', () => expect(effectiveResize(R({ mode: 'preset', preset: 'nope' })).kind).toBe('none'))
})

describe('computeGeometry', () => {
  it('disabled keeps the original size', () => {
    const g = computeGeometry(4000, 3000, R({ enabled: false }))
    expect(g.canvas).toEqual({ w: 4000, h: 3000 })
    expect(g.crop).toEqual({ x: 0, y: 0, w: 4000, h: 3000 })
  })
  it('long side scales proportionally', () => {
    const g = computeGeometry(4000, 3000, R({ mode: 'long', long: 2048 }))
    expect(g.canvas).toEqual({ w: 2048, h: 1536 })
    expect(g.notUpscaled).toBe(false)
  })
  it('long side does not enlarge small images with noUpscale', () => {
    const g = computeGeometry(800, 600, R({ mode: 'long', long: 2048 }))
    expect(g.canvas).toEqual({ w: 800, h: 600 })
    expect(g.notUpscaled).toBe(true)
  })
  it('long side enlarges when allowed', () => {
    expect(computeGeometry(800, 600, R({ mode: 'long', long: 1600, noUpscale: false })).canvas).toEqual({ w: 1600, h: 1200 })
  })
  it('percent', () => {
    expect(computeGeometry(1000, 501, R({ mode: 'pct', pct: 50 })).canvas).toEqual({ w: 500, h: 251 })
  })
  it('percent never exceeds the canvas limit', () => {
    const g = computeGeometry(10000, 5000, R({ mode: 'pct', pct: 400, noUpscale: false }))
    expect(g.canvas.w).toBe(MAX_SIDE)
  })
  it('contain fits inside the box keeping the ratio', () => {
    const g = computeGeometry(2400, 1600, R({ mode: 'box', w: 1080, h: 1080, fit: 'contain' }))
    expect(g.canvas).toEqual({ w: 1080, h: 720 })
    expect(g.cropped).toBe(false)
  })
  it('pad letterboxes to the exact box', () => {
    const g = computeGeometry(2400, 1600, R({ mode: 'box', w: 1080, h: 1080, fit: 'pad' }))
    expect(g.canvas).toEqual({ w: 1080, h: 1080 })
    expect(g.draw).toEqual({ x: 0, y: 180, w: 1080, h: 720 })
    expect(g.padded).toBe(true)
  })
  it('pad keeps a small image at its own size, centred', () => {
    const g = computeGeometry(400, 300, R({ mode: 'box', w: 1000, h: 1000, fit: 'pad' }))
    expect(g.canvas).toEqual({ w: 1000, h: 1000 })
    expect(g.draw).toEqual({ x: 300, y: 350, w: 400, h: 300 })
    expect(g.notUpscaled).toBe(true)
  })
  it('cover crops centred by default', () => {
    const g = computeGeometry(2400, 1600, R({ mode: 'box', w: 1080, h: 1080, fit: 'cover' }))
    expect(g.canvas).toEqual({ w: 1080, h: 1080 })
    expect(g.crop.w).toBeCloseTo(1600)
    expect(g.crop.h).toBeCloseTo(1600)
    expect(g.crop.x).toBeCloseTo(400)
    expect(g.crop.y).toBe(0)
    expect(g.cropped).toBe(true)
  })
  it('cover follows the focus', () => {
    const r = R({ mode: 'box', w: 1080, h: 1080, fit: 'cover' })
    expect(computeGeometry(2400, 1600, r, { x: 0, y: 0.5 }).crop.x).toBe(0)
    expect(computeGeometry(2400, 1600, r, { x: 1, y: 0.5 }).crop.x).toBeCloseTo(800)
  })
  it('cover on a small image keeps the box ratio at source resolution', () => {
    const g = computeGeometry(600, 400, R({ mode: 'box', w: 1080, h: 1440, fit: 'cover' }))
    expect(g.notUpscaled).toBe(true)
    expect(g.canvas.w / g.canvas.h).toBeCloseTo(1080 / 1440, 2)
    expect(g.canvas.h).toBe(400)
    expect(g.crop.h).toBe(400)
  })
  it('preset produces the exact platform size', () => {
    const g = computeGeometry(3024, 4032, R({ mode: 'preset', preset: 'story916' }))
    expect(g.canvas).toEqual({ w: 1080, h: 1920 })
  })
})

describe('panFocus', () => {
  const r = R({ mode: 'box', w: 1000, h: 1000, fit: 'cover' })
  it('dragging the picture right moves the window left', () => {
    const g = computeGeometry(2000, 1000, r)
    const f = panFocus(g, 2000, 1000, { x: 0.5, y: 0.5 }, 250, 0)
    expect(f.x).toBeCloseTo(0.25)
    expect(f.y).toBe(0.5)
  })
  it('clamps at the edges', () => {
    const g = computeGeometry(2000, 1000, r)
    expect(panFocus(g, 2000, 1000, { x: 0.5, y: 0.5 }, 99999, 0).x).toBe(0)
    expect(panFocus(g, 2000, 1000, { x: 0.5, y: 0.5 }, -99999, 0).x).toBe(1)
  })
})

describe('ratio lock', () => {
  it('derives the other side from the source', () => {
    expect(lockedHeight(1080, 4000, 3000)).toBe(810)
    expect(lockedWidth(810, 4000, 3000)).toBe(1080)
  })
})
