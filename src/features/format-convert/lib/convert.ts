// Pure logic of the format converter: what each file becomes, how outputs
// are named, which inputs are accepted, alpha handling, list counts. No
// DOM, no Vue; unit tested in tests/unit/convert-lib.test.ts.
import { gifFrameCount } from '../../../shared/image/gif'
import type { AnyImageFormat as ImageFormat } from '../../../shared/image/sniff'
import type { ConvertItem, ConvertSettings, FormatChoice, LossyFormat, OutFormat } from '../types'

/** Output formats in picker order: the everyday four, then the rest. */
export const OUT_FORMATS: readonly OutFormat[] = ['jpeg', 'png', 'webp', 'avif', 'jxl', 'gif', 'bmp', 'tiff', 'ico', 'qoi']

export const OUT_MIME: Record<OutFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  jxl: 'image/jxl',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  ico: 'image/x-icon',
  qoi: 'image/qoi',
}

export const OUT_EXT: Record<OutFormat, string> = { jpeg: 'jpg', png: 'png', webp: 'webp', avif: 'avif', jxl: 'jxl', gif: 'gif', bmp: 'bmp', tiff: 'tif', ico: 'ico', qoi: 'qoi' }

/** Short uppercase labels for the format pills (source and output). */
export const FORMAT_LABEL: Record<string, string> = {
  jpeg: 'JPEG', png: 'PNG', webp: 'WebP', avif: 'AVIF', heic: 'HEIC', gif: 'GIF', bmp: 'BMP', tiff: 'TIFF', svg: 'SVG', ico: 'ICO',
  jxl: 'JPEG XL', psd: 'PSD', qoi: 'QOI', tga: 'TGA', raw: 'RAW',
}

export const DEFAULT_QUALITY: Record<LossyFormat, number> = { jpeg: 85, webp: 82, avif: 60, jxl: 80 }

/** Output formats with a quality slider (the rest are lossless or palette). */
export const LOSSY_FORMATS: readonly LossyFormat[] = ['jpeg', 'webp', 'avif', 'jxl']
export function isLossy(f: OutFormat): f is LossyFormat {
  return (LOSSY_FORMATS as readonly string[]).includes(f)
}

/** Formats whose output keeps transparency (GIF only fully transparent pixels). */
export const ALPHA_OUT = new Set<OutFormat>(['png', 'webp', 'avif', 'jxl', 'gif', 'bmp', 'tiff', 'ico', 'qoi'])

export const ICO_SIZE_CHOICES = [16, 24, 32, 48, 64, 128, 256] as const
export const DEFAULT_ICO_SIZES = [16, 32, 48, 64, 128, 256]

export const DEFAULT_SETTINGS: ConvertSettings = {
  format: 'auto',
  quality: { ...DEFAULT_QUALITY },
  fill: '#ffffff',
  keepExif: true,
  keepName: true,
  icoSizes: [...DEFAULT_ICO_SIZES],
  tiffPages: 'all',
}

