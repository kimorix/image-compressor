import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import ResultRow from '../../src/shared/components/ResultRow.vue'

async function render(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  const app = createSSRApp({ render: () => h(ResultRow, { ...props, ...attrs }, () => h('span', 'x')) })
  return renderToString(app)
}

describe('ResultRow', () => {
  it('renders the tool\'s own element and classes around its content', async () => {
    const html = await render({}, { class: 'cv-item st-done' })
    expect(html.replace(/<!--[[\]]-->/g, '')).toBe('<li class="cv-item st-done"><span>x</span></li>')
  })
  it('a selectable row is focusable and marks the current one', async () => {
    const html = await render({ tag: 'div', selectable: true, current: true }, { class: 'item', 'data-id': 'a' })
    expect(html).toContain('<div tabindex="0" aria-current="true" class="item" data-id="a">')
  })
})
