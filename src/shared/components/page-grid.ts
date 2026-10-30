// Pure logic behind PageGrid.vue (sortable thumbnail grid shared by images
// to PDF and PDF merge/split): reorder, selection, grid hit-testing,
// keyboard moves, auto-scroll speed, virtual window and rotated-thumbnail
// fit. No DOM here, so all of it is unit tested.

export type PageRotation = 0 | 90 | 180 | 270
export type PageAction = 'rotateL' | 'rotateR' | 'dup' | 'delete'

export interface PageGridItem {
  /** Stable identity (survives reorder). */
  key: string
  /** Thumbnail URL; missing = not rendered yet (PageGrid emits need-thumb). */
  thumb?: string | null
  /** Caption under the tile (file name, "P3"). */
  label?: string
  /** Small pill after the label ("HEIC", "横图"). */
  tag?: string
  tagKind?: 'info' | 'warn' | 'bad'
  /** Source colour stripe (merge: one colour per input file). */
  color?: string
  /** Extra rotation applied on top of the thumbnail, clockwise. */
  rotate?: number
  /** Thumbnail width / height before rotation (fits the tile exactly). */
  aspect?: number
  /** Shown struck through / translucent (deleted page awaiting undo). */
  dimmed?: boolean
}

/** Move one element: the item at `from` ends up at index `to`. New array. */
export function moveItem<T>(arr: readonly T[], from: number, to: number): T[] {
  const out = arr.slice()
  if (from < 0 || from >= out.length) return out
  const t = Math.max(0, Math.min(out.length - 1, to))
  if (t === from) return out
  const [x] = out.splice(from, 1)
  out.splice(t, 0, x)
  return out
}

/**
 * Move several elements (a selection) as one block, keeping their relative
 * order, so the block starts at index `to` of the result ("move to first":
 * to = 0, "move to last": to = arr.length - indices.length).
 */
export function moveBlock<T>(arr: readonly T[], indices: readonly number[], to: number): T[] {
  const set = new Set(indices.filter((i) => i >= 0 && i < arr.length))
  if (!set.size) return arr.slice()
  const block = arr.filter((_, i) => set.has(i))
  const rest = arr.filter((_, i) => !set.has(i))
  const t = Math.max(0, Math.min(rest.length, to))
  return [...rest.slice(0, t), ...block, ...rest.slice(t)]
}

/** Normalise any degree value to 0/90/180/270. */
export function normRotation(deg: number): PageRotation {
  return ((((Math.round(deg / 90) * 90) % 360) + 360) % 360) as PageRotation
}

// ---- selection ----

export interface SelectModifiers { shift?: boolean; toggle?: boolean }

/**
 * Selection after a click on `key`: plain click selects only it (a second
 * click on the sole selected item clears), toggle (Ctrl/⌘ or touch select
 * mode) flips it, shift selects the range from the anchor (the last plainly
 * or toggle-clicked key) in display order.
 */
export function nextSelection(
  order: readonly string[],
  selection: readonly string[],
  anchor: string | null,
  key: string,
  mod: SelectModifiers = {},
): string[] {
  if (mod.shift && anchor && order.includes(anchor)) {
    const a = order.indexOf(anchor)
    const b = order.indexOf(key)
    const [lo, hi] = a < b ? [a, b] : [b, a]
    return order.slice(lo, hi + 1)
  }
  if (mod.toggle) {
    return selection.includes(key) ? selection.filter((k) => k !== key) : order.filter((k) => k === key || selection.includes(k))
  }
  return selection.length === 1 && selection[0] === key ? [] : [key]
}

// ---- grid geometry ----

export interface GridGeom {
  cols: number
  /** Tile width and row height (px, without gaps). */
  colW: number
  rowH: number
  gap: number
  n: number
}

/** Column count for a container width: fixed, or as many min-width tiles as fit. */
export function columnsFor(width: number, minTile: number, gap: number, fixed?: number): number {
  if (fixed && fixed > 0) return fixed
  return Math.max(2, Math.floor((width + gap) / (minTile + gap)))
}

