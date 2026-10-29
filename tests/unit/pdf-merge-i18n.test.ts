import { describe, expect, it } from 'vitest'
import { LANGS } from '../../src/shared/i18n'
import { MERGE_MESSAGES, MERGE_SUFFIX, mergeT } from '../../src/features/pdf-merge/i18n'
import { parseSettings } from '../../src/features/pdf-merge/lib/settings'
import { DEFAULT_SETTINGS } from '../../src/features/pdf-merge/types'
import { colorOf, PALETTE } from '../../src/features/pdf-merge/lib/colors'

describe('pdf-merge i18n', () => {
  const keys = Object.keys(MERGE_MESSAGES.en)
  it('every language defines every key with the same kind (text / function)', () => {
    for (const { code } of LANGS) {
      const dict = MERGE_MESSAGES[code]
      expect(Object.keys(dict).sort(), code).toEqual(keys.slice().sort())
      for (const k of keys) expect(typeof dict[k], `${code}.${k}`).toBe(typeof MERGE_MESSAGES.en[k])
    }
  })
  it('formats arguments and falls back to the key', () => {
    expect(mergeT('zh', 'mergeN', 24)).toBe('合并 24 页')
    expect(mergeT('en', 'sumOutput', 17, 1, 0)).toBe('17 pages · 1 deleted')
    expect(mergeT('de', 'nope')).toBe('nope')
    for (const { code } of LANGS) expect(MERGE_SUFFIX[code]).toMatch(/^-/)
  })
})

describe('pdf-merge settings + colours', () => {
  it('parses stored settings defensively and never restores a file name', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('x')).toEqual(DEFAULT_SETTINGS)
    const s = parseSettings({ mode: 'split', merge: { fileName: 'x', pageSize: 'a4', bookmarks: false }, split: { kind: 'every', every: 3.7, template: '  ' } })
    expect(s.mode).toBe('split')
    expect(s.merge).toEqual({ ...DEFAULT_SETTINGS.merge, pageSize: 'a4', bookmarks: false })
    expect(s.split).toEqual({ ...DEFAULT_SETTINGS.split, kind: 'every', every: 3 })
    expect(parseSettings({ merge: { pageSize: 'huge' }, split: { kind: 'zzz', every: -1 } }).merge.pageSize).toBe('keep')
  })
  it('cycles the palette', () => {
    expect(colorOf(0)).toBe(PALETTE[0])
    expect(colorOf(PALETTE.length + 2)).toBe(PALETTE[2])
    expect(colorOf(-1)).toBe(PALETTE[PALETTE.length - 1])
  })
})
