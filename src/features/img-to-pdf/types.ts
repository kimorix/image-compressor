// Images to PDF: settings and page items. Everything here is plain data;
// File objects live in a shallowRef in the view (never deep-reactive).
import type { ImageFormat } from '../../shared/image/sniff'
import type { PageRotation } from '../../shared/components/page-grid'

export type OutputMode = 'single' | 'perImage'
export type Paper = 'a4' | 'letter' | 'fit'
export type Orientation = 'auto' | 'portrait' | 'landscape'
export type Margin = 'none' | 'small' | 'medium' | 'large'
export type Quality = 'original' | 'balanced' | 'small'

export interface Img2PdfSettings {
  output: OutputMode
  paper: Paper
  orientation: Orientation
  margin: Margin
  quality: Quality
  /** JPEG quality 1–100 for balanced / small (advanced slider). */
  jpegQuality: number
  /** Longest edge in px for balanced / small (advanced input). */
  maxEdge: number
}

export type PageStatus = 'loading' | 'ready' | 'error'

export interface PageItem {
  id: string
  file: File
  name: string
  /** Sniffed from the bytes (null = unknown, the browser may still decode it). */
  format: ImageFormat | null
  /** Displayed size in px after EXIF orientation, before the user's rotation. */
  w: number
  h: number
  /** User rotation, clockwise, on top of EXIF orientation. */
  rotation: PageRotation
  /** Paper-preview thumbnail (object URL, ≤ 360 px, white behind alpha). */
  thumb: string | null
  status: PageStatus
  hasAlpha: boolean
  /** Animated GIF: only the first frame goes into the PDF. */
  animated: boolean
  /** Pasted from the clipboard (generic "image.png" name, not used for the default file name). */
  pasted?: boolean
  error?: string
}

/** One finished output file. */
export interface OutFile {
  name: string
  blob: Blob
  pages: number
}

export interface BuildNotes {
  heic: number
  landscape: number
  skipped: number
  downscaled: number
  firstFrame: number
}

export interface BuildResult {
  mode: OutputMode
  files: OutFile[]
  /** Sum of the source files that made it into the output. */
  sourceBytes: number
  /** Total output bytes (all files). */
  bytes: number
  pages: number
  notes: BuildNotes
  /** Snapshot of the settings used (for the "A4 · small margin" line). */
  settings: Img2PdfSettings
  /** Thumbnails of the pages in order, for the result preview strip. */
  thumbs: { thumb: string | null; rotation: PageRotation; w: number; h: number }[]
}
