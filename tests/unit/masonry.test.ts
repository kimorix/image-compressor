import { describe, expect, it } from 'vitest'
import {
  CARD_INFO_HEIGHT,
  appendMasonry,
  clampAspect,
  columnHeightDifference,
  distributeMasonry,
  estimateCardHeight,
  estimateThumbHeight,
  fallbackColumnWidth,
  isTinyImage,
  type MasonryColumns,
} from '../../src/lib/masonry'
import type { CompressItem } from '../../src/types'

function item(id: string, origW: number, origH: number): CompressItem {
  return { id, origW, origH } as CompressItem
}

describe('masonry aspect and height estimate', () => {
  it('clamps extremes to 3:4–4:3 and uses 1:1 when unknown', () => {
    expect(clampAspect(1080, 6000)).toBeCloseTo(3 / 4)
    expect(clampAspect(6000, 1000)).toBeCloseTo(4 / 3)
    expect(clampAspect(0, 0)).toBe(1)
  })

  it('caps tall thumbnails at 180px only on small phones', () => {
    const tall = item('t', 1080, 6000)
    expect(estimateThumbHeight(tall, 166, 390)).toBe(166)
    expect(estimateThumbHeight(tall, 186, 720)).toBeCloseTo(226.67, 1)
    expect(estimateCardHeight(tall, 166, 390)).toBe(237)
    expect(estimateCardHeight(item('unknown', 0, 0), 166, 390)).toBe(221)
  })

  it('reserves a one-line name plus the 28px meta row (71px info area)', () => {
    // 1px border + 8px padding + 6 + 17 (name) + 2 + 28 (meta) + 8 + 1
    expect(CARD_INFO_HEIGHT).toBe(71)
    // Long names cannot grow the card: the estimate ignores the filename.
    const a = { ...item('a', 1200, 900), file: { name: 'x'.repeat(200) } } as unknown as CompressItem
    const b = { ...item('b', 1200, 900), file: { name: 'x.jpg' } } as unknown as CompressItem
    expect(estimateCardHeight(a, 150, 375)).toBe(estimateCardHeight(b, 150, 375))
    // 150px column at 375px: thumb 134 wide, 4:3 → 100.5 tall, + 71.
    expect(estimateCardHeight(a, 150, 375)).toBe(Math.ceil(134 / (4 / 3) + 71))
  })

  it('leaves wide images at the 4:3 limit', () => {
    expect(estimateThumbHeight(item('w', 6000, 1000), 166, 390)).toBeCloseTo(112.5)
  })

  it('detects images smaller than 64px for contain rendering', () => {
    expect(isTinyImage(item('icon', 8, 8))).toBe(true)
    expect(isTinyImage(item('edge', 64, 100))).toBe(false)
    expect(isTinyImage(item('unknown', 0, 0))).toBe(false)
  })

  it('falls back to a sensible column width without a measured container', () => {
    expect(Math.round(fallbackColumnWidth(390))).toBe(166)
  })
})

describe('masonry distribution', () => {
  const width = 166
  const vw = 390
  const list = [
    item('a', 1200, 800),
    item('b', 800, 1200),
    item('c', 6000, 1000),
    item('d', 1080, 6000),
    item('e', 800, 800),
  ]

  it('places in shortest-column order and preserves per-column order', () => {
    const [left, right] = distributeMasonry(list, width, vw)
    expect(left.length + right.length).toBe(list.length)
    expect(new Set([...left, ...right].map((i) => i.id))).toEqual(new Set(list.map((i) => i.id)))
    // First two cards land on opposite sides; later cards never reorder a column.
    expect(left[0].id).toBe('a')
    expect(right[0].id).toBe('b')
    expect(left.map((i) => i.id)).toEqual(left.map((i) => i.id).sort((x, y) => list.findIndex((i) => i.id === x) - list.findIndex((i) => i.id === y)))
    expect(right.map((i) => i.id)).toEqual(right.map((i) => i.id).sort((x, y) => list.findIndex((i) => i.id === x) - list.findIndex((i) => i.id === y)))
  })

  it('appends only new cards and never moves existing ones', () => {
    const before: MasonryColumns = [
      [item('a', 1200, 800), item('c', 6000, 1000)],
      [item('b', 800, 1200)],
    ]
    const after = appendMasonry(before, [...before[0], ...before[1], item('d', 1080, 6000)], width, vw)
    expect(after[0].slice(0, before[0].length)).toEqual(before[0])
    expect(after[1].slice(0, before[1].length)).toEqual(before[1])
    expect([...after[0], ...after[1]].some((i) => i.id === 'd')).toBe(true)
  })

  it('reports a bottom difference no larger than one card', () => {
    const columns = distributeMasonry(list, width, vw)
    const max = Math.max(...[...columns[0], ...columns[1]].map((i) => estimateCardHeight(i, width, vw)))
    expect(columnHeightDifference(columns, width, vw)).toBeLessThanOrEqual(max)
  })
})
