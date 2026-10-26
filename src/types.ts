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
}

export interface Settings {
  format: string
  mode: 'quality' | 'target'
  targetSize: number
  quality: number
  maxSize: number
  noUpscale: boolean
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
  }
}
