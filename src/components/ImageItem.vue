<template>
  <div class="item">
    <div
      class="thumb"
      :class="{ clickable: item.done }"
      :title="item.done ? t('thumbTitle') : ''"
      @click="onThumbClick"
    >
      <img ref="layerA" class="layer top" :alt="item.file.name" />
      <img v-if="item.done" ref="layerB" class="layer" alt="" />
    </div>
    <div class="meta">
      <div class="name" :title="item.file.name">{{ shortName(item.file.name) }}</div>
      <div class="sizes">
        <span v-if="item.error" class="error">{{ item.error }}</span>
        <span v-else-if="item.done"><span v-html="t('sizes', fmtSize(item.file.size), fmtSize(item.outSize))"></span><span v-if="!isAlreadyBest && savedPct > 0" class="save-pct"> −{{ savedPct }}%</span><span v-if="isAlreadyBest" class="best-tag">{{ t('alreadyBest') }}</span></span>
        <span v-else>{{ fmtSize(item.file.size) }} · {{ t('processing') }}</span>
      </div>
    </div>
    <div class="item-actions">
      <a v-if="item.done && item.outUrl" class="dl-icon" :href="item.outUrl" :download="item.outName ?? undefined" :title="t('btnDownload')" :aria-label="t('btnDownload')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg></a>
      <button class="remove-btn" :title="t('btnRemove')" :aria-label="t('btnRemove')" @click="$emit('remove', item)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2m-8 0l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"/></svg></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { CompressItem } from '../types'
import { fmtSize, shortName } from '../lib/format'

const props = defineProps<{
  item: CompressItem
  t: (key: string, ...args: (string | number)[]) => string
}>()
const emit = defineEmits<{
  (e: 'remove', item: CompressItem): void
  (e: 'preview', item: CompressItem): void
  (e: 'view-change', item: CompressItem, view: 'orig' | 'comp'): void
}>()

const layerA = ref<HTMLImageElement | null>(null)
const layerB = ref<HTMLImageElement | null>(null)

// Fixed layer mapping: A always holds the compressed image, B the original.
// initLayers puts the current view's layer on top; view changes crossfade
// via the watcher below, so the thumbnail always shows the live view.
function srcFor(view: 'orig' | 'comp'): string {
  return view === 'comp' ? (props.item.outUrl ?? props.item.url) : props.item.url
}

function initLayers() {
  if (!layerA.value) return
  layerA.value.src = srcFor('comp')
  const top = props.item.view === 'comp' ? layerA.value : layerB.value
  const bottom = top === layerA.value ? layerB.value : layerA.value
  if (top) top.classList.add('top')
  if (bottom) bottom.classList.remove('top')
  if (top) top.style.opacity = ''
  if (bottom) bottom.style.opacity = ''
  if (layerB.value) layerB.value.src = srcFor('orig')
}

onMounted(initLayers)
watch(() => props.item.done, async () => {
  // Recompressing or freshly done: rebuild layers from the current view.
  await nextTick()
  initLayers()
})

// The thumbnail no longer toggles on click (it opens the preview overlay);
// the crossfade now follows view changes, which come from the preview's
// original/compressed switch. Deriving the target layer from the fixed
// mapping keeps rapid toggles correct: a toggle arriving mid-fade bumps the
// generation (cancelling the in-flight fade) and re-animates from the live
// DOM state instead of corrupting the top layer.
let swapGen = 0
watch(() => props.item.view, () => {
  if (!props.item.done) return
  const a = layerA.value, b = layerB.value
  if (!a || !b) return
  const target = props.item.view === 'comp' ? a : b
  const other = target === a ? b : a
  const gen = ++swapGen
  if (target.classList.contains('top')) {
    // Already showing the target (toggle arrived mid-fade): snap to it.
    target.style.opacity = ''
    other.style.opacity = ''
    return
  }
  target.style.opacity = '1'
  other.style.opacity = '0'
  setTimeout(() => {
    if (gen !== swapGen) return
    other.classList.remove('top')
    target.classList.add('top')
    target.style.opacity = ''
    other.style.opacity = ''
  }, 380)
})

function onThumbClick() {
  if (!props.item.done) return
  emit('preview', props.item)
}

const savedPct = computed(() => {
  if (props.item.file.size <= 0) return 0
  return Math.max(0, Math.round((1 - props.item.outSize / props.item.file.size) * 100))
})

// Already-best needs no extra state: a normal success always outputs
// strictly smaller than the input (the never-bigger check guarantees it),
// so done + outSize >= file.size is exactly the already-best case, and it
// can never go stale across recompresses.
const isAlreadyBest = computed(() => props.item.done && props.item.outSize >= props.item.file.size)
</script>
