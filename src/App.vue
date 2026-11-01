<template>
  <!-- Thin shell: the hash route picks the feature view. Views stay alive
  once opened (KeepAlive), so switching never drops a running batch or its
  results. Everything but the compressor is its own lazy chunk; the
  compressor bundle never loads pdf.js, pdf-lib, docx or tesseract.

  Switching is seamless: the current tool stays on screen until the next
  tool's chunk has loaded (no blank frame), then both are swapped in one
  frame. Every view renders the same header / side nav / tab bar markup, so
  only the content changes; it gets a short fade (.view-in, none under
  prefers-reduced-motion). Each tool keeps its own scroll position. Idle
  time after the first load warms the other tools' chunks. -->
  <KeepAlive>
    <component :is="view" v-if="view" :key="shown" v-bind="viewProps" />
  </KeepAlive>
  <div v-if="showProgress" class="view-progress" aria-hidden="true"></div>
</template>

<script setup lang="ts">
import { computed, markRaw, nextTick, ref, shallowReactive, watch, type Component } from 'vue'
import CompressorView from './features/image-compressor/CompressorView.vue'
import { useHashRoute, type Feature } from './shared/composables/useHashRoute'
import { pendingFeature } from './shared/composables/useViewSwitch'

type Loader = () => Promise<{ default: Component }>
const LOADERS: Partial<Record<Feature, Loader>> = {
  pdf: () => import('./features/pdf-to-word/PdfToWordView.vue'),
  convert: () => import('./features/format-convert/ConvertView.vue'),
  resize: () => import('./features/resize-watermark/ResizeWatermarkView.vue'),
  'pdf-merge': () => import('./features/pdf-merge/PdfMergeView.vue'),
  img2pdf: () => import('./features/img-to-pdf/ImgToPdfView.vue'),
}
const loadPlaceholder: Loader = () => import('./shared/components/ToolPlaceholder.vue')

// Resolved view components by feature (the compressor is in the main chunk).
const loaded = shallowReactive<Partial<Record<Feature, Component>>>({ compress: CompressorView })
const inflight = new Map<Feature, Promise<Component>>()

function load(f: Feature): Promise<Component> {
  const have = loaded[f]
  if (have) return Promise.resolve(have)
  let p = inflight.get(f)
  if (!p) {
    const loader = LOADERS[f] ?? loadPlaceholder
    // One retry: a flaky connection should not strand the user.
    p = loader().catch(() => loader()).then((m) => {
      const c = markRaw(m.default)
      loaded[f] = c
      return c
    }).finally(() => inflight.delete(f))
    inflight.set(f, p)
  }
  return p
}

const { route } = useHashRoute()
/** The tool on screen; trails `route` while the next chunk loads. */
const shown = ref<Feature | null>(loaded[route.value.feature] ? route.value.feature : null)
const view = computed(() => (shown.value ? loaded[shown.value] ?? null : null))
const viewProps = computed(() => (shown.value && !LOADERS[shown.value] && shown.value !== 'compress' ? { feature: shown.value } : {}))

// ---- per-tool scroll memory ----
const scrollPos = new Map<Feature, number>()
if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
  // Back/forward between tools must not let the browser restore a scroll
  // offset that belonged to the previous tool's page; the shell does it.
  try { history.scrollRestoration = 'manual' } catch { /* ignore */ }
}

let fadeTimer = 0
function playFade() {
  const root = document.documentElement
  root.classList.remove('view-in')
  // Restart the animation even on quick successive switches.
  void root.offsetWidth
  root.classList.add('view-in')
  clearTimeout(fadeTimer)
  fadeTimer = window.setTimeout(() => root.classList.remove('view-in'), 260)
}

// Swap in one go: remember where the old tool was scrolled, render the new
// one, then (before the browser paints) put it at its own remembered
// position — the top on a first visit.
async function show(f: Feature) {
  const prev = shown.value
  if (prev === f) return
  if (prev) scrollPos.set(prev, window.scrollY)
  shown.value = f
  await nextTick()
  window.scrollTo(0, scrollPos.get(f) ?? 0)
  if (prev) playFade()
}

// Thin progress line, only when a chunk takes long enough to notice.
const showProgress = ref(false)
let progressTimer = 0

watch(() => route.value.feature, (f) => {
  if (loaded[f]) {
    pendingFeature.value = null
    clearTimeout(progressTimer); showProgress.value = false
    void show(f)
    return
  }
  pendingFeature.value = shown.value ? f : null
  clearTimeout(progressTimer)
  progressTimer = window.setTimeout(() => { if (pendingFeature.value === f) showProgress.value = true }, 150)
  load(f).then(() => {
    // The user may have moved on while this chunk loaded.
    if (route.value.feature !== f) return
    pendingFeature.value = null
    clearTimeout(progressTimer); showProgress.value = false
    void show(f)
  }, (err) => {
    // Chunk failed twice (offline without a cached copy): stay on the
    // current tool rather than showing a blank page.
    console.warn('[view] failed to load', f, err)
    if (route.value.feature !== f) return
    pendingFeature.value = null
    clearTimeout(progressTimer); showProgress.value = false
    if (!shown.value) void show('compress')
  })
}, { immediate: true })

// ---- warm the other tools' chunks once the page is idle ----
// They are runtime fetches (and already in the service worker precache),
// so first-load JS is unchanged. Skipped when the user asked to save data.
function warm() {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? '')) return
  const queue = (Object.keys(LOADERS) as Feature[]).filter((f) => !loaded[f])
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  const idle = (cb: () => void) => { if (ric) ric.call(window, cb, { timeout: 3000 }); else window.setTimeout(cb, 300) }
  const next = () => {
    const f = queue.shift()
    if (!f) return
    load(f).catch(() => { /* fetched again on demand */ }).finally(() => idle(next))
  }
  idle(next)
}
if (typeof window !== 'undefined') {
  const start = () => window.setTimeout(warm, 1500)
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}
</script>

<style lang="less">
// Content-only fade after a tool switch. The header, side nav and tab bar
// are identical in every view, so they are left alone; opacity only (a
// transform would re-anchor fixed descendants such as the desktop panel).
@keyframes view-in {
  from { opacity: 0.35; }
  to { opacity: 1; }
}
.view-in .layout > main,
.view-in .layout > #historyView {
  animation: view-in 0.18s ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .view-in .layout > main,
  .view-in .layout > #historyView {
    animation: none;
  }
}
.view-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  z-index: 100;
  pointer-events: none;
  background: var(--accent, #3b82f6);
  transform-origin: 0 50%;
  animation: view-progress 1.2s ease-out forwards;
}
@keyframes view-progress {
  from { transform: scaleX(0.05); }
  to { transform: scaleX(0.85); }
}
@media (prefers-reduced-motion: reduce) {
  .view-progress { animation: none; transform: scaleX(0.6); }
}
</style>
