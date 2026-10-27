<template>
  <header>
    <div>
      <h1><span>{{ t('appTitle') }}</span><span class="badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>{{ t('badgeLocal') }}</span></h1>
      <p>{{ t('headerSub') }}</p>
    </div>
    <div class="header-actions">
      <button class="gh-btn icon-btn" id="themeBtn" type="button" :title="themeTitle" :aria-label="t('themeAria')" @click="toggleTheme" v-html="themeIcon"></button>
      <select id="langSelect" class="lang-select" :value="lang" :aria-label="t('langAria')" @change="setLang(($event.target as HTMLSelectElement).value as Lang)">
        <option v-for="l in LANGS" :key="l.code" :value="l.code">{{ l.label }}</option>
      </select>
      <a class="gh-btn" href="https://github.com/kimorix/image-compressor" target="_blank" rel="noopener"><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" /></svg><span class="gh-text">{{ t('githubBtn') }}</span></a>
    </div>
  </header>
  <main :class="{ 'no-result': items.length === 0 }">
    <div class="card" id="uploadCard">
      <DropZone ref="dropzoneRef" :t="t" :compact="items.length > 0" @files="addFiles" />
      <p v-if="fileHint" class="file-hint">{{ fileHint }}</p>
    </div>

    <div class="card" id="settingsCard">
      <button v-if="items.length > 0" class="settings-summary" type="button" :aria-expanded="!settingsCollapsed" @click="settingsCollapsed = !settingsCollapsed">
        <span>{{ settingsSummary }}</span><span class="settings-caret">{{ settingsCollapsed ? '▾' : '▴' }}</span>
      </button>
      <div :class="{ 'settings-body-collapsed': items.length > 0 && settingsCollapsed }">
        <SettingsPanel :settings="settings" :t="t" @update="onSettingsUpdate" @preset="onPreset" />
      </div>
    </div>

    <div class="card" id="resultCard" v-show="items.length > 0">
      <ProgressBar :finished="finishedCount" :total="items.length" :t="t" />
      <div id="summary" v-html="summaryHtml"></div>
      <div id="list">
        <ImageItem
          v-for="item in items"
          :key="item.id"
          :item="item"
          :t="t"
          @remove="removeItem"
          @preview="lightboxId = $event.id"
          @use-webp="onUseWebp"
        />
      </div>
      <div v-if="allAlreadyBest" class="dl-note">{{ t('allBestNote', items.length) }}</div>
      <div class="actions">
        <button class="primary" id="downloadAll" :disabled="doneCount === 0 || zipping" @click="downloadAll">{{ t('downloadAll') }}</button>
        <button id="clearAll" :class="{ danger: clearConfirm }" :disabled="items.length === 0" @click="onClearClick">{{ clearConfirm ? t('clearConfirm') : t('clearAll') }}</button>
      </div>
    </div>
  </main>
  <div class="sticky-bar" v-show="items.length > 0">
    <button class="sticky-add" type="button" @click="openPicker">{{ t('addBtn') }}</button>
    <button class="sticky-clear" type="button" :disabled="items.length === 0" @click="onClearClick">{{ clearConfirm ? t('clearConfirm') : t('clearAll') }}</button>
    <button class="sticky-download primary" type="button" :disabled="doneCount === 0 || zipping" @click="downloadAll">{{ t('downloadAll') }}</button>
  </div>
  <div class="sticky-spacer" v-show="items.length > 0" aria-hidden="true"></div>
  <!-- Global recompress indicator: the centered "processing" pill is the
  single loading indicator. pointer-events none: it must never block taps
  while a run is in flight. -->
  <div class="global-loading" :class="{ show: recompressing }" aria-hidden="true"><span class="gl-spin"></span><span>{{ t('processing') }}</span></div>
  <div v-if="pageDragging" class="page-drop-hint" aria-hidden="true">{{ t('dropAnywhere') }}</div>
  <Lightbox v-if="lbItem" :item="lbItem" :t="t" @close="lightboxId = null" />
  <footer v-html="t('footer')"></footer>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'
import { zipSync } from 'fflate'
import DropZone from './components/DropZone.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import ImageItem from './components/ImageItem.vue'
import Lightbox from './components/Lightbox.vue'
import ProgressBar from './components/ProgressBar.vue'
import { LANGS, initialLang, t as tx, type Lang } from './i18n'
import { applyTheme, initialTheme, MOON_ICON, SUN_ICON, type Theme } from './lib/theme'
import { CompressPool } from './lib/compress-pool'
import { baseName, fmtSize } from './lib/format'
import { DEFAULT_SETTINGS, matchPreset, PRESETS } from './lib/presets'
import { loadSavedSettings, saveSettings } from './lib/settings-store'
import { newItem, type CompressItem, type Settings } from './types'

