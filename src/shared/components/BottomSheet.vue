<template>
  <!-- Shared phone bottom-sheet shell (detail sheet, settings sheet): dim
  backdrop that closes on tap, drag handle that closes on a downward swipe,
  Esc to close, focus moved in on open, trapped while open and restored on
  close. Scroll lock is the caller's job (App locks body overflow while any
  sheet is open). -->
  <div class="sheet-overlay" :class="overlayClass" @click.self="emit('close')">
    <section
      ref="sheetRef"
      class="sheet"
      :class="sheetClass"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="labelId"
      :style="sheetStyle"
    >
      <div class="sheet-drag" @pointerdown="onDragStart">
        <span class="sheet-handle"></span>
      </div>
      <div class="sheet-head">
        <h2 :id="labelId">{{ title }}</h2>
        <button ref="closeBtn" type="button" class="sheet-close" :title="closeLabel" :aria-label="closeLabel" @click="emit('close')">×</button>
      </div>
      <slot />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

defineProps<{
  title: string
  closeLabel: string
  labelId: string
  sheetClass?: string
  overlayClass?: string
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

const sheetRef = ref<HTMLElement | null>(null)
const closeBtn = ref<HTMLButtonElement | null>(null)
const dragY = ref(0)
const sheetStyle = computed(() => ({ transform: `translateY(${Math.max(0, dragY.value)}px)` }))

// Down-swipe close: only the handle starts a drag, so scrolling the sheet
// body (and dragging a compare divider inside it) keep their own gestures.
let dragStartY = 0
let dragStarted = 0
function onDragStart(e: PointerEvent) {
  dragStartY = e.clientY
  dragStarted = Date.now()
  dragY.value = 0
  try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId) } catch { /* synthetic/unsupported */ }
  const move = (ev: PointerEvent) => {
    dragY.value = Math.max(0, ev.clientY - dragStartY)
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    const elapsed = Date.now() - dragStarted
    if (dragY.value > 100 || (dragY.value > 36 && elapsed < 260)) {
      dragY.value = 0
      emit('close')
    } else {
      dragY.value = 0
    }
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

const previousFocus = ref<HTMLElement | null>(null)
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
    return
  }
  if (e.key !== 'Tab' || !sheetRef.value) return
  const focusables = [...sheetRef.value.querySelectorAll<HTMLElement>(
    'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )].filter((el) => el.offsetParent !== null)
  if (!focusables.length) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  previousFocus.value = document.activeElement as HTMLElement | null
  closeBtn.value?.focus()
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  previousFocus.value?.focus?.()
})
</script>
