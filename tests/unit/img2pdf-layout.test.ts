import { describe, expect, it } from 'vitest'
import {
  MARGIN_PT, MAX_PAGE_PT, PAPER_PT, exifMatrix, exifSwaps, frameAspect, layoutPage, placementMatrix,
  previewBoxes, rotatedSize,
} from '../../src/features/img-to-pdf/lib/layout'

const A4 = PAPER_PT.a4
const LETTER = PAPER_PT.letter
const s = (o: Partial<{ paper: 'a4' | 'letter' | 'fit'; orientation: 'auto' | 'portrait' | 'landscape'; margin: 'none' | 'small' | 'medium' | 'large' }> = {}) =>
  ({ paper: 'a4' as const, orientation: 'auto' as const, margin: 'small' as const, ...o })

describe('rotatedSize', () => {
  it('swaps sides at 90/270 only', () => {
    expect(rotatedSize(4, 3, 0)).toEqual({ w: 4, h: 3 })
    expect(rotatedSize(4, 3, 90)).toEqual({ w: 3, h: 4 })
    expect(rotatedSize(4, 3, 180)).toEqual({ w: 4, h: 3 })
    expect(rotatedSize(4, 3, 270)).toEqual({ w: 3, h: 4 })
    expect(rotatedSize(4, 3, -90)).toEqual({ w: 3, h: 4 })
  })
})

describe('layoutPage: paper sizes', () => {
  it('portrait image on A4, auto → portrait page, contained and centred', () => {
    const l = layoutPage(3000, 4000, 0, s())
    expect([l.pageW, l.pageH]).toEqual(A4)
    expect(l.landscape).toBe(false)
    const m = MARGIN_PT.small
    // Width-bound: 3:4 is wider than the A4 box (559.28 × 805.89).
    expect(l.w).toBeCloseTo(A4[0] - 2 * m, 1)
    expect(l.h).toBeCloseTo(((A4[0] - 2 * m) * 4) / 3, 1)
    expect(l.x).toBeCloseTo(m, 1)
    expect(l.y + l.h / 2).toBeCloseTo(A4[1] / 2, 1)
  })
  it('landscape image, auto → landscape page (per page)', () => {
    const l = layoutPage(4000, 3000, 0, s())
    expect([l.pageW, l.pageH]).toEqual([A4[1], A4[0]])
    expect(l.landscape).toBe(true)
    expect(l.h).toBeCloseTo(A4[0] - 36, 1) // height-bound
  })
  it('square image stays portrait on auto', () => {
    expect(layoutPage(1000, 1000, 0, s()).landscape).toBe(false)
  })
  it('user rotation decides auto orientation', () => {
    const l = layoutPage(3000, 4000, 90, s())
    expect(l.landscape).toBe(true)
    expect(l.w / l.h).toBeCloseTo(4 / 3, 3)
  })
  it('forced portrait / landscape ignore the image shape', () => {
    expect(layoutPage(4000, 3000, 0, s({ orientation: 'portrait' })).pageW).toBe(A4[0])
    expect(layoutPage(3000, 4000, 0, s({ orientation: 'landscape' })).pageW).toBe(A4[1])
  })
  it('Letter', () => {
    const l = layoutPage(800, 600, 0, s({ paper: 'letter', margin: 'none' }))
    expect([l.pageW, l.pageH]).toEqual([LETTER[1], LETTER[0]])
    expect(l.w).toBeCloseTo(792 * 1, 0) // 4:3 into 792 × 612: height-bound → 816 > 792, so width-bound
    expect(l.h).toBeCloseTo(594, 0)
  })
  it('each margin shrinks the box and keeps it centred', () => {
    for (const margin of ['none', 'small', 'medium', 'large'] as const) {
      const m = MARGIN_PT[margin]
      const l = layoutPage(1000, 1000, 0, s({ margin }))
      expect(l.w).toBeCloseTo(A4[0] - 2 * m, 1)
      expect(l.x).toBeCloseTo(m, 1)
      expect(l.x + l.w + m).toBeCloseTo(A4[0], 1)
      expect(l.y * 2 + l.h).toBeCloseTo(A4[1], 1)
    }
  })
  it('never crops: the image rect stays inside the margin box', () => {
    for (const [w, h] of [[1, 5000], [5000, 1], [123, 457], [4032, 3024]]) {
      for (const rot of [0, 90]) {
        const l = layoutPage(w, h, rot, s({ margin: 'large' }))
        expect(l.x).toBeGreaterThanOrEqual(54 - 0.01)
        expect(l.y).toBeGreaterThanOrEqual(54 - 0.01)
        expect(l.x + l.w).toBeLessThanOrEqual(l.pageW - 54 + 0.01)
        expect(l.y + l.h).toBeLessThanOrEqual(l.pageH - 54 + 0.01)
      }
    }
  })
  it('degenerate sizes do not divide by zero', () => {
    const l = layoutPage(0, 0, 0, s())
    expect(Number.isFinite(l.w) && Number.isFinite(l.h)).toBe(true)
  })
})

