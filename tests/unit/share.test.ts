import { describe, expect, it, vi } from 'vitest'
import { canShareFiles, shareFilesOr, type ShareNavigator } from '../../src/shared/lib/share'

const files = [new File([new Uint8Array(3)], 'a.webp', { type: 'image/webp' }), new File([new Uint8Array(4)], 'b.jpg', { type: 'image/jpeg' })]

function abort(): Error {
  const e = new Error('cancelled')
  e.name = 'AbortError'
  return e
}

describe('batch share with ZIP fallback', () => {
  it('shares every file when canShare accepts them', async () => {
    const share = vi.fn(async () => {})
    const canShare = vi.fn(() => true)
    const fallback = vi.fn()
    expect(await shareFilesOr({ canShare, share }, files, fallback)).toBe('shared')
    expect(canShare).toHaveBeenCalledWith({ files })
    expect(share).toHaveBeenCalledWith({ files })
    expect(fallback).not.toHaveBeenCalled()
  })

  it('does nothing when the user dismisses the share sheet', async () => {
    const fallback = vi.fn()
    const nav: ShareNavigator = { canShare: () => true, share: () => Promise.reject(abort()) }
    expect(await shareFilesOr(nav, files, fallback)).toBe('cancelled')
    expect(fallback).not.toHaveBeenCalled()
  })

  it('falls back on any other share error', async () => {
    const fallback = vi.fn()
    const err = new Error('nope')
    err.name = 'NotAllowedError'
    const nav: ShareNavigator = { canShare: () => true, share: () => Promise.reject(err) }
    expect(await shareFilesOr(nav, files, fallback)).toBe('fallback')
    expect(fallback).toHaveBeenCalledTimes(1)
  })

  it('falls back when file sharing is unsupported or refused', async () => {
    for (const nav of [undefined, {}, { share: async () => {} }, { canShare: () => false, share: async () => {} }, { canShare: () => { throw new TypeError('x') }, share: async () => {} }] as (ShareNavigator | undefined)[]) {
      const fallback = vi.fn()
      expect(await shareFilesOr(nav, files, fallback)).toBe('fallback')
      expect(fallback).toHaveBeenCalledTimes(1)
    }
    expect(canShareFiles({ canShare: () => true, share: async () => {} }, [])).toBe(false)
  })
})
