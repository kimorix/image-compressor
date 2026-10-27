<template>
  <div class="sheet-overlay" @click.self="emit('close')">
    <section
      ref="sheetRef"
      class="sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheetTitle"
      :style="sheetStyle"
    >
      <div class="sheet-drag" @pointerdown="onDragStart">
        <span class="sheet-handle"></span>
      </div>
      <div class="sheet-head">
        <h2 id="sheetTitle">{{ t('detailTitle') }}</h2>
        <button ref="closeBtn" type="button" class="sheet-close" :title="t('lbClose')" :aria-label="t('lbClose')" @click="emit('close')">×</button>
      </div>

      <div class="sheet-body">
        <div class="pv-stage sheet-stage" @click="onStageClick($event, () => emit('preview', item))">
          <div class="pv-compare" ref="compareRef" :style="compareStyle">
            <img class="pv-img" :src="compSrc" :alt="item.file.name" />
            <div v-if="canCompare" class="pv-orig-clip" :style="{ clipPath: `inset(0 ${100 - pos}% 0 0)` }">
              <img class="pv-img" :src="item.url" :alt="item.file.name" />
            </div>
            <div
              v-if="canCompare"
              class="pv-divider"
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
              <span class="pv-handle">↔</span>
            </div>
            <span v-if="canCompare" class="pv-side-tag left">{{ t('tagOrig') }}</span>
            <span v-if="canCompare" class="pv-side-tag right">{{ t('tagComp') }}</span>
          </div>
        </div>

        <p class="sheet-name" :title="item.file.name">{{ item.file.name }}</p>

        <div class="sheet-summary">
          <span v-if="item.done && item.outUrl" class="sheet-sizes">{{ fmtSize(item.file.size) }} → {{ fmtSize(item.outSize) }}</span>
          <span v-else class="sheet-sizes">{{ fmtSize(item.file.size) }}</span>
          <span v-if="item.done && item.outUrl && !isAlreadyBest" class="sheet-pct">−{{ savedPct }}%</span>
          <span v-if="statusLine" class="sheet-state" :class="{ fail: !!item.error && !item.cancelled }">{{ statusLine }}</span>
        </div>

        <dl class="sheet-rows">
          <div v-if="dimsText">
            <dt>{{ t('thDims') }}</dt>
            <dd :class="{ warn: upscaled }">{{ dimsText }}</dd>
          </div>
          <div>
            <dt>{{ t('thFormat') }}</dt>
            <dd>{{ formatText }}</dd>
          </div>
        </dl>

        <div v-if="hasNotes" class="sheet-notes">
          <h3>{{ t('detailNotes') }}</h3>
          <p v-if="item.error" :class="['sheet-note', { fail: !item.cancelled }]">{{ item.error }}</p>
          <p v-if="item.cancelled && !item.error" class="sheet-note">{{ t('cancelled') }}</p>
          <p v-if="item.targetNote" class="sheet-note">{{ item.targetNote }}</p>
          <p v-if="item.typeNote" class="sheet-note">{{ item.typeNote }}</p>
          <p v-if="item.isAnimatedGif" class="sheet-note">{{ t('gifFirstFrame') }}</p>
          <p v-if="showAlphaNote" class="sheet-note">
            {{ t('alphaJpegNote') }}
            <button type="button" class="sheet-link" @click="emit('use-webp', item)">{{ t('useWebpBtn') }}</button>
          </p>
          <p v-if="smallSave" class="sheet-note">{{ smallSaveText }}</p>
          <p v-if="isAlreadyBest" class="sheet-note">{{ t('alreadyBest') }}</p>
          <p v-if="copyState === 'fail'" class="sheet-note fail">{{ t('copyFailed') }}</p>
        </div>

        <button v-if="showRetry" type="button" class="sheet-retry" @click="emit('retry', item)">{{ t('retryBtn') }}</button>
      </div>

      <div class="sheet-actions">
        <button type="button" class="sheet-secondary" :disabled="!canDownload || copying" @click="onCopy">
          {{ copyState === 'ok' ? t('copied') : t('copyBtn') }}
        </button>
        <button type="button" class="sheet-secondary danger" @click="emit('remove', item)">{{ t('deleteBtn') }}</button>
        <button type="button" class="primary" :disabled="!canDownload" @click="onPrimary">{{ primaryLabel }}</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { CompressItem } from '../types'
import { fmtSize } from '../lib/format'
import { useCompareSlider } from '../composables/useCompareSlider'

const props = defineProps<{
  item: CompressItem
  t: (key: string, ...args: (string | number)[]) => string
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'remove', item: CompressItem): void
  (e: 'retry', item: CompressItem): void
  (e: 'use-webp', item: CompressItem): void
  (e: 'preview', item: CompressItem): void
}>()

const itemRef = computed(() => props.item) as Ref<CompressItem | null>
const { pos, compareRef, onDividerDown, onDividerKey, onStageClick } = useCompareSlider(itemRef)

