// Remembered converter settings (own key, independent of the compressor).
// The output format stays 'auto' (recommended per source) until the user
// picks one; from then on the pick is remembered. Quality is remembered per
// lossy format. Loads are validated field by field: a corrupt or partial
// save falls back to the defaults for the bad fields only. Storage is
// injectable for tests.
import type { ConvertSettings, LossyFormat } from '../types'
import { DEFAULT_QUALITY, DEFAULT_SETTINGS, LOSSY_FORMATS, normalizeHex, normalizeIcoSizes, OUT_FORMATS } from './convert'

export const SETTINGS_KEY = 'ic-convert-settings'

type Store = Pick<Storage, 'getItem' | 'setItem'>
function store(): Store | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}

const LOSSY: readonly LossyFormat[] = LOSSY_FORMATS

export function loadConvertSettings(s: Store | null = store()): ConvertSettings {
  const out: ConvertSettings = { ...DEFAULT_SETTINGS, quality: { ...DEFAULT_QUALITY }, icoSizes: [...DEFAULT_SETTINGS.icoSizes] }
  try {
    const raw = s?.getItem(SETTINGS_KEY)
    if (!raw) return out
    const v = JSON.parse(raw) as Record<string, unknown>
    if (typeof v.format === 'string' && (OUT_FORMATS as readonly string[]).includes(v.format)) out.format = v.format as ConvertSettings['format']
    const q = v.quality as Record<string, unknown> | undefined
    if (q && typeof q === 'object') {
      for (const f of LOSSY) {
        const n = q[f]
        if (typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 100) out.quality[f] = n
      }
    }
    if (typeof v.fill === 'string') out.fill = normalizeHex(v.fill) ?? out.fill
    if (typeof v.keepExif === 'boolean') out.keepExif = v.keepExif
    if (typeof v.keepName === 'boolean') out.keepName = v.keepName
    if (Array.isArray(v.icoSizes)) out.icoSizes = normalizeIcoSizes(v.icoSizes)
    if (v.tiffPages === 'all' || v.tiffPages === 'first') out.tiffPages = v.tiffPages
  } catch { /* corrupt save: defaults */ }
  return out
}

export function saveConvertSettings(v: ConvertSettings, s: Store | null = store()): void {
  try {
    const { format, quality, fill, keepExif, keepName, icoSizes, tiffPages } = v
    // 'auto' is not a choice: saving it would pin nothing, so leave it out.
    const body: Record<string, unknown> = { quality, fill, keepExif, keepName, icoSizes, tiffPages }
    if (format !== 'auto') body.format = format
    s?.setItem(SETTINGS_KEY, JSON.stringify(body))
  } catch { /* storage full or blocked */ }
}
