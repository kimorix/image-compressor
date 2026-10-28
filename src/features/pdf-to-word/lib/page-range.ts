// "1-3, 5, 8-" style page ranges. Pure, so it is unit tested directly.

export type RangeResult = { ok: true; pages: number[] } | { ok: false; error: 'syntax' | 'empty' | 'outOfRange' }

/**
 * Parse a page range against a document of `total` pages.
 * Empty input means every page. Accepts "," "，" "、" ";" and spaces as
 * separators, "-" "–" "—" "~" as range dashes, open ends ("5-", "-3"),
 * and reversed ranges ("5-3"). Pages past the end are clipped; a range
 * that selects nothing is an error.
 */
export function parsePageRange(input: string, total: number): RangeResult {
  const all = Array.from({ length: Math.max(0, total) }, (_, i) => i + 1)
  const s = (input || '').trim()
  if (!s) return total > 0 ? { ok: true, pages: all } : { ok: false, error: 'empty' }
  const set = new Set<number>()
  let sawOutOfRange = false
  for (const raw of s.split(/[,，、;；\s]+/)) {
    const part = raw.trim()
    if (!part) continue
    const m = part.match(/^(\d*)\s*[-–—~～]\s*(\d*)$/)
    let a: number
    let b: number
    if (m) {
      if (!m[1] && !m[2]) return { ok: false, error: 'syntax' }
      a = m[1] ? parseInt(m[1], 10) : 1
      b = m[2] ? parseInt(m[2], 10) : total
    } else if (/^\d+$/.test(part)) {
      a = b = parseInt(part, 10)
    } else {
      return { ok: false, error: 'syntax' }
    }
    if (a > b) [a, b] = [b, a]
    if (a < 1) a = 1
    if (a > total) { sawOutOfRange = true; continue }
    if (b > total) { sawOutOfRange = true; b = total }
    for (let p = a; p <= b; p++) set.add(p)
  }
  if (!set.size) return { ok: false, error: sawOutOfRange ? 'outOfRange' : 'empty' }
  return { ok: true, pages: [...set].sort((x, y) => x - y) }
}

/** Syntax-only check for the settings field (no document yet). */
export function isValidRangeSyntax(input: string): boolean {
  const r = parsePageRange(input, 100000)
  return r.ok || (!input.trim())
}
