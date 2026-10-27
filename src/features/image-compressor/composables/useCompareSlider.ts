import { ref, watch, type Ref } from 'vue'
import type { CompressItem } from '../types'

/**
 * Shared original/compressed comparison slider used by the desktop preview
 * card and the mobile detail sheet. Keeping the pointer/keyboard mechanics in
 * one place guarantees both surfaces behave identically.
 */
export function useCompareSlider(item: Ref<CompressItem | null>) {
  const pos = ref(50)
  const compareRef = ref<HTMLElement | null>(null)
  let lastDragEnd = 0

  watch(() => item.value?.id, () => { pos.value = 50 })

  function setFromClientX(clientX: number) {
    const el = compareRef.value
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width <= 0) return
    pos.value = Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100))
  }

  function onDividerDown(e: PointerEvent) {
    e.preventDefault()
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId) } catch { /* synthetic/unsupported */ }
    let moved = false
    const move = (ev: PointerEvent) => { moved = true; setFromClientX(ev.clientX) }
    const up = () => {
      if (moved) lastDragEnd = Date.now()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function onDividerKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') { pos.value = Math.max(0, pos.value - 5); e.preventDefault() }
    else if (e.key === 'ArrowRight') { pos.value = Math.min(100, pos.value + 5); e.preventDefault() }
    else if (e.key === 'Home') { pos.value = 0; e.preventDefault() }
    else if (e.key === 'End') { pos.value = 100; e.preventDefault() }
  }

  // A divider drag ends in a click too. Ignore clicks on the divider and any
  // click immediately after a drag so releasing the slider never opens the
  // Lightbox by accident.
  function onStageClick(e: MouseEvent, open: () => void) {
    if ((e.target as HTMLElement).closest('.pv-divider')) return
    if (Date.now() - lastDragEnd < 300) return
    open()
  }

  return { pos, compareRef, onDividerDown, onDividerKey, onStageClick }
}
