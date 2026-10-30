// Split specs → output groups. Positions are 1-based into the document being
// split (one source file after the user's edits: deleted pages left out,
// moved / rotated pages as shown). Pure, unit tested.
import { parseRangeGroups, type RangeError } from '../../../shared/pdf/page-range'
import type { SplitKind } from '../types'

export type SplitSpec =
  | { kind: 'ranges'; text: string }
  | { kind: 'every'; n: number }
  | { kind: 'selected'; positions: number[] }
  | { kind: 'single' }

export type SplitError = RangeError | 'noSelection' | 'badN'
export type SplitPlan = { ok: true; groups: number[][] } | { ok: false; error: SplitError }

/** Largest N accepted for "every N pages". */
export const MAX_EVERY = 9999

export function planSplit(spec: SplitSpec, total: number): SplitPlan {
  if (total <= 0) return { ok: false, error: 'empty' }
  switch (spec.kind) {
    case 'ranges':
      return parseRangeGroups(spec.text, total)
    case 'every': {
      const n = Math.floor(spec.n)
      if (!(n >= 1) || n > MAX_EVERY) return { ok: false, error: 'badN' }
      const groups: number[][] = []
      for (let a = 1; a <= total; a += n) {
        const g: number[] = []
        for (let p = a; p < a + n && p <= total; p++) g.push(p)
        groups.push(g)
      }
      return { ok: true, groups }
    }
    case 'selected': {
      const pos = spec.positions.filter((p) => p >= 1 && p <= total)
      return pos.length ? { ok: true, groups: [pos] } : { ok: false, error: 'noSelection' }
    }
    case 'single':
      return { ok: true, groups: Array.from({ length: total }, (_, i) => [i + 1]) }
  }
}

/** Build the spec from settings (selected positions come from the grid). */
export function specFor(kind: SplitKind, ranges: string, every: number, positions: number[] = []): SplitSpec {
  if (kind === 'ranges') return { kind, text: ranges }
  if (kind === 'every') return { kind, n: every }
  if (kind === 'selected') return { kind, positions }
  return { kind: 'single' }
}

/**
 * Short label for a group of positions: "5", "1-3", "5-3" (descending run),
 * or runs joined with "_" ("1-3_5_8-9").
 */
export function groupLabel(group: readonly number[]): string {
  if (!group.length) return ''
  const runs: string[] = []
  let start = group[0]
  let prev = group[0]
  let dir = 0
  const flush = () => runs.push(start === prev ? String(start) : `${start}-${prev}`)
  for (let i = 1; i < group.length; i++) {
    const p = group[i]
    const d = p - prev
    if ((d === 1 || d === -1) && (dir === 0 || dir === d)) {
      dir = d
      prev = p
      continue
    }
    flush()
    start = prev = p
    dir = 0
  }
  flush()
  return runs.join('_')
}