const lang = ref<Lang>(initialLang())
const theme = ref<Theme>(initialTheme())
const settings = reactive<Settings>({ ...DEFAULT_SETTINGS, ...loadSavedSettings() })
// Remember the last-used settings across visits. Writing storage never
// mutates settings, so this watcher cannot loop.
watch(settings, () => saveSettings(settings), { deep: true })
// shallowRef on purpose: File/Blob objects must never be wrapped by Vue's
// reactive proxy (it breaks platform brand checks like createObjectURL).
const items = shallowRef<CompressItem[]>([])

// Mobile settings collapse: with images, the settings card folds to a
// one-line summary (tapping it expands). Default collapsed so the results
// are visible right under the upload area.
const settingsCollapsed = ref(true)
const settingsSummary = computed(() => {
  // Smart mode has no format/quality to show: it picks per image.
  if (settings.mode === 'smart') {
    const parts = [t('modeSmart')]
    if (settings.smartKeepOriginal) parts.push(t('smartKeepOriginalShort'))
    if (settings.maxSize) parts.push(settings.resizeMode === 'percent' ? `${settings.maxSize}%` : `${settings.maxSize}px`)
    return parts.join(' · ')
  }
  const fmt = settings.format === 'original' ? t('fmtOriginal')
    : settings.format === 'image/webp' ? 'WebP' : settings.format.split('/')[1].toUpperCase()
  const mode = settings.mode === 'target' ? `≤${settings.targetSize}KB` : `${settings.quality}%`
  const parts = [fmt, mode]
  if (settings.maxSize) parts.push(settings.resizeMode === 'percent' ? `${settings.maxSize}%` : `${settings.maxSize}px`)
  return parts.join(' · ')
})

// Sticky-bar "+ Add" reuses the dropzone's picker (a label for the hidden
// file input is unreliable on iOS Safari; a programmatic click is not).
const dropzoneRef = ref<{ openPicker: () => void } | null>(null)
function openPicker() { dropzoneRef.value?.openPicker() }

function t(key: string, ...args: (string | number)[]): string {
  return tx(lang.value, key, ...args)
}

const themeIcon = computed(() => (theme.value === 'dark' ? SUN_ICON : MOON_ICON))
const themeTitle = computed(() => (theme.value === 'dark' ? t('themeToDay') : t('themeToNight')))

const doneCount = computed(() => items.value.filter((i) => i.done).length)
const finishedCount = computed(() => items.value.filter((i) => i.done || i.error).length)
// Every finished item already optimal: "download all" would just hand back
// the originals, so the note says so up front.
const allAlreadyBest = computed(() => items.value.length > 0
  && items.value.every((i) => i.done && i.outSize >= i.file.size))

const summaryHtml = computed(() => {
  if (!items.value.length) return ''
  const orig = items.value.reduce((s, i) => s + i.file.size, 0)
  const doneItems = items.value.filter((i) => i.done)
  const comp = doneItems.reduce((s, i) => s + i.outSize, 0)
  // Saved % and bytes are computed over finished items only: with nothing
  // finished yet, "0 B -> 100% saved" would be a lie, so it reads 0%.
  const doneOrig = doneItems.reduce((s, i) => s + i.file.size, 0)
  const saved = doneOrig > 0 ? Math.max(0, Math.round((1 - comp / doneOrig) * 100)) : 0
  const detail = t('summaryDetail', items.value.length, doneCount.value, fmtSize(orig), fmtSize(comp))
  // No big figure when nothing was saved yet (or everything was already
  // optimal): the per-item already-best badge carries that case.
  const body = (doneCount.value === 0 || saved === 0)
    ? `<div class="sum-detail">${detail}</div>`
    : `<div class="sum-big">${t('sumBig', saved)}</div><div class="sum-detail">${detail}</div>`
  // The thumbnail-toggle hint used to repeat on every row; once, under the
  // summary, is enough.
  return `${body}<div class="list-hint">${t('thumbHint')}</div>`
})

function refresh() {
  items.value = [...items.value]
}

