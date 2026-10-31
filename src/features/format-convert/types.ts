import type { AnyImageFormat as ImageFormat } from '../../shared/image/sniff'

/** Output formats. */
export type OutFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'jxl' | 'gif' | 'bmp' | 'tiff' | 'ico' | 'qoi'
/** 'auto' = recommended by source until the user picks a format. */
export type FormatChoice = 'auto' | OutFormat
export type LossyFormat = 'jpeg' | 'webp' | 'avif' | 'jxl'
/** Multi-page TIFF: one row per page, or the first page only. */
export type TiffPages = 'all' | 'first'

export interface ConvertSettings {
  format: FormatChoice
  /** Quality per lossy format (remembered separately). */
  quality: Record<LossyFormat, number>
  /** Fill for transparent areas when the output is JPEG (#rrggbb). */
  fill: string
  keepExif: boolean
  keepName: boolean
  /** ICO output sizes (px, square). */
  icoSizes: number[]
  tiffPages: TiffPages
}

export type ItemStatus = 'queued' | 'converting' | 'done' | 'error' | 'unsupported' | 'cancelled'

/** Row notes, rendered through the feature dictionary. */
export type NoteKey = 'filled' | 'firstFrame' | 'exifKept' | 'exifAvif' | 'sameFormat' | 'p3Kept'
  | 'rawPreview' | 'svgRaster' | 'icoLargest' | 'psdComposite' | 'psdEmpty' | 'gifAlpha' | 'gifColors' | 'icoSizes' | 'tiffPage'

/** EXIF outcome of one conversion ('avif' = the output format cannot carry EXIF). */
export type ExifOutcome = 'kept' | 'none' | 'off' | 'avif'

export interface ConvertItem {
  id: string
  file: File
  /** Folder path from a folder drop ('' for loose files); kept in the zip. */
  dir: string
  /** Sniffed source format (bytes, not the name); null = unknown. */
  src: ImageFormat | null
  /** Header hint: a PNG whose IHDR/tRNS says it can be transparent. */
  mayHaveAlpha: boolean
  status: ItemStatus
  /** Per-file format from the detail sheet ("change to PNG"). */
  override: OutFormat | null
  /** Output format of the last (or running) conversion. */
  target: OutFormat
  /** Preview of the source (null for HEIC, which browsers cannot show). */
  srcUrl: string | null
  outBlob: Blob | null
  outUrl: string | null
  outName: string
  width: number
  height: number
  quality: number | null
  notes: NoteKey[]
  exif: ExifOutcome | null
  /** Error key in the feature dictionary. */
  error: string | null
  retryable: boolean
  /** Multi-page TIFF: 0-based page of this row, and the file's page count. */
  page: number
  pages: number
  /** ICO output: the sizes written. */
  icoSizes: number[]
  /** Settings signature the result was made with (stale detection). */
  sig: string
  /** Bumped per run: a late result of an older run is ignored. */
  gen: number
  /** JPEG fill colour the result was made with (for its note). */
  fill: string
}

export interface ConvertJobPayload {
  file: File
  src: ImageFormat
  /** Requested output; 'auto' resolves inside the job after the alpha scan. */
  format: FormatChoice
  quality: Record<LossyFormat, number>
  fill: string
  keepExif: boolean
  /** TIFF page to convert (0-based). */
  page: number
  icoSizes: number[]
}

export interface ConvertJobResult {
  blob: Blob
  format: OutFormat
  width: number
  height: number
  quality: number | null
  hasAlpha: boolean
  filled: boolean
  animated: boolean
  exif: ExifOutcome
  p3: boolean
  /** Source/output notes beyond the flags above (RAW preview, SVG raster, …). */
  extra: NoteKey[]
  /** ICO output: the sizes written. */
  icoSizes: number[]
}
