import { describe, expect, it } from 'vitest'
import {
  clampQuality, countItems, DEFAULT_SETTINGS, flattenAlpha, formatFromParam, hasAlpha, hexToRgb, isAnimated, isSameFormat,
  isSupportedInput, looksLikeImage, normalizeHex, outputName, pngMayHaveAlpha, predictTarget, qualityFor, recommendFormat,
  settingsSig, sourceLabel, uniqueOutNames,
} from '../../src/features/format-convert/lib/convert'
import { loadConvertSettings, saveConvertSettings, SETTINGS_KEY } from '../../src/features/format-convert/lib/settings-store'
import { CONVERT_MESSAGES, convertT } from '../../src/features/format-convert/i18n'
import type { ConvertSettings } from '../../src/features/format-convert/types'

const S = (patch: Partial<ConvertSettings> = {}): ConvertSettings => ({ ...DEFAULT_SETTINGS, quality: { ...DEFAULT_SETTINGS.quality }, ...patch })

const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0))
function png(colorType: number, chunks: string[] = []): Uint8Array {
  const out = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...be32(13), ...ascii('IHDR'), ...be32(1), ...be32(1), 8, colorType, 0, 0, 0, 0, 0, 0, 0]
  for (const c of chunks) out.push(...be32(1), ...ascii(c), 0, 0, 0, 0, 0)
  out.push(...be32(0), ...ascii('IDAT'), 0, 0, 0, 0)
  return new Uint8Array(out)
}

describe('format recommendation (auto)', () => {
  it('HEIC -> JPEG, transparent PNG -> WebP, everything else -> JPEG', () => {
    expect(recommendFormat('heic', false)).toBe('jpeg')
    expect(recommendFormat('heic', true)).toBe('jpeg')
    expect(recommendFormat('png', true)).toBe('webp')
    expect(recommendFormat('png', false)).toBe('jpeg')
    expect(recommendFormat('webp', true)).toBe('jpeg')
    expect(recommendFormat('gif', false)).toBe('jpeg')
    expect(recommendFormat(null, false)).toBe('jpeg')
  })
  it('a manual pick or per-file override wins over auto', () => {
    const item = { override: null, src: 'png' as const, mayHaveAlpha: true }
    expect(predictTarget(item, S())).toBe('webp')
    expect(predictTarget(item, S({ format: 'avif' }))).toBe('avif')
    expect(predictTarget({ ...item, override: 'png' }, S({ format: 'jpeg' }))).toBe('png')
  })
  it('defaults to auto and offers no BMP/GIF output', () => {
    expect(DEFAULT_SETTINGS.format).toBe('auto')
    expect(formatFromParam('bmp')).toBeNull()
    expect(formatFromParam('gif')).toBeNull()
  })
})

