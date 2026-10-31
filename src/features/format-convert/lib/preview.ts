// Which formats an <img> can show in every supported browser (thumbnails
// and the phone detail sheet). TIFF, HEIC, JPEG XL, PSD, TGA, QOI and RAW
// are not, so their rows show a label until a viewable output exists.
import type { AnyImageFormat } from '../../../shared/image/sniff'
import type { OutFormat } from '../types'

const VIEWABLE = new Set<string>(['jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg', 'ico'])

export function canPreview(f: AnyImageFormat | OutFormat | null): boolean {
  return f !== null && VIEWABLE.has(f)
}
