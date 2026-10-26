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
      <div id="summary" v-html="summaryHtml"></div>
      <div id="list">
        <ImageItem
          v-for="item in items"
          :key="item.id"
          :item="item"
          :t="t"
          @preview="openLightbox"
          @remove="removeItem"
          @view-change="onViewChange"
        />
      </div>
      <div class="actions">
        <button class="primary" id="downloadAll" :disabled="doneCount === 0 || zipping" @click="downloadAll">{{ t('downloadAll') }}</button>
        <button id="clearAll" :disabled="items.length === 0" @click="clearAll">{{ t('clearAll') }}</button>
      </div>
    </div>

    <div class="card" id="settingsCard">
      <SettingsPanel :settings="settings" :t="t" @update="onSettingsUpdate" />
    </div>
  </main>
  <footer v-html="t('footer')"></footer>

  <Lightbox
    v-if="lightboxItem"
    :item="lightboxItem"
    :initial-view="lightboxItem.view"
    :t="t"
    @close="lightboxItem = null"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef } from 'vue'
import { zipSync } from 'fflate'
import DropZone from './components/DropZone.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import ImageItem from './components/ImageItem.vue'
import ProgressBar from './components/ProgressBar.vue'
import Lightbox from './components/Lightbox.vue'
import { LANGS, initialLang, t as tx, type Lang } from './i18n'
import { applyTheme, initialTheme, MOON_ICON, SUN_ICON, type Theme } from './lib/theme'
import { compressItem } from './lib/compress'
import { fmtSize } from './lib/format'
import { newItem, type CompressItem, type Settings } from './types'

const lang = ref<Lang>(initialLang())
const theme = ref<Theme>(initialTheme())
const settings = reactive<Settings>({
  format: 'image/webp',
  mode: 'quality',
  targetSize: 200,
  quality: 80,
  maxSize: 1920,
  noUpscale: true,
})
// shallowRef on purpose: File/Blob objects must never be wrapped by Vue's
// reactive proxy (it breaks platform brand checks like createObjectURL).
const items = shallowRef<CompressItem[]>([])
const lightboxItem = ref<CompressItem | null>(null)

function t(key: string, ...args: (string | number)[]): string {
  return tx(lang.value, key, ...args)
}

const themeIcon = computed(() => (theme.value === 'dark' ? SUN_ICON : MOON_ICON))
const themeTitle = computed(() => (theme.value === 'dark' ? t('themeToDay') : t('themeToNight')))

const doneCount = computed(() => items.value.filter((i) => i.done).length)
const finishedCount = computed(() => items.value.filter((i) => i.done || i.error).length)

const summaryHtml = computed(() => {
  if (!items.value.length) return ''
  const orig = items.value.reduce((s, i) => s + i.file.size, 0)
  const comp = items.value.filter((i) => i.done).reduce((s, i) => s + i.outSize, 0)
  const saved = orig > 0 ? Math.max(0, Math.round((1 - comp / orig) * 100)) : 0
  return t('summary', items.value.length, doneCount.value, fmtSize(orig), fmtSize(comp), saved)
})

function refresh() {
  items.value = [...items.value]
}

// Items live in a shallowRef (File/Blob must stay unproxied), so an in-place
// field mutation alone never re-renders a child: its props reference is unchanged.
// Every state change therefore replaces the item object, which also keeps an
// open lightbox pointing at the current object.
function replaceItem(updated: CompressItem) {
  const idx = items.value.findIndex((i) => i.id === updated.id)
  if (idx >= 0) {
    const old = items.value[idx]
    if (old.outUrl && old.outUrl !== updated.outUrl) URL.revokeObjectURL(old.outUrl)
    items.value[idx] = updated
  }
  if (lightboxItem.value?.id === updated.id) lightboxItem.value = updated
  refresh()
}

// Generation guard: settings changes and file adds can overlap in-flight runs.
// Only the latest run's results are applied; a stale run's blob is revoked.
let runGen = 0
// At most 3 images decode/encode at once: throwing 50 phone photos through
// Promise.all would spike memory and block the main thread.
const MAX_CONCURRENT = 3
async function runCompress(list: CompressItem[], g: number, snap: Settings) {
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
  const g = ++runGen
  const snap = { ...settings }
  items.value = items.value.map((i) => {
    const next = { ...i, done: false, error: null, view: 'orig' as const }
    if (lightboxItem.value?.id === next.id) lightboxItem.value = next
    return next
  })
  refresh()
  await runCompress(items.value, g, snap)
}

function onSettingsUpdate(patch: Partial<Settings>) {
  Object.assign(settings, patch)
  void recompressAll()
}

function onViewChange(item: CompressItem, view: 'orig' | 'comp') {
  replaceItem({ ...item, view })
}

function removeItem(item: CompressItem) {
  URL.revokeObjectURL(item.url)
  if (item.outUrl) URL.revokeObjectURL(item.outUrl)
  items.value = items.value.filter((i) => i.id !== item.id)
}

function openLightbox(item: CompressItem) {
  lightboxItem.value = item
}

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