describe('layoutPage: fit to image', () => {
  it('page = image at 72 dpi plus margins', () => {
    const l = layoutPage(800, 600, 0, s({ paper: 'fit', margin: 'small' }))
    expect([l.pageW, l.pageH]).toEqual([836, 636])
    expect([l.x, l.y, l.w, l.h]).toEqual([18, 18, 800, 600])
    expect(l.landscape).toBe(true)
  })
  it('rotation swaps the page', () => {
    const l = layoutPage(800, 600, 270, s({ paper: 'fit', margin: 'none' }))
    expect([l.pageW, l.pageH]).toEqual([600, 800])
  })
  it('caps the page at 200 in', () => {
    const l = layoutPage(30000, 10000, 0, s({ paper: 'fit', margin: 'none' }))
    expect(l.pageW).toBeLessThanOrEqual(MAX_PAGE_PT)
    expect(l.pageW).toBeCloseTo(MAX_PAGE_PT, 0)
    expect(l.pageH).toBeCloseTo(4800, 0)
  })
})

describe('frameAspect / previewBoxes', () => {
  it('frame is the portrait paper', () => {
    expect(frameAspect('a4')).toBeCloseTo(1.4142, 3)
    expect(frameAspect('letter')).toBeCloseTo(792 / 612, 4)
    expect(frameAspect('fit')).toBeCloseTo(1.4142, 3)
  })
  it('portrait page fills the frame; landscape page is letterboxed', () => {
    const fa = frameAspect('a4')
    const p = previewBoxes(layoutPage(3, 4, 0, s()), fa)
    expect(p.page.width).toBeCloseTo(100, 3)
    expect(p.page.height).toBeCloseTo(100, 3)
    const q = previewBoxes(layoutPage(4, 3, 0, s()), fa)
    expect(q.page.width).toBeCloseTo(100, 3)
    expect(q.page.height).toBeCloseTo(100 / fa / fa, 2)
    expect(q.page.top).toBeCloseTo((100 - q.page.height) / 2, 3)
  })
  it('image box in page percent', () => {
    const l = layoutPage(800, 600, 0, s({ paper: 'fit', margin: 'none' }))
    expect(previewBoxes(l, 1.414).img).toEqual({ left: 0, top: 0, width: 100, height: 100 })
  })
})

// Apply a PDF cm matrix to a unit-square point (u right, v up; v = 1 is the
// top row of the stored image).
const apply = (m: number[], u: number, v: number) => [m[0] * u + m[2] * v + m[4], m[1] * u + m[3] * v + m[5]]

describe('placementMatrix', () => {
  const r = { x: 10, y: 20, w: 300, h: 200 } // top-left origin
  const pageH = 1000
  // In PDF coordinates (bottom-left origin): x 10..310, y 780..980.
  const TL = [10, 980]
  const TR = [310, 980]
  const BL = [10, 780]
  const BR = [310, 780]

  it('identity: unit square onto the rect', () => {
    const m = placementMatrix(r, pageH, 0, 1)
    expect(m).toEqual([300, 0, 0, 200, 10, 780])
    expect(apply(m, 0, 1)).toEqual(TL)
    expect(apply(m, 1, 0)).toEqual(BR)
  })
  it('user 90° cw: stored top-left lands top-right', () => {
    const m = placementMatrix(r, pageH, 90, 1)
    expect(apply(m, 0, 1)).toEqual(TR)
    expect(apply(m, 1, 1)).toEqual(BR)
    expect(apply(m, 0, 0)).toEqual(TL)
  })
  it('user 180°', () => {
    const m = placementMatrix(r, pageH, 180, 1)
    expect(apply(m, 0, 1)).toEqual(BR)
    expect(apply(m, 1, 0)).toEqual(TL)
  })
  it('user 270° cw: stored top-left lands bottom-left', () => {
    const m = placementMatrix(r, pageH, 270, 1)
    expect(apply(m, 0, 1)).toEqual(BL)
    expect(apply(m, 1, 1)).toEqual(TL)
  })
  // EXIF orientations: where the stored top-left / top-right pixels must
  // end up for the picture to read upright (EXIF 2.32 table).
  const cases: [number, number[], number[]][] = [
    [1, TL, TR],
    [2, TR, TL], // mirrored horizontally
    [3, BR, BL], // 180°
    [4, BL, BR], // mirrored vertically
    [5, TL, BL], // transpose
    [6, TR, BR], // 90° cw
    [7, BR, TR], // transverse
    [8, BL, TL], // 270° cw
  ]
  for (const [o, tl, tr] of cases) {
    it(`EXIF orientation ${o}`, () => {
      const m = placementMatrix(r, pageH, 0, o)
      expect(apply(m, 0, 1)).toEqual(tl)
      expect(apply(m, 1, 1)).toEqual(tr)
    })
  }
  it('EXIF 6 then user 90° = 180° turn of the stored image', () => {
    const m = placementMatrix(r, pageH, 90, 6)
    expect(apply(m, 0, 1)).toEqual(BR)
    expect(apply(m, 1, 1)).toEqual(BL)
  })
  it('no negative zeros', () => {
    for (const rot of [0, 90, 180, 270]) for (let o = 1; o <= 8; o++) {
      for (const n of placementMatrix(r, pageH, rot, o)) expect(Object.is(n, -0)).toBe(false)
    }
  })
  it('exifSwaps / exifMatrix', () => {
    expect([1, 2, 3, 4].map(exifSwaps)).toEqual([false, false, false, false])
    expect([5, 6, 7, 8].map(exifSwaps)).toEqual([true, true, true, true])
    expect(exifMatrix(0)).toEqual([1, 0, 0, 1])
    expect(exifMatrix(9)).toEqual([1, 0, 0, 1])
  })
})
