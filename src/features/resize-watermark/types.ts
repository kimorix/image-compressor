// Resize & watermark: settings and list item shapes. Settings are plain
// JSON (persisted, and structured-cloned into the image-pool worker).

export type ResizeMode = 'long' | 'box' | 'pct' | 'preset'
export type FitMode = 'contain' | 'pad' | 'cover'

export interface ResizeSettings {
  enabled: boolean
  mode: ResizeMode
  long: number
  w: number
  h: number
  lockRatio: boolean
  fit: FitMode
  pct: number
  /** Preset id last picked (preset mode, or a quick preset in box mode). */
  preset: string
  noUpscale: boolean
  /** Fill colour for pad mode and for flattening transparency into JPG. */
  padColor: string
  /** Pad with transparency when the output format keeps alpha. */
  padTransparent: boolean
}

export type WmKind = 'text' | 'logo'
/** Nine-grid anchors, plus free (dragged) and tiled. */
export type WmPos = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br' | 'free' | 'tile'
export type WmFont = 'sans' | 'serif' | 'mono' | 'kai'

export interface WatermarkSettings {
  enabled: boolean
  kind: WmKind
  text: string
  font: WmFont
  bold: boolean
  color: string
  /** Outline + soft shadow for legibility on busy or light backgrounds. */
  stroke: boolean
  pos: WmPos
  /** Free position: centre of the mark relative to the output (0–1). */
  x: number
  y: number
  /** Text height (% of the output's short side, 2–20). */
  size: number
  /** Logo width (% of the output's short side, 5–50). */
  logoSize: number
  /** 10–100 (%). */
  opacity: number
  /** -90–90 degrees. */
  rotate: number
  /** Edge margin (% of short side, 0–10). */
  margin: number
  /** Tile gap (% of short side, 2–40). */
  tileGap: number
}

export type OutFormat = 'follow' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif'

export interface OutputSettings {
  format: OutFormat
  quality: number
  keepExif: boolean
  /** File-name suffix; {w} and {h} are replaced by the output size. */
  suffix: string
}

export interface RwSettings {
  resize: ResizeSettings
  wm: WatermarkSettings
  out: OutputSettings
}

/** Framing for cover crops: where the crop window sits (0–1, 0.5 = centre). */
export interface Focus { x: number; y: number }

export type RwStatus = 'probing' | 'ready' | 'queued' | 'processing' | 'done' | 'stale' | 'error'

export interface RwItem {
  id: string
  file: File
  status: RwStatus
  /** Upright (EXIF-corrected) size; 0 until probed. */
  w: number
  h: number
  /** Format sniffed from the bytes ('jpeg', 'heic', …). */
  format: string
  thumb: string | null
  /** EXIF orientation was not 1 (the pixels are shown upright). */
  oriented: boolean
  gifFrames: number
  /** Capture date (EXIF) for the {date} variable, YYYY-MM-DD. */
  date: string | null
  focus: Focus
  /** Bumped when this item's framing changes (stale detection). */
  focusRev: number
  outBlob: Blob | null
  outUrl: string | null
  outName: string
  outW: number
  outH: number
  notes: string[]
  error: string | null
}
