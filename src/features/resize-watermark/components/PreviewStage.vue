<template>
  <!-- Live preview canvas. Desktop: drag the watermark to move it, drag the
  picture (crop mode) to reframe. Touch: one finger on the watermark moves
  it, two fingers reframe, a horizontal swipe elsewhere switches images.
  Drags only emit new values; the view owns the state. -->
  <div ref="wrap" class="rw-stage" :class="{ touch, empty: !bmp }" :style="{ height: boxH ? `${boxH}px` : undefined }">
    <canvas
      v-show="bmp"
      ref="cv"
      class="rw-stage-canvas"
      :class="{ checker: checker }"
      :style="{ cursor }"
      role="img"
      :aria-label="label"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @lostpointercapture="onLost"
    ></canvas>
    <p v-if="!bmp" class="rw-stage-empty">{{ emptyText }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Focus, RwSettings } from '../types'
import { panFocus } from '../lib/geometry'
import { hitTest, type WmLayout } from '../lib/watermark'
import { renderOriginal, renderStage, stageLayout, type StageLayout } from '../lib/preview'
import { keepsAlpha } from '../lib/settings'

type Img = CanvasImageSource & { width: number; height: number }

const props = defineProps<{
  bmp: Img | null
  srcW: number
  srcH: number
  settings: RwSettings
  focus: Focus
  outType: string
  text: string
  logo: Img | null
  view: 'effect' | 'original'
  /** Show the whole source around the crop window (desktop). */
  context: boolean
  touch: boolean
  /** Max canvas height in CSS px. */
  maxH: number
  label: string
  emptyText: string
}>()
const emit = defineEmits<{
  (e: 'wm', pos: { x: number; y: number }): void
  (e: 'focus', f: Focus): void
  (e: 'swipe', dir: 1 | -1): void
  (e: 'layout', L: StageLayout | null): void
}>()

const wrap = ref<HTMLDivElement | null>(null)
const cv = ref<HTMLCanvasElement | null>(null)
const width = ref(0)
let L: StageLayout | null = null
let wmLayout: WmLayout = { items: [], fontPx: 0, bw: 0, bh: 0 }
const boxH = ref(0)
const cursor = ref('default')
const checker = computed(() => props.view === 'effect' && keepsAlpha(props.outType))

let raf = 0
function schedule() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    draw()
  })
}
function draw() {
  const c = cv.value
  const bmp = props.bmp
  if (!c || !bmp || !width.value || !props.srcW || !props.srcH) {
    L = null
    boxH.value = 0
    emit('layout', null)
    return
  }
  const maxW = width.value
  const maxH = Math.max(120, props.maxH)
  const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1
  if (props.view === 'original') {
    renderOriginal(c, bmp, props.srcW, props.srcH, maxW, maxH, dpr)
    L = null
    wmLayout = { items: [], fontPx: 0, bw: 0, bh: 0 }
    boxH.value = parseFloat(c.style.height) || 0
    emit('layout', null)
    return
  }
  L = stageLayout(props.srcW, props.srcH, props.settings, props.focus, maxW, maxH, props.context)
  wmLayout = renderStage(c, L, {
    bmp,
    srcW: props.srcW,
    srcH: props.srcH,
    settings: props.settings,
    focus: props.focus,
    outType: props.outType,
    text: props.text,
    logo: props.logo,
    dpr,
  })
  boxH.value = L.cssH
  emit('layout', L)
}

watch(() => [props.bmp, props.srcW, props.srcH, props.settings, props.focus, props.outType, props.text, props.logo, props.view, props.context, props.maxH, width.value], schedule)

let ro: ResizeObserver | null = null
onMounted(() => {
  const el = wrap.value!
  width.value = el.clientWidth
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      if (wrap.value && Math.abs(wrap.value.clientWidth - width.value) > 0.5) width.value = wrap.value.clientWidth
    })
    ro.observe(el)
  }
  schedule()
})
onBeforeUnmount(() => {
  ro?.disconnect()
  if (raf) cancelAnimationFrame(raf)
})

