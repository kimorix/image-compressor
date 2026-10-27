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
        <span v-if="item.error" class="error">{{ item.error }}</span><button v-if="item.error" type="button" class="retry-btn" :title="t('retryBtn')" :aria-label="t('retryBtn')" @click="$emit('retry', item)">{{ t('retryBtn') }}</button>
        <span v-else-if="item.done"><span v-html="t('sizes', fmtSize(item.file.size), fmtSize(item.outSize))"></span><span v-if="!isAlreadyBest && savedPct > 0" class="save-pct"> −{{ savedPct }}%</span><span v-if="isAlreadyBest" class="best-tag">{{ t('alreadyBest') }}</span></span>
        <span v-else>{{ fmtSize(item.file.size) }} · {{ t('processing') }}</span>
      </div>
      <div v-if="dimsChanged" class="dims">{{ item.origW }}×{{ item.origH }} → {{ item.outW }}×{{ item.outH }}</div>
      <div v-if="item.isAnimatedGif" class="gif-tag">{{ t('gifFirstFrame') }}</div>
      <div v-if="showSmallNote" class="small-note">{{ smallNoteText }}</div>
      <div v-if="showAlphaNote" class="alpha-note">{{ t('alphaJpegNote') }} <button type="button" class="link-btn" @click="$emit('use-webp', item)">{{ t('useWebpBtn') }}</button></div>
      <div v-if="copyFailed" class="error">{{ t('copyFailed') }}</div>
    </div>
    <div class="item-actions">
      <button v-if="item.done && item.outUrl" class="copy-btn" :title="copyOk ? t('copied') : t('copyBtn')" :aria-label="t('copyBtn')" @click="onCopy"><span v-if="copyOk" class="copy-ok">✓</span><svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg></button>
      <button v-if="shareable" class="share-btn" :title="t('shareBtn')" :aria-label="t('shareBtn')" @click="onShare"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4m0 0L8 8m4-4l4 4" /><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg></button>
      <a v-else-if="item.done && item.outUrl" class="dl-icon" :href="item.outUrl" :download="item.outName ?? undefined" :title="t('btnDownload')" :aria-label="t('btnDownload')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg></a>
      <button class="remove-btn" :title="t('btnRemove')" :aria-label="t('btnRemove')" @click="$emit('remove', item)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2m-7 0l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"/></svg></button>
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
  (e: 'use-webp', item: CompressItem): void
  (e: 'retry', item: CompressItem): void
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

// Dims line shows only when the output was actually resized (and kept):
// already-best keeps the original file, so its dims are equal and no line
// appears; outW/outH at 0 (never assigned) also hides it.
const dimsChanged = computed(() => props.item.done
  && props.item.origW > 0 && props.item.origH > 0
  && props.item.outW > 0 && props.item.outH > 0
  && (props.item.origW !== props.item.outW || props.item.origH !== props.item.outH))

// Barely-smaller output: worth one quiet line, not a green celebration.
// PNG without quantization gets the actionable variant (quantization is
// the lever that actually shrinks it); the snapshot proves what the
// displayed result was computed under.
const showSmallNote = computed(() => props.item.done && !isAlreadyBest.value && savedPct.value < 10)
const smallNoteText = computed(() => {
  const ls = props.item.lastSettings
  return ls && ls.format === 'image/png' && !ls.quantize ? props.t('smallSaveQuantNote') : props.t('smallSaveNote')
})

// Transparent source flattened to JPEG: the white fill is silent data
// loss, so the row says so and offers the one-tap fix (WebP keeps alpha).
// Already-best keeps the original file, so no fill happened there.
const showAlphaNote = computed(() => props.item.done && !isAlreadyBest.value
  && props.item.hasAlpha && props.item.outType === 'image/jpeg')

// iOS share sheet instead of a Files download: on touch devices that can
// share files, the sheet offers Save Image (Photos) and WeChat directly.
// Desktop keeps the plain download; a cancelled sheet is silent, any other
// failure falls back to the download so the tap still produces the file.
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

async function onShare() {
  const it = props.item
  if (!it.outUrl || !it.outName) return
  try {
    const blob = await (await fetch(it.outUrl)).blob()
    await navigator.share({ files: [new File([blob], it.outName, { type: blob.type })] })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return
    const a = document.createElement('a')
    a.href = it.outUrl
    a.download = it.outName
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
}

// Copy as PNG (canvas conversion): the clipboard's one reliably supported
// image type, so WebP/AVIF outputs paste into WeChat and Word too. A P3
// source is converted through an sRGB canvas; paste targets are sRGB
// anyway, so nothing visible is lost.
const copyOk = ref(false)
const copyFailed = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null
async function onCopy() {
  const it = props.item
  if (!it.outUrl) return
  try {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error('unsupported')
    const img = new Image()
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = it.outUrl! })
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    c.getContext('2d')!.drawImage(img, 0, 0)
    const png = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'))
    if (!png) throw new Error('png')
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
    copyOk.value = true
    copyFailed.value = false
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copyOk.value = false }, 1500)
  } catch (err) {
    console.warn('[image-compressor] Copy failed:', err)
    copyFailed.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copyFailed.value = false }, 3000)
  }
}
</script>
