<template>
  <div class="item" :title="item.file.name">
    <div
      class="thumb"
      :class="{ clickable: item.done }"
      :title="item.done ? t('thumbTitle') : ''"
      :role="item.done ? 'button' : undefined"
      :tabindex="item.done ? 0 : undefined"
      :aria-label="item.done ? t('thumbTitle') : undefined"
      @click="onThumbClick"
      @keydown.enter="onThumbClick"
      @keydown.space.prevent="onThumbClick"
    >
      <img ref="layerA" class="layer top" :alt="item.file.name" decoding="async" />
      <img v-if="item.done" ref="layerB" class="layer" alt="" decoding="async" />
    </div>
    <div class="row-main">
      <div class="cell-name">
        <span class="sr-only">{{ t('thName') }}</span>
        <div class="name" :title="item.file.name"><span class="name-stem">{{ nameParts.stem }}</span><span class="name-ext">{{ nameParts.ext }}</span></div>
        <div class="name-tags"><span class="sr-only">{{ t('thFormat') }}</span><span class="fmt-tag">{{ fmtTag }}</span><span v-if="isAlreadyBest" class="best-tag">{{ t('alreadyBest') }}</span><span v-if="showSmallTag" class="best-tag">{{ smallTagText }}</span></div>
      </div>
      <div class="orig-size"><span class="sr-only">{{ t('thOrig') }}</span>{{ fmtSize(item.file.size) }}</div>
      <div class="comp-size" :class="{ done: item.done && !item.error }">
        <span class="sr-only">{{ t('thComp') }}</span>
        <span v-if="item.error" class="error" :class="{ cancelled: item.cancelled }">{{ item.error }}</span>
        <span v-else-if="item.done">{{ fmtSize(item.outSize) }}</span>
        <span v-else>{{ t('processing') }}</span>
      </div>
      <div class="save-cell"><span v-if="item.done && !isAlreadyBest && savedPct > 0" class="save-pct"><span class="sr-only">{{ t('thSave') }}</span> −{{ savedPct }}%</span></div>
      <div v-if="dimsShown" class="dims" :title="`${item.origW}×${item.origH} → ${outW}×${outH}`">
        <span class="sr-only">{{ t('thDims') }}</span>
        <template v-if="dimsChanged">
          <span class="dims-orig">{{ item.origW }}×{{ item.origH }}</span>
          <span class="dims-arrow">→</span>
          <span class="dims-comp">{{ outW }}×{{ outH }}</span>
        </template>
        <span v-else class="dims-same">{{ item.origW }}×{{ item.origH }} → {{ outW }}×{{ outH }}</span>
      </div>
      <div class="cell-status"><span class="sr-only">{{ t('thStatus') }}</span><span :class="['status-pill', pillClass]">{{ pillText }}</span></div>
      <div class="item-actions">
        <button v-if="item.error && item.retryable !== false" type="button" class="retry-icon" :title="t('retryBtn')" :aria-label="t('retryBtn')" @click="$emit('retry', item)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg></button>
        <button v-if="item.done && item.outUrl" class="copy-btn" :title="copyOk ? t('copied') : t('copyBtn')" :aria-label="t('copyBtn')" @click="onCopy"><span v-if="copyOk" class="copy-ok">✓</span><svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg></button>
        <button v-if="shareable" class="share-btn" :title="t('shareBtn')" :aria-label="t('shareBtn')" @click="onShare"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4m0 0L8 8m4-4l4 4" /><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg></button>
        <a v-else-if="item.done && item.outUrl" class="dl-icon" :href="item.outUrl" :download="item.outName ?? undefined" :title="t('btnDownload')" :aria-label="t('btnDownload')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg></a>
        <button class="remove-btn" :title="t('btnRemove')" :aria-label="t('btnRemove')" @click="$emit('remove', item)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2m-7 0l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"/></svg></button>
      </div>
      <div v-if="item.isAnimatedGif || showAlphaNote || copyFailed" class="note-row">
        <div v-if="item.isAnimatedGif" class="gif-tag">{{ t('gifFirstFrame') }}</div>
        <div v-if="showAlphaNote" class="alpha-note">{{ t('alphaJpegNote') }} <button type="button" class="link-btn" @click="$emit('use-webp', item)">{{ t('useWebpBtn') }}</button></div>
        <div v-if="copyFailed" class="error">{{ t('copyFailed') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { CompressItem } from '../types'
import { fmtSize } from '../lib/format'

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

// Name cell: the stem truncates with CSS (fills whatever width the column
// has) while the extension stays visible, instead of a fixed-length cut
// that could still overflow the column or waste room on wide screens.
const nameParts = computed(() => {
  const n = props.item.file.name
  const dot = n.lastIndexOf('.')
  return dot > 0 && n.length - dot <= 6 ? { stem: n.slice(0, dot), ext: n.slice(dot) } : { stem: n, ext: '' }
})

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
  // A pending/errored item has no original layer (layerB is v-if="done").
  // Without this fallback, initLayers removed `.top` from the only layer and
  // the row thumbnail was invisible (opacity 0) until the compression ended.
  const top = props.item.view === 'comp' || !layerB.value ? layerA.value : layerB.value
  const bottom = top === layerA.value ? layerB.value : layerA.value
  if (top) top.classList.add('top')
  if (bottom) bottom.classList.remove('top')
  if (top) top.style.opacity = ''
  if (bottom) bottom.style.opacity = ''
  if (layerB.value) layerB.value.src = srcFor('orig')
}

onMounted(initLayers)
// Re-init on a new result, not just the first success: a recompress keeps
// `done` true while outUrl changes, and the old URL is revoked by App. Without
// the outUrl dependency the imperative <img> kept a dead URL after every
// settings change (broken thumbnail until the next remount).
watch([() => props.item.done, () => props.item.outUrl], async () => {
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

// Row tag + status pill (mock rows show both): output format when done,
// input extension while waiting; the pill mirrors the row's real state.
const fmtTag = computed(() => {
  const map: Record<string, string> = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/avif': 'AVIF' }
  if (props.item.done && props.item.outType) return map[props.item.outType] ?? props.item.outType
  return props.item.file.name.split('.').pop()?.toUpperCase() ?? ''
})
const pillClass = computed(() => props.item.cancelled ? 'cancelled' : props.item.error ? 'fail' : props.item.done ? 'done' : 'processing')
const pillText = computed(() => props.item.cancelled ? props.t('cancelled') : props.item.error ? props.t('statusFailed') : props.item.done ? props.t('statusDone') : props.t('statusProcessing'))

const savedPct = computed(() => {
  if (props.item.file.size <= 0) return 0
  return Math.max(0, Math.round((1 - props.item.outSize / props.item.file.size) * 100))
})

// Already-best needs no extra state: a normal success always outputs
// strictly smaller than the input (the never-bigger check guarantees it),
// so done + outSize >= file.size is exactly the already-best case, and it
// can never go stale across recompresses.
const isAlreadyBest = computed(() => props.item.done && props.item.outSize >= props.item.file.size)

// Dims line shows for every finished row (mock rows read
// "1920×1080 → 1920×1080" even when unchanged): output dims fall back to
// the original when the encoder kept the size (already-best never assigns
// outW/outH, so the fallback is what makes its line read unchanged).
const dimsShown = computed(() => props.item.done && props.item.origW > 0 && props.item.origH > 0)
// Output dimensions fall back to the input for already-best items. Unchanged
// dimensions stay on one line; a real resize gets the vertical original ↓
// output layout, which is easier to scan than a long horizontal "A → B".
const outW = computed(() => props.item.outW || props.item.origW)
const outH = computed(() => props.item.outH || props.item.origH)
const dimsChanged = computed(() => outW.value !== props.item.origW || outH.value !== props.item.origH)

// Barely-smaller output: worth one quiet line, not a green celebration.
// PNG without quantization gets the actionable variant (quantization is
// the lever that actually shrinks it); the snapshot proves what the
// displayed result was computed under.
const showSmallTag = computed(() => props.item.done && !isAlreadyBest.value && savedPct.value < 10)
// Same grey bordered tag as already-best; only the verdict differs. A
// lossless PNG gets the actionable "try quantization" wording.
const smallTagText = computed(() => {
  const ls = props.item.lastSettings
  return ls && ls.format === 'image/png' && !ls.quantize ? props.t('smallSaveQuantTag') : props.t('smallSaveTag')
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

onUnmounted(() => { if (copyTimer) clearTimeout(copyTimer) })
</script>
