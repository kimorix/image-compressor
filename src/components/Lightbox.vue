<template>
  <div class="lb-overlay" @click.self="$emit('close')">
    <div class="lb-box">
      <div class="lb-bar">
        <button class="lb-close" :title="t('lbClose')" :aria-label="t('lbClose')" @click="$emit('close')">×</button>
      </div>
      <div class="lb-stage" :class="{ zoomed }">
        <div class="lb-compare" ref="compareRef">
          <!-- Base layer: compressed when done, else the original (same
          fallback as the row thumbnail, covers the recompress window). -->
          <img class="lb-img" :src="compSrc" :alt="item.file.name" @click="zoomed = !zoomed" />
          <!-- Original layer, clipped to the left of the divider. Both
          layers share the wrapper's box, so they stay aligned at any zoom
          and scroll together when the stage pans. -->
          <div class="lb-orig-clip" :style="{ clipPath: `inset(0 ${100 - pos}% 0 0)` }">
            <img class="lb-img" :src="item.url" :alt="item.file.name" @click="zoomed = !zoomed" />
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
      <div class="lb-info" v-if="item.done && item.origW"><span :class="{ warn: upscaled }">{{ dimsText }}</span><span v-if="item.targetNote"> · {{ item.targetNote }}</span><span v-if="item.typeNote"> · {{ item.typeNote }}</span></div>
      <div class="lb-hint">{{ t('lbZoomHint') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { CompressItem } from '../types'

const props = defineProps<{
  item: CompressItem
  t: (key: string, ...args: (string | number)[]) => string
}>()
const emit = defineEmits<{
  (e: 'close'): void
}>()

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

const zoomed = ref(false)
const pos = ref(50)
const compareRef = ref<HTMLElement | null>(null)

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
  if (e.key === 'ArrowLeft') { pos.value = Math.max(0, pos.value - 5); e.preventDefault() }
  else if (e.key === 'ArrowRight') { pos.value = Math.min(100, pos.value + 5); e.preventDefault() }
  else if (e.key === 'Home') { pos.value = 0; e.preventDefault() }
  else if (e.key === 'End') { pos.value = 100; e.preventDefault() }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>
