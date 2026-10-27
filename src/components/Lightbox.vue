<template>
  <div ref="overlayRef" class="lb-overlay" role="dialog" aria-modal="true" :aria-label="t('previewTitle')" @click.self="$emit('close')">
    <div class="lb-box">
      <div class="lb-bar">
        <div class="lb-zoom">
          <button type="button" class="lb-zoom-btn" :class="{ active: zoomLevel === 'fit' }" :aria-pressed="zoomLevel === 'fit'" @click="zoomLevel = 'fit'">{{ t('lbFit') }}</button>
          <button type="button" class="lb-zoom-btn" :class="{ active: zoomLevel === '100' }" :aria-pressed="zoomLevel === '100'" @click="zoomLevel = '100'">100%</button>
          <button type="button" class="lb-zoom-btn" :class="{ active: zoomLevel === '200' }" :aria-pressed="zoomLevel === '200'" @click="zoomLevel = '200'">200%</button>
        </div>
        <div class="lb-nav">
          <button type="button" class="lb-nav-btn" :disabled="!hasPrev" :aria-label="t('stripPrev')" @click="emit('prev')">‹</button>
          <button type="button" class="lb-nav-btn" :disabled="!hasNext" :aria-label="t('stripNext')" @click="emit('next')">›</button>
        </div>
        <button ref="closeBtn" type="button" class="lb-close" :title="t('lbClose')" :aria-label="t('lbClose')" @click="$emit('close')">×</button>
      </div>
      <div class="lb-stage" :class="{ zoomed: zoomLevel !== 'fit' }">
        <div class="lb-compare" ref="compareRef" :style="compareStyle">
          <!-- Base layer: compressed when done, else the original (same
          fallback as the row thumbnail, covers the recompress window). -->
          <img class="lb-img" :src="compSrc" :alt="item.file.name" @click="cycleZoom" />
          <!-- Original layer, clipped to the left of the divider. Both
          layers share the wrapper's box, so they stay aligned at any zoom
          and scroll together when the stage pans. -->
          <div class="lb-orig-clip" :style="{ clipPath: `inset(0 ${100 - pos}% 0 0)` }">
            <img class="lb-img" :src="item.url" :alt="item.file.name" @click="cycleZoom" />
          </div>
          <div
            class="lb-divider"
            :style="{ left: pos + '%' }"
            tabindex="0"
            role="slider"
            :aria-label="t('lbCompare')"
            :aria-valuemin="0"
            :aria-valuemax="100"
            :aria-valuenow="Math.round(pos)"
            @pointerdown="onDividerDown"
            @keydown="onDividerKey"
          >
            <span class="lb-handle">↔</span>
          </div>
          <span class="lb-side-tag left">{{ t('tagOrig') }}</span>
          <span class="lb-side-tag right">{{ t('tagComp') }}</span>
        </div>
      </div>
      <div class="lb-info">
        <span class="lb-name">{{ item.file.name }}</span>
        <template v-if="item.done && item.origW"><span :class="{ warn: upscaled }">{{ dimsText }}</span><span v-if="item.targetNote"> · {{ item.targetNote }}</span><span v-if="item.typeNote"> · {{ item.typeNote }}</span></template>
      </div>
      <div class="lb-hint">{{ t('lbZoomHint') }}<span class="lb-keys"> · {{ t('lbKeysHint') }}</span></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { CompressItem } from '../types'

const props = defineProps<{
  item: CompressItem
  t: (key: string, ...args: (string | number)[]) => string
  hasPrev?: boolean
  hasNext?: boolean
  busy?: boolean
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'prev'): void
  (e: 'next'): void
}>()

const overlayRef = ref<HTMLElement | null>(null)
const closeBtn = ref<HTMLButtonElement | null>(null)

// Same source rule as the row thumbnail: compressed when done, else the
// original (covers the recompress window, when outUrl is stale).
const compSrc = computed(() =>
  props.item.done && props.item.outUrl ? props.item.outUrl : props.item.url,
)

// Row info lives here now (item 11): dimensions, target note and type
// note moved out of the row into the preview. Upscaling only happens
// with "don't upscale" off: flag it in a warning colour so a silently
// enlarged image is visible.
const upscaled = computed(() => props.item.done
  && (props.item.outW > props.item.origW || props.item.outH > props.item.origH))
const dimsText = computed(() => {
  const it = props.item
  if (it.origW === it.outW && it.origH === it.outH) {
    return `${it.origW}×${it.origH} ${props.t('dimsUnchanged')}`
  }
  return `${it.origW}×${it.origH} → ${it.outW}×${it.outH}`
})

