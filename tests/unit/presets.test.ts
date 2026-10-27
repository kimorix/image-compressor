import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, matchPreset, PRESETS } from '../../src/lib/presets'
import { loadSavedSettings, saveSettings } from '../../src/lib/settings-store'

describe('matchPreset', () => {
  it('defaults match no scene', () => {
    expect(matchPreset(DEFAULT_SETTINGS)).toBeNull()
  })
  it('every preset matches itself once applied', () => {
    for (const p of PRESETS) expect(matchPreset({ ...DEFAULT_SETTINGS, ...p.patch })).toBe(p.id)
  })
  it('a manual tweak clears the scene', () => {
    const wechat = PRESETS.find((p) => p.id === 'wechat')!
    expect(matchPreset({ ...DEFAULT_SETTINGS, ...wechat.patch, quality: 70 })).toBeNull()
  })
  it('target presets leave the size free', () => {
    const email = PRESETS.find((p) => p.id === 'email')!
    expect(matchPreset({ ...DEFAULT_SETTINGS, ...email.patch, maxSize: 1280 })).toBe('email')
  })
})

describe('settings store', () => {
  const store = new Map<string, string>()
  beforeEach(() => {
    store.clear()
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
    } as Storage
  })
  it('migrates pre-2.1 smart saves to smart format', () => {
    store.set('ic-settings', JSON.stringify({ format: 'image/jpeg', smartKeepOriginal: false }))
    expect(loadSavedSettings().format).toBe('auto')
  })
  it('migrates keep-original to the original format', () => {
    store.set('ic-settings', JSON.stringify({ format: 'image/webp', smartKeepOriginal: true }))
    expect(loadSavedSettings().format).toBe('original')
  })
  it('never remembers the mode', () => {
    saveSettings({ ...DEFAULT_SETTINGS, mode: 'target' })
    expect(JSON.parse(store.get('ic-settings')!).mode).toBeUndefined()
  })
  it('keeps crop boxes and drops corrupt keys', () => {
    store.set('ic-settings', JSON.stringify({ resizeMode: 'exact', maxSize: 295, maxHeight: 413, quality: 'x' }))
    const s = loadSavedSettings()
    expect(s).toMatchObject({ resizeMode: 'exact', maxSize: 295, maxHeight: 413 })
    expect(s.quality).toBeUndefined()
  })
})
