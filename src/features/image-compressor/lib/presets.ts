import type { Settings } from '../types'

// The settings the app starts with. Smart format + smart quality is the
// default: most users just want smaller files, not format/quality homework.
export const DEFAULT_SETTINGS: Settings = {
  format: 'auto',
  mode: 'auto',
  targetSize: 200,
  quality: 80,
  maxSize: 1920,
  maxHeight: 0,
  resizeMode: 'longest',
  noUpscale: true,
  quantize: true,
  keepExif: false,
  jpegFill: '#ffffff',
  keepOriginalName: false,
}

// Standard ID photo sizes at 300 dpi: 1 inch 25x35mm, 2 inch 35x49mm.
export const ID_SIZES = [
  { id: 'id1', w: 295, h: 413 },
  { id: 'id2', w: 413, h: 579 },
]

// One-tap scenes: WeChat chat images (JPEG, 1920), WeChat article images
// (JPEG, 900px body width), ID photos (1 inch crop, JPEG <= 200KB),
// website/blog images (WebP, 1600px), email attachments (target mode,
// 1000KB cap: safely under a decimal 1MB, where 1024KB would overshoot).
export const PRESETS: { id: string; patch: Partial<Settings> }[] = [
  { id: 'wechat', patch: { format: 'image/jpeg', mode: 'quality', quality: 85, maxSize: 1920, resizeMode: 'longest' } },
  { id: 'article', patch: { format: 'image/jpeg', mode: 'quality', quality: 85, maxSize: 900, resizeMode: 'longest' } },
  { id: 'idphoto', patch: { format: 'image/jpeg', mode: 'target', targetSize: 200, resizeMode: 'exact', maxSize: 295, maxHeight: 413 } },
  { id: 'website', patch: { format: 'image/webp', mode: 'quality', quality: 80, maxSize: 1600, resizeMode: 'longest' } },
  { id: 'email', patch: { format: 'image/jpeg', mode: 'target', targetSize: 1000, resizeMode: 'longest' } },
]

// Which preset (if any) the current settings match: every key the preset
// sets must be equal, except that a target-size preset that does not set
// a size leaves the size free. The active scene is derived, so a manual
// tweak that leaves a preset's values clears it on its own.
export function matchPreset(s: Settings): string | null {
  for (const p of PRESETS) {
    const keys = Object.keys(p.patch) as (keyof Settings)[]
    if (keys.every((k) => s[k] === p.patch[k])) return p.id
  }
  return null
}
