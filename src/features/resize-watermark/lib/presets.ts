// Social / e-commerce / ID-photo output sizes. Picking one fills width ×
// height and switches the fit to crop (cover), the only fit that hits the
// exact pixel size a platform asks for.
export interface SizePreset {
  id: string
  w: number
  h: number
}

export const PRESETS: readonly SizePreset[] = [
  { id: 'xhs34', w: 1080, h: 1440 },
  { id: 'igSquare', w: 1080, h: 1080 },
  { id: 'igPortrait', w: 1080, h: 1350 },
  { id: 'story916', w: 1080, h: 1920 },
  { id: 'wxCover', w: 900, h: 383 },
  { id: 'moments', w: 1080, h: 0 },
  { id: 'taobao', w: 800, h: 800 },
  { id: 'x169', w: 1600, h: 900 },
  { id: 'ytThumb', w: 1280, h: 720 },
  { id: 'liBanner', w: 1584, h: 396 },
  { id: 'id1', w: 295, h: 413 },
  { id: 'id2', w: 413, h: 579 },
]

/** The four shown in the box-mode quick grid (desktop design). */
export const QUICK_PRESETS: readonly string[] = ['xhs34', 'igSquare', 'wxCover', 'story916']

export function findPreset(id: string): SizePreset | undefined {
  return PRESETS.find((p) => p.id === id)
}

/**
 * "Moments / general" has no fixed box: it is a 1080 long-side resize.
 * Every other preset is an exact crop to w × h.
 */
export function isLongSidePreset(p: SizePreset): boolean {
  return p.h === 0
}

/** "1080×1440" (or "1080 long side" label key handled by the caller). */
export function presetDims(p: SizePreset): string {
  return p.h ? `${p.w}×${p.h}` : `${p.w}`
}
