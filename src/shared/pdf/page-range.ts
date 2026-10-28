// "1-3, 5, 8-" style page ranges. Pure, so it is unit tested directly.
// Shared by PDF to Word (a page selection) and PDF merge/split (split by
// ranges, one output file per group).

export type RangeError = 'syntax' | 'empty' | 'outOfRange'
export type RangeResult = { ok: true; pages: number[] } | { ok: false; error: RangeError }
export type RangeGroupsResult = { ok: true; groups: number[][] } | { ok: false; error: RangeError }

/** One comma-separated part, 1-based and inclusive, as typed (a may exceed b). */
interface RangePart { a: number; b: number; openEnd?: boolean }

/**
 * Shared lexer. Accepts "," "，" "、" ";" "；" and spaces as separators,
 * "-" "–" "—" "~" "～" as range dashes, and open ends ("5-" = to the last
 * page, "-3" = from page 1). Null on a syntax error.
 */
function lexRanges(input: string, total: number): RangePart[] | null {
  const parts: RangePart[] = []
  for (const raw of input.split(/[,，、;；\s]+/)) {
    const part = raw.trim()
    if (!part) continue
    const m = part.match(/^(\d*)\s*[-–—~～]\s*(\d*)$/)
    if (m) {
      if (!m[1] && !m[2]) return null
      parts.push({ a: m[1] ? parseInt(m[1], 10) : 1, b: m[2] ? parseInt(m[2], 10) : total, openEnd: !m[2] })
    } else if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10)
      parts.push({ a: n, b: n })
    } else {
      return null
    }
  }
  return parts
}

/** Clip a part to [1, total]: ascending bounds, or null when it lies past the end. */
function clip(part: RangePart, total: number): { lo: number; hi: number; clipped: boolean } | null {
  let lo = Math.min(part.a, part.b)
  let hi = Math.max(part.a, part.b)
  if (lo < 1) lo = 1
  if (lo > total) return null
  const clipped = hi > total
  if (clipped) hi = total
  return { lo, hi, clipped }
}

/**
 * Parse a page range against a document of `total` pages.
 * Empty input means every page. Reversed ranges ("5-3") are accepted.
 * Pages past the end are clipped; a range that selects nothing is an
 * error. The result is sorted and de-duplicated.
 */
export function parsePageRange(input: string, total: number): RangeResult {
  const all = Array.from({ length: Math.max(0, total) }, (_, i) => i + 1)
  const s = (input || '').trim()
  if (!s) return total > 0 ? { ok: true, pages: all } : { ok: false, error: 'empty' }
  const parts = lexRanges(s, total)
  if (!parts) return { ok: false, error: 'syntax' }
  const set = new Set<number>()
  let sawOutOfRange = false
  for (const part of parts) {
    const c = clip(part, total)
    if (!c) { sawOutOfRange = true; continue }
    if (c.clipped) sawOutOfRange = true
    for (let p = c.lo; p <= c.hi; p++) set.add(p)
  }
  if (!set.size) return { ok: false, error: sawOutOfRange ? 'outOfRange' : 'empty' }
  return { ok: true, pages: [...set].sort((x, y) => x - y) }
}

/**
 * Parse ranges as separate groups, keeping the typed order: "1-3, 8, 4-6"
 * gives [[1,2,3],[8],[4,5,6]], and a reversed range keeps its direction
 * ("5-3" gives [5,4,3]). Groups are not merged or de-duplicated (the same
 * page may go to two output files). Parts are clipped to the document; a
 * part entirely past the end is dropped. Empty input selects nothing.
 */
export function parseRangeGroups(input: string, total: number): RangeGroupsResult {
  const s = (input || '').trim()
  if (!s) return { ok: false, error: 'empty' }
  const parts = lexRanges(s, total)
  if (!parts) return { ok: false, error: 'syntax' }
  const groups: number[][] = []
  let sawOutOfRange = false
  for (const part of parts) {
    // "9-" on a 4-page file starts past the end (not a reversed "4-9").
    const c = part.openEnd && part.a > total ? null : clip(part, total)
    if (!c) { sawOutOfRange = true; continue }
    const pages: number[] = []
    for (let p = c.lo; p <= c.hi; p++) pages.push(p)
    groups.push(part.a > part.b ? pages.reverse() : pages)
  }
  if (!groups.length) return { ok: false, error: sawOutOfRange ? 'outOfRange' : 'empty' }
  return { ok: true, groups }
}

/** Syntax-only check for the settings field (no document yet). */
export function isValidRangeSyntax(input: string): boolean {
  const r = parsePageRange(input, 100000)
  return r.ok || (!input.trim())
}
