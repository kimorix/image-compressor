import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import SideNav from '../../src/shared/components/SideNav.vue'
import { NAV_GROUPS } from '../../src/shared/components/nav'
import { defaultNavMode, effectiveNavMode, parseNavMode, useSideNav } from '../../src/shared/composables/useSideNav'
import { MESSAGES, t as tx } from '../../src/shared/i18n'
import type { NavKey } from '../../src/shared/composables/useHashRoute'

const t = (key: string, ...args: (string | number)[]) => tx('zh', key, ...args)

async function render(active: NavKey | ''): Promise<string> {
  const app = createSSRApp({ render: () => h(SideNav, { t, active }, { default: () => h('div', { class: 'side-card', innerHTML: '支持的格式' }) }) })
  return renderToString(app)
}

describe('side nav mode', () => {
  it('defaults to the rail on tablets and narrow desktop windows, full sidebar on desktop', () => {
    // iPad portrait / landscape sizes, touch.
    for (const w of [768, 810, 820, 834, 1024, 1080, 1180, 1194, 1366]) expect(defaultNavMode(w, true), String(w)).toBe('rail')
    // Desktop mouse.
    expect(defaultNavMode(1280, false)).toBe('full')
    expect(defaultNavMode(1366, false)).toBe('full')
    expect(defaultNavMode(1440, false)).toBe('full')
    expect(defaultNavMode(1100, false)).toBe('rail')
    // A big touch screen is a desktop.
    expect(defaultNavMode(1920, true)).toBe('full')
  })
  it('remembers the user choice from 1080px and keeps the rail track below it', () => {
    expect(effectiveNavMode('full', 1180, true)).toBe('full')
    expect(effectiveNavMode('rail', 1440, false)).toBe('rail')
    expect(effectiveNavMode(null, 1180, true)).toBe('rail')
    expect(effectiveNavMode('full', 820, true)).toBe('rail')
    expect(effectiveNavMode('full', 1079, false)).toBe('rail')
  })
  it('only accepts the two stored values', () => {
    expect(parseNavMode('rail')).toBe('rail')
    expect(parseNavMode('full')).toBe('full')
    expect(parseNavMode('collapsed')).toBeNull()
    expect(parseNavMode(null)).toBeNull()
  })
  it('has collapse / expand labels in all six languages', () => {
    for (const [code, m] of Object.entries(MESSAGES)) {
      expect(m.navCollapse, code).toBeTypeOf('string')
      expect(m.navExpand, code).toBeTypeOf('string')
    }
  })
})

describe('side nav rail', () => {
  it('collapses to an icon rail with labelled, tooltipped buttons and no card', async () => {
    const { toggle, mode } = useSideNav()
    expect(mode.value).toBe('full') // node: 1440px, fine pointer
    toggle()
    try {
      expect(mode.value).toBe('rail')
      const html = await render('compress')
      expect(html).toContain('class="rail"')
      expect(html).not.toContain('class="side-card"')
      for (const g of NAV_GROUPS) for (const e of g.items) {
        expect(html).toContain(`aria-label="${t(e.label)}"`)
        expect(html).toContain(`data-tip="${t(e.label)}"`)
      }
      expect(html).toContain(`aria-label="${t('navExpand')}"`)
      expect(html).toContain('aria-expanded="false"')
    } finally {
      toggle()
    }
    expect(mode.value).toBe('full')
    const full = await render('compress')
    expect(full).toContain('aria-expanded="true"')
    expect(full).not.toContain('data-tip=')
  })
})
