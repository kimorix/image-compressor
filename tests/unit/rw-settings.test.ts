import { describe, expect, it } from 'vitest'
import { defaultSettings, keepsAlpha, loadSettings, normalizeSettings, outputName, resolveOutType, saveSettings, SETTINGS_KEY } from '../../src/features/resize-watermark/lib/settings'
import { findPreset, isLongSidePreset, PRESETS, presetDims, QUICK_PRESETS } from '../../src/features/resize-watermark/lib/presets'

function memStore() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}

describe('settings', () => {
  it('normalize fills defaults for garbage', () => {
    expect(normalizeSettings(null)).toEqual(defaultSettings())
    expect(normalizeSettings('x')).toEqual(defaultSettings())
  })
  it('normalize clamps and rejects bad values', () => {
    const s = normalizeSettings({
      resize: { long: 999999, pct: 0, mode: 'weird', padColor: 'red' },
      wm: { opacity: 1, rotate: 500, pos: 'zz', color: '#ABCDEF', size: 99 },
      out: { format: 'image/bmp', quality: 300, suffix: '_a/b:c' },
    })
    expect(s.resize.long).toBe(16384)
    expect(s.resize.pct).toBe(1)
    expect(s.resize.mode).toBe('long')
    expect(s.resize.padColor).toBe('#ffffff')
    expect(s.wm.opacity).toBe(10)
    expect(s.wm.rotate).toBe(90)
    expect(s.wm.pos).toBe('br')
    expect(s.wm.color).toBe('#abcdef')
    expect(s.wm.size).toBe(20)
    expect(s.out.format).toBe('follow')
    expect(s.out.quality).toBe(100)
    expect(s.out.suffix).toBe('_abc')
  })
  it('round-trips through storage', () => {
    const st = memStore()
    const s = defaultSettings()
    s.wm.enabled = true
    s.wm.text = '© me'
    saveSettings(s, st)
    expect(st.m.has(SETTINGS_KEY)).toBe(true)
    expect(loadSettings(st)).toEqual(s)
  })
  it('broken JSON falls back to defaults', () => {
    const st = memStore()
    st.setItem(SETTINGS_KEY, '{oops')
    expect(loadSettings(st)).toEqual(defaultSettings())
  })
  it('follow-format mapping', () => {
    expect(resolveOutType('follow', 'jpeg')).toBe('image/jpeg')
    expect(resolveOutType('follow', 'heic')).toBe('image/jpeg')
    expect(resolveOutType('follow', 'gif')).toBe('image/png')
    expect(resolveOutType('follow', 'webp')).toBe('image/webp')
    expect(resolveOutType('follow', 'avif')).toBe('image/avif')
    expect(resolveOutType('follow', 'bmp')).toBe('image/png')
    expect(resolveOutType('image/webp', 'jpeg')).toBe('image/webp')
  })
  it('output names', () => {
    expect(outputName('photo.heic', '_{w}x{h}', 1080, 1440, 'image/jpeg')).toBe('photo_1080x1440.jpg')
    expect(outputName('.hidden', '', 1, 1, 'image/png')).toBe('image.png')
    expect(outputName('a.b.png', '-s', 10, 20, 'image/webp')).toBe('a.b-s.webp')
  })
  it('alpha formats', () => {
    expect(keepsAlpha('image/jpeg')).toBe(false)
    expect(keepsAlpha('image/png')).toBe(true)
  })
})

describe('presets', () => {
  it('ids are unique and quick presets exist', () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length)
    for (const id of QUICK_PRESETS) expect(findPreset(id)).toBeTruthy()
  })
  it('only moments is a long-side preset', () => {
    expect(PRESETS.filter(isLongSidePreset).map((p) => p.id)).toEqual(['moments'])
  })
  it('dims label', () => {
    expect(presetDims(findPreset('xhs34')!)).toBe('1080×1440')
    expect(presetDims(findPreset('moments')!)).toBe('1080')
  })
})