describe('inputs', () => {
  it('accepts decodable formats and refuses TIFF / SVG / ICO / unknown', () => {
    for (const f of ['jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'bmp'] as const) expect(isSupportedInput(f)).toBe(true)
    for (const f of ['tiff', 'svg', 'ico'] as const) expect(isSupportedInput(f)).toBe(false)
    expect(isSupportedInput(null)).toBe(false)
  })
  it('tells images (even unsupported ones) from other files', () => {
    expect(looksLikeImage({ name: 'a.tiff', type: '' }, null)).toBe(true)
    expect(looksLikeImage({ name: 'raw.CR2', type: '' }, null)).toBe(true)
    expect(looksLikeImage({ name: 'x', type: 'image/x-foo' }, null)).toBe(true)
    expect(looksLikeImage({ name: 'notes.txt', type: 'text/plain' }, null)).toBe(false)
    expect(looksLikeImage({ name: 'notes.txt', type: '' }, 'jpeg')).toBe(true)
  })
  it('labels the source by its bytes, else its extension', () => {
    expect(sourceLabel('heic', 'IMG.jpg')).toBe('HEIC')
    expect(sourceLabel(null, 'archive_0001.tiff')).toBe('TIFF')
    expect(sourceLabel(null, 'noext')).toBe('?')
  })
})

describe('PNG / animation header hints', () => {
  it('alpha colour types and tRNS mean "may have alpha"', () => {
    expect(pngMayHaveAlpha(png(6))).toBe(true)
    expect(pngMayHaveAlpha(png(4))).toBe(true)
    expect(pngMayHaveAlpha(png(2))).toBe(false)
    expect(pngMayHaveAlpha(png(3, ['tRNS']))).toBe(true)
    expect(pngMayHaveAlpha(new Uint8Array([1, 2, 3]))).toBe(false)
  })
  it('detects APNG and animated WebP', () => {
    expect(isAnimated(png(6, ['acTL']), 'png')).toBe(true)
    expect(isAnimated(png(6), 'png')).toBe(false)
    const webp = new Uint8Array(30)
    webp.set(ascii('RIFF'), 0)
    webp.set(ascii('WEBP'), 8)
    webp.set(ascii('VP8X'), 12)
    expect(isAnimated(webp, 'webp')).toBe(false)
    webp[20] = 0x02
    expect(isAnimated(webp, 'webp')).toBe(true)
  })
})

describe('alpha', () => {
  it('finds any non-opaque pixel', () => {
    expect(hasAlpha(new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]))).toBe(false)
    expect(hasAlpha(new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 254]))).toBe(true)
  })
  it('composites over the fill colour (straight alpha) and leaves every pixel opaque', () => {
    const d = new Uint8ClampedArray([
      0, 0, 0, 0, // fully transparent -> fill
      255, 0, 0, 128, // half red over white -> pink, not dark
      10, 20, 30, 255, // opaque untouched
    ])
    expect(flattenAlpha(d, '#ffffff')).toBe(true)
    expect([...d.slice(0, 4)]).toEqual([255, 255, 255, 255])
    expect([...d.slice(4, 8)]).toEqual([255, 127, 127, 255])
    expect([...d.slice(8, 12)]).toEqual([10, 20, 30, 255])
    expect(flattenAlpha(new Uint8ClampedArray([1, 1, 1, 255]), '#000')).toBe(false)
  })
  it('normalises hex colours', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc')
    expect(normalizeHex('  ff8800 ')).toBe('#ff8800')
    expect(normalizeHex('#12345')).toBeNull()
    expect(normalizeHex('red')).toBeNull()
    expect(hexToRgb('#000')).toEqual([0, 0, 0])
    expect(hexToRgb('nope')).toEqual([255, 255, 255])
  })
})

describe('naming', () => {
  it('swaps the extension, or adds -converted', () => {
    expect(outputName('IMG_4821.HEIC', 'jpeg', true)).toBe('IMG_4821.jpg')
    expect(outputName('logo@2x.png', 'webp', false)).toBe('logo@2x-converted.webp')
    expect(outputName('noext', 'avif', true)).toBe('noext.avif')
    expect(outputName('.hidden', 'png', true)).toBe('.hidden.png')
  })
  it('makes clashing names in the same folder unique, case-insensitively', () => {
    expect(uniqueOutNames([
      { dir: '', name: 'a.jpg' },
      { dir: '', name: 'A.jpg' },
      { dir: 'sub', name: 'a.jpg' },
      { dir: '', name: 'a.jpg' },
    ])).toEqual(['a.jpg', 'A (1).jpg', 'a.jpg', 'a (2).jpg'])
  })
})

describe('settings signature (stale detection)', () => {
  const item = { override: null, src: 'jpeg' as const, mayHaveAlpha: false }
  it('changes with anything that changes the output', () => {
    const base = settingsSig(item, S({ format: 'jpeg' }))
    expect(settingsSig(item, S({ format: 'jpeg', quality: { jpeg: 70, webp: 82, avif: 60 } }))).not.toBe(base)
    expect(settingsSig(item, S({ format: 'jpeg', fill: '#000000' }))).not.toBe(base)
    expect(settingsSig(item, S({ format: 'jpeg', keepExif: false }))).not.toBe(base)
    expect(settingsSig(item, S({ format: 'png' }))).not.toBe(base)
  })
  it('ignores what cannot affect this output', () => {
    expect(settingsSig(item, S({ format: 'png' }))).toBe(settingsSig(item, S({ format: 'png', fill: '#000000', quality: { jpeg: 10, webp: 10, avif: 10 } })))
    expect(settingsSig(item, S({ format: 'jpeg' }))).toBe(settingsSig(item, S({ format: 'jpeg', keepName: false, quality: { jpeg: 85, webp: 10, avif: 10 } })))
  })
  it('per-file override is part of it', () => {
    expect(settingsSig({ ...item, override: 'png' }, S())).not.toBe(settingsSig(item, S()))
  })
})

