import { describe, expect, it } from 'vitest'
import { RW_MESSAGES, rwError, rwT } from '../../src/features/resize-watermark/i18n'
import { PRESETS } from '../../src/features/resize-watermark/lib/presets'
import { FONTS } from '../../src/features/resize-watermark/lib/fonts'

describe('resize & watermark i18n', () => {
  const en = Object.keys(RW_MESSAGES.en).sort()
  it('every language has exactly the English keys', () => {
    for (const [lang, m] of Object.entries(RW_MESSAGES)) expect(Object.keys(m).sort(), lang).toEqual(en)
  })
  it('function messages stay functions in every language', () => {
    for (const k of en) {
      const kind = typeof RW_MESSAGES.en[k]
      for (const [lang, m] of Object.entries(RW_MESSAGES)) expect(typeof m[k], `${lang}.${k}`).toBe(kind)
    }
  })
  it('presets and fonts all have labels', () => {
    for (const p of PRESETS) expect(rwT('zh', `preset_${p.id}`)).not.toBe(`preset_${p.id}`)
    for (const f of FONTS) expect(rwT('ja', `font_${f}`)).not.toBe(`font_${f}`)
  })
  it('job errors translate with their argument', () => {
    expect(rwError('zh', 'errTooLarge:80')).toContain('80')
    expect(rwError('en', 'errDecode')).toBe(rwT('en', 'errDecode'))
    expect(rwError('en', 'Some random Error')).toBe(rwT('en', 'errFailed'))
  })
})
