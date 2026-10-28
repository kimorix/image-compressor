// Mobile two-column masonry helpers. Kept pure so the distribution rules
// (shortest column, stable assignments, aspect clamping) can be unit-tested
// without a browser. The DOM only renders the returned columns.
import type { CompressItem } from '../types'

// Must match style.less: .masonry { gap: 8px } and .masonry-card { padding: 8px }.
export const MASONRY_GAP = 8
export const CARD_PADDING = 8
// 8px top + 6px gap + one 17px filename line + 2px + a 28px meta/download
// row + 8px bottom + 1px borders. The filename is a single ellipsized line
// and the action row has a fixed height, so this estimate does not depend on
// the name length (must match .m-name/.m-meta in styles/mobile.less).
export const CARD_INFO_HEIGHT = 71
// At 390–430px a 3:4 thumbnail would be ~200px tall and two rows would push
// the fourth card under the sticky bars once the 28px bottom action row is
// reserved. Capping the display height at 166px keeps the rendered ratio
// inside the required 3:4–4:3 range while still fitting four complete cards.
export const SMALL_VIEWPORT_THUMB_MAX = 166
export const SMALL_VIEWPORT_MAX = 479

const MIN_ASPECT = 3 / 4
const MAX_ASPECT = 4 / 3

/** Display aspect ratio (width / height), clamped to 3:4–4:3. */
export function clampAspect(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return 1
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, width / height))
}

/** Images smaller than 64px on either side must not be upscaled with cover. */
export function isTinyImage(item: Pick<CompressItem, 'origW' | 'origH'>): boolean {
  return item.origW > 0 && item.origH > 0 && (item.origW < 64 || item.origH < 64)
}

/** Content width inside an 8px card padding. */
export function thumbWidth(columnWidth: number): number {
  return Math.max(0, columnWidth - CARD_PADDING * 2)
}

/** Rendered thumbnail height. Unknown dimensions use a 1:1 placeholder. */
export function estimateThumbHeight(
  item: Pick<CompressItem, 'origW' | 'origH'>,
  columnWidth: number,
  viewportWidth: number,
): number {
  const width = thumbWidth(columnWidth)
  const ideal = width / clampAspect(item.origW, item.origH)
  return viewportWidth <= SMALL_VIEWPORT_MAX
    ? Math.min(ideal, SMALL_VIEWPORT_THUMB_MAX)
    : ideal
}

/** Estimated full card height (thumbnail + fixed information area). */
export function estimateCardHeight(
  item: Pick<CompressItem, 'origW' | 'origH'>,
  columnWidth: number,
  viewportWidth: number,
): number {
  return Math.ceil(estimateThumbHeight(item, columnWidth, viewportWidth) + CARD_INFO_HEIGHT)
}

/** Column width fallback; the App prefers the real container width. */
export function fallbackColumnWidth(viewportWidth: number): number {
  // Viewport - main padding (24) - result-card padding (24) - borders (2)
  // - column gap (8), split in two.
  return Math.max(120, (viewportWidth - 58) / 2)
}

export type MasonryColumns = [CompressItem[], CompressItem[]]

function heightsOf(
  columns: MasonryColumns,
  columnWidth: number,
  viewportWidth: number,
): [number, number] {
  const heights: [number, number] = [0, 0]
  for (const col of [0, 1]) {
    for (const item of columns[col]) {
      heights[col] += estimateCardHeight(item, columnWidth, viewportWidth) + MASONRY_GAP
    }
  }
  return heights
}

function place(
  columns: MasonryColumns,
  heights: [number, number],
  item: CompressItem,
  columnWidth: number,
  viewportWidth: number,
  preferredOnTie: 0 | 1,
): 0 | 1 {
  // Shortest column wins. On a tie use the caller's preference (alternating
  // on a fresh layout, fewer cards when appending).
  const col: 0 | 1 = heights[0] === heights[1]
    ? preferredOnTie
    : (heights[0] < heights[1] ? 0 : 1)
  columns[col].push(item)
  heights[col] += estimateCardHeight(item, columnWidth, viewportWidth) + MASONRY_GAP
  return col
}

/** Full re-layout in item order (used on delete/clear and first render). */
export function distributeMasonry(
  items: CompressItem[],
  columnWidth: number,
  viewportWidth: number,
): MasonryColumns {
  const columns: MasonryColumns = [[], []]
  const heights: [number, number] = [0, 0]
  let last: 0 | 1 = 1
  for (const item of items) {
    last = place(columns, heights, item, columnWidth, viewportWidth, last === 0 ? 1 : 0)
  }
  return columns
}

/**
 * Append only items not present in the existing columns. Existing items are
 * never moved: this is what keeps cards in their column when their phase
 * changes (queued → processing → done) or when another file is added.
 */
export function appendMasonry(
  existing: MasonryColumns,
  items: CompressItem[],
  columnWidth: number,
  viewportWidth: number,
): MasonryColumns {
  const columns: MasonryColumns = [[...existing[0]], [...existing[1]]]
  const present = new Set(columns[0].concat(columns[1]).map((i) => i.id))
  const heights = heightsOf(columns, columnWidth, viewportWidth)
  const preferred: 0 | 1 = columns[0].length <= columns[1].length ? 0 : 1
  for (const item of items) {
    if (present.has(item.id)) continue
    place(columns, heights, item, columnWidth, viewportWidth, preferred)
    present.add(item.id)
  }
  return columns
}

/** Bottom-edge difference between the columns (0 for an empty layout). */
export function columnHeightDifference(
  columns: MasonryColumns,
  columnWidth: number,
  viewportWidth: number,
): number {
  const h = heightsOf(columns, columnWidth, viewportWidth)
  return Math.abs(h[0] - h[1])
}
