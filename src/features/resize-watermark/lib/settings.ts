// Defaults, persistence (localStorage key resize.settings.v1, no logo
// bytes) and small pure helpers shared by the view and the worker job.
import type { ImageFormat } from '../../../shared/image/sniff'
import type { OutFormat, RwSettings } from '../types'

export const SETTINGS_KEY = 'resize.settings.v1'

export function defaultSettings(): RwSettings {
  return {
    resize: {
      enabled: true,
      mode: 'long',
      long: 2048,
      w: 1080,
      h: 1080,
      lockRatio: false,
      fit: 'cover',
      pct: 50,
      preset: 'xhs34',
      noUpscale: true,
      padColor: '#ffffff',
      padTransparent: false,
    },
    wm: {
      enabled: false,
      kind: 'text',
      text: '',
      font: 'sans',
      bold: true,
      color: '#ffffff',
      stroke: true,
      pos: 'br',
      x: 0.5,
      y: 0.5,
      size: 4,
      logoSize: 18,
      opacity: 80,
      rotate: 0,
      margin: 3,
      tileGap: 12,
    },
    out: {
      format: 'follow',
      quality: 85,
      keepExif: true,
      suffix: '_{w}x{h}',
    },
  }
}

const clamp = (v: unknown, lo: number, hi: number, d: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : d
  return Math.min(hi, Math.max(lo, n))
}
const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T =>
  (allowed as readonly unknown[]).includes(v) ? (v as T) : d
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)
const str = (v: unknown, d: string, max = 200) => (typeof v === 'string' ? v.slice(0, max) : d)
const color = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d)

/** Validate a stored/foreign object field by field; anything bad falls back. */
export function normalizeSettings(raw: unknown): RwSettings {
  const d = defaultSettings()
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, Record<string, unknown> | undefined>
  const r = o.resize ?? {}
  const w = o.wm ?? {}
  const u = o.out ?? {}
  return {
    resize: {
      enabled: bool(r.enabled, d.resize.enabled),
      mode: pick(r.mode, ['long', 'box', 'pct', 'preset'] as const, d.resize.mode),
      long: Math.round(clamp(r.long, 1, 16384, d.resize.long)),
      w: Math.round(clamp(r.w, 1, 16384, d.resize.w)),
      h: Math.round(clamp(r.h, 1, 16384, d.resize.h)),
      lockRatio: bool(r.lockRatio, d.resize.lockRatio),
      fit: pick(r.fit, ['contain', 'pad', 'cover'] as const, d.resize.fit),
      pct: Math.round(clamp(r.pct, 1, 400, d.resize.pct)),
      preset: str(r.preset, d.resize.preset, 32),
      noUpscale: bool(r.noUpscale, d.resize.noUpscale),
      padColor: color(r.padColor, d.resize.padColor),
      padTransparent: bool(r.padTransparent, d.resize.padTransparent),
    },
    wm: {
      enabled: bool(w.enabled, d.wm.enabled),
      kind: pick(w.kind, ['text', 'logo'] as const, d.wm.kind),
      text: str(w.text, d.wm.text),
      font: pick(w.font, ['sans', 'serif', 'mono', 'kai'] as const, d.wm.font),
      bold: bool(w.bold, d.wm.bold),
      color: color(w.color, d.wm.color),
      stroke: bool(w.stroke, d.wm.stroke),
      pos: pick(w.pos, ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br', 'free', 'tile'] as const, d.wm.pos),
      x: clamp(w.x, 0, 1, d.wm.x),
      y: clamp(w.y, 0, 1, d.wm.y),
      size: clamp(w.size, 2, 20, d.wm.size),
      logoSize: clamp(w.logoSize, 5, 50, d.wm.logoSize),
      opacity: Math.round(clamp(w.opacity, 10, 100, d.wm.opacity)),
      rotate: Math.round(clamp(w.rotate, -90, 90, d.wm.rotate)),
      margin: clamp(w.margin, 0, 10, d.wm.margin),
      tileGap: clamp(w.tileGap, 2, 40, d.wm.tileGap),
    },
    out: {
      format: pick(u.format, ['follow', 'image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const, d.out.format),
      quality: Math.round(clamp(u.quality, 1, 100, d.out.quality)),
      keepExif: bool(u.keepExif, d.out.keepExif),
      suffix: str(u.suffix, d.out.suffix, 60).replace(/[\\/:*?"<>|]/g, ''),
    },
  }
}

type Store = Pick<Storage, 'getItem' | 'setItem'>
function store(): Store | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}

export function loadSettings(s: Store | null = store()): RwSettings {
  try {
    const raw = s?.getItem(SETTINGS_KEY)
    return normalizeSettings(raw ? JSON.parse(raw) : null)
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(v: RwSettings, s: Store | null = store()): void {
  try { s?.setItem(SETTINGS_KEY, JSON.stringify(v)) } catch { /* quota / private mode */ }
}

/**
 * Output MIME type. "Follow the original" keeps JPEG/PNG/WebP/AVIF, turns
 * HEIC into JPG and GIF (first frame) into PNG; anything else the encoders
 * cannot write (BMP, TIFF, ICO, SVG) becomes PNG.
 */
export function resolveOutType(format: OutFormat, src: ImageFormat | string | null): string {
  if (format !== 'follow') return format
  switch (src) {
    case 'jpeg': return 'image/jpeg'
    case 'webp': return 'image/webp'
    case 'avif': return 'image/avif'
    case 'heic': return 'image/jpeg'
    default: return 'image/png'
  }
}

export const OUT_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }

/** "photo.heic" + "_{w}x{h}" at 1080×1440 as JPG → "photo_1080x1440.jpg". */
export function outputName(name: string, suffix: string, w: number, h: number, type: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'image'
  const sfx = suffix.replace(/\{w\}/g, String(w)).replace(/\{h\}/g, String(h))
  return `${base}${sfx}.${OUT_EXT[type] ?? 'png'}`
}

/** Output types that keep an alpha channel. */
export function keepsAlpha(type: string): boolean {
  return type !== 'image/jpeg'
}
