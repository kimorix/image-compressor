// Output file names. Pure, unit tested.

/** Characters no common file system accepts, plus control characters. */
// eslint-disable-next-line no-control-regex
const BAD = /[\\/:*?"<>|\u0000-\u001f]+/g

/** File name stem without the .pdf extension (any case). */
export function stem(name: string): string {
  return name.replace(/\.pdf$/i, '')
}

/** Make a user-typed or generated stem safe; never empty. */
export function sanitize(s: string, fallback = 'document'): string {
  const out = s.replace(BAD, '_').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 180).trim()
  return out || fallback
}

/** Ensure exactly one ".pdf" at the end. */
export function withPdf(s: string): string {
  return stem(s) + '.pdf'
}

/** Merge output: the typed name, or the first file's name + suffix ("-合并"). */
export function mergeName(typed: string, firstFile: string | undefined, suffix: string): string {
  const t = stem(typed.trim())
  if (t) return withPdf(sanitize(t))
  return withPdf(sanitize(stem(firstFile || 'merged') + suffix))
}

export interface SplitNameVars {
  /** Source file name (with or without .pdf). */
  name: string
  /** Range label from groupLabel ("1-3"). */
  range: string
  /** 1-based output number. */
  n: number
  /** Number of outputs (pads {n}: 01…12). */
  total: number
}

/**
 * Fill a split template: {name}, {range}, {n}. An empty template, or one
 * that would give every part the same name, still yields distinct names
 * (zip.ts uniqueNames adds -2, -3 as a last resort).
 */
export function splitName(template: string, v: SplitNameVars): string {
  const width = String(Math.max(1, v.total)).length
  const tpl = template.trim() || '{name}_{range}'
  const filled = tpl
    .replace(/\{name\}/g, stem(v.name))
    .replace(/\{range\}/g, v.range)
    .replace(/\{n\}/g, String(v.n).padStart(width, '0'))
  return withPdf(sanitize(stem(filled)))
}
