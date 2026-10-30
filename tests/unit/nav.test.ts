import { describe, expect, it } from 'vitest'
import { MORE_OTHER, MORE_TOOLS, NAV_GROUPS, PDF_HUB } from '../../src/shared/components/nav'
import { MESSAGES } from '../../src/shared/i18n'

describe('tool map', () => {
  it('reaches every desktop side-nav entry on a phone (tab bar, PDF hub or More menu)', () => {
    // The tab bar has its own Compress tab; PDF tools live in the hub.
    const phone = new Set<string>(['compress', ...PDF_HUB.map((e) => e.key), ...MORE_TOOLS.map((e) => e.key), ...MORE_OTHER.map((e) => e.key)])
    for (const group of NAV_GROUPS) for (const entry of group.items) expect(phone.has(entry.key), entry.key).toBe(true)
  })

  it('lists the compressor history in the phone More menu, after the tools', () => {
    expect(MORE_OTHER.map((e) => e.key)).toEqual(['history'])
    expect(MORE_TOOLS.some((e) => e.key === 'history')).toBe(false)
  })

  it('has label and description copy for every More entry in all six languages', () => {
    expect(Object.keys(MESSAGES)).toHaveLength(6)
    for (const messages of Object.values(MESSAGES)) {
      for (const e of [...MORE_TOOLS, ...MORE_OTHER]) {
        expect(messages[e.label], e.label).toBeTypeOf('string')
        expect(messages[e.desc], e.desc).toBeTypeOf('string')
        expect((messages[e.desc] as string).length).toBeGreaterThan(0)
      }
    }
  })
})