/** Inputs the pipeline decodes (browser-native or with our own decoders). */
const SUPPORTED_INPUT = new Set<ImageFormat>(['jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'bmp', 'tiff', 'svg', 'ico', 'jxl', 'psd', 'qoi', 'tga', 'raw'])

/** Sources that may be transparent before decoding (for the auto prediction). */
export const MAYBE_ALPHA_INPUT = new Set<ImageFormat>(['webp', 'gif', 'tiff', 'svg', 'ico', 'jxl', 'psd', 'qoi', 'tga'])

export function isSupportedInput(fmt: ImageFormat | null): fmt is ImageFormat {
  return fmt !== null && SUPPORTED_INPUT.has(fmt)
}

/** True for a file that is some kind of image (decides "unsupported" vs skipped). */
export function looksLikeImage(file: { name: string; type: string }, sniffed: ImageFormat | null): boolean {
  if (sniffed) return true
  if (file.type.startsWith('image/')) return true
  return /\.(tiff?|svg|ico|cur|psd|psb|raw|cr2|cr3|nef|nrw|arw|srf|sr2|dng|orf|rw2|rwl|raf|pef|srw|erf|3fr|jxl|qoi|tga|heic|heif|avif|webp|png|jpe?g|gif|bmp|dib)$/i.test(file.name)
}

/** File picker filter: image/* misses the formats browsers do not know. */
export const ACCEPT = 'image/*,.heic,.heif,.avif,.webp,.jxl,.tif,.tiff,.bmp,.dib,.ico,.cur,.svg,.psd,.psb,.qoi,.tga,.dng,.cr2,.cr3,.nef,.nrw,.arw,.srf,.sr2,.orf,.rw2,.rwl,.raf,.pef,.srw,.erf,.3fr'

/**
 * Recommended output for a source (the default until the user picks a
 * format): HEIC -> JPEG (opens everywhere), PNG or JPEG XL with real
 * transparency -> WebP (keeps it, smaller than PNG), SVG and ICO -> PNG
 * (graphics: lossless, keeps transparency), transparent TIFF / PSD / TGA /
 * QOI -> PNG (lossless sources stay lossless), everything else -> JPEG.
 * RAW previews are JPEGs already, so they stay JPEG.
 */
export function recommendFormat(src: ImageFormat | null, hasAlpha: boolean): OutFormat {
  if ((src === 'png' || src === 'jxl') && hasAlpha) return 'webp'
  if (src === 'svg' || src === 'ico') return 'png'
  if (hasAlpha && (src === 'tiff' || src === 'psd' || src === 'tga' || src === 'qoi')) return 'png'
  return 'jpeg'
}

/** What the user asked for this file (may still be 'auto'). */
export function requestedFormat(item: Pick<ConvertItem, 'override'>, s: ConvertSettings): FormatChoice {
  return item.override ?? s.format
}

/** Best guess of the output before converting (auto uses the PNG header hint). */
export function predictTarget(item: Pick<ConvertItem, 'override' | 'src' | 'mayHaveAlpha'>, s: ConvertSettings): OutFormat {
  const req = requestedFormat(item, s)
  return req === 'auto' ? recommendFormat(item.src, item.mayHaveAlpha) : req
}

export function qualityFor(s: Pick<ConvertSettings, 'quality'>, fmt: OutFormat): number | null {
  return isLossy(fmt) ? s.quality[fmt] : null
}

/**
 * Signature of everything that changes a file's output. A done item whose
 * signature differs from the current one is stale ("convert again").
 */
export function settingsSig(item: Pick<ConvertItem, 'override' | 'src' | 'mayHaveAlpha'>, s: ConvertSettings): string {
  const req = requestedFormat(item, s)
  // Auto may land on JPEG or WebP, so both qualities matter there.
  const q = req === 'auto' ? `${s.quality.jpeg}/${s.quality.webp}` : String(qualityFor(s, req) ?? '')
  const fill = req === 'auto' || req === 'jpeg' ? s.fill.toLowerCase() : ''
  const parts = [req, q, fill, s.keepExif ? 'x' : '-']
  if (req === 'ico') parts.push(normalizeIcoSizes(s.icoSizes).join(','))
  return parts.join('|')
}

/** Sorted, deduplicated, valid ICO sizes (default set when empty). */
export function normalizeIcoSizes(v: unknown): number[] {
  const ok = Array.isArray(v) ? v.filter((n): n is number => typeof n === 'number' && (ICO_SIZE_CHOICES as readonly number[]).includes(n)) : []
  const out = [...new Set(ok)].sort((a, b) => a - b)
  return out.length ? out : [...DEFAULT_ICO_SIZES]
}

export function baseOf(name: string): string {
  return name.replace(/\.[^./]+$/, '') || name
}

/**
 * Output file name: same base + new extension, or "-converted" when
 * keepName is off; pages of a multi-page TIFF get "-p2", "-p3", ….
 */
export function outputName(name: string, fmt: OutFormat, keepName: boolean, page = 0, pages = 1): string {
  const pg = pages > 1 ? `-p${page + 1}` : ''
  return `${baseOf(name)}${pg}${keepName ? '' : '-converted'}.${OUT_EXT[fmt]}`
}

/**
 * Make output paths unique inside one batch: the second "a.jpg" in the
 * same folder becomes "a (1).jpg", the third "a (2).jpg".
 */
export function uniqueOutNames(entries: { dir: string; name: string }[]): string[] {
  const used = new Set<string>()
  return entries.map(({ dir, name }) => {
    const dot = name.lastIndexOf('.')
    const stem = dot > 0 ? name.slice(0, dot) : name
    const ext = dot > 0 ? name.slice(dot) : ''
    let candidate = name
    let n = 1
    while (used.has(`${dir}/${candidate}`.toLowerCase())) candidate = `${stem} (${n++})${ext}`
    used.add(`${dir}/${candidate}`.toLowerCase())
    return candidate
  })
}

const ascii = (b: Uint8Array, at: number, len: number) => String.fromCharCode(...b.subarray(at, at + len))
const be32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0

/** PNG header hint: an alpha colour type, or a tRNS chunk before IDAT. */
export function pngMayHaveAlpha(b: Uint8Array): boolean {
  if (b.length < 33 || b[0] !== 0x89 || ascii(b, 12, 4) !== 'IHDR') return false
  const colorType = b[25]
  if (colorType === 4 || colorType === 6) return true
  let o = 8
  while (o + 8 <= b.length) {
    const len = be32(b, o)
    const type = ascii(b, o + 4, 4)
    if (type === 'tRNS') return true
    if (type === 'IDAT' || type === 'IEND') return false
    o += 12 + len
  }
  return false
}

/** Animated GIF / WebP / APNG (only the first frame is converted). */
export function isAnimated(b: Uint8Array, fmt: ImageFormat | null): boolean {
  if (fmt === 'gif') return gifFrameCount(b) > 1
  if (fmt === 'webp') {
    if (b.length < 21 || ascii(b, 12, 4) !== 'VP8X') return false
    return (b[20] & 0x02) !== 0
  }
  if (fmt === 'png') {
    let o = 8
    while (o + 8 <= b.length) {
      const len = be32(b, o)
      const type = ascii(b, o + 4, 4)
      if (type === 'acTL') return true
      if (type === 'IDAT' || type === 'IEND') return false
      o += 12 + len
    }
  }
  return false
}

/** '#abc' / 'abc' / '#AABBCC' -> '#aabbcc'; null when not a colour. */
export function normalizeHex(input: string): string | null {
  const s = input.trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{3}$/.test(s)) return '#' + s.split('').map((c) => c + c).join('')
  if (/^[0-9a-f]{6}$/.test(s)) return '#' + s
  return null
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = normalizeHex(hex) ?? '#ffffff'
  return [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16)]
}