/**
 * Index of the slot under a point given in grid-local coordinates (origin =
 * the grid's top-left, content coordinates, so scrolling is already
 * accounted for). Points in gaps or outside snap to the nearest slot.
 */
export function gridIndexAt(x: number, y: number, g: GridGeom): number {
  if (g.n <= 0) return -1
  const col = Math.max(0, Math.min(g.cols - 1, Math.floor((x + g.gap / 2) / (g.colW + g.gap))))
  const row = Math.max(0, Math.floor((y + g.gap / 2) / (g.rowH + g.gap)))
  return Math.max(0, Math.min(g.n - 1, row * g.cols + col))
}

/** Top-left of slot `i` in grid-local coordinates. */
export function slotOrigin(i: number, g: GridGeom): { x: number; y: number } {
  return { x: (i % g.cols) * (g.colW + g.gap), y: Math.floor(i / g.cols) * (g.rowH + g.gap) }
}

/** Rows [start, end) to render for a viewport over the grid, with overscan rows. */
export function virtualRows(viewTop: number, viewH: number, g: GridGeom, overscan = 2): { start: number; end: number } {
  const rows = Math.ceil(g.n / g.cols)
  const stride = g.rowH + g.gap
  if (stride <= 0) return { start: 0, end: rows }
  const start = Math.min(rows, Math.max(0, Math.floor(viewTop / stride) - overscan))
  const end = Math.min(rows, Math.ceil((viewTop + viewH) / stride) + overscan)
  return { start, end: Math.max(start, end) }
}

// ---- keyboard ----

/** Target index for a navigation key in a grid of n items; null = not a nav key. */
export function keyTarget(key: string, i: number, cols: number, n: number): number | null {
  let t: number
  switch (key) {
    case 'ArrowLeft': t = i - 1; break
    case 'ArrowRight': t = i + 1; break
    case 'ArrowUp': t = i - cols; break
    case 'ArrowDown': t = i + cols; break
    case 'Home': t = 0; break
    case 'End': t = n - 1; break
    default: return null
  }
  return Math.max(0, Math.min(n - 1, t))
}

// ---- auto-scroll while dragging ----

/**
 * Scroll step (px per frame) for a pointer at clientY inside a viewport
 * [top, bottom]: zero in the middle, ramping linearly to ±max within `edge`
 * px of either edge (and beyond it).
 */
export function autoScrollStep(clientY: number, top: number, bottom: number, edge = 56, max = 18): number {
  if (clientY < top + edge) return -Math.round(max * Math.min(1, (top + edge - clientY) / edge))
  if (clientY > bottom - edge) return Math.round(max * Math.min(1, (clientY - (bottom - edge)) / edge))
  return 0
}

// ---- rotated thumbnail fit ----

/**
 * Scale for a thumbnail drawn with `object-fit: contain` in a tile frame of
 * aspect `frameHW` (height / width) and then rotated by `rot`, so the
 * rotated picture fits the frame as large as possible. 1 at 0°/180°.
 * `imgWH` is the picture's width / height before rotation.
 */
export function rotatedScale(imgWH: number, frameHW: number, rot: number): number {
  if (normRotation(rot) % 180 === 0 || !(imgWH > 0) || !(frameHW > 0)) return 1
  // Frame normalised to width 1, height frameHW.
  const bw = Math.min(1, frameHW * imgWH) // unrotated contained box
  const bh = bw / imgWH
  // Rotated, the box occupies bh × bw (w × h); fit that into 1 × frameHW.
  return Math.min(1 / bh, frameHW / bw)
}

// ---- optional group headers ----
//
// With a `groupKey`, PageGrid splits the items into runs of consecutive
// items that share a group id. Each run starts on a new row under a header
// row (spanning all columns); a run whose id is empty (null / undefined /
// '') starts a new row without a header. Runs are contiguous: an item moved
// into the middle of another group splits that group into two runs, each
// with its own header — the parent decides what a move across groups means.
// Without a `groupKey` none of this is used.

