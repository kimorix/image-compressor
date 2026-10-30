// PDF merge / split data model. Sources keep the File (never its bytes):
// every write reads fresh bytes and transfers them to the worker, so the
// main thread never holds a second copy of a large PDF.
import type { PageRotation } from '../../shared/components/page-grid'

export type SrcStatus = 'probing' | 'ready' | 'locked' | 'error'

export interface SrcFile {
  id: string
  file: File
  name: string
  /** Page count (0 until probed). */
  pages: number
  /** Index into the colour palette (stable for the file's lifetime). */
  color: number
  status: SrcStatus
  /** Opens without a password but carries an owner (permissions) password. */
  ownerLocked: boolean
  hasForm: boolean
  xfa: boolean
  hasOutline: boolean
  /** Width / height of page 1 as displayed (after its own /Rotate). */
  aspect: number
}

/** One page of the working document: a source page plus the user's edits. */
export interface PageRef {
  key: string
  src: string
  /** 0-based page index in the source file. */
  index: number
  /** Rotation added by the user, clockwise, on top of the page's own /Rotate. */
  rotate: PageRotation
  /** Soft-deleted: shown dimmed until undone, never written. */
  deleted?: boolean
}

export type Mode = 'merge' | 'split'
export type PageSizeMode = 'keep' | 'a4' | 'first'
export type SplitKind = 'ranges' | 'every' | 'selected' | 'single'

export interface MergeSettings {
  /** Output file name without extension; '' = automatic (first file + suffix). */
  fileName: string
  pageSize: PageSizeMode
  bookmarks: boolean
  keepForms: boolean
  /** Pad a file with an odd page count with one blank page (duplex printing). */
  blankBetween: boolean
}

export interface SplitSettings {
  kind: SplitKind
  ranges: string
  every: number
  /** `{name}`, `{range}`, `{n}` placeholders; '.pdf' is added. */
  template: string
}

export interface Settings {
  mode: Mode
  merge: MergeSettings
  split: SplitSettings
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'merge',
  merge: { fileName: '', pageSize: 'keep', bookmarks: true, keepForms: true, blankBetween: false },
  split: { kind: 'ranges', ranges: '', every: 2, template: '{name}_{range}' },
}

/** One finished output file. */
export interface OutFile {
  name: string
  blob: Blob
  url: string
  pages: number
  /** Source colour for the row dot. */
  color: number
  /** Path inside the ZIP (split of several files: one folder per file). */
  path: string
}

export interface RunResult {
  kind: Mode
  files: OutFile[]
  ms: number
  warnings: string[]
}
