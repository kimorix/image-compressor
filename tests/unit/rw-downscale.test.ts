import { describe, expect, it } from 'vitest'
import { planSteps } from '../../src/features/resize-watermark/lib/downscale'

describe('planSteps', () => {
  it('no steps for mild reductions or enlargements', () => {
    expect(planSteps(1000, 800, 600, 480)).toEqual([])
    expect(planSteps(500, 500, 1000, 1000)).toEqual([])
  })
  it('halves while staying at or above the target', () => {
    expect(planSteps(4000, 3000, 900, 675)).toEqual([{ w: 2000, h: 1500 }, { w: 1000, h: 750 }])
  })
  it('every step is at most a halving and the final draw ≤ 2x', () => {
    const steps = planSteps(12000, 9000, 300, 225)
    let w = 12000
    for (const s of steps) {
      expect(s.w).toBeGreaterThanOrEqual(Math.floor(w / 2))
      w = s.w
    }
    expect(w / 300).toBeLessThan(2)
  })
  it('stops exactly at the target without a duplicate step', () => {
    expect(planSteps(2000, 2000, 1000, 1000)).toEqual([])
    expect(planSteps(4000, 4000, 1000, 1000)).toEqual([{ w: 2000, h: 2000 }])
  })
})