// Items live in a shallowRef (File/Blob must stay unproxied), so an in-place
// field mutation alone never re-renders a child: its props reference is unchanged.
// Every state change therefore replaces the item object.
function replaceItem(updated: CompressItem) {
  const idx = items.value.findIndex((i) => i.id === updated.id)
  if (idx >= 0) {
    const old = items.value[idx]
    if (old.outUrl && old.outUrl !== updated.outUrl) URL.revokeObjectURL(old.outUrl)
    items.value[idx] = updated
  }
  refresh()
}

// Generation guard: settings changes and file adds can overlap in-flight runs.
// Only the latest run's results are applied; a stale run's blob is revoked.
let runGen = 0
// Runs currently encoding (fresh or recompress). The summary shows a
// spinner while a recompress is in flight over finished items.
const activeRuns = ref(0)
const recompressing = computed(() => activeRuns.value > 0 && items.value.length > 0 && items.value.every((i) => i.done))
// Encode workers (2–4 by hardwareConcurrency, see compress-pool): the pool
// queues the rest, so a 50-photo batch neither spikes memory nor blocks
// the main thread.
const pool = new CompressPool()
// A settings change that lands mid-run must not start a second run on top
// of it (that was the click-spam freeze: several full encodes burning CPU
// at once, only the last one's results kept). It just marks a trailing run,
// which fires once with the latest settings when the active run drains.
let pendingRecompress = false
async function runCompress(list: CompressItem[], g: number, snap: Settings) {
  activeRuns.value++
  try {
    await Promise.all(list.map(async (item) => {
      const res = await pool.run(item, snap, lang.value)
      if (g !== runGen) {
        if (res.done) URL.revokeObjectURL(res.outUrl)
        return
      }
      // Only a successful result counts as "computed under snap": a
      // failed item keeps its displayed (older) result, so its snapshot
      // must stay at the older settings, not advance to snap.
      replaceItem({ ...item, ...res, ...(res.done ? { lastSettings: snap } : {}) })
    }))
  } finally {
    activeRuns.value--
    if (activeRuns.value === 0 && pendingRecompress) {
      pendingRecompress = false
      void recompressAll()
    }
  }
}

function setLang(l: Lang) {
  lang.value = l
  document.documentElement.lang = l
  document.documentElement.dataset.lang = l
  try { localStorage.setItem('ic-lang', l) } catch { /* ignore */ }
  document.title = t('docTitle')
  const md = document.querySelector('meta[name="description"]')
  if (md) md.setAttribute('content', t('metaDesc'))
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  applyTheme(theme.value)
}

// Transient note for files skipped by the addFiles funnel (non-images).
const fileHint = ref<string | null>(null)
let hintTimer: ReturnType<typeof setTimeout> | null = null

function addFiles(files: File[]) {
  // Single funnel for drop, paste and picker. Chrome/Windows often
  // reports an empty type for HEIC files, so the extension is the
  // fallback signal (same rule as isHeic in wasm-encoders). Anything
  // that is not an image is skipped with a visible hint instead of
  // silently vanishing, which was the old drop/paste behavior.
  const accepted = files.filter(
    (f) => f.type.startsWith('image/') || /\.hei[cf]$/i.test(f.name),
  )
  const filtered = files.length - accepted.length
  if (filtered > 0) {
    fileHint.value = t('filteredNote', filtered)
    if (hintTimer) clearTimeout(hintTimer)
    hintTimer = setTimeout(() => { fileHint.value = null }, 5000)
  }
  if (!accepted.length) return
  for (const file of accepted) items.value.push(newItem(file))
  refresh()
  const g = ++runGen
  const snap = { ...settings }
  void runCompress(items.value.filter((i) => !i.done), g, snap)
}

