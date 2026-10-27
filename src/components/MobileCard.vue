<template>
  <article class="masonry-card" :class="{ leaving }" :data-id="item.id">
    <!-- The overlay owns opening the detail sheet; the download/retry buttons
    sit above it, so the card never nests one button inside another. -->
    <button
      type="button"
      class="m-open"
      :aria-label="`${t('openDetails')}: ${item.file.name}`"
      @click="$emit('open', item)"
    ></button>

    <div class="m-thumb" :class="{ tiny: tiny }" :style="{ aspectRatio: String(ratio) }">
      <img :src="thumbSrc" :alt="item.file.name" loading="lazy" decoding="async" />
      <span v-if="item.isAnimatedGif" class="m-gif">GIF</span>
      <span :class="['m-badge', statusClass]">{{ statusText }}</span>
      <span v-if="hasNotes" class="m-note" aria-hidden="true">i</span>
      <div v-if="processing" class="m-progress" role="progressbar" :aria-label="t('statusProcessing')"><span></span></div>
      <div v-if="item.error" :class="['m-error', { cancelled: item.cancelled }]" aria-hidden="true"></div>
      <button
        v-if="showRetry"
        type="button"
        class="m-retry"
        @click.stop="$emit('retry', item)"
      >{{ t('retryBtn') }}</button>
    </div>

    <div class="m-name" :title="item.file.name">
      <span class="m-name-stem">{{ nameParts.stem }}</span><span class="m-name-ext">{{ nameParts.ext }}</span>
    </div>
    <div class="m-meta" :title="metaText"><span class="m-meta-text">{{ metaText }}</span></div>
    <button
      v-if="canDownload"
      type="button"
      class="m-dl"
      :title="shareable ? t('shareBtn') : t('btnDownload')"
      :aria-label="shareable ? t('shareBtn') : t('btnDownload')"
      @click.stop="onDownload"
    >
      <svg v-if="shareable" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4m0 0L8 8m4-4l4 4" /><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m0 0l-4-4m4 4l4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
    </button>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CompressItem } from '../types'
import { fmtSizeShort } from '../lib/format'
import { clampAspect, isTinyImage } from '../lib/masonry'

const props = defineProps<{
  item: CompressItem
  t: (key: string, ...args: (string | number)[]) => string
  // Both are run-state flags from App; item.done alone cannot tell queued
  // from actively encoding (especially during a recompress of a done item).
  active: boolean
  processing: boolean
  leaving?: boolean
}>()
defineEmits<{ (e: 'open', item: CompressItem): void; (e: 'retry', item: CompressItem): void }>()

const nameParts = computed(() => {
  const n = props.item.file.name
  const dot = n.lastIndexOf('.')
  return dot > 0 && n.length - dot <= 6 ? { stem: n.slice(0, dot), ext: n.slice(dot) } : { stem: n, ext: '' }
})

const ratio = computed(() => clampAspect(props.item.origW, props.item.origH))
const tiny = computed(() => isTinyImage(props.item))
const thumbSrc = computed(() => (props.item.done && props.item.outUrl ? props.item.outUrl : props.item.url))

const savedPct = computed(() => {
  if (props.item.file.size <= 0) return 0
  return Math.max(0, Math.round((1 - props.item.outSize / props.item.file.size) * 100))
})
const isAlreadyBest = computed(() => props.item.done && props.item.outSize >= props.item.file.size)
const canDownload = computed(() => props.item.done && !!props.item.outUrl)

const formatMap: Record<string, string> = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/avif': 'AVIF' }
const fmtTag = computed(() => {
  if (props.item.done && props.item.outType) return formatMap[props.item.outType] ?? props.item.outType
  return props.item.file.name.split('.').pop()?.toUpperCase() ?? ''
})
const metaText = computed(() => {
  const it = props.item
  if (it.done && !isAlreadyBest.value) return `${fmtSizeShort(it.file.size)} → ${fmtSizeShort(it.outSize)} · ${fmtTag.value}`
  return `${fmtSizeShort(it.file.size)} · ${fmtTag.value}`
})

const statusText = computed(() => {
  const it = props.item
  if (it.error) return it.cancelled ? props.t('cancelled') : props.t('statusFailed')
  if (props.processing) return props.t('statusProcessing')
  if (props.active) return props.t('statusQueued')
  if (it.done) {
    if (isAlreadyBest.value || savedPct.value <= 0) return props.t('alreadyBest')
    return `−${savedPct.value}%`
  }
  return props.t('statusQueued')
})
const statusClass = computed(() => {
  const it = props.item
  if (it.error) return it.cancelled ? 'cancelled' : 'fail'
  if (props.processing) return 'processing'
  if (props.active) return 'queued'
  if (it.done) return isAlreadyBest.value || savedPct.value <= 0 ? 'best' : 'save'
  return 'queued'
})

const showRetry = computed(() => !!props.item.error && props.item.retryable !== false)

const smallSave = computed(() => props.item.done && !isAlreadyBest.value && savedPct.value < 10)
const showAlphaNote = computed(() => props.item.done && !isAlreadyBest.value
  && props.item.hasAlpha && props.item.outType === 'image/jpeg')
const hasNotes = computed(() => !!(props.item.targetNote || props.item.typeNote
  || smallSave.value || showAlphaNote.value || props.item.isAnimatedGif))

// Same capability check as the desktop row: a touch device with file sharing
// gets the share sheet (Save Image / WeChat), otherwise the download icon.
const isTouchDevice = typeof window !== 'undefined'
  && (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window)
const shareable = computed(() => {
  if (!isTouchDevice || !props.item.done || !props.item.outUrl) return false
  try {
    return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [new File([], 'probe.png', { type: 'image/png' })] })
  } catch {
    return false
  }
})

function downloadNow() {
  const it = props.item
  if (!it.outUrl) return
  const a = document.createElement('a')
  a.href = it.outUrl
  a.download = it.outName ?? it.file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

async function onDownload() {
  const it = props.item
  if (!it.outUrl) return
  if (!shareable.value) { downloadNow(); return }
  try {
    const blob = await (await fetch(it.outUrl)).blob()
    await navigator.share({ files: [new File([blob], it.outName ?? it.file.name, { type: blob.type })] })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return
    downloadNow()
  }
}

</script>
