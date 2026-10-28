// Shared model of the PDF to Word feature. Everything that crosses the
// docx worker boundary is plain data (structured-clone safe): no pdf.js
// objects, no Vue proxies.

/** Output style: reflowed editable text, or each page laid out as in the PDF. */
export type ConvertMode = 'editable' | 'layout'

export type OcrLang = 'chi_sim+eng' | 'chi_tra+eng' | 'eng' | 'jpn+eng' | 'kor+eng' | 'deu+eng' | 'fra+eng'

export interface PdfSettings {
  mode: ConvertMode
  /** "" = every page, otherwise "1-3,5". */
  pageRange: string
  keepImages: boolean
  ocr: boolean
  /** Defaults to the UI language + English (see defaultOcrLang). */
  ocrLang: OcrLang
  /** The user chose ocrLang themselves: keep it, do not follow the UI language. */
  ocrLangPicked?: boolean
}

export const DEFAULT_PDF_SETTINGS: PdfSettings = {
  mode: 'editable',
  pageRange: '',
  keepImages: true,
  ocr: false,
  ocrLang: 'chi_sim+eng',
}

/**
 * One positioned run of text, in PDF points with a top-left origin
 * (y is the top of the glyph box, not the baseline).
 */
export interface TextItem {
  str: string
  x: number
  y: number
  w: number
  h: number
  /** Font size in points. */
  size: number
  bold: boolean
  italic: boolean
}

/** An image cropped from the rendered page, PNG/JPEG bytes. */
export interface PageImage {
  x: number
  y: number
  w: number
  h: number
  data: Uint8Array
  type: 'png' | 'jpg'
}

export interface PageModel {
  /** 1-based page number in the source PDF. */
  num: number
  width: number
  height: number
  items: TextItem[]
  images: PageImage[]
  /** Whole-page picture: scanned page kept as an image (layout mode, no OCR). */
  background?: PageImage
  /** Text came from OCR. */
  ocr?: boolean
}

export interface ConvertStats {
  pages: number
  headings: number
  images: number
  tables: number
  lists: number
  twoColumnPages: number
  ocrPages: number
  /** Pages with no text left as pictures. */
  imagePages: number
}

export type PdfKind = 'text' | 'scanned' | 'unknown'

export type ItemStatus = 'probing' | 'ready' | 'locked' | 'queued' | 'converting' | 'done' | 'error' | 'cancelled'

export interface PdfItem {
  id: string
  file: File
  status: ItemStatus
  pages: number
  kind: PdfKind
  /** Object URL of a page-1 thumbnail. */
  thumb: string | null
  password: string
  /** Wrong password entered last time. */
  badPassword: boolean
  /** Progress 0..1 and the page being worked on. */
  progress: number
  pageNow: number
  pageTotal: number
  phase: 'read' | 'ocr' | 'build' | ''
  outBlob: Blob | null
  outUrl: string | null
  outName: string
  stats: ConvertStats | null
  /** Mode used for the output. */
  outMode: ConvertMode | null
  error: string | null
  warnings: string[]
}
