import type { Settings } from '../types'

// The settings the app starts with.
export const DEFAULT_SETTINGS: Settings = {
  format: 'image/webp',
  mode: 'quality',
  targetSize: 200,
  quality: 80,
  maxSize: 1920,
  resizeMode: 'longest',
  noUpscale: true,
  quantize: true,
  keepExif: false,
  jpegFill: '#ffffff',
  keepOriginalName: false,
}

// One-tap scenes: WeChat chat images (JPEG, 1920), WeChat article images
// (JPEG, 900px body width), ID photos (target mode, 200KB cap),
// website/blog images (WebP, 1600px), email attachments (target mode,
// 1000KB cap: safely under a decimal 1MB, where 1024KB would overshoot).
export const PRESETS: { id: string; patch: Partial<Settings> }[] = [
  { id: 'wechat', patch: { format: 'image/jpeg', mode: 'quality', quality: 85, maxSize: 1920, resizeMode: 'longest' } },
  { id: 'article', patch: { format: 'image/jpeg', mode: 'quality', quality: 85, maxSize: 900, resizeMode: 'longest' } },
  { id: 'idphoto', patch: { format: 'image/jpeg', mode: 'target', targetSize: 200, resizeMode: 'longest' } },
  { id: 'website', patch: { format: 'image/webp', mode: 'quality', quality: 80, maxSize: 1600, resizeMode: 'longest' } },
  { id: 'email', patch: { format: 'image/jpeg', mode: 'target', targetSize: 1000, resizeMode: 'longest' } },
]

// Which preset (if any) the current settings match. Shared by the settings
// panel (active highlight) and the app (click = apply; clicking the active
// preset again is a no-op, only a manual tweak clears the highlight).
// Presets are longest-side by definition, so a width/height/percent resize
// never matches one even when the value coincides.
export function matchPreset(s: Settings): string | null {
  if (s.resizeMode !== 'longest') return null
  for (const p of PRESETS) {
    if (p.patch.mode === 'target') {
      if (s.mode === 'target' && s.targetSize === p.patch.targetSize && s.format === p.patch.format) return p.id
    } else if (s.mode === 'quality' && s.format === p.patch.format
      && s.quality === p.patch.quality && s.maxSize === p.patch.maxSize) return p.id
  }
  return null
}
