// Remembered conversion settings and the file funnel helpers. Pure enough
// to unit test (storage is injectable).
import { DEFAULT_PDF_SETTINGS, type OcrLang, type PdfSettings } from '../types'

const KEY = 'ic-pdf-settings'
const OCR_LANGS: OcrLang[] = ['chi_sim+eng', 'chi_tra+eng', 'eng', 'jpn+eng', 'kor+eng', 'deu+eng', 'fra+eng']

type Store = Pick<Storage, 'getItem' | 'setItem'>
function store(): Store | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}

/** Saved settings, field by field validated (a corrupt entry falls back). */
export function loadSettings(s: Store | null = store()): Partial<PdfSettings> {
  try {
    const raw = s?.getItem(KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as Record<string, unknown>
    const out: Partial<PdfSettings> = {}
    if (o.mode === 'editable' || o.mode === 'layout') out.mode = o.mode
    if (typeof o.keepImages === 'boolean') out.keepImages = o.keepImages
    if (typeof o.ocr === 'boolean') out.ocr = o.ocr
    if (typeof o.ocrLang === 'string' && (OCR_LANGS as string[]).includes(o.ocrLang)) out.ocrLang = o.ocrLang as OcrLang
    // The page range is per job, not remembered.
    return out
  } catch {
    return {}
  }
}

export function saveSettings(v: PdfSettings, s: Store | null = store()): void {
  try {
    const { mode, keepImages, ocr, ocrLang } = { ...DEFAULT_PDF_SETTINGS, ...v }
    s?.setItem(KEY, JSON.stringify({ mode, keepImages, ocr, ocrLang }))
  } catch { /* storage full or blocked */ }
}

export function isPdfFile(f: { name: string; type: string }): boolean {
  return f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
}

/** Same file picked twice: name + size + mtime. */
export function fileKey(f: File): string {
  return `${f.name}|${f.size}|${f.lastModified}`
}
