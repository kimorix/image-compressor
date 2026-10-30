// Prop sets rendered by page-grid-groups.test.ts. Their SSR output before
// group headers existed is stored in fixtures/page-grid-baseline.json, so
// the test proves a grid without `groupKey` renders byte-identical DOM.
import type { PageGridItem } from '../../src/shared/components/page-grid'

const items = (n: number, extra: (i: number) => Partial<PageGridItem> = () => ({})): PageGridItem[] =>
  Array.from({ length: n }, (_, i) => ({ key: `k${i}`, ...extra(i) }))

export const CASES: Record<string, Record<string, unknown>> = {
  empty: { items: [] },
  plain: { items: items(5, (i) => ({ thumb: i % 2 ? `t${i}.png` : null })) },
  rich: {
    items: items(4, (i) => ({
      thumb: `t${i}.png`, label: `file-${i}.pdf`, tag: i === 1 ? 'HEIC' : undefined, tagKind: i === 1 ? 'warn' : undefined,
      color: i < 2 ? '#2563eb' : '#16a34a', rotate: i * 90, aspect: 0.75, dimmed: i === 3,
    })),
    selection: ['k1', 'k2'],
    actions: ['rotateL', 'rotateR', 'dup', 'delete'],
    columns: 3,
    ariaLabel: 'Pages',
  },
  disabled: { items: items(3, (i) => ({ thumb: `t${i}.png` })), disabled: true, showNumbers: false, animate: false },
  virtual: { items: items(30, (i) => ({ thumb: `t${i}.png` })), virtualizeOver: 10 },
}
