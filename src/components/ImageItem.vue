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
      <span class="tag">{{ item.done ? (item.view === 'comp' ? t('tagComp') : t('tagOrig')) : t('tagOrig') }}</span>
    </div>
    <div class="meta">
      <div class="name" :title="item.file.name">{{ shortName(item.file.name) }}</div>
      <div class="sizes">
        <span v-if="item.error" class="error">{{ item.error }}</span>
        <span v-else-if="item.done" v-html="t('sizes', fmtSize(item.file.size), fmtSize(item.outSize), savedPct)"></span>
        <span v-else>{{ fmtSize(item.file.size) }} · {{ t('processing') }}</span>
      </div>
      <template v-if="item.done && item.origW">
        <div class="dims">{{ dimsText }}</div>
        <div class="hint">{{ t('thumbHint') }}</div>
        <div v-if="item.targetNote" class="dims">{{ item.targetNote }}</div>
        <div v-if="item.typeNote" class="dims">{{ item.typeNote }}</div>
      </template>
    </div>
    <div class="item-actions">
      <button v-if="item.done" @click="$emit('preview', item)">{{ t('btnPreview') }}</button>
      <a v-if="item.done && item.outUrl" :href="item.outUrl" :download="item.outName ?? undefined"><button>{{ t('btnDownload') }}</button></a>
      <button @click="$emit('remove', item)">{{ t('btnRemove') }}</button>
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
  (e: 'preview', item: CompressItem): void
  (e: 'remove', item: CompressItem): void
  (e: 'view-change', item: CompressItem, view: 'orig' | 'comp'): void
}>()

const layerA = ref<HTMLImageElement | null>(null)
const layerB = ref<HTMLImageElement | null>(null)
const switching = ref(false)

// Dual-layer crossfade, same as the original: both images are preloaded and stacked,
// switching only cross-fades them, so there is never a blank frame and no list rebuild.
// Layer srcs are set imperatively (never bound) so Vue re-renders can't interrupt a fade.
function srcFor(view: 'orig' | 'comp'): string {
  return view === 'comp' ? (props.item.outUrl ?? props.item.url) : props.item.url
}

function initLayers() {
  if (!layerA.value) return
  layerA.value.src = srcFor(props.item.view)
  layerA.value.classList.add('top')
  layerA.value.style.opacity = ''
  if (layerB.value) {
    layerB.value.src = srcFor(props.item.view === 'comp' ? 'orig' : 'comp')
    layerB.value.classList.remove('top')
    layerB.value.style.opacity = ''
  }
}

onMounted(initLayers)
watch(() => props.item.done, async (done) => {
  if (!done) {
    // Recompressing: back to a single original layer.
    await nextTick()
    initLayers()
  } else {
    await nextTick()
    initLayers()
  }
})

function onThumbClick() {
  if (!props.item.done || switching.value) return
  const top = layerA.value?.classList.contains('top') ? layerA.value : layerB.value
  const bottom = top === layerA.value ? layerB.value : layerA.value
  if (!top || !bottom) return
  switching.value = true
  const newView = props.item.view === 'comp' ? 'orig' : 'comp'
  emit('view-change', props.item, newView)
  bottom.style.opacity = '1'
  top.style.opacity = '0'
  setTimeout(() => {
    top.classList.remove('top')
    bottom.classList.add('top')
    top.style.opacity = ''
    bottom.style.opacity = ''
    switching.value = false
  }, 380)
}

const savedPct = computed(() => {
  if (props.item.file.size <= 0) return 0
  return Math.max(0, Math.round((1 - props.item.outSize / props.item.file.size) * 100))
})

const dimsText = computed(() => {
  const it = props.item
  if (it.origW === it.outW && it.origH === it.outH) {
    return `${it.origW}×${it.origH} ${props.t('dimsUnchanged')}`
  }
  return `${it.origW}×${it.origH} → ${it.outW}×${it.outH}`
})
</script>