const sheetRef = ref<HTMLElement | null>(null)
const closeBtn = ref<HTMLButtonElement | null>(null)
const dragY = ref(0)
const sheetStyle = computed(() => ({ transform: `translateY(${Math.max(0, dragY.value)}px)` }))

const done = computed(() => props.item.done && !!props.item.outUrl)
const canCompare = computed(() => done.value)
const canDownload = computed(() => done.value)
const compSrc = computed(() => (props.item.done && props.item.outUrl ? props.item.outUrl : props.item.url))
const showRetry = computed(() => !!props.item.error && props.item.retryable !== false)
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
const primaryLabel = computed(() => (shareable.value ? props.t('saveToAlbum') : props.t('btnDownload')))
const isAlreadyBest = computed(() => props.item.done && props.item.outSize >= props.item.file.size)
const savedPct = computed(() => {
  if (props.item.file.size <= 0) return 0
  return Math.max(0, Math.round((1 - props.item.outSize / props.item.file.size) * 100))
})
const formatMap: Record<string, string> = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/avif': 'AVIF' }
const fmtTag = computed(() => {
  if (props.item.done && props.item.outType) return formatMap[props.item.outType] ?? props.item.outType
  return props.item.file.name.split('.').pop()?.toUpperCase() ?? ''
})
const sourceFmt = computed(() => {
  const t = props.item.file.type
  return formatMap[t] ?? (props.item.file.name.split('.').pop()?.toUpperCase() ?? '')
})
const formatText = computed(() => {
  if (props.item.done && props.item.outType && sourceFmt.value && sourceFmt.value !== fmtTag.value) {
    return `${sourceFmt.value} → ${fmtTag.value}`
  }
  return fmtTag.value
})
const outW = computed(() => props.item.outW || props.item.origW)
const outH = computed(() => props.item.outH || props.item.origH)
const upscaled = computed(() => props.item.done
  && (props.item.outW > props.item.origW || props.item.outH > props.item.origH))
const dimsText = computed(() => {
  const it = props.item
  if (!it.origW || !it.origH) return ''
  if (!it.done) return `${it.origW}×${it.origH}`
  if (it.origW === outW.value && it.origH === outH.value) {
    return `${it.origW}×${it.origH} ${props.t('dimsUnchanged')}`
  }
  return `${it.origW}×${it.origH} → ${outW.value}×${outH.value}`
})
const statusLine = computed(() => {
  const it = props.item
  if (it.error) return it.cancelled ? props.t('cancelled') : props.t('statusFailed')
  return ''
})
const showAlphaNote = computed(() => props.item.done && !isAlreadyBest.value
  && props.item.hasAlpha && props.item.outType === 'image/jpeg')
const smallSave = computed(() => props.item.done && !isAlreadyBest.value && savedPct.value < 10)
const smallSaveText = computed(() => {
  const ls = props.item.lastSettings
  return ls && ls.format === 'image/png' && !ls.quantize
    ? props.t('smallSaveQuantNote')
    : props.t('smallSaveNote')
})
const hasNotes = computed(() => !!(props.item.error || props.item.cancelled || props.item.targetNote
  || props.item.typeNote || props.item.isAnimatedGif || showAlphaNote.value
  || smallSave.value || isAlreadyBest.value || copyState.value === 'fail'))

// Keep the comparison readable inside the sheet without letting a portrait
// image push the action bar off-screen: cap the width using 38dvh.
const compareStyle = computed(() => {
  const w = done.value && props.item.outW ? props.item.outW : props.item.origW
  const h = done.value && props.item.outH ? props.item.outH : props.item.origH
  return w && h ? { width: `min(100%, calc(38dvh * ${w} / ${h}))` } : { width: '100%' }
})

const copyState = ref<'idle' | 'ok' | 'fail'>('idle')
const copying = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null
watch(() => props.item.id, () => { copyState.value = 'idle' })

async function onCopy() {
  if (!props.item.outUrl || copying.value) return
  copying.value = true
  try {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error('unsupported')
    const img = new Image()
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = props.item.outUrl! })
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    c.getContext('2d')!.drawImage(img, 0, 0)
    const png = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'))
    if (!png) throw new Error('png')
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
    copyState.value = 'ok'
  } catch (err) {
    console.warn('[image-compressor] Copy failed:', err)
    copyState.value = 'fail'
  } finally {
    copying.value = false
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copyState.value = 'idle' }, 1800)
  }
}

function onDownload() {
  const it = props.item
  if (!it.done || !it.outUrl) return
  const a = document.createElement('a')
  a.href = it.outUrl
  a.download = it.outName ?? it.file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

async function onPrimary() {
  if (!shareable.value) { onDownload(); return }
  const it = props.item
  if (!it.outUrl) return
  try {
    const blob = await (await fetch(it.outUrl)).blob()
    await navigator.share({ files: [new File([blob], it.outName ?? it.file.name, { type: blob.type })] })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return
    onDownload()
  }
}

// Down-swipe close: only the handle starts a drag, so scrolling the sheet
// body and dragging the comparison divider keep their own gestures.
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
  if (copyTimer) clearTimeout(copyTimer)
  previousFocus.value?.focus?.()
})
</script>
