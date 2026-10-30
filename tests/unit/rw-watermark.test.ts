import { describe, expect, it } from 'vitest'
import { expandText, hitTest, layoutWatermark, lightness, MAX_TILES, relativeCenter, rotatedBounds, textVars } from '../../src/features/resize-watermark/lib/watermark'
import { defaultSettings } from '../../src/features/resize-watermark/lib/settings'
import type { WatermarkSettings } from '../../src/features/resize-watermark/types'

const W = (patch: Partial<WatermarkSettings>): WatermarkSettings => ({ ...defaultSettings().wm, enabled: true, ...patch })
// Fake measure: 0.6 em per character.
const measure = (text: string, px: number) => text.length * px * 0.6

describe('layoutWatermark', () => {
  it('empty text draws nothing', () => {
    expect(layoutWatermark(1000, 800, W({}), { text: '', measure }).items).toEqual([])
  })
  it('size is relative to the short side', () => {
    const a = layoutWatermark(1000, 800, W({ size: 5 }), { text: 'abc', measure })
    const b = layoutWatermark(4000, 3200, W({ size: 5 }), { text: 'abc', measure })
    expect(a.fontPx).toBeCloseTo(40)
    expect(b.fontPx).toBeCloseTo(160)
    // Same relative position at both sizes.
    expect(relativeCenter(a, 1000, 800)!.x).toBeCloseTo(relativeCenter(b, 4000, 3200)!.x)
    expect(relativeCenter(a, 1000, 800)!.y).toBeCloseTo(relativeCenter(b, 4000, 3200)!.y)
  })
  it('bottom-right anchor respects the margin', () => {
    const l = layoutWatermark(1000, 1000, W({ pos: 'br', size: 4, margin: 3 }), { text: 'abcd', measure })
    const p = l.items[0]
    expect(p.cx + l.bw / 2).toBeCloseTo(970)
    expect(p.cy + l.bh / 2).toBeCloseTo(970)
  })
  it('top-left and centre anchors', () => {
    const tl = layoutWatermark(1000, 1000, W({ pos: 'tl', margin: 0 }), { text: 'ab', measure })
    expect(tl.items[0].cx - tl.bw / 2).toBeCloseTo(0)
    const mc = layoutWatermark(1000, 600, W({ pos: 'mc' }), { text: 'ab', measure })
    expect(mc.items[0].cx).toBeCloseTo(500)
    expect(mc.items[0].cy).toBeCloseTo(300)
  })
  it('free position is relative and clamped inside', () => {
    const l = layoutWatermark(1000, 1000, W({ pos: 'free', x: 0.25, y: 0.75 }), { text: 'ab', measure })
    expect(l.items[0].cx).toBeCloseTo(250)
    expect(l.items[0].cy).toBeCloseTo(750)
    const edge = layoutWatermark(1000, 1000, W({ pos: 'free', x: 1, y: 0 }), { text: 'abcdef', measure })
    expect(edge.items[0].cx + edge.bw / 2).toBeLessThanOrEqual(1000.001)
    expect(edge.items[0].cy - edge.bh / 2).toBeGreaterThanOrEqual(-0.001)
  })
  it('too long text shrinks to fit', () => {
    const l = layoutWatermark(400, 400, W({ size: 20, margin: 0 }), { text: 'x'.repeat(100), measure })
    expect(l.bw).toBeLessThanOrEqual(400.001)
  })
  it('logo width is relative to the short side and keeps its aspect', () => {
    const l = layoutWatermark(2000, 1000, W({ kind: 'logo', logoSize: 20, rotate: 0 }), { logoAspect: 2 })
    expect(l.items[0].w).toBeCloseTo(200)
    expect(l.items[0].h).toBeCloseTo(100)
  })
  it('tile covers the image with staggered rows, at least one mark', () => {
    const l = layoutWatermark(1000, 1000, W({ pos: 'tile', rotate: -30, tileGap: 10 }), { text: 'abc', measure })
    expect(l.items.length).toBeGreaterThan(4)
    expect(l.items.length).toBeLessThanOrEqual(MAX_TILES)
    const rows = new Map<number, number[]>()
    for (const p of l.items) rows.set(Math.round(p.cy), [...(rows.get(Math.round(p.cy)) ?? []), p.cx])
    const firsts = [...rows.values()].map((xs) => Math.min(...xs))
    expect(new Set(firsts.map((x) => Math.round(x))).size).toBeGreaterThan(1)
  })
  it('tile caps the number of marks', () => {
    const l = layoutWatermark(16000, 16000, W({ pos: 'tile', size: 2, tileGap: 2 }), { text: 'a', measure })
    expect(l.items.length).toBeLessThanOrEqual(MAX_TILES)
  })
})

describe('helpers', () => {
  it('rotatedBounds', () => {
    const b = rotatedBounds(100, 20, Math.PI / 2)
    expect(b.bw).toBeCloseTo(20)
    expect(b.bh).toBeCloseTo(100)
  })
  it('hitTest respects rotation', () => {
    const l = layoutWatermark(1000, 1000, W({ pos: 'mc', rotate: 90 }), { text: 'abcdefghij', measure })
    const p = l.items[0]
    expect(hitTest(l, p.cx, p.cy)).toBe(true)
    expect(hitTest(l, p.cx, p.cy - p.w / 2 + 2)).toBe(true)
    expect(hitTest(l, p.cx + p.w / 2 - 2, p.cy)).toBe(false)
  })
  it('expandText replaces variables', () => {
    expect(expandText(' © {name} {date} ', { name: 'IMG_1', date: '2026-10-29' })).toBe('© IMG_1 2026-10-29')
  })
  it('textVars uses the EXIF date, then the file date', () => {
    expect(textVars({ name: 'a.b.jpg', lastModified: 0 }, '2020-01-02')).toEqual({ name: 'a.b', date: '2020-01-02' })
    expect(textVars({ name: 'x.png', lastModified: new Date(2024, 4, 6).getTime() }, null).date).toBe('2024-05-06')
  })
  it('lightness', () => {
    expect(lightness('#ffffff')).toBeCloseTo(1)
    expect(lightness('#000000')).toBe(0)
  })
})
