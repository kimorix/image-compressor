import type { Settings } from '../types'

// The settings the app starts with. Doubling as the fallback when a preset
// is cancelled without a snapshot (defensive only: cancelling normally
// restores the snapshot taken when the preset was applied).
export const DEFAULT_SETTINGS: Settings = {
  format: 'image/webp',
  mode: 'quality',
  targetSize: 200,
  quality: 80,
  maxSize: 1920,
  noUpscale: true,
  quantize: true,
  keepExif: false,
}

// One-tap scenes: WeChat chat images (JPEG, 1920), WeChat article images
// (JPEG, 900px body width), ID photos (target mode, 200KB cap),
// website/blog images (WebP, 1600px), email attachments (target mode,
// 1000KB cap: safely under a decimal 1MB, where 1024KB would overshoot).
export const PRESETS: { id: string; patch: Partial<Settings> }[] = [
  { id: 'wechat', patch: { format: 'image/jpeg', mode: 'quality', quality: 85, maxSize: 1920 } },
  { id: 'article', patch: { format: 'image/jpeg', mode: 'quality', quality: 85, maxSize: 900 } },
  { id: 'idphoto', patch: { format: 'image/jpeg', mode: 'target', targetSize: 200 } },
  { id: 'website', patch: { format: 'image/webp', mode: 'quality', quality: 80, maxSize: 1600 } },
  { id: 'email', patch: { format: 'image/jpeg', mode: 'target', targetSize: 1000 } },
]

// Which preset (if any) the current settings match. Shared by the settings
// panel (active highlight) and the app (click = apply, click again = cancel).
export function matchPreset(s: Settings): string | null {
  for (const p of PRESETS) {
    if (p.patch.mode === 'target') {
      if (s.mode === 'target' && s.targetSize === p.patch.targetSize && s.format === p.patch.format) return p.id
    } else if (s.mode === 'quality' && s.format === p.patch.format
      && s.quality === p.patch.quality && s.maxSize === p.patch.maxSize) return p.id
  }
  return null
}
