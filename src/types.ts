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
}

export interface Settings {
  format: string
  mode: 'quality' | 'target' | 'smart'
  targetSize: number
  quality: number
  maxSize: number
  // How maxSize is read: longest side (default), exact width, exact height,
  // or a percent of the original size.
  resizeMode: 'longest' | 'width' | 'height' | 'percent'
  noUpscale: boolean
  quantize: boolean
  keepExif: boolean
  // JPEG fill for transparent pixels (default white); empty = white.
  jpegFill: string
  // Smart mode: keep the input's own format instead of auto-picking
  // WebP/PNG. Quality/size rules still apply (q80, resize, PNG quantize).
  smartKeepOriginal: boolean
}

export function newItem(file: File): CompressItem {
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
    done: false,
    targetNote: null,
    typeNote: null,
    outType: null,
    hasAlpha: false,
    isAnimatedGif: false,
    lastSettings: null,
  }
}
