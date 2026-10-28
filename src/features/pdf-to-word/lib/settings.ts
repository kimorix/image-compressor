// Remembered conversion settings and the file funnel helpers. Pure enough
// to unit test (storage is injectable).
import type { Lang } from '../../../shared/i18n'
import { DEFAULT_PDF_SETTINGS, type OcrLang, type PdfSettings } from '../types'

const KEY = 'ic-pdf-settings'
export const OCR_LANGS: OcrLang[] = ['chi_sim+eng', 'chi_tra+eng', 'eng', 'jpn+eng', 'kor+eng', 'deu+eng', 'fra+eng']

const UI_OCR_LANG: Record<Lang, OcrLang> = {
  zh: 'chi_sim+eng',
  en: 'eng',
  ja: 'jpn+eng',
  ko: 'kor+eng',
  de: 'deu+eng',
  fr: 'fra+eng',
}

/** Until the user picks one, OCR reads the UI language plus English (English alone for an English UI). */
export function defaultOcrLang(ui: Lang): OcrLang {
  return UI_OCR_LANG[ui] ?? 'eng'
}

// First-use download of the OCR engine and each language's data (MB as
// served by jsDelivr: tesseract.js 7 worker + core wasm, and
// @tesseract.js-data/<lang>/4.0.0_best_int/<lang>.traineddata.gz). Cached
// by the browser afterwards.
const OCR_ENGINE_MB = 4.0
const OCR_LANG_MB: Record<string, number> = { eng: 2.95, chi_sim: 1.72, chi_tra: 1.66, jpn: 2.03, kor: 1.57, deu: 1.33, fra: 0.71 }

/** Approximate first-use OCR download for a language choice, whole MB. */
export function ocrDownloadMB(lang: OcrLang): number {
  const data = lang.split('+').reduce((n, l) => n + (OCR_LANG_MB[l] ?? 0), 0)
  return Math.max(1, Math.round(OCR_ENGINE_MB + data))
}

/**
 * Files converted at once: 2 on a desktop-sized screen with at least four
 * cores, 1 on phones (memory: each conversion holds a rendered page and its
 * own docx worker).
 */
export function pdfConcurrency(env: { innerWidth?: number; hardwareConcurrency?: number } = {}): number {
  return (env.innerWidth ?? 0) >= 720 && (env.hardwareConcurrency ?? 0) >= 4 ? 2 : 1
}

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
    // The language is remembered only once the user picked one; otherwise it
    // follows the UI language (defaultOcrLang).
    if (o.ocrLangPicked === true && typeof o.ocrLang === 'string' && (OCR_LANGS as string[]).includes(o.ocrLang)) {
      out.ocrLang = o.ocrLang as OcrLang
      out.ocrLangPicked = true
    }
    // The page range is per job, not remembered.
    return out
  } catch {
    return {}
  }
}

export function saveSettings(v: PdfSettings, s: Store | null = store()): void {
  try {
    const { mode, keepImages, ocr, ocrLang, ocrLangPicked } = { ...DEFAULT_PDF_SETTINGS, ...v }
    s?.setItem(KEY, JSON.stringify(ocrLangPicked ? { mode, keepImages, ocr, ocrLang, ocrLangPicked: true } : { mode, keepImages, ocr }))
  } catch { /* storage full or blocked */ }
}

export function isPdfFile(f: { name: string; type: string }): boolean {
  return f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
}

/** Same file picked twice: name + size + mtime. */
export function fileKey(f: File): string {
  return `${f.name}|${f.size}|${f.lastModified}`
}