// Zoom levels: fit (default), 100% (natural size), 200% (doubled).
// Both layers share the wrapper's box, so scaling the wrapper scales them
// together. The base width comes from the item fields, not the DOM:
// compressed → outW, else original → origW (covers the recompress window).
const zoomLevel = ref<'fit' | '100' | '200'>('fit')
const baseW = computed(() => {
  const it = props.item
  const w = it.done && it.outUrl && it.outW ? it.outW : it.origW
  return w > 0 ? w : 0
})
const compareStyle = computed(() => {
  if (zoomLevel.value === 'fit' || !baseW.value) return {}
  const factor = zoomLevel.value === '200' ? 2 : 1
  return { width: `${baseW.value * factor}px` }
})
function cycleZoom() {
  zoomLevel.value = zoomLevel.value === 'fit' ? '100' : zoomLevel.value === '100' ? '200' : 'fit'
}
const pos = ref(50)
const compareRef = ref<HTMLElement | null>(null)

// Switching images (← / → or the lightbox nav) starts a fresh comparison:
// carrying a 200% zoom and an off-centre divider into the next image was
// disorienting, and the old zoom made the new image look cropped.
watch(() => props.item.id, () => {
  zoomLevel.value = 'fit'
  pos.value = 50
})

function setPosFromClientX(clientX: number) {
  const el = compareRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  if (r.width <= 0) return
  pos.value = Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100))
}

function onDividerDown(e: PointerEvent) {
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  const move = (ev: PointerEvent) => setPosFromClientX(ev.clientX)
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

function onDividerKey(e: KeyboardEvent) {
  if (props.busy) return
  if (e.key === 'ArrowLeft') { pos.value = Math.max(0, pos.value - 5); e.preventDefault() }
  else if (e.key === 'ArrowRight') { pos.value = Math.min(100, pos.value + 5); e.preventDefault() }
  else if (e.key === 'Home') { pos.value = 0; e.preventDefault() }
  else if (e.key === 'End') { pos.value = 100; e.preventDefault() }
}

function trapFocus(e: KeyboardEvent) {
  const root = overlayRef.value
  if (!root) return
  const focusables = [...root.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((el) => el.getClientRects().length > 0)
  if (!focusables.length) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement as HTMLElement | null
  if (e.shiftKey) {
    if (active === first || !root.contains(active)) { e.preventDefault(); last.focus() }
  } else if (active === last || !root.contains(active)) {
    e.preventDefault(); first.focus()
  }
}

// Desktop keys: Esc closes, ← / → step through the list (the divider keeps
// its own arrows while focused), Space flips between all-original and
// all-compressed for a quick blink comparison.
function onKey(e: KeyboardEvent) {
  // The blocking loading layer owns keyboard shortcuts too: no Esc, arrows or
  // Space until the encode/zip finishes.
  if (props.busy) return
  if (e.key === 'Escape') { emit('close'); return }
  if (e.key === 'Tab') { trapFocus(e); return }
  const target = e.target as HTMLElement | null
  const onDivider = target?.classList?.contains('lb-divider')
  // A focused button/input keeps its own Space/Enter/arrow behaviour; only
  // the stage (or body) drives the image shortcuts.
  const onControl = target?.closest?.('button, a, input, select, textarea')
  if (onDivider || onControl || e.defaultPrevented) return
  if (e.key === 'ArrowLeft' && props.hasPrev) { emit('prev'); e.preventDefault() }
  else if (e.key === 'ArrowRight' && props.hasNext) { emit('next'); e.preventDefault() }
  else if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault()
    pos.value = pos.value === 100 ? 0 : 100
  }
}
// Scroll lock: while the preview is open, swipes on the overlay must not
// scroll the page behind (iOS Safari chains them to the document).
// overflow:hidden alone still lets iOS scroll through a fixed overlay, so
// the body itself is pinned: position fixed + top offset preserves the
// visual position, and unmount restores it. The stage keeps its own
// overflow:auto, so zoomed panning still works.
let savedY = 0
function lockScroll() {
  savedY = window.scrollY
  const b = document.body
  b.style.position = 'fixed'
  b.style.top = `-${savedY}px`
  b.style.left = '0'
  b.style.right = '0'
  b.style.width = '100%'
}
function unlockScroll() {
  const b = document.body
  b.style.position = ''
  b.style.top = ''
  b.style.left = ''
  b.style.right = ''
  b.style.width = ''
  window.scrollTo(0, savedY)
}
let previousFocus: HTMLElement | null = null
onMounted(() => {
  previousFocus = document.activeElement as HTMLElement | null
  window.addEventListener('keydown', onKey)
  lockScroll()
  void nextTick(() => closeBtn.value?.focus())
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  unlockScroll()
  if (previousFocus?.isConnected) previousFocus.focus()
})
</script>
