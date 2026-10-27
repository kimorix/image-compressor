import { describe, expect, it } from 'vitest'
import { fileKey, isPdfFile, loadSettings, saveSettings } from '../../src/features/pdf-to-word/lib/settings'
import { DEFAULT_PDF_SETTINGS } from '../../src/features/pdf-to-word/types'
import { PDF_MESSAGES, pdfT } from '../../src/features/pdf-to-word/i18n'
import { docxName } from '../../src/features/pdf-to-word/lib/convert'

function mem() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }
}

describe('pdf settings store', () => {
  it('round-trips everything but the page range', () => {
    const s = mem()
    saveSettings({ ...DEFAULT_PDF_SETTINGS, mode: 'layout', ocr: true, ocrLang: 'jpn+eng', pageRange: '1-2', keepImages: false }, s)
    expect(loadSettings(s)).toEqual({ mode: 'layout', ocr: true, ocrLang: 'jpn+eng', keepImages: false })
  })
  it('ignores corrupt or unknown values', () => {
    const s = mem()
    s.setItem('ic-pdf-settings', '{"mode":"weird","ocr":"yes","ocrLang":"xx"}')
    expect(loadSettings(s)).toEqual({})
    s.setItem('ic-pdf-settings', 'not json')
    expect(loadSettings(s)).toEqual({})
  })
  it('accepts PDFs by type or extension', () => {
    expect(isPdfFile({ name: 'a.PDF', type: '' })).toBe(true)
    expect(isPdfFile({ name: 'scan', type: 'application/pdf' })).toBe(true)
    expect(isPdfFile({ name: 'a.docx', type: 'application/msword' })).toBe(false)
    const f = new File([new Uint8Array(3)], 'x.pdf', { lastModified: 5 })
    expect(fileKey(f)).toBe('x.pdf|3|5')
    expect(docxName('报告.final.pdf')).toBe('报告.final.docx')
    expect(docxName('.pdf')).toBe('document.docx')
  })
})

describe('pdf i18n', () => {
  it('every language has every key', () => {
    const keys = Object.keys(PDF_MESSAGES.zh).sort()
    for (const [lang, msgs] of Object.entries(PDF_MESSAGES)) expect(Object.keys(msgs).sort(), lang).toEqual(keys)
  })
  it('formats with arguments and falls back to the key', () => {
    expect(pdfT('zh', 'stConverting', 9, 15)).toBe('转换中 第 9/15 页')
    expect(pdfT('en', 'found', 12, 8, 2)).toBe('12 headings · 8 images · 2 tables')
    expect(pdfT('de', 'nope')).toBe('nope')
  })
})
