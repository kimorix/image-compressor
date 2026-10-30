import { readFileSync } from 'node:fs'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'
import PageGrid from '../../src/shared/components/PageGrid.vue'
import {
  groupedIndexAt, groupedKeyTarget, groupLayout, groupRowTops, type GridGeom, type PageGridItem,
} from '../../src/shared/components/page-grid'
import { CASES } from './page-grid-ssr-cases'

// Template comments carry documentation, not DOM; drop them but keep Vue's
// own fragment / v-if markers (<!--[-->, <!--]-->, <!---->).
const stripDocs = (html: string) => html.replace(/<!--(?!\[-->|\]-->|-->)[\s\S]*?-->/g, '')

async function render(props: Record<string, unknown>, slots?: Record<string, (p: never) => unknown>) {
  const spy = vi.spyOn(Math, 'random').mockReturnValue(0.123456789)
  try {
    return stripDocs(await renderToString(createSSRApp({ render: () => h(PageGrid, props as never, slots as never) })))
  } finally {
    spy.mockRestore()
  }
}

describe('PageGrid without groupKey (backward compatibility)', () => {
  const baseline = JSON.parse(readFileSync(new URL('./fixtures/page-grid-baseline.json', import.meta.url), 'utf8')) as Record<string, string>
  for (const name of Object.keys(CASES)) {
    it(`renders byte-identical DOM to the pre-groups grid: ${name}`, async () => {
      expect(await render(CASES[name])).toBe(stripDocs(baseline[name]))
    })
  }
  it('treats groupKey: undefined as no grouping', async () => {
    expect(await render({ ...CASES.rich, groupKey: undefined, groupLabel: (g: string) => g })).toBe(stripDocs(baseline.rich))
  })
})

describe('PageGrid with groupKey', () => {
  const items: PageGridItem[] = ['a', 'a', 'a', 'b', 'b'].map((g, i) => ({ key: `k${i}`, label: `${g}-${i}`, thumb: `t${i}.png` }))
  const groupKey = (it: PageGridItem) => it.label!.split('-')[0]

  it('renders a header per group and places tiles on explicit grid rows', async () => {
    const html = await render({ items, groupKey, columns: 2, groupLabel: (g: string, n: number) => `File ${g} (${n})` })
    expect(html).toContain('page-grid pg-grouped')
    expect(html.match(/class="pg-group-header"/g)).toHaveLength(2)
    expect(html).toContain('File a (3)')
    expect(html).toContain('File b (2)')
    // rows: header a, a0 a1, a2, header b, b3 b4
    expect(html).toContain('grid-template-rows:32px auto auto 32px auto;')
    expect(html).toMatch(/data-key="k2"/)
    expect(html).toContain('grid-row:3;grid-column:1;')
    expect(html).toContain('grid-row:5;grid-column:2;')
    expect(html).toContain('aria-label="Page 4, b-3, File b (2)"')
  })

  it('never virtualizes a grouped grid', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ key: `k${i}`, thumb: 't.png' }))
    const html = await render({ items: many, groupKey: () => 'g', virtualizeOver: 10 })
    expect(html).not.toContain('pg-virtual')
    expect(html.match(/class="pg-tile/g)).toHaveLength(30)
  })

  it('renders the #group-header slot with group, label, start and count', async () => {
    const html = await render({ items, groupKey }, {
      'group-header': (p: never) => {
        const s = p as { group: string; label: string; start: number; count: number }
        return h('b', { class: 'custom' }, `${s.group}|${s.label}|${s.start}|${s.count}`)
      },
    })
    expect(html).toContain('<b class="custom">a|a|0|3</b>')
    expect(html).toContain('<b class="custom">b|b|3|2</b>')
  })
})

describe('groupLayout', () => {
  it('starts each run on a new row under a header row', () => {
    const L = groupLayout(['a', 'a', 'a', 'b'], 2)
    expect(L.runs).toEqual([
      { group: 'a', start: 0, count: 3, headerRow: 0 },
      { group: 'b', start: 3, count: 1, headerRow: 3 },
    ])
    expect(L.rowKinds).toEqual(['header', 'tiles', 'tiles', 'header', 'tiles'])
    expect(L.rowSlots).toEqual([[], [0, 1], [2], [], [3]])
    expect(L.slots).toEqual([{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 0 }, { row: 4, col: 0 }])
  })
  it('gives empty ids a new row but no header', () => {
    const L = groupLayout([null, null, 'x', undefined, ''], 3)
    expect(L.runs.map((r) => [r.group, r.start, r.count, r.headerRow])).toEqual([['', 0, 2, -1], ['x', 2, 1, 1], ['', 3, 2, -1]])
    expect(L.rowKinds).toEqual(['tiles', 'header', 'tiles', 'tiles'])
  })
  it('splits non-contiguous groups into separate runs', () => {
    expect(groupLayout(['a', 'b', 'a'], 4).runs.map((r) => r.group)).toEqual(['a', 'b', 'a'])
  })
  it('handles no items and degenerate column counts', () => {
    expect(groupLayout([], 3)).toEqual({ runs: [], slots: [], rowKinds: [], rowSlots: [] })
    expect(groupLayout(['a', 'a'], 0).rowSlots).toEqual([[], [0], [1]])
  })
})

describe('grouped hit-testing and keyboard', () => {
  // header a | a0 a1 | a2 | header b | b3 b4
  const L = groupLayout(['a', 'a', 'a', 'b', 'b'], 2)
  const g: GridGeom = { cols: 2, colW: 100, rowH: 150, gap: 10, n: 5 }
  const H = 32
  it('row tops add header and tile rows with gaps', () => {
    expect(groupRowTops(L, 150, H, 10)).toEqual([0, 42, 202, 362, 404])
  })
  it('maps points to slots', () => {
    expect(groupedIndexAt(50, 100, L, g, H)).toBe(0)
    expect(groupedIndexAt(150, 100, L, g, H)).toBe(1)
    expect(groupedIndexAt(50, 250, L, g, H)).toBe(2)
    expect(groupedIndexAt(150, 250, L, g, H)).toBe(2) // past the short row's end
    expect(groupedIndexAt(150, 370, L, g, H)).toBe(4) // header b → its first tile row
    expect(groupedIndexAt(50, 10, L, g, H)).toBe(0) // header a
    expect(groupedIndexAt(50, -500, L, g, H)).toBe(0)
    expect(groupedIndexAt(500, 5000, L, g, H)).toBe(4)
    expect(groupedIndexAt(0, 0, groupLayout([], 2), g, H)).toBe(-1)
  })
  it('moves Up/Down between tile rows, skipping headers and clamping the column', () => {
    expect(groupedKeyTarget('ArrowDown', 1, L)).toBe(2)
    expect(groupedKeyTarget('ArrowDown', 2, L)).toBe(3)
    expect(groupedKeyTarget('ArrowUp', 4, L)).toBe(2)
    expect(groupedKeyTarget('ArrowUp', 0, L)).toBe(0)
    expect(groupedKeyTarget('ArrowDown', 4, L)).toBe(4)
  })
  it('keeps Left/Right/Home/End flat', () => {
    expect(groupedKeyTarget('ArrowRight', 2, L)).toBe(3)
    expect(groupedKeyTarget('ArrowLeft', 0, L)).toBe(0)
    expect(groupedKeyTarget('Home', 3, L)).toBe(0)
    expect(groupedKeyTarget('End', 0, L)).toBe(4)
    expect(groupedKeyTarget('x', 0, L)).toBeNull()
  })
})