// ---- pointer gestures ----
type Mode = 'none' | 'wm' | 'pan' | 'swipe'
const pts = new Map<number, { x: number; y: number }>()
let mode: Mode = 'none'
let start = { x: 0, y: 0 }
let startCenter = { x: 0, y: 0 }
let startFocus: Focus = { x: 0.5, y: 0.5 }
let startL: StageLayout | null = null

function local(e: PointerEvent) {
  const r = cv.value!.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}
function avg() {
  let x = 0
  let y = 0
  for (const p of pts.values()) { x += p.x; y += p.y }
  const n = Math.max(1, pts.size)
  return { x: x / n, y: y / n }
}
function onWatermark(p: { x: number; y: number }): boolean {
  if (!L || !props.settings.wm.enabled || props.settings.wm.pos === 'tile' || !wmLayout.items.length) return false
  const ox = (p.x - L.frame.x) / L.ds
  const oy = (p.y - L.frame.y) / L.ds
  return hitTest(wmLayout, ox, oy, (props.touch ? 14 : 6) / L.ds)
}
function canPan() {
  return !!L && L.g.cropped
}
function beginPan() {
  mode = 'pan'
  start = avg()
  startFocus = { ...props.focus }
  startL = L
}

function onDown(e: PointerEvent) {
  if (props.view !== 'effect' || !L) {
    if (props.touch) { pts.set(e.pointerId, local(e)); mode = 'swipe'; start = local(e) }
    return
  }
  try { cv.value?.setPointerCapture(e.pointerId) } catch { /* synthetic */ }
  const p = local(e)
  pts.set(e.pointerId, p)
  if (pts.size === 2 && props.touch) {
    if (canPan()) beginPan()
    else mode = 'none'
    return
  }
  if (pts.size > 1) return
  if (onWatermark(p)) {
    mode = 'wm'
    start = p
    const it = wmLayout.items[0]
    startCenter = { x: it.cx, y: it.cy }
    e.preventDefault()
  } else if (!props.touch && canPan()) {
    beginPan()
    e.preventDefault()
  } else if (props.touch) {
    mode = 'swipe'
    start = p
  } else mode = 'none'
}

function onMove(e: PointerEvent) {
  const p = local(e)
  if (!pts.has(e.pointerId)) {
    // Hover cursor (mouse only).
    if (!props.touch && L && props.view === 'effect') cursor.value = onWatermark(p) ? 'move' : canPan() ? 'grab' : 'default'
    return
  }
  pts.set(e.pointerId, p)
  if (!L) return
  if (mode === 'wm') {
    const W = L.g.canvas.w
    const H = L.g.canvas.h
    const cx = startCenter.x + (p.x - start.x) / L.ds
    const cy = startCenter.y + (p.y - start.y) / L.ds
    emit('wm', { x: Math.min(1, Math.max(0, cx / W)), y: Math.min(1, Math.max(0, cy / H)) })
    cursor.value = 'move'
  } else if (mode === 'pan' && startL) {
    const a = avg()
    // CSS px → source px: the crop window moves against the drag.
    const k = startL.ds * startL.g.scale
    emit('focus', panFocus(startL.g, props.srcW, props.srcH, startFocus, (a.x - start.x) / k, (a.y - start.y) / k))
    cursor.value = 'grabbing'
  }
}

function onUp(e: PointerEvent) {
  const p = pts.get(e.pointerId)
  pts.delete(e.pointerId)
  if (mode === 'swipe' && p && pts.size === 0) {
    const dx = p.x - start.x
    const dy = p.y - start.y
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) emit('swipe', dx < 0 ? 1 : -1)
  }
  if (mode === 'pan' && pts.size > 0 && props.touch) {
    // One finger lifted: keep panning with the rest from here.
    beginPan()
    return
  }
  if (pts.size === 0) {
    mode = 'none'
    startL = null
    if (!props.touch) cursor.value = 'default'
  }
}
function onLost(e: PointerEvent) {
  if (pts.has(e.pointerId)) onUp(e)
}
</script>
