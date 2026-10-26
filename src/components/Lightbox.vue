<template>
  <div class="lb-overlay" @click.self="$emit('close')">
    <div class="lb-box">
      <div class="lb-bar">
        <div class="lb-views">
          <button class="lb-orig" :class="{ active: item.view === 'orig' }" @click="$emit('view-change', item, 'orig')">{{ t('tagOrig') }}</button>
          <button class="lb-comp" :class="{ active: item.view === 'comp' }" @click="$emit('view-change', item, 'comp')">{{ t('tagComp') }}</button>
        </div>
        <button class="lb-close" :title="t('lbClose')" :aria-label="t('lbClose')" @click="$emit('close')">×</button>
      </div>
      <div class="lb-stage" :class="{ zoomed }">
        <img :src="src" :alt="item.file.name" @click="zoomed = !zoomed" />
      </div>
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
  (e: 'view-change', item: CompressItem, view: 'orig' | 'comp'): void
}>()

// Same source rule as the row thumbnail: compressed when done, else the
// original (covers the recompress window, when outUrl is stale).
const src = computed(() =>
  props.item.view === 'comp' && props.item.done && props.item.outUrl
    ? props.item.outUrl
    : props.item.url,
)

const zoomed = ref(false)
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>
