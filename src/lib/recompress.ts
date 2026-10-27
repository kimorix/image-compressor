import type { CompressItem, Settings } from '../types'

// "Unaffected" is defined only for an already-optimal item (its output is the
// original file; in the UI that is done && outSize >= file.size). If the new
// settings cannot make its output any smaller, re-encoding is pure waste.
//
// "More aggressive" means it can shrink the file and therefore escape the
// already-optimal state:
// - a format, mode or quantize change (sizes are not ordered across formats,
//   so a format change must never be skipped);
// - a lower quality in quality mode, or a lower target in target mode;
// - a genuinely tighter size limit (maxSize 0 means unlimited; noUpscale is
//   already folded into the computed dimension);
// - dropping keepExif, which only ever injected bytes into JPEG output.
//
// Skipping can only miss a potentially smaller result (the original file is
// still the correct output), never produce a wrong one. When the effect is
// uncertain, re-run (conservative).
export function isUnaffected(item: CompressItem, next: Settings): boolean {
  if (!item.done || item.outSize < item.file.size) return false
  const prev = item.lastSettings
  if (!prev) return false
  if (prev.format !== next.format || prev.mode !== next.mode || prev.quantize !== next.quantize) return false
  // Crop boxes change the framing, not just the scale: any change re-runs.
  if (prev.resizeMode === 'exact' || next.resizeMode === 'exact') {
    if (prev.resizeMode !== next.resizeMode || prev.maxSize !== next.maxSize || prev.maxHeight !== next.maxHeight) return false
  }
  if (next.mode === 'quality' && next.quality < prev.quality) return false
  if (next.mode === 'target' && next.targetSize < prev.targetSize) return false
  const origMax = Math.max(item.origW, item.origH)
  const dimOf = (s: Settings) => {
    if (!s.maxSize) return origMax
    if (s.resizeMode === 'percent') {
      let sc = s.maxSize / 100
      if (s.noUpscale && sc > 1) sc = 1
      return Math.round(origMax * sc)
    }
    if (s.resizeMode === 'width' || s.resizeMode === 'height') {
      const dim = s.resizeMode === 'width' ? item.origW : item.origH
      const out = (dim > s.maxSize || !s.noUpscale) ? s.maxSize : dim
      const other = s.resizeMode === 'width' ? item.origH : item.origW
      return Math.max(out, Math.round(other * (out / dim)))
    }
    return s.noUpscale ? Math.min(origMax, s.maxSize) : s.maxSize
  }
  if (dimOf(next) < dimOf(prev)) return false
  const injectedUnderPrev = prev.keepExif && item.file.type === 'image/jpeg'
    && (prev.format === 'image/jpeg' || prev.format === 'original')
  if (injectedUnderPrev && !next.keepExif) return false
  return true
}
