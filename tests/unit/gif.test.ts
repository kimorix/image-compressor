import { describe, expect, it } from 'vitest'
import { gifFrameCount } from '../../src/shared/image/gif'

function gif(frames: number): Uint8Array {
  // Header + logical screen descriptor, no global color table.
  const out: number[] = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0]
  for (let i = 0; i < frames; i++) {
    out.push(0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0) // image descriptor, no local table
    out.push(2, 2, 0, 0, 0) // LZW min code size, one sub-block of 2 bytes, terminator
  }
  out.push(0x3b) // trailer
  return new Uint8Array(out)
}

describe('gifFrameCount', () => {
  it('returns 0 for non-GIF bytes', () => {
    expect(gifFrameCount(new Uint8Array([1, 2, 3]))).toBe(0)
  })
  it('counts a single frame', () => {
    expect(gifFrameCount(gif(1))).toBe(1)
  })
  it('counts multiple frames', () => {
    expect(gifFrameCount(gif(3))).toBe(3)
  })
})
