// Pure page operations for merge / split: every function returns a new
// array and never mutates its input, so each state can go on the undo stack
// as is. Keys identify pages across moves; duplicates get fresh keys.
import { moveBlock, moveItem, normRotation } from '../../../shared/components/page-grid'
import type { PageRef } from '../types'

export type KeyGen = () => string

let seq = 0
export const defaultKeyGen: KeyGen = () => `p${(seq++).toString(36)}`

/** Pages of a newly added source, in order. */
export function pagesForSource(src: string, count: number, key: KeyGen = defaultKeyGen): PageRef[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => ({ key: key(), src, index, rotate: 0 }))
}

/** Move the page at `from` so it ends up at `to` (PageGrid's reorder event). */
export function reorder(pages: readonly PageRef[], from: number, to: number): PageRef[] {
  return moveItem(pages, from, to)
}

/** Move the pages with these keys as one block so it starts at index `to`. */
export function moveKeys(pages: readonly PageRef[], keys: readonly string[], to: number): PageRef[] {
  const set = new Set(keys)
  const idx = pages.map((p, i) => (set.has(p.key) ? i : -1)).filter((i) => i >= 0)
  return moveBlock(pages, idx, to)
}

/** Rotate the pages with these keys by `delta` degrees (clockwise, multiples of 90). */
export function rotateKeys(pages: readonly PageRef[], keys: readonly string[], delta: number): PageRef[] {
  const set = new Set(keys)
  return pages.map((p) => (set.has(p.key) ? { ...p, rotate: normRotation(p.rotate + delta) } : p))
}

/** Soft-delete: mark deleted (they stay in place, dimmed, until undone). */
export function deleteKeys(pages: readonly PageRef[], keys: readonly string[]): PageRef[] {
  const set = new Set(keys)
  return pages.map((p) => (set.has(p.key) && !p.deleted ? { ...p, deleted: true } : p))
}

/** Bring soft-deleted pages back. */
export function restoreKeys(pages: readonly PageRef[], keys: readonly string[]): PageRef[] {
  const set = new Set(keys)
  return pages.map((p) => (set.has(p.key) && p.deleted ? { ...p, deleted: false } : p))
}

/** Delete, or restore when every targeted page is already deleted (a toggle). */
export function toggleDeleteKeys(pages: readonly PageRef[], keys: readonly string[]): PageRef[] {
  const set = new Set(keys)
  const targets = pages.filter((p) => set.has(p.key))
  return targets.length && targets.every((p) => p.deleted) ? restoreKeys(pages, keys) : deleteKeys(pages, keys)
}

/** Duplicate each page right after itself (copies keep rotation, are never deleted). */
export function duplicateKeys(pages: readonly PageRef[], keys: readonly string[], key: KeyGen = defaultKeyGen): { pages: PageRef[]; added: string[] } {
  const set = new Set(keys)
  const out: PageRef[] = []
  const added: string[] = []
  for (const p of pages) {
    out.push(p)
    if (set.has(p.key)) {
      const copy: PageRef = { key: key(), src: p.src, index: p.index, rotate: p.rotate }
      out.push(copy)
      added.push(copy.key)
    }
  }
  return { pages: out, added }
}

/** Drop every page of a source (removing the file). */
export function removeSource(pages: readonly PageRef[], src: string): PageRef[] {
  return pages.filter((p) => p.src !== src)
}

/** Pages actually written, in order. */
export function livePages(pages: readonly PageRef[]): PageRef[] {
  return pages.filter((p) => !p.deleted)
}

/**
 * Order of sources as they first appear in the page list, followed by any
 * source that has no pages yet (still probing / every page removed).
 */
export function sourceOrder(pages: readonly PageRef[], all: readonly string[] = []): string[] {
  const seen: string[] = []
  for (const p of pages) if (!seen.includes(p.src)) seen.push(p.src)
  for (const s of all) if (!seen.includes(s)) seen.push(s)
  return seen
}

/** True when each source's pages form one contiguous run (the grouped view is meaningful). */
export function isGrouped(pages: readonly PageRef[]): boolean {
  const done = new Set<string>()
  let cur: string | null = null
  for (const p of pages) {
    if (p.src === cur) continue
    if (done.has(p.src)) return false
    if (cur) done.add(cur)
    cur = p.src
  }
  return true
}

/**
 * Re-order pages by a new source order (file chips dragged, sort by name).
 * Stable: pages keep their order within a source. Sources missing from
 * `order` keep their place after the listed ones.
 */
export function applySourceOrder(pages: readonly PageRef[], order: readonly string[]): PageRef[] {
  const rank = new Map(order.map((s, i) => [s, i]))
  const fallback = order.length
  return pages
    .map((p, i) => ({ p, i, r: rank.get(p.src) ?? fallback }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.p)
}

/** Source ids ordered by file name, natural ("2.pdf" before "10.pdf"). */
export function sortSourcesByName(srcs: readonly { id: string; name: string }[]): string[] {
  const coll = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  return srcs.slice().sort((a, b) => coll.compare(a.name, b.name)).map((s) => s.id)
}

/** Keys of every page of one source (select a whole file). */
export function keysOfSource(pages: readonly PageRef[], src: string): string[] {
  return pages.filter((p) => p.src === src).map((p) => p.key)
}

// ---- undo ----

export interface History {
  past: PageRef[][]
  future: PageRef[][]
}

export const HISTORY_LIMIT = 20

export function emptyHistory(): History {
  return { past: [], future: [] }
}

/** Record `prev` before a change; keeps the newest `limit` states and clears redo. */
export function commit(h: History, prev: PageRef[], limit = HISTORY_LIMIT): History {
  const past = [...h.past, prev]
  return { past: past.length > limit ? past.slice(past.length - limit) : past, future: [] }
}

/** Step back: the state to show and the new history (null when nothing to undo). */
export function undo(h: History, current: PageRef[]): { pages: PageRef[]; history: History } | null {
  if (!h.past.length) return null
  const pages = h.past[h.past.length - 1]
  return { pages, history: { past: h.past.slice(0, -1), future: [current, ...h.future] } }
}

export function redo(h: History, current: PageRef[]): { pages: PageRef[]; history: History } | null {
  if (!h.future.length) return null
  const [pages, ...future] = h.future
  return { pages, history: { past: [...h.past, current], future } }
}
