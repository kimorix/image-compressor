// Which per-image notes deserve the ⓘ marker on a phone card. The detail
// sheet still lists every note; the card marker is only for notes the user
// may want to act on, so it does not sit on every smart-quality image.
import type { CompressItem } from '../types'

export type NoteFields = Pick<CompressItem,
  'done' | 'outSize' | 'hasAlpha' | 'outType' | 'typeNote' | 'targetNoteNotable' | 'isAnimatedGif'
> & { file: { size: number } }

/** Transparent pixels were flattened into a JPEG (offer: use WebP). */
export function hasAlphaJpegNote(it: NoteFields): boolean {
  return it.done && it.outSize < it.file.size && it.hasAlpha && it.outType === 'image/jpeg'
}

/**
 * Card marker rule: transparency → JPEG, a format fallback (typeNote), a
 * target-size note that resized the image or still misses the target, or an
 * animated GIF reduced to its first frame. Auto/smart quality, "best
 * quality", "already optimal" and small-saving notes do not count.
 */
export function hasActionableNote(it: NoteFields): boolean {
  return !!it.typeNote || it.targetNoteNotable || hasAlphaJpegNote(it) || it.isAnimatedGif
}
