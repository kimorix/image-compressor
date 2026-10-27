import { describe, expect, it } from 'vitest'
import { hasActionableNote, hasAlphaJpegNote, type NoteFields } from '../../src/features/image-compressor/lib/notes'

function base(over: Partial<NoteFields> = {}): NoteFields {
  return {
    done: true,
    outSize: 400,
    file: { size: 1000 },
    hasAlpha: false,
    outType: 'image/webp',
    typeNote: null,
    targetNoteNotable: false,
    isAnimatedGif: false,
    ...over,
  }
}

describe('phone card note marker', () => {
  it('is hidden for plain results (smart / auto quality, best quality)', () => {
    // targetAutoQ, smartQ and targetBest only set targetNote text; the
    // notable flag stays false, so the marker stays off.
    expect(hasActionableNote(base())).toBe(false)
  })

  it('is hidden for an already-optimal or small-saving result', () => {
    expect(hasActionableNote(base({ outSize: 1000 }))).toBe(false)
    expect(hasActionableNote(base({ outSize: 950 }))).toBe(false)
  })

  it('shows for a resized / still-over-target result', () => {
    expect(hasActionableNote(base({ targetNoteNotable: true }))).toBe(true)
  })

  it('shows for a WebP → JPEG format fallback', () => {
    expect(hasActionableNote(base({ typeNote: 'switched to JPEG', outType: 'image/jpeg' }))).toBe(true)
  })

  it('shows for transparency flattened into a JPEG, but not when already best', () => {
    expect(hasAlphaJpegNote(base({ hasAlpha: true, outType: 'image/jpeg' }))).toBe(true)
    expect(hasActionableNote(base({ hasAlpha: true, outType: 'image/jpeg' }))).toBe(true)
    expect(hasActionableNote(base({ hasAlpha: true, outType: 'image/webp' }))).toBe(false)
    expect(hasActionableNote(base({ hasAlpha: true, outType: 'image/jpeg', outSize: 1000 }))).toBe(false)
  })

  it('shows for an animated GIF reduced to its first frame', () => {
    expect(hasActionableNote(base({ isAnimatedGif: true }))).toBe(true)
  })

  it('is hidden before a result exists', () => {
    expect(hasActionableNote(base({ done: false, outSize: 0 }))).toBe(false)
  })
})
