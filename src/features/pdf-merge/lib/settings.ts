// Persisted merge / split settings (mode and options, never a file name).
import { DEFAULT_SETTINGS, type Settings } from '../types'

const KEY = 'ic-pdf-merge'

/** Merge stored values over the defaults, ignoring anything malformed. */
export function parseSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>
  const mg = (o.merge && typeof o.merge === 'object' ? o.merge : {}) as Partial<Settings['merge']>
  const sp = (o.split && typeof o.split === 'object' ? o.split : {}) as Partial<Settings['split']>
  const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def)
  return {
    mode: o.mode === 'split' ? 'split' : 'merge',
    merge: {
      fileName: '',
      pageSize: mg.pageSize === 'a4' || mg.pageSize === 'first' ? mg.pageSize : d.merge.pageSize,
      bookmarks: bool(mg.bookmarks, d.merge.bookmarks),
      keepForms: bool(mg.keepForms, d.merge.keepForms),
      blankBetween: bool(mg.blankBetween, d.merge.blankBetween),
    },
    split: {
      kind: sp.kind === 'every' || sp.kind === 'selected' || sp.kind === 'single' ? sp.kind : 'ranges',
      ranges: typeof sp.ranges === 'string' ? sp.ranges.slice(0, 200) : d.split.ranges,
      every: typeof sp.every === 'number' && sp.every >= 1 ? Math.floor(sp.every) : d.split.every,
      template: typeof sp.template === 'string' && sp.template.trim() ? sp.template.slice(0, 120) : d.split.template,
    },
  }
}

export function loadSettings(): Settings {
  try {
    return parseSettings(JSON.parse(localStorage.getItem(KEY) || 'null'))
  } catch {
    return parseSettings(null)
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, merge: { ...s.merge, fileName: '' } }))
  } catch { /* private mode */ }
}