export interface GroupRun {
  /** The group id ('' = no header). */
  group: string
  /** First item index and item count. */
  start: number
  count: number
  /** 0-based grid row of the header, or -1 for a run without one. */
  headerRow: number
}

export interface GroupLayout {
  runs: GroupRun[]
  /** Per item (display slot): 0-based grid row and column. */
  slots: { row: number; col: number }[]
  /** Per grid row: a header row or a row of tiles. */
  rowKinds: ('header' | 'tiles')[]
  /** Item indices per grid row (empty for header rows). */
  rowSlots: number[][]
}

/** Grid placement for items with these group ids (in display order) at `cols` columns. */
export function groupLayout(groups: readonly (string | null | undefined)[], cols: number): GroupLayout {
  const c = Math.max(1, Math.floor(cols) || 1)
  const runs: GroupRun[] = []
  const slots: { row: number; col: number }[] = []
  const rowKinds: ('header' | 'tiles')[] = []
  const rowSlots: number[][] = []
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i] ?? ''
    const prev = runs[runs.length - 1]
    if (prev && prev.group === g) {
      prev.count++
    } else {
      runs.push({ group: g, start: i, count: 1, headerRow: g ? rowKinds.length : -1 })
      if (g) { rowKinds.push('header'); rowSlots.push([]) }
    }
    const run = runs[runs.length - 1]
    const k = i - run.start
    if (k % c === 0) { rowKinds.push('tiles'); rowSlots.push([]) }
    const row = rowKinds.length - 1
    slots.push({ row, col: k % c })
    rowSlots[row].push(i)
  }
  return { runs, slots, rowKinds, rowSlots }
}

/** Top of each grid row (px, grid-local) for uniform tile rows of `rowH` and header rows of `headerH`. */
export function groupRowTops(layout: GroupLayout, rowH: number, headerH: number, gap: number): number[] {
  const tops: number[] = []
  let y = 0
  for (const kind of layout.rowKinds) {
    tops.push(y)
    y += (kind === 'header' ? headerH : rowH) + gap
  }
  return tops
}

/**
 * Grouped counterpart of gridIndexAt: the slot under a grid-local point.
 * A point on a header row targets the first slot of the row below it (the
 * start of that group); a point past the end of a short row snaps to that
 * row's last slot; above / below the grid snaps to the first / last row.
 */
export function groupedIndexAt(x: number, y: number, layout: GroupLayout, g: GridGeom, headerH: number): number {
  const n = layout.slots.length
  if (n <= 0) return -1
  const tops = groupRowTops(layout, g.rowH, headerH, g.gap)
  let r = 0
  for (let i = 0; i < tops.length; i++) if (y + g.gap / 2 >= tops[i]) r = i
  if (layout.rowKinds[r] === 'header') r = Math.min(r + 1, tops.length - 1)
  // Every header is followed by its tiles, so this row is never empty.
  const row = layout.rowSlots[r]
  if (!row.length) return 0
  const col = Math.max(0, Math.floor((x + g.gap / 2) / (g.colW + g.gap)))
  return row[Math.min(col, row.length - 1)]
}

/** Grouped counterpart of keyTarget: Up/Down move between tile rows (skipping headers), keeping the column where it exists. */
export function groupedKeyTarget(key: string, i: number, layout: GroupLayout): number | null {
  const n = layout.slots.length
  if (key !== 'ArrowUp' && key !== 'ArrowDown') return keyTarget(key, i, 1, n)
  const here = layout.slots[i]
  if (!here) return null
  const step = key === 'ArrowUp' ? -1 : 1
  for (let r = here.row + step; r >= 0 && r < layout.rowSlots.length; r += step) {
    const row = layout.rowSlots[r]
    if (row.length) return row[Math.min(here.col, row.length - 1)]
  }
  return i
}
