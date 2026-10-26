<template>
  <header>
    <div>
      <h1><span>{{ t('appTitle') }}</span><span class="badge">{{ t('badgeLocal') }}</span></h1>
      <p>{{ t('headerSub') }}</p>
    </div>
    <div class="header-actions">
      <button class="gh-btn icon-btn" id="themeBtn" type="button" :title="themeTitle" :aria-label="t('themeAria')" @click="toggleTheme" v-html="themeIcon"></button>
      <select id="langSelect" class="lang-select" :value="lang" :aria-label="t('langAria')" @change="setLang(($event.target as HTMLSelectElement).value as Lang)">
        <option v-for="l in LANGS" :key="l.code" :value="l.code">{{ l.label }}</option>
      </select>
      <a class="gh-btn" href="https://github.com/kimorix/image-compressor" target="_blank" rel="noopener">{{ t('githubBtn') }}</a>
    </div>
  </header>
  <main>
    <div class="card" id="uploadCard">
      <DropZone :t="t" @files="addFiles" />
    </div>

    <div class="card" id="resultCard" v-show="items.length > 0">
      <ProgressBar :finished="finishedCount" :total="items.length" :t="t" />
      <div id="summary" :class="{ updating: recompressing }" v-html="summaryHtml"></div>
      <div id="list">
        <ImageItem
          v-for="item in items"
          :key="item.id"
          :item="item"
          :t="t"
          @remove="removeItem"
          @preview="lightboxId = $event.id"
          @view-change="onViewChange"
        />
      </div>
      <div v-if="allAlreadyBest" class="dl-note">{{ t('allBestNote', items.length) }}</div>
      <div class="actions">
        <button class="primary" id="downloadAll" :disabled="doneCount === 0 || zipping" @click="downloadAll">{{ t('downloadAll') }}</button>
        <button id="clearAll" :class="{ danger: clearConfirm }" :disabled="items.length === 0" @click="onClearClick">{{ clearConfirm ? t('clearConfirm') : t('clearAll') }}</button>
      </div>
    </div>

    <div class="card" id="settingsCard">
      <SettingsPanel :settings="settings" :t="t" @update="onSettingsUpdate" @preset="onPreset" />
    </div>
  </main>
  <Lightbox v-if="lbItem" :item="lbItem" :t="t" @close="lightboxId = null" @view-change="onViewChange" />
  <footer v-html="t('footer')"></footer>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef } from 'vue'
import { zipSync } from 'fflate'
import DropZone from './components/DropZone.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import ImageItem from './components/ImageItem.vue'
import Lightbox from './components/Lightbox.vue'
import ProgressBar from './components/ProgressBar.vue'
import { LANGS, initialLang, t as tx, type Lang } from './i18n'
import { applyTheme, initialTheme, MOON_ICON, SUN_ICON, type Theme } from './lib/theme'
import { compressItem } from './lib/compress'
import { fmtSize } from './lib/format'
import { DEFAULT_SETTINGS, matchPreset, PRESETS } from './lib/presets'
import { newItem, type CompressItem, type Settings } from './types'

const lang = ref<Lang>(initialLang())
const theme = ref<Theme>(initialTheme())
const settings = reactive<Settings>({ ...DEFAULT_SETTINGS })
// shallowRef on purpose: File/Blob objects must never be wrapped by Vue's
// reactive proxy (it breaks platform brand checks like createObjectURL).
const items = shallowRef<CompressItem[]>([])

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
    // The spinner slot is always in the DOM (invisible when idle): the old
    // "updating…" text grew the line on narrow screens and pushed the whole
    // settings card — including the preset just tapped — down mid-click.
    + ' <span class="sum-spin" aria-hidden="true"></span>'
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
// At most 3 images decode/encode at once: throwing 50 phone photos through
// Promise.all would spike memory and block the main thread.
const MAX_CONCURRENT = 3
// A settings change that lands mid-run must not start a second run on top
// of it (that was the click-spam freeze: several full encodes burning CPU
// at once, only the last one's results kept). It just marks a trailing run,
// which fires once with the latest settings when the active run drains.
let pendingRecompress = false
async function runCompress(list: CompressItem[], g: number, snap: Settings) {
  activeRuns.value++
  try {
    let idx = 0
    const workers = Array.from({ length: MAX_CONCURRENT }, async () => {
      while (idx < list.length) {
        const item = list[idx++]
        const res = await compressItem(item, snap, t)
        if (g !== runGen) {
          if (res.done) URL.revokeObjectURL(res.outUrl)
          continue
        }
        replaceItem({ ...item, ...res })
      }
    })
    await Promise.all(workers)
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

function addFiles(files: File[]) {
  for (const file of files) items.value.push(newItem(file))
  refresh()
  const g = ++runGen
  const snap = { ...settings }
  void runCompress(items.value.filter((i) => !i.done), g, snap)
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
  await runCompress(items.value, g, snap)
}

function onSettingsUpdate(patch: Partial<Settings>) {
  // No-change updates (re-selecting the current format, dragging the slider
  // back to its value) used to burn a full recompress for nothing.
  const changed = (Object.keys(patch) as (keyof Settings)[]).some((k) => settings[k] !== patch[k])
  if (!changed) return
  Object.assign(settings, patch)
  void recompressAll()
}

// Preset click = apply; clicking the active preset again cancels it and
// restores the settings from before any preset was applied. Switching
// presets keeps the original snapshot, so cancel always returns to the
// pre-preset state, not to the intermediate preset.
const activePreset = computed(() => matchPreset(settings))
let presetBase: Settings | null = null
function onPreset(id: string) {
  if (activePreset.value === id) {
    const base = presetBase ?? DEFAULT_SETTINGS
    presetBase = null
    Object.assign(settings, { ...base })
  } else {
    if (activePreset.value === null) presetBase = { ...settings }
    const p = PRESETS.find((x) => x.id === id)
    if (!p) return
    Object.assign(settings, p.patch)
  }
  void recompressAll()
}

function onViewChange(item: CompressItem, view: 'orig' | 'comp') {
  replaceItem({ ...item, view })
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
    a.download = 'images-compressed.zip'
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
  const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
  if (files.length) addFiles(files)
}

onMounted(() => {
  applyTheme(theme.value)
  setLang(lang.value)
  document.addEventListener('paste', onPaste)
})
onUnmounted(() => {
  document.removeEventListener('paste', onPaste)
})
</script>
