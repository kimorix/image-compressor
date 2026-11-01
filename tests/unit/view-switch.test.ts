// Tool switching: while the next tool's chunk loads, the shell keeps the
// current view on screen and the nav already highlights the target.
import { afterEach, describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import SideNav from '../../src/shared/components/SideNav.vue'
import TabBar from '../../src/shared/components/TabBar.vue'
import PdfHubSwitch from '../../src/shared/components/PdfHubSwitch.vue'
import { pendingFeature, tabOf } from '../../src/shared/composables/useViewSwitch'

const t = (k: string) => k
const render = (c: unknown, props: Record<string, unknown>) => renderToString(createSSRApp({ render: () => h(c as never, props) }))
const activeTexts = (html: string) => [...html.matchAll(/<button[^>]*class="[^"]*\bactive\b[^"]*"[^>]*>(?:<svg[\s\S]*?<\/svg>)?([\s\S]*?)<\/button>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/<!--[\s\S]*?-->/g, '').trim())

afterEach(() => { pendingFeature.value = null })

describe('view switch', () => {
  it('maps every tool to its phone tab', () => {
    expect(tabOf('compress')).toBe('compress')
    expect(tabOf('pdf')).toBe('pdf')
    expect(tabOf('img2pdf')).toBe('pdf')
    expect(tabOf('pdf-merge')).toBe('pdf')
    expect(tabOf('convert')).toBe('more')
    expect(tabOf('resize')).toBe('more')
  })

  it('side nav follows the view, then the pending tool', async () => {
    expect(activeTexts(await render(SideNav, { t, active: 'compress' }))).toEqual(['navTool'])
    pendingFeature.value = 'pdf-merge'
    const html = await render(SideNav, { t, active: 'compress' })
    expect(activeTexts(html)).toHaveLength(1)
    expect(activeTexts(html)).toEqual(['navPdfMerge'])
  })

  it('tab bar highlights the pending tool\'s tab', async () => {
    const base = { t, active: 'compress', settingsOpen: false, moreOpen: false }
    expect(activeTexts(await render(TabBar, base))).toEqual(['tabCompress'])
    pendingFeature.value = 'convert'
    expect(activeTexts(await render(TabBar, base))).toEqual(['tabMore'])
    pendingFeature.value = 'img2pdf'
    expect(activeTexts(await render(TabBar, base))).toEqual(['tabPdf'])
  })

  it('PDF hub selects a pending PDF tool, ignores others', async () => {
    const checked = (html: string) => [...html.matchAll(/aria-checked="true"[^>]*>([^<]*)</g)].map((m) => m[1])
    expect(checked(await render(PdfHubSwitch, { t, active: 'pdf' }))).toEqual(['hubToWord'])
    pendingFeature.value = 'pdf-merge'
    expect(checked(await render(PdfHubSwitch, { t, active: 'pdf' }))).toEqual(['hubMerge'])
    pendingFeature.value = 'convert'
    expect(checked(await render(PdfHubSwitch, { t, active: 'pdf' }))).toEqual(['hubToWord'])
  })
})
