// Defaults, presets and persistence for the Images to PDF settings
// (localStorage `ic.img2pdf.settings.v1`). The file name is per document
// and deliberately not persisted.
import type { Img2PdfSettings, Margin, Orientation, OutputMode, Paper, Quality } from '../types'

export const SETTINGS_KEY = 'ic.img2pdf.settings.v1'

/** Quality presets: JPEG quality and longest edge (px). */
export const QUALITY_PRESETS: Record<Exclude<Quality, 'original'>, { q: number; edge: number }> = {
  balanced: { q: 82, edge: 2000 },
  small: { q: 70, edge: 1600 },
}
/** JPEG quality for sources that cannot be embedded as-is on "original". */
export const ORIGINAL_REENCODE_Q = 92
export const EDGE_MIN = 320
export const EDGE_MAX = 10000

/** Letter for the regions that use it (US, Canada, Mexico, Philippines, Chile, Colombia…); A4 elsewhere. */
const LETTER_REGIONS = new Set(['US', 'CA', 'MX', 'PH', 'CL', 'CO', 'VE', 'GT', 'CR', 'PR'])
export function defaultPaper(locale?: string): Paper {
  const m = /[-_]([A-Za-z]{2})\b/.exec(locale || '')
  return m && LETTER_REGIONS.has(m[1].toUpperCase()) ? 'letter' : 'a4'
}

export function defaultSettings(locale?: string): Img2PdfSettings {
  return {
    output: 'single',
    paper: defaultPaper(locale),
    orientation: 'auto',
    margin: 'small',
    quality: 'balanced',
    jpegQuality: QUALITY_PRESETS.balanced.q,
    maxEdge: QUALITY_PRESETS.balanced.edge,
  }
}

const OUTPUTS: OutputMode[] = ['single', 'perImage']
const PAPERS: Paper[] = ['a4', 'letter', 'fit']
const ORIENTS: Orientation[] = ['auto', 'portrait', 'landscape']
const MARGINS: Margin[] = ['none', 'small', 'medium', 'large']
const QUALITIES: Quality[] = ['original', 'balanced', 'small']

const pick = <T extends string>(v: unknown, list: T[], d: T): T => (list.includes(v as T) ? (v as T) : d)
const clampInt = (v: unknown, lo: number, hi: number, d: number): number => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d
}

/** Validate a stored / partial object against the defaults. */
export function normalizeSettings(raw: unknown, base: Img2PdfSettings): Img2PdfSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    output: pick(r.output, OUTPUTS, base.output),
    paper: pick(r.paper, PAPERS, base.paper),
    orientation: pick(r.orientation, ORIENTS, base.orientation),
    margin: pick(r.margin, MARGINS, base.margin),
    quality: pick(r.quality, QUALITIES, base.quality),
    jpegQuality: clampInt(r.jpegQuality, 1, 100, base.jpegQuality),
    maxEdge: clampInt(r.maxEdge, EDGE_MIN, EDGE_MAX, base.maxEdge),
  }
}

export function loadSettings(locale?: string): Img2PdfSettings {
  const base = defaultSettings(locale)
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? normalizeSettings(JSON.parse(raw), base) : base
  } catch {
    return base
  }
}

export function saveSettings(s: Img2PdfSettings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch { /* private mode */ }
}

/** Switching the quality preset resets the advanced values to the preset's. */
export function withQuality(s: Img2PdfSettings, quality: Quality): Img2PdfSettings {
  if (quality === 'original') return { ...s, quality }
  const p = QUALITY_PRESETS[quality]
  return { ...s, quality, jpegQuality: p.q, maxEdge: p.edge }
}

/** Effective encode parameters: maxEdge 0 = keep full size. */
export function encodeParams(s: Img2PdfSettings): { q: number; maxEdge: number } {
  if (s.quality === 'original') return { q: ORIGINAL_REENCODE_Q, maxEdge: 0 }
  return { q: s.jpegQuality, maxEdge: s.maxEdge }
}
