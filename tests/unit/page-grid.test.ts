import { describe, expect, it } from 'vitest'
import {
  autoScrollStep, columnsFor, gridIndexAt, keyTarget, moveBlock, moveItem, nextSelection,
  normRotation, rotatedScale, slotOrigin, virtualRows, type GridGeom,
} from '../../src/shared/components/page-grid'

const ABC = ['a', 'b', 'c', 'd', 'e']

describe('PageGrid reorder', () => {
  it('moveItem puts the item at the target index', () => {
    expect(moveItem(ABC, 0, 3)).toEqual(['b', 'c', 'd', 'a', 'e'])
    expect(moveItem(ABC, 4, 0)).toEqual(['e', 'a', 'b', 'c', 'd'])
    expect(moveItem(ABC, 2, 2)).toEqual(ABC)
    expect(moveItem(ABC, 1, 99)).toEqual(['a', 'c', 'd', 'e', 'b'])
    expect(moveItem(ABC, 9, 0)).toEqual(ABC)
  })
  it('moveItem never mutates and round-trips', () => {
    const src = ABC.slice()
    const moved = moveItem(src, 1, 3)
    expect(src).toEqual(ABC)
    expect(moveItem(moved, 3, 1)).toEqual(ABC)
  })
  it('moveBlock keeps the block together and in order', () => {
    expect(moveBlock(ABC, [3, 1], 0)).toEqual(['b', 'd', 'a', 'c', 'e']) // move to first
    expect(moveBlock(ABC, [0, 2], 3)).toEqual(['b', 'd', 'e', 'a', 'c']) // move to last
    expect(moveBlock(ABC, [], 0)).toEqual(ABC)
    expect(moveBlock(ABC, [4], 1)).toEqual(['a', 'e', 'b', 'c', 'd'])
  })
  it('normRotation', () => {
    expect([0, 90, 180, 270, 360, -90, 450, 89].map(normRotation)).toEqual([0, 90, 180, 270, 0, 270, 90, 90])
  })
})

describe('PageGrid selection', () => {
  it('plain click selects one, second click clears', () => {
    expect(nextSelection(ABC, [], null, 'c')).toEqual(['c'])
    expect(nextSelection(ABC, ['a', 'b'], 'a', 'c')).toEqual(['c'])
    expect(nextSelection(ABC, ['c'], 'c', 'c')).toEqual([])
  })
  it('toggle adds/removes and keeps display order', () => {
    expect(nextSelection(ABC, ['d'], 'd', 'b', { toggle: true })).toEqual(['b', 'd'])
    expect(nextSelection(ABC, ['b', 'd'], 'd', 'b', { toggle: true })).toEqual(['d'])
  })
  it('shift selects the range from the anchor in either direction', () => {
    expect(nextSelection(ABC, ['b'], 'b', 'd', { shift: true })).toEqual(['b', 'c', 'd'])
    expect(nextSelection(ABC, ['d'], 'd', 'a', { shift: true })).toEqual(['a', 'b', 'c', 'd'])
    expect(nextSelection(ABC, [], null, 'c', { shift: true })).toEqual(['c'])
  })
})

describe('PageGrid geometry', () => {
  const g: GridGeom = { cols: 4, colW: 100, rowH: 150, gap: 10, n: 10 }
  it('columnsFor', () => {
    expect(columnsFor(560, 120, 12)).toBe(4)
    expect(columnsFor(358, 100, 8)).toBe(3)
    expect(columnsFor(150, 120, 12)).toBe(2) // never fewer than 2
    expect(columnsFor(999, 120, 12, 3)).toBe(3)
  })
  it('gridIndexAt maps points to slots, snapping gaps and clamping', () => {
    expect(gridIndexAt(5, 5, g)).toBe(0)
    expect(gridIndexAt(115, 10, g)).toBe(1)
    expect(gridIndexAt(104, 10, g)).toBe(0) // left half of the gap belongs to slot 0
    expect(gridIndexAt(106, 10, g)).toBe(1)
    expect(gridIndexAt(330, 170, g)).toBe(7)
    expect(gridIndexAt(330, 400, g)).toBe(9) // past the last item
    expect(gridIndexAt(-50, -50, g)).toBe(0)
    expect(gridIndexAt(9999, 0, g)).toBe(3)
    expect(gridIndexAt(0, 0, { ...g, n: 0 })).toBe(-1)
  })
  it('slotOrigin is the inverse of gridIndexAt', () => {
    for (let i = 0; i < g.n; i++) {
      const o = slotOrigin(i, g)
      expect(gridIndexAt(o.x + 1, o.y + 1, g)).toBe(i)
    }
  })
  it('virtualRows renders the visible rows plus overscan', () => {
    const big: GridGeom = { cols: 4, colW: 100, rowH: 150, gap: 10, n: 1000 } // 250 rows, stride 160
    expect(virtualRows(0, 800, big, 2)).toEqual({ start: 0, end: 7 })
    expect(virtualRows(1600, 800, big, 2)).toEqual({ start: 8, end: 17 })
    expect(virtualRows(1e9, 800, big, 2).end).toBe(250)
  })
  it('keyTarget moves by one, by a row, to the ends, and clamps', () => {
    expect(keyTarget('ArrowRight', 3, 4, 10)).toBe(4)
    expect(keyTarget('ArrowLeft', 0, 4, 10)).toBe(0)
    expect(keyTarget('ArrowDown', 6, 4, 10)).toBe(9)
    expect(keyTarget('ArrowUp', 6, 4, 10)).toBe(2)
    expect(keyTarget('Home', 6, 4, 10)).toBe(0)
    expect(keyTarget('End', 0, 4, 10)).toBe(9)
    expect(keyTarget('a', 0, 4, 10)).toBeNull()
  })
  it('autoScrollStep ramps near the edges only', () => {
    expect(autoScrollStep(400, 0, 800)).toBe(0)
    expect(autoScrollStep(0, 0, 800)).toBe(-18)
    expect(autoScrollStep(28, 0, 800)).toBe(-9)
    expect(autoScrollStep(800, 0, 800)).toBe(18)
    expect(autoScrollStep(900, 0, 800)).toBe(18)
  })
  it('rotatedScale fits a rotated thumbnail into the frame', () => {
    expect(rotatedScale(1.5, 1.414, 0)).toBe(1)
    expect(rotatedScale(1.5, 1.414, 180)).toBe(1)
    // landscape photo on an A4 tile, turned upright: grows to fill the height
    expect(rotatedScale(1.5, 1.414, 90)).toBeCloseTo(1.414, 3)
    // square frame, any picture: rotation never changes the fit
    expect(rotatedScale(0.75, 1, 270)).toBeCloseTo(1, 6)
    // rotated box always fits: (bh*s) <= 1 and (bw*s) <= frame
    for (const ia of [0.5, 0.7, 1, 1.3, 2]) {
      const fa = 1.414
      const s = rotatedScale(ia, fa, 90)
      const bw = Math.min(1, fa * ia)
      expect((bw / ia) * s).toBeLessThanOrEqual(1 + 1e-9)
      expect(bw * s).toBeLessThanOrEqual(fa + 1e-9)
    }
  })
})
