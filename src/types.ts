export type View = 'orig' | 'comp'

export interface CompressItem {
  id: string
  file: File
  url: string
  outUrl: string | null
  outName: string | null
  outSize: number
  origW: number
  origH: number
  outW: number
  outH: number
  view: View
  error: string | null
  // A user cancellation is not a failure: the row keeps a neutral pill and a
  // muted note, with Retry available.
  cancelled: boolean
  // False for deterministic failures (pixel cap): omit the Retry action.
  retryable: boolean
  done: boolean
  targetNote: string | null
  typeNote: string | null
  // Final output type (after any fallback flip), whether any pixel was
  // transparent, and whether the input was an animated GIF. All three
  // arrive with the compress result; defaults cover pre-result items.
  outType: string | null
  hasAlpha: boolean
  isAnimatedGif: boolean
  // Settings snapshot the item's CURRENT result was computed under
  // (null until its first successful compress). recompressAll compares
  // each item against its own snapshot, so interleaved runs can't
  // wrongly skip an item whose displayed result predates the snapshot.
  lastSettings: Settings | null
  // Folder the file came from when a directory was dropped ('' otherwise);
  // the zip keeps this structure.
  relDir: string
}

export interface Settings {
  // 'auto' picks per image from its pixels (photo -> WebP, few colors ->
  // palette PNG, transparency kept); 'original' keeps the input's own
  // format; anything else is an output MIME type.
  format: string
  // How quality is chosen, independent of the format: 'auto' searches the
  // lowest quality whose SSIM against the source stays above a threshold;
  // 'quality' is a fixed value; 'target' fits a file-size cap.
  mode: 'auto' | 'quality' | 'target'
  targetSize: number
  quality: number
  maxSize: number
  // How maxSize is read: longest side (default), exact width, exact height,
  // a percent of the original size, or 'exact': scale to cover
  // maxSize x maxHeight and center-crop (ID photos).
  resizeMode: 'longest' | 'width' | 'height' | 'percent' | 'exact'
  // Height for resizeMode 'exact' (ignored otherwise).
  maxHeight: number
  noUpscale: boolean
  quantize: boolean
  keepExif: boolean
  // JPEG fill for transparent pixels (default white); empty = white.
  jpegFill: string
  // Download names without the -compressed suffix.
  keepOriginalName: boolean
}

export function newItem(file: File, relDir = ''): CompressItem {
  return {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    file,
    url: URL.createObjectURL(file),
    outUrl: null,
    outName: null,
    outSize: 0,
    origW: 0,
    origH: 0,
    outW: 0,
    outH: 0,
    view: 'orig',
    error: null,
    cancelled: false,
    retryable: true,
    done: false,
    targetNote: null,
    typeNote: null,
    outType: null,
    hasAlpha: false,
    isAnimatedGif: false,
    lastSettings: null,
    relDir,
  }
}
