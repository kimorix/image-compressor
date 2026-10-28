import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPdfFeature, lastPdfTool, parseHash, ROUTE_HASH } from '../../src/shared/composables/useHashRoute'

describe('hash routes', () => {
  it('parses every tool route, the history view and aliases', () => {
    expect(parseHash('')).toEqual({ feature: 'compress', sub: '', params: {} })
    expect(parseHash('#/')).toMatchObject({ feature: 'compress', sub: '' })
    expect(parseHash('#/convert')).toMatchObject({ feature: 'convert' })
    expect(parseHash('#/resize/')).toMatchObject({ feature: 'resize' })
    expect(parseHash('#/pdf-to-word')).toMatchObject({ feature: 'pdf' })
    expect(parseHash('#/PDF')).toMatchObject({ feature: 'pdf' })
    expect(parseHash('#/img-to-pdf')).toMatchObject({ feature: 'img2pdf' })
    expect(parseHash('#/pdf-merge')).toMatchObject({ feature: 'pdf-merge' })
    expect(parseHash('#/history')).toMatchObject({ feature: 'compress', sub: 'history' })
    expect(parseHash('#/nope')).toMatchObject({ feature: 'compress', sub: '' })
  })
  it('parses an optional query', () => {
    expect(parseHash('#/convert?to=webp')).toEqual({ feature: 'convert', sub: '', params: { to: 'webp' } })
    expect(parseHash('#/pdf-merge?mode=split&x=1')).toMatchObject({ feature: 'pdf-merge', params: { mode: 'split', x: '1' } })
  })
  it('every feature has a hash that parses back to it', () => {
    for (const [feature, hash] of Object.entries(ROUTE_HASH)) expect(parseHash(hash).feature).toBe(feature)
  })
  it('PDF tools', () => {
    expect(['pdf', 'img2pdf', 'pdf-merge'].every(isPdfFeature)).toBe(true)
    expect(isPdfFeature('compress')).toBe(false)
    expect(isPdfFeature('convert')).toBe(false)
  })
})

describe('last PDF tool', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('defaults to PDF to Word and ignores junk', () => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v } })
    expect(lastPdfTool()).toBe('pdf')
    store['ic-pdf-tool'] = 'pdf-merge'
    expect(lastPdfTool()).toBe('pdf-merge')
    store['ic-pdf-tool'] = 'compress'
    expect(lastPdfTool()).toBe('pdf')
  })
  it('survives a throwing localStorage', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied') } })
    expect(lastPdfTool()).toBe('pdf')
  })
})
