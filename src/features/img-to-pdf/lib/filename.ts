// Output file names: the user's typed name (cleaned), a default from the
// first image or the date, and per-image names for "one PDF per image".
// Pure, unit tested.
import { uniqueNames } from '../../../shared/lib/zip'

/** Characters Windows / macOS / Android refuse in file names, plus controls. */
// eslint-disable-next-line no-control-regex
const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f\u007f]+/g
export const MAX_STEM = 120

/** File stem without its extension ("IMG_4021.HEIC" → "IMG_4021"). */
export function stemOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(0, dot) : base
}

/**
 * Clean a typed name into a safe stem (no ".pdf"): illegal characters
 * become "-", runs of "-" collapse, leading/trailing dots, dashes and
 * spaces go, and the stem is capped at MAX_STEM characters (by code
 * point, so an emoji or CJK character is never cut in half). Empty when
 * nothing usable is left.
 */
export function cleanStem(raw: string): string {
  let s = (raw || '').normalize('NFC').replace(/\.pdf\s*$/i, '')
  s = s.replace(/\s+/g, ' ').replace(ILLEGAL, '-').replace(/-{2,}/g, '-')
  s = s.replace(/^[\s.-]+|[\s.-]+$/g, '')
  const cps = [...s]
  if (cps.length > MAX_STEM) s = cps.slice(0, MAX_STEM).join('').replace(/[\s.-]+$/, '')
  return s
}

/** yyyymmdd for the date-based default. */
function stamp(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Default stem: the first image's name, or `<prefix>-YYYYMMDD`
 * ("图片-20261029") when there is none or it cleans to nothing (pasted
 * images are all "image.png"; the caller passes undefined for those).
 * `prefix` is the localised word for "images".
 */
export function defaultStem(firstName: string | undefined, prefix: string, date = new Date()): string {
  const first = firstName ? cleanStem(stemOf(firstName)) : ''
  return first || cleanStem(`${prefix}-${stamp(date)}`) || `images-${stamp(date)}`
}

/** Final single-PDF name: the typed name when usable, else the default. */
export function pdfName(typed: string, fallbackStem: string): string {
  return `${cleanStem(typed) || cleanStem(fallbackStem) || 'images'}.pdf`
}

/** "One PDF per image": `<image stem>.pdf`, made unique ("a.pdf", "a-2.pdf"). */
export function perImageNames(imageNames: string[]): string[] {
  return uniqueNames(imageNames.map((n) => `${cleanStem(stemOf(n)) || 'image'}.pdf`))
}

/** Zip name for the per-image output, from the single-PDF name. */
export function zipName(pdf: string): string {
  return pdf.replace(/\.pdf$/i, '') + '.zip'
}