// "不受影响"的定义，只针对已最优项（它的输出就是原图，UI 上以
// done && outSize >= file.size 判断）：新设置比上次计算时不更"激进"，
// 它就必然仍是最优，重压纯属浪费。激进 = 会让输出变小、可能脱离已最优：
// 格式、模式、quantize 任一变化（跨格式尺寸无序，所以格式变更不能跳）；
// 质量（质量模式）、目标尺寸（目标模式）降低；尺寸上限真正收紧
// （maxSize=0 是不限；noUpscale 的影响已折进尺寸里）；keepExif 仅对
// JPEG 输出有注入，关掉它才会让输出变小。
// 跳过只会错失一次"可能更小"的结果（仍输出正确原图），不会出错误结果；
// 所以不确定的方向一律取"重压"（保守），只有确信无影响时才跳过。
function isUnaffected(item: CompressItem, next: Settings): boolean {
  if (!item.done || item.outSize < item.file.size) return false
  const prev = item.lastSettings
  if (!prev) return false
  if (prev.format !== next.format || prev.mode !== next.mode || prev.quantize !== next.quantize || prev.smartKeepOriginal !== next.smartKeepOriginal) return false
  if (next.mode === 'quality' && next.quality < prev.quality) return false
  if (next.mode === 'target' && next.targetSize < prev.targetSize) return false
  const origMax = Math.max(item.origW, item.origH)
  const dimOf = (s: Settings) => {
    if (!s.maxSize) return origMax
    if (s.resizeMode === 'percent') {
      let sc = s.maxSize / 100
      if (s.noUpscale && sc > 1) sc = 1
      return Math.round(origMax * sc)
    }
    if (s.resizeMode === 'width' || s.resizeMode === 'height') {
      const dim = s.resizeMode === 'width' ? item.origW : item.origH
      const out = (dim > s.maxSize || !s.noUpscale) ? s.maxSize : dim
      const other = s.resizeMode === 'width' ? item.origH : item.origW
      return Math.max(out, Math.round(other * (out / dim)))
    }
    return s.noUpscale ? Math.min(origMax, s.maxSize) : s.maxSize
  }
  if (dimOf(next) < dimOf(prev)) return false
  const injectedUnderPrev = prev.keepExif && item.file.type === 'image/jpeg'
    && (prev.format === 'image/jpeg' || prev.format === 'original')
  if (injectedUnderPrev && !next.keepExif) return false
  return true
}

async function recompressAll() {
  if (!items.value.length) return
  if (activeRuns.value > 0) {
    pendingRecompress = true
    return
  }
  const g = ++runGen
  const snap = { ...settings }
  // Do NOT reset finished items first: blanking them back to "processing"
  // flashes the whole result card (progress bar, 0 B / 100% summary, thumbs
  // flipping to original) on every settings click. Old results stay visible
  // and downloadable until the new run's result replaces them.
  await runCompress(items.value.filter((item) => !isUnaffected(item, snap)), g, snap)
}

function onSettingsUpdate(patch: Partial<Settings>) {
  // No-change updates (re-selecting the current format, dragging the slider
  // back to its value) used to burn a full recompress for nothing.
  const changed = (Object.keys(patch) as (keyof Settings)[]).some((k) => settings[k] !== patch[k])
  if (!changed) return
  const onlyName = Object.keys(patch).length === 1 && 'keepOriginalName' in patch
  Object.assign(settings, patch)
  if (onlyName) {
    // Renaming needs no re-encode: rewrite the download names in place
    // (new objects, so the rows re-render). Already-best items keep the
    // original filename either way and are skipped.
    items.value = items.value.map((item) => {
      if (!item.done || !item.outName || item.outSize >= item.file.size) return item
      const dot = item.outName.lastIndexOf('.')
      const ext = dot > 0 ? item.outName.slice(dot) : ''
      return { ...item, outName: baseName(item.file.name) + (settings.keepOriginalName ? '' : '-compressed') + ext }
    })
    return
  }
  void recompressAll()
}

// Transparent image flattened to JPEG: the row offers the one-tap fix.
function onUseWebp() {
  onSettingsUpdate({ format: 'image/webp' })
}

// Preset click = apply; clicking the active preset again cancels it:
// settings roll back to the snapshot taken when that preset was applied
// (or to defaults when there is none, e.g. the page loaded with a preset
// already matching). Only a manual settings change clears the highlight
// otherwise, via matchPreset in the panel.
let presetSnapshot: Settings | null = null
function onPreset(id: string) {
  if (matchPreset(settings) === id) {
    if (presetSnapshot) Object.assign(settings, presetSnapshot)
    else Object.assign(settings, DEFAULT_SETTINGS)
    presetSnapshot = null
    void recompressAll()
    return
  }
  const p = PRESETS.find((x) => x.id === id)
  if (!p) return
  presetSnapshot = { ...settings }
  Object.assign(settings, p.patch)
  void recompressAll()
}

function removeItem(item: CompressItem) {
  URL.revokeObjectURL(item.url)
  if (item.outUrl) URL.revokeObjectURL(item.outUrl)
  items.value = items.value.filter((i) => i.id !== item.id)
  if (lightboxId.value === item.id) lightboxId.value = null
}

// Preview overlay: stores only the id, so the overlay always shows the
// live item object (it survives recompresses that replace the item).
const lightboxId = ref<string | null>(null)
const lbItem = computed(() => items.value.find((i) => i.id === lightboxId.value) ?? null)