/** Any pixel not fully opaque (RGBA, unpremultiplied). */
export function hasAlpha(data: Uint8ClampedArray | Uint8Array): boolean {
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true
  return false
}

/**
 * Composite RGBA pixels over a solid colour in place (source-over on
 * straight alpha), leaving every pixel opaque. Semi-transparent edges blend
 * into the fill instead of turning dark. Returns whether anything changed.
 */
export function flattenAlpha(data: Uint8ClampedArray | Uint8Array, fill: string): boolean {
  const [fr, fg, fb] = hexToRgb(fill)
  let changed = false
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a === 255) continue
    changed = true
    const k = a / 255
    data[i] = Math.round(data[i] * k + fr * (1 - k))
    data[i + 1] = Math.round(data[i + 1] * k + fg * (1 - k))
    data[i + 2] = Math.round(data[i + 2] * k + fb * (1 - k))
    data[i + 3] = 255
  }
  return changed
}

/** `?to=webp` (also jpg / tif / jpegxl aliases) -> output format. */
export function formatFromParam(to: string | undefined): OutFormat | null {
  const v = (to || '').toLowerCase()
  if (v === 'jpg' || v === 'jpeg') return 'jpeg'
  if (v === 'tif') return 'tiff'
  if (v === 'jpegxl' || v === 'jpeg-xl') return 'jxl'
  return (OUT_FORMATS as readonly string[]).includes(v) ? (v as OutFormat) : null
}

/** Label for a source pill: sniffed format, else the file extension. */
export function sourceLabel(src: ImageFormat | null, name: string): string {
  if (src) return FORMAT_LABEL[src] ?? src.toUpperCase()
  const m = /\.([a-z0-9]{2,5})$/i.exec(name)
  return m ? m[1].toUpperCase() : '?'
}

export interface Counts {
  total: number
  done: number
  running: number
  failed: number
  unsupported: number
  inBytes: number
  outBytes: number
}

/** Status strip numbers; sizes cover finished files only. */
export function countItems(items: Pick<ConvertItem, 'status' | 'file' | 'outBlob'>[]): Counts {
  const c: Counts = { total: items.length, done: 0, running: 0, failed: 0, unsupported: 0, inBytes: 0, outBytes: 0 }
  for (const it of items) {
    if (it.status === 'done' && it.outBlob) {
      c.done++
      c.inBytes += it.file.size
      c.outBytes += it.outBlob.size
    } else if (it.status === 'queued' || it.status === 'converting') c.running++
    else if (it.status === 'error') c.failed++
    else if (it.status === 'unsupported') c.unsupported++
  }
  return c
}

/** Same-format conversion (JPEG -> JPEG): re-encoded at the chosen quality. */
export function isSameFormat(src: ImageFormat | null, out: OutFormat): boolean {
  return src === out
}

/** Whether the output carries EXIF (others drop it: the "not kept" note). */
export function canCarryExif(f: OutFormat): boolean {
  return f === 'jpeg' || f === 'png' || f === 'webp'
}

/** Encoder quality range: 1–100, integers. */
export function clampQuality(q: number): number {
  if (!Number.isFinite(q)) return 80
  return Math.min(100, Math.max(1, Math.round(q)))
}