describe('misc helpers', () => {
  it('quality per format, PNG has none', () => {
    expect(qualityFor(S(), 'jpeg')).toBe(85)
    expect(qualityFor(S(), 'webp')).toBe(82)
    expect(qualityFor(S(), 'avif')).toBe(60)
    expect(qualityFor(S(), 'png')).toBeNull()
    expect(clampQuality(0)).toBe(1)
    expect(clampQuality(150)).toBe(100)
    expect(clampQuality(NaN)).toBe(80)
    expect(clampQuality(84.6)).toBe(85)
  })
  it('?to= accepts jpg/jpeg/png/webp/avif', () => {
    expect(formatFromParam('JPG')).toBe('jpeg')
    expect(formatFromParam('webp')).toBe('webp')
    expect(formatFromParam(undefined)).toBeNull()
  })
  it('same-format detection', () => {
    expect(isSameFormat('jpeg', 'jpeg')).toBe(true)
    expect(isSameFormat('heic', 'jpeg')).toBe(false)
  })
  it('counts statuses and finished sizes', () => {
    const f = (size: number) => ({ size }) as File
    const c = countItems([
      { status: 'done', file: f(100), outBlob: { size: 40 } as Blob },
      { status: 'done', file: f(50), outBlob: { size: 10 } as Blob },
      { status: 'converting', file: f(1), outBlob: null },
      { status: 'queued', file: f(1), outBlob: null },
      { status: 'error', file: f(1), outBlob: null },
      { status: 'unsupported', file: f(1), outBlob: null },
      { status: 'cancelled', file: f(1), outBlob: null },
    ])
    expect(c).toEqual({ total: 7, done: 2, running: 2, failed: 1, unsupported: 1, inBytes: 150, outBytes: 50 })
  })
})

function mem() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, m }
}

describe('settings store', () => {
  it('starts on auto and remembers a manual pick', () => {
    const s = mem()
    expect(loadConvertSettings(s).format).toBe('auto')
    saveConvertSettings(S(), s)
    expect(JSON.parse(s.m.get(SETTINGS_KEY)!).format).toBeUndefined()
    saveConvertSettings(S({ format: 'webp', quality: { jpeg: 70, webp: 75, avif: 40 }, fill: '#000000', keepExif: false, keepName: false }), s)
    expect(loadConvertSettings(s)).toEqual(S({ format: 'webp', quality: { jpeg: 70, webp: 75, avif: 40 }, fill: '#000000', keepExif: false, keepName: false }))
  })
  it('validates field by field', () => {
    const s = mem()
    s.setItem(SETTINGS_KEY, JSON.stringify({ format: 'bmp', quality: { jpeg: 0, webp: 77, avif: 'x' }, fill: 'nope', keepExif: 'yes' }))
    const v = loadConvertSettings(s)
    expect(v.format).toBe('auto')
    expect(v.quality).toEqual({ jpeg: 85, webp: 77, avif: 60 })
    expect(v.fill).toBe('#ffffff')
    expect(v.keepExif).toBe(true)
    s.setItem(SETTINGS_KEY, '{broken')
    expect(loadConvertSettings(s)).toEqual(S())
    expect(loadConvertSettings(null)).toEqual(S())
  })
})

describe('converter dictionary', () => {
  it('has every key in all six languages', () => {
    const keys = Object.keys(CONVERT_MESSAGES.zh).sort()
    for (const [lang, msgs] of Object.entries(CONVERT_MESSAGES)) expect(Object.keys(msgs).sort(), lang).toEqual(keys)
  })
  it('formats arguments and falls back to the key', () => {
    for (const lang of Object.keys(CONVERT_MESSAGES)) {
      expect(convertT(lang as 'en', 'noteFilled', '#FFFFFF')).toContain('#FFFFFF')
      expect(convertT(lang as 'en', 'download', 'jpg')).toContain('.jpg')
    }
    expect(convertT('en', 'no-such-key')).toBe('no-such-key')
  })
  it('has every error key the job can throw', () => {
    for (const k of ['errDecode', 'errAvifDecode', 'errHeic', 'errTooLarge', 'errEncode', 'errFailed']) expect(CONVERT_MESSAGES.en[k]).toBeTypeOf('string')
  })
})
