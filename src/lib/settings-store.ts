import type { Settings } from '../types'

// Last-used settings, remembered across visits. Loads are validated
// per-key against the defaults: a corrupt or partial save degrades to
// defaults for the bad keys instead of breaking startup.
const KEY = 'ic-settings'
const FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'original']

export function loadSavedSettings(): Partial<Settings> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const v = JSON.parse(raw) as Partial<Settings>
    const out: Partial<Settings> = {}
    if (FORMATS.includes(v.format as string)) out.format = v.format
    if (v.mode === 'quality' || v.mode === 'target' || v.mode === 'smart') out.mode = v.mode
    if (Number.isFinite(v.targetSize) && (v.targetSize as number) > 0) out.targetSize = v.targetSize
    if (Number.isFinite(v.quality) && (v.quality as number) >= 1 && (v.quality as number) <= 100) out.quality = v.quality
    if (Number.isFinite(v.maxSize) && (v.maxSize as number) >= 0) out.maxSize = v.maxSize
    if (v.resizeMode === 'longest' || v.resizeMode === 'width' || v.resizeMode === 'height' || v.resizeMode === 'percent') out.resizeMode = v.resizeMode
    if (typeof v.noUpscale === 'boolean') out.noUpscale = v.noUpscale
    if (typeof v.quantize === 'boolean') out.quantize = v.quantize
    if (typeof v.keepExif === 'boolean') out.keepExif = v.keepExif
    if (typeof v.jpegFill === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.jpegFill)) out.jpegFill = v.jpegFill
    if (typeof v.keepOriginalName === 'boolean') out.keepOriginalName = v.keepOriginalName
    if (typeof v.smartKeepOriginal === 'boolean') out.smartKeepOriginal = v.smartKeepOriginal
    return out
  } catch {
    return {}
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Private mode or quota: remembering is a nicety, never an error.
  }
}