function downloadAll() {
  void downloadAllZip()
}

const zipping = ref(false)
async function downloadAllZip() {
  const done = items.value.filter((i) => i.done && i.outUrl)
  if (!done.length || zipping.value) return
  // One zip download instead of many consecutive downloads: browsers,
  // especially Safari/iOS, block the latter. level 0 (store) — the files are
  // already compressed, no need to burn CPU recompressing them.
  zipping.value = true
  try {
    const used = new Set<string>()
    const files: Record<string, Uint8Array> = {}
    for (const item of done) {
      let name = item.outName ?? item.file.name
      if (used.has(name)) {
        const dot = name.lastIndexOf('.')
        const stem = dot > 0 ? name.slice(0, dot) : name
        const ext = dot > 0 ? name.slice(dot) : ''
        let n = 2
        while (used.has(`${stem}-${n}${ext}`)) n++
        name = `${stem}-${n}${ext}`
      }
      used.add(name)
      const buf = await (await fetch(item.outUrl!)).arrayBuffer()
      files[name] = new Uint8Array(buf)
    }
    const zipped = zipSync(files, { level: 0 })
    const url = URL.createObjectURL(new Blob([zipped], { type: 'application/zip' }))
    const a = document.createElement('a')
    a.href = url
    const d = new Date()
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    a.download = `images-compressed-${ymd}-${done.length}.zip`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  } finally {
    zipping.value = false
  }
}

function clearAll() {
  items.value.forEach((i) => {
    URL.revokeObjectURL(i.url)
    if (i.outUrl) URL.revokeObjectURL(i.outUrl)
  })
  items.value = []
  lightboxId.value = null
}

// Clearing is destructive and the button sits next to the primary action,
// so the first click only arms it ("confirm?") and the second clears.
// The armed state expires after 3s.
const clearConfirm = ref(false)
let clearTimer: ReturnType<typeof setTimeout> | null = null
function onClearClick() {
  if (!clearConfirm.value) {
    clearConfirm.value = true
    if (clearTimer) clearTimeout(clearTimer)
    clearTimer = setTimeout(() => { clearConfirm.value = false }, 3000)
    return
  }
  if (clearTimer) clearTimeout(clearTimer)
  clearConfirm.value = false
  clearAll()
}

function onPaste(e: ClipboardEvent) {
  const files = [...(e.clipboardData?.files ?? [])]
  if (files.length) addFiles(files)
}

// Full-page drop: files dropped anywhere on the page are accepted, not
// just on the dropzone. dragenter/dragleave balance via a counter (child
// boundaries fire both, so a boolean would flicker); the hint only shows
// for real file drags (types includes 'Files'), not for dragged images
// or text. Drops on the dropzone itself are left to its own handler.
const pageDragging = ref(false)
let dragDepth = 0
function onDocDragEnter(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('Files')) return
  dragDepth++
  pageDragging.value = true
}
function onDocDragLeave(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('Files')) return
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) pageDragging.value = false
}
function onDocDragEnd() {
  dragDepth = 0
  pageDragging.value = false
}
function onDocDragOver(e: DragEvent) {
  // Allow drops anywhere on the page (the drop handler decides).
  e.preventDefault()
}
function onDocDrop(e: DragEvent) {
  dragDepth = 0
  pageDragging.value = false
  const target = e.target as HTMLElement | null
  if (target?.closest?.('#dropzone')) return
  const files = [...(e.dataTransfer?.files ?? [])]
  if (!files.length) return
  // Without this the browser would navigate away to the dropped file.
  e.preventDefault()
  addFiles(files)
}

onMounted(() => {
  applyTheme(theme.value)
  setLang(lang.value)
  document.addEventListener('paste', onPaste)
  document.addEventListener('dragenter', onDocDragEnter)
  document.addEventListener('dragleave', onDocDragLeave)
  document.addEventListener('dragend', onDocDragEnd)
  document.addEventListener('dragover', onDocDragOver)
  document.addEventListener('drop', onDocDrop)
})
onUnmounted(() => {
  document.removeEventListener('paste', onPaste)
  document.removeEventListener('dragenter', onDocDragEnter)
  document.removeEventListener('dragleave', onDocDragLeave)
  document.removeEventListener('dragend', onDocDragEnd)
  document.removeEventListener('dragover', onDocDragOver)
  document.removeEventListener('drop', onDocDrop)
})
</script>
