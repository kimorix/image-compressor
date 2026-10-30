
<template>
  <AppHeader :sub="p('sub')" :inert="sheetOpen ? true : undefined" @lang="setLang">
    <template #title><span class="title-desk">{{ p('title') }}</span><span class="title-hub">{{ t('hubTitle') }}</span></template>
  </AppHeader>
  <div class="layout i2p-layout" :inert="sheetOpen ? true : undefined">
    <SideNav :t="t" active="img2pdf" @nav="onNav">
      <div class="side-card">
        <strong>{{ p('tipTitle') }}</strong>
        <p>{{ p('tipDesc') }}</p>
      </div>
    </SideNav>
    <main class="i2p-main">
      <PdfHubSwitch active="img2pdf" :t="t" />
      <div class="card i2p-upload">
        <div
          class="i2p-drop"
          :class="{ dragover, compact: items.length > 0 }"
          tabindex="0"
          role="button"
          :aria-label="p('dropAria')"
          @click="openPicker"
          @keydown.enter.prevent="openPicker"
          @keydown.space.prevent="openPicker"
          @dragenter.prevent="dragover = true"
          @dragover.prevent="dragover = true"
          @dragleave.prevent="dragover = false"
          @drop.prevent.stop="onZoneDrop"
        >
          <div class="i2p-drop-copy">
            <strong>+ {{ isMobile ? p('dropTitleTouch') : p('dropTitle') }}</strong>
            <p>{{ isMobile ? p('dropSubTouch') : p('dropSub') }}</p>
          </div>
          <button type="button" class="primary i2p-pick" tabindex="-1" @click.stop="openPicker">{{ isMobile ? p('pickShort') : p('pick') }}</button>
          <input ref="fileInput" type="file" accept="image/*,.heic,.heif,.avif,.webp,.bmp,.svg" multiple hidden @change="onPick" />
        </div>
        <p v-if="hint" class="i2p-hint" role="status">{{ hint }}</p>
      </div>

      <section v-if="items.length" class="card i2p-order" :class="{ sorting: sortMode }">
        <div class="i2p-order-head">
          <h3>{{ sortMode && isMobile ? p('sortingTitle') : p('orderTitle') }}</h3>
          <span v-if="!(sortMode && isMobile)" class="i2p-count">{{ p('pagesCount', items.length) }}</span>
          <span class="i2p-order-hint">{{ orderHint }}</span>
          <div class="i2p-order-actions">
            <template v-if="actionBar">
              <button type="button" class="primary i2p-done" @click="endSort">{{ p('done') }}</button>
            </template>
            <template v-else-if="!isMobile">
              <button type="button" :disabled="building || items.length < 2" @click="sortByName">{{ p('sortByName') }}</button>
              <button type="button" :disabled="building || items.length < 2" @click="reverseOrder">{{ p('reverse') }}</button>
              <button type="button" class="i2p-link" :class="{ danger: clearConfirm }" :disabled="building" @click="onClear">{{ clearConfirm ? p('clearConfirm') : p('clear') }}</button>
            </template>
          </div>
        </div>
        <PageGrid
          :items="gridItems"
          :selection="selection"
          :columns="isMobile ? 3 : 'auto'"
          :min-tile-width="isMobile ? 90 : 150"
          :gap="isMobile ? 10 : 16"
          :page-aspect="frameHW"
          :actions="isMobile ? [] : ['rotateL', 'rotateR', 'delete']"
          :select-mode="isMobile"
          :disabled="building"
          :aria-label="p('orderTitle')"
          :messages="gridMessages"
          @reorder="onReorder"
          @select="onSelect"
          @action="onAction"
          @drag="onDrag"
        >
          <template #tile="{ item }">
            <PaperThumb
              v-if="byId.get(item.key)"
              :thumb="byId.get(item.key)!.thumb"
              :w="byId.get(item.key)!.w"
              :h="byId.get(item.key)!.h"
              :rotation="byId.get(item.key)!.rotation"
              :layout="settings"
              :frame-h-w="frameHW"
              :state="byId.get(item.key)!.status"
              valign="top"
            />
          </template>
        </PageGrid>
      </section>
      <p v-else class="i2p-empty">{{ p('emptyGrid') }}</p>
    </main>
    <div id="rightPanel" class="i2p-right">
      <div v-if="!isMobile" class="card i2p-settings-card">
        <h3>{{ p('settingsTitle') }}</h3>
        <ImgPdfSettingsPanel
          v-model:file-name="fileName"
          :settings="settings"
          :placeholder="defaultStemText"
          :estimate-text="estimateText"
          :count="usable.length"
          :busy="building"
          :progress="progress"
          :p="p"
          @update="onSettings"
          @generate="generate"
          @cancel="cancelBuild"
          @warm="warm"
        />
      </div>
      <div v-if="!isMobile && result" class="card i2p-result-card">
        <ImgPdfResultSheet :result="result" :name="resultName" variant="card" :stale="stale" :p="p" @preview="preview" @download="download" />
      </div>
    </div>
  </div>

  <!-- Phone: floating action bar (settings summary + Generate), or the dark
  page-action bar while a page is selected / being sorted. -->
  <div v-if="items.length && isMobile" class="i2p-float" :class="{ dark: actionBar }" :inert="sheetOpen ? true : undefined">
    <template v-if="actionBar">
      <p class="i2p-float-hint">{{ sortMode ? p('autoScrollHint') : selection.length ? p('selectedN', selection.length) : p('selectHint') }}</p>
      <div class="i2p-actbar">
        <button type="button" :disabled="!selection.length" @click="bulk('rotateL')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8M3 3v5h5" /></svg>{{ p('rotateLeft') }}</button>
        <button type="button" :disabled="!selection.length" @click="bulk('rotateR')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 11-9-9 9.7 9.7 0 016.7 2.8L21 8M21 3v5h-5" /></svg>{{ p('rotateRight') }}</button>
        <button type="button" :disabled="!selection.length" @click="bulk('first')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v16M19 12H9m0 0l4-4m-4 4l4 4" /></svg>{{ p('moveFirst') }}</button>
        <button type="button" :disabled="!selection.length" @click="bulk('last')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 4v16M5 12h10m0 0l-4-4m4 4l-4 4" /></svg>{{ p('moveLast') }}</button>
        <button type="button" class="bad" :disabled="!selection.length" @click="bulk('delete')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>{{ p('remove') }}</button>
      </div>
    </template>
    <template v-else-if="building">
      <div class="i2p-float-progress">
        <div class="i2p-progress"><span :style="{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }"></span></div>
        <span>{{ p('generating', Math.min(progress.done + 1, progress.total), progress.total) }}</span>
      </div>
      <button type="button" @click="cancelBuild">{{ p('cancel') }}</button>
    </template>
    <template v-else>
      <button type="button" class="i2p-summary" :aria-label="p('settingsOpen')" @click="toggleSettings">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
        <span>{{ summary }}</span><span class="i2p-chev" aria-hidden="true">›</span>
      </button>
      <button v-if="result && !stale" type="button" class="i2p-gen-mob" @click="resultOpen = true">{{ p('resultDone') }}</button>
      <button v-else type="button" class="primary i2p-gen-mob" :disabled="!usable.length" @click="generate">{{ p('generateShort') }}</button>
    </template>
  </div>
  <div class="i2p-float-spacer" v-if="items.length" aria-hidden="true"></div>

  <TabBar
    :t="t"
    :inert="resultOpen && isMobile ? true : undefined"
    :active="moreOpen ? 'more' : settingsOpen ? 'settings' : 'pdf'"
    :settings-open="settingsOpen"
    :more-open="moreOpen"
    @compress="goCompress"
    @pdf="onPdfTab"
    @settings="toggleSettings"
    @more="moreOpen = !moreOpen"
  />
  <MoreMenu :t="t" :open="moreOpen" :menu-inert="sheetOpen" @close="moreOpen = false" @nav="onNav" />
  <div v-if="pageDragging" class="page-drop-hint" aria-hidden="true">{{ p('dropAnywhere') }}</div>
  <BottomSheet
    v-if="settingsOpen && isMobile"
    :title="p('settingsTitle')"
    :close-label="p('close')"
    label-id="i2pSettingsTitle"
    sheet-class="settings-sheet i2p-sheet"
    overlay-class="settings-overlay"
    @close="settingsOpen = false"
  >
    <div class="sheet-body">
      <ImgPdfSettingsPanel
        v-model:file-name="fileName"
        :settings="settings"
        :placeholder="defaultStemText"
        :estimate-text="estimateText"
        :count="usable.length"
        :busy="building"
        :progress="progress"
        :p="p"
        @update="onSettings"
        @generate="generateFromSheet"
        @cancel="cancelBuild"
        @warm="warm"
      />
    </div>
  </BottomSheet>
  <BottomSheet
    v-if="resultOpen && result && isMobile"
    :title="p('resultDone')"
    :close-label="p('close')"
    label-id="i2pResultTitle"
    sheet-class="i2p-sheet i2p-result-sheet"
    @close="resultOpen = false"
  >
    <div class="sheet-body">
      <ImgPdfResultSheet
        :result="result"
        :name="resultName"
        variant="sheet"
        :stale="stale"
        :sharing="sharing"
        :p="p"
        @preview="preview"
        @share="share"
        @restart="restart"
        @regenerate="regenerate"
      />
    </div>
  </BottomSheet>
  <div v-if="toast" class="more-toast" role="status">{{ toast }}</div>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref, shallowRef, triggerRef, watch } from 'vue'
import AppHeader from '../../shared/components/AppHeader.vue'
import SideNav from '../../shared/components/SideNav.vue'
import TabBar from '../../shared/components/TabBar.vue'
import MoreMenu from '../../shared/components/MoreMenu.vue'
import PdfHubSwitch from '../../shared/components/PdfHubSwitch.vue'
import BottomSheet from '../../shared/components/BottomSheet.vue'
import PageGrid, { type PageGridMessages } from '../../shared/components/PageGrid.vue'
import { moveBlock, moveItem, normRotation, type PageAction, type PageGridItem } from '../../shared/components/page-grid'
import { usePrefs } from '../../shared/composables/usePrefs'
import { useHashRoute, type NavKey } from '../../shared/composables/useHashRoute'
import { fmtSize } from '../../shared/lib/format'
import { filesFromDrop } from '../../shared/lib/drop'
import { shareFilesOr } from '../../shared/lib/share'
import { downloadUrl, zipEntries } from '../../shared/lib/zip'
import { getImagePool } from '../../shared/image/image-pool'
import type { Lang } from '../../shared/i18n'
import ImgPdfSettingsPanel from './components/ImgPdfSettingsPanel.vue'
import ImgPdfResultSheet from './components/ImgPdfResultSheet.vue'
import PaperThumb from './components/PaperThumb.vue'
import { i2pT } from './i18n'
import type { BuildResult, Img2PdfSettings, OutFile, PageItem } from './types'
import { loadSettings, saveSettings } from './lib/settings'
import { frameAspect } from './lib/layout'
import { estimateTotal } from './lib/estimate'
import { defaultStem, pdfName, perImageNames, zipName } from './lib/filename'
import type { ProbePayload, ProbeResult } from './lib/prepare'
import './styles/img2pdf.less'

const { lang, t, setLang: setPrefLang } = usePrefs()
const { navigate } = useHashRoute()
function p(key: string, ...args: (string | number)[]): string {
  return i2pT(lang.value, key, ...args)
}

// ---- settings ----
const settings = ref<Img2PdfSettings>(loadSettings(typeof navigator !== 'undefined' ? navigator.language : undefined))
function onSettings(s: Img2PdfSettings) {
  settings.value = s
  saveSettings(s)
}
const fileName = ref('')
const frameHW = computed(() => frameAspect(settings.value.paper))

// ---- items (shallowRef: File objects never become reactive proxies) ----
const items = shallowRef<PageItem[]>([])
const touch = () => triggerRef(items)
const byId = computed(() => new Map(items.value.map((i) => [i.id, i])))
const usable = computed(() => items.value.filter((i) => i.status !== 'error'))

const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 720 : false)
function onResize() {
  isMobile.value = window.innerWidth < 720
}

const tagFor = (it: PageItem): Pick<PageGridItem, 'tag' | 'tagKind'> => {
  if (it.status === 'error') return { tag: p('tagError'), tagKind: 'bad' }
  if (it.status === 'loading') return { tag: p('tagLoading') }
  if (it.format === 'heic') return { tag: p('tagHeic'), tagKind: 'warn' }
  if (it.animated) return { tag: p('tagFirstFrame'), tagKind: 'warn' }
  const rot = normRotation(it.rotation) % 180 ? { w: it.h, h: it.w } : { w: it.w, h: it.h }
  if (settings.value.paper !== 'fit' && settings.value.orientation === 'auto' && rot.w > rot.h) return { tag: p('tagLandscape'), tagKind: 'info' }
  return {}
}
const gridItems = computed<PageGridItem[]>(() => items.value.map((it) => ({
  key: it.id,
  thumb: it.thumb,
  label: it.name,
  rotate: it.rotation,
  aspect: it.w && it.h ? it.w / it.h : undefined,
  ...tagFor(it),
})))
const gridMessages = computed<Partial<PageGridMessages>>(() => ({
  page: (n) => p('gPage', n),
  moveBadge: (a, b) => p('dragMove', a, b),
  moved: (a, b) => p('gMoved', a, b),
  picked: (n) => p('gPicked', n),
  dropped: (n) => p('gDropped', n),
  cancelled: p('gCancelled'),
  instructions: p('gInstructions'),
  rotateL: p('rotateLeft'),
  rotateR: p('rotateRight'),
  delete: p('remove'),
}))

// ---- hints / toast ----
const hint = ref<string | null>(null)
let hintTimer: ReturnType<typeof setTimeout> | null = null
function showHint(s: string) {
  hint.value = s
  if (hintTimer) clearTimeout(hintTimer)
  hintTimer = setTimeout(() => { hint.value = null }, 4000)
}
const toast = ref<string | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(s: string) {
  toast.value = s
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = null }, 3000)
}

// ---- adding images ----
const IMAGE_EXT = /\.(jpe?g|jfif|png|gif|webp|avif|heic|heif|bmp|svg|ico|tiff?)$/i
function isImageFile(f: File): boolean {
  return f.type.startsWith('image/') || IMAGE_EXT.test(f.name)
}
const fileInput = ref<HTMLInputElement | null>(null)
function openPicker() {
  if (building.value) { showHint(p('busyAdd')); return }
  fileInput.value?.click()
}
function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  addFiles([...(input.files ?? [])])
  input.value = ''
}
const dragover = ref(false)
function onZoneDrop(e: DragEvent) {
  dragover.value = false
  pageDragging.value = false
  void filesFromDrop(e.dataTransfer).then(addDropped)
}
const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
function addDropped(d: { file: File; dir: string }[]) {
  // A dropped folder comes in file-name order (natural: 2 before 10).
  const anyDir = d.some((x) => x.dir)
  const list = anyDir ? [...d].sort((a, b) => natural.compare(`${a.dir}/${a.file.name}`, `${b.dir}/${b.file.name}`)) : d
  addFiles(list.map((x) => x.file))
}

let seq = 0
const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`
function addFiles(files: File[], pasted = false) {
  if (building.value) { showHint(p('busyAdd')); return }
  const imgs = files.filter(isImageFile)
  const skipped = files.length - imgs.length
  const have = new Set(items.value.map((i) => fileKey(i.file)))
  const dups = pasted ? 0 : imgs.filter((f) => have.has(fileKey(f))).length
  if (skipped) showHint(p('notImage', skipped))
  else if (dups) showHint(p('dupNote', dups))
  if (!imgs.length) return
  const added: PageItem[] = imgs.map((file) => ({
    id: `i2p-${Date.now().toString(36)}-${seq++}`,
    file,
    name: file.name || 'image',
    format: null,
    w: 0,
    h: 0,
    rotation: 0,
    thumb: null,
    status: 'loading',
    hasAlpha: false,
    animated: false,
    pasted,
  }))
  items.value = [...items.value, ...added]
  for (const it of added) void probeItem(it)
}

async function probeItem(item: PageItem) {
  const payload: ProbePayload = { op: 'probe', file: item.file, lang: lang.value }
  const r = await getImagePool().run<ProbeResult>('img2pdf', payload, { group: 'img2pdf-probe' })
  if (!items.value.includes(item)) return
  if (r.ok) {
    const x = r.result
    item.format = x.format
    item.w = x.w
    item.h = x.h
    item.hasAlpha = x.hasAlpha
    item.animated = x.animated
    if (x.thumb) item.thumb = URL.createObjectURL(x.thumb)
    item.status = 'ready'
  } else if (!r.cancelled) {
    item.status = 'error'
    item.error = r.error
  }
  touch()
}

// ---- ordering / page actions ----
const selection = ref<string[]>([])
const sortMode = ref(false)
const actionBar = computed(() => isMobile.value && (sortMode.value || selection.value.length > 0))
function onReorder(from: number, to: number) {
  items.value = moveItem(items.value, from, to)
}
function onSelect(keys: string[]) {
  selection.value = keys
}
function onDrag(active: boolean) {
  if (active && isMobile.value) sortMode.value = true
}
function endSort() {
  sortMode.value = false
  selection.value = []
}
function rotate(it: PageItem, delta: number) {
  it.rotation = normRotation(it.rotation + delta)
}
// Thumbnails still shown by the result previews are revoked with the result.
let heldThumbs: string[] = []
function releaseThumb(url: string | null) {
  if (!url) return
  if (result.value?.thumbs.some((t) => t.thumb === url)) heldThumbs.push(url)
  else URL.revokeObjectURL(url)
}
function removeIds(ids: Set<string>) {
  for (const it of items.value) if (ids.has(it.id)) releaseThumb(it.thumb)
  items.value = items.value.filter((i) => !ids.has(i.id))
  selection.value = selection.value.filter((k) => !ids.has(k))
  if (!items.value.length) sortMode.value = false
}
function onAction(key: string, a: PageAction) {
  const it = byId.value.get(key)
  if (!it) return
  if (a === 'rotateL') rotate(it, -90)
  else if (a === 'rotateR') rotate(it, 90)
  else if (a === 'delete') { removeIds(new Set([key])); return }
  touch()
}
function bulk(a: 'rotateL' | 'rotateR' | 'first' | 'last' | 'delete') {
  const sel = new Set(selection.value)
  if (!sel.size) return
  if (a === 'delete') { removeIds(sel); return }
  if (a === 'rotateL' || a === 'rotateR') {
    for (const it of items.value) if (sel.has(it.id)) rotate(it, a === 'rotateL' ? -90 : 90)
    touch()
    return
  }
  const idx = items.value.map((it, i) => (sel.has(it.id) ? i : -1)).filter((i) => i >= 0)
  items.value = moveBlock(items.value, idx, a === 'first' ? 0 : items.value.length - idx.length)
}
function sortByName() {
  items.value = [...items.value].sort((a, b) => natural.compare(a.name, b.name))
}
function reverseOrder() {
  items.value = [...items.value].reverse()
}
const clearConfirm = ref(false)
let clearTimer: ReturnType<typeof setTimeout> | null = null
function onClear() {
  if (!clearConfirm.value) {
    clearConfirm.value = true
    if (clearTimer) clearTimeout(clearTimer)
    clearTimer = setTimeout(() => { clearConfirm.value = false }, 3000)
    return
  }
  clearConfirm.value = false
  clearAll()
}
function clearAll() {
  getImagePool().cancel('img2pdf-probe')
  for (const it of items.value) releaseThumb(it.thumb)
  items.value = []
  selection.value = []
  sortMode.value = false
  fileName.value = ''
  dropResult()
}
const orderHint = computed(() => (isMobile.value ? (actionBar.value ? '' : p('dragHintTouch')) : p('dragHint')))

// ---- names / estimate / summary ----
const defaultStemText = computed(() => {
  const first = items.value.find((i) => !i.pasted)
  return defaultStem(first?.name, p('defaultPrefix'))
})
const sourceBytes = computed(() => usable.value.reduce((n, i) => n + i.file.size, 0))
const estimateText = computed(() => {
  if (!usable.value.length) return '—'
  const est = estimateTotal(usable.value.map((i) => ({ bytes: i.file.size, format: i.format, w: i.w, h: i.h, hasAlpha: i.hasAlpha })), settings.value)
  return `${p('estimateApprox', fmtSize(est))} · ${p('estimateOrig', fmtSize(sourceBytes.value))}`
})
const summary = computed(() => {
  const s = settings.value
  const paper = s.paper === 'fit' ? p('paperFit') : s.paper === 'letter' ? p('paperLetter') : p('paperA4')
  const orient = s.paper === 'fit' ? '' : p(s.orientation === 'auto' ? 'orientAuto' : s.orientation === 'portrait' ? 'orientPortrait' : 'orientLandscape')
  const q = p(s.quality === 'original' ? 'qOriginal' : s.quality === 'balanced' ? 'qBalanced' : 'qSmall')
  return [paper, orient, q].filter(Boolean).join(' · ')
})

// ---- generating ----
const building = ref(false)
const progress = ref({ done: 0, total: 0 })
const result = shallowRef<BuildResult | null>(null)
const resultName = ref('')
const resultSig = ref('')
let ctrl: AbortController | null = null
// Anything that changes the output marks the result stale.
const signature = computed(() => JSON.stringify([
  settings.value,
  fileName.value,
  items.value.map((i) => `${i.id}:${i.rotation}:${i.status}`),
]))
const stale = computed(() => !!result.value && resultSig.value !== signature.value)

function warm() {
  void import('./lib/build-pdf').then((m) => m.loadPdfLib()).catch(() => {})
}

function dropResult() {
  result.value = null
  resultOpen.value = false
  for (const u of heldThumbs) URL.revokeObjectURL(u)
  heldThumbs = []
}

async function generate() {
  if (building.value) return
  const pages = items.value.filter((i) => i.status === 'ready')
  const pending = items.value.filter((i) => i.status === 'loading')
  if (pending.length) {
    // Wait for thumbnails/sizes still being read (layout needs the size).
    building.value = true
    progress.value = { done: 0, total: usable.value.length }
    await new Promise<void>((resolve) => {
      const stop = watch(items, () => {
        if (!items.value.some((i) => i.status === 'loading')) { stop(); resolve() }
      })
    })
    building.value = false
    return generate()
  }
  if (!pages.length) { showToast(p('errNone')); return }
  const s = { ...settings.value }
  const stem = pdfName(fileName.value, defaultStemText.value)
  const perNames = perImageNames(pages.map((i) => i.name))
  building.value = true
  progress.value = { done: 0, total: pages.length }
  ctrl = new AbortController()
  const sig = signature.value
  try {
    const { buildPdf, isCancel } = await import('./lib/build-pdf')
    try {
      const out = await buildPdf(pages, s, {
        title: stem.replace(/\.pdf$/i, ''),
        titles: perNames.map((n) => n.replace(/\.pdf$/i, '')),
        lang: lang.value,
        signal: ctrl.signal,
        onProgress: (pr) => { progress.value = { done: pr.done, total: pr.total } },
      })
      const included = new Set(out.included)
      const inc = pages.filter((i) => included.has(i.id))
      const files: OutFile[] = out.files.map((f) => ({
        name: f.page < 0 ? stem : perNames[f.page],
        blob: new Blob([f.bytes as BlobPart], { type: 'application/pdf' }),
        pages: f.pages,
      }))
      out.notes.skipped += items.value.length - pages.length
      result.value = {
        mode: s.output,
        files,
        sourceBytes: inc.reduce((n, i) => n + i.file.size, 0),
        bytes: files.reduce((n, f) => n + f.blob.size, 0),
        pages: inc.length,
        notes: out.notes,
        settings: s,
        thumbs: inc.map((i) => ({ thumb: i.thumb, rotation: i.rotation, w: i.w, h: i.h })),
      }
      const held = heldThumbs
      heldThumbs = []
      for (const u of held) URL.revokeObjectURL(u)
      resultName.value = files.length > 1 ? zipName(stem) : files[0].name
      resultSig.value = sig
      if (isMobile.value) { settingsOpen.value = false; resultOpen.value = true }
    } catch (err) {
      if (isCancel(err)) showToast(p('cancelled'))
      else {
        console.error('[img-to-pdf]', err)
        const msg = err instanceof Error ? err.message : ''
        showToast(/nothing to build/.test(msg) ? p('errNone') : err instanceof RangeError || /memory|allocation/i.test(msg) ? p('errMemory') : p('errBuild'))
      }
    }
  } catch (err) {
    console.error('[img-to-pdf] load failed', err)
    showToast(p('errBuild'))
  } finally {
    building.value = false
    ctrl = null
  }
}
function cancelBuild() {
  ctrl?.abort()
}
function generateFromSheet() {
  void generate()
}

// ---- output ----
const sharing = ref(false)
const resultOpen = ref(false)
async function zipBlob(): Promise<Blob> {
  return zipEntries(result.value!.files.map((f) => ({ name: f.name, blob: f.blob })))
}
async function download() {
  const r = result.value
  if (!r) return
  if (r.files.length === 1) downloadUrl(r.files[0].blob, r.files[0].name)
  else downloadUrl(await zipBlob(), resultName.value)
}
function preview() {
  const r = result.value
  if (!r) return
  const url = URL.createObjectURL(r.files[0].blob)
  const w = window.open(url, '_blank', 'noopener')
  if (!w) downloadUrl(r.files[0].blob, r.files[0].name)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
async function share() {
  const r = result.value
  if (!r) return
  sharing.value = true
  try {
    const files = r.files.map((f) => new File([f.blob], f.name, { type: 'application/pdf' }))
    await shareFilesOr(typeof navigator !== 'undefined' ? navigator : undefined, files, download)
  } finally {
    sharing.value = false
  }
}
function restart() {
  resultOpen.value = false
  clearAll()
}
function regenerate() {
  resultOpen.value = false
  settingsOpen.value = true
}

// ---- phone surfaces ----
const settingsOpen = ref(false)
const moreOpen = ref(false)
const sheetOpen = computed(() => isMobile.value && (settingsOpen.value || resultOpen.value))
watch(sheetOpen, (open) => { document.body.style.overflow = open ? 'hidden' : '' })
watch(moreOpen, (open) => { if (open) settingsOpen.value = false })
watch(isMobile, (m) => { if (!m) { settingsOpen.value = false; resultOpen.value = false; sortMode.value = false } })
function toggleSettings() {
  moreOpen.value = false
  resultOpen.value = false
  settingsOpen.value = !settingsOpen.value
}

// ---- navigation ----
function closeSurfaces() {
  moreOpen.value = false
  settingsOpen.value = false
  resultOpen.value = false
}
function goCompress() {
  closeSurfaces()
  navigate('compress')
}
function onNav(key: NavKey) {
  if (key === 'img2pdf') { scrollTop(); return }
  closeSurfaces()
  if (key === 'history') navigate('compress', 'history')
  else navigate(key)
}
function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function onPdfTab() {
  settingsOpen.value = false
  moreOpen.value = false
  scrollTop()
}
function setLang(l: Lang) {
  setPrefLang(l)
  applyDocMeta()
}
function applyDocMeta() {
  document.title = p('docTitle')
  document.querySelector('meta[name="description"]')?.setAttribute('content', p('metaDesc'))
}

// ---- page-wide drop and paste while this view is shown ----
const pageDragging = ref(false)
let dragDepth = 0
const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types?.includes('Files')
function onDocDragEnter(e: DragEvent) {
  if (!hasFiles(e)) return
  dragDepth++
  pageDragging.value = true
}
function onDocDragLeave(e: DragEvent) {
  if (!hasFiles(e)) return
  dragDepth = Math.max(0, dragDepth - 1)
  if (!dragDepth) pageDragging.value = false
}
function onDocDragOver(e: DragEvent) {
  if (hasFiles(e)) e.preventDefault()
}
function onDocDrop(e: DragEvent) {
  dragDepth = 0
  pageDragging.value = false
  if (!hasFiles(e)) return
  e.preventDefault()
  void filesFromDrop(e.dataTransfer).then(addDropped)
}
function onPaste(e: ClipboardEvent) {
  const el = e.target as HTMLElement | null
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
  const files = [...(e.clipboardData?.files ?? [])].filter(isImageFile)
  if (!files.length) return
  e.preventDefault()
  addFiles(files, true)
}
let listening = false
function startListening() {
  if (listening) return
  listening = true
  document.addEventListener('dragenter', onDocDragEnter)
  document.addEventListener('dragleave', onDocDragLeave)
  document.addEventListener('dragover', onDocDragOver)
  document.addEventListener('drop', onDocDrop)
  document.addEventListener('paste', onPaste)
  window.addEventListener('resize', onResize)
}
function stopListening() {
  if (!listening) return
  listening = false
  document.removeEventListener('dragenter', onDocDragEnter)
  document.removeEventListener('dragleave', onDocDragLeave)
  document.removeEventListener('dragover', onDocDragOver)
  document.removeEventListener('drop', onDocDrop)
  document.removeEventListener('paste', onPaste)
  window.removeEventListener('resize', onResize)
}
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (building.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

onMounted(() => {
  applyDocMeta()
  window.addEventListener('beforeunload', onBeforeUnload)
})
onActivated(() => {
  applyDocMeta()
  onResize()
  startListening()
  if (sheetOpen.value) document.body.style.overflow = 'hidden'
})
onDeactivated(() => {
  stopListening()
  closeSurfaces()
  pageDragging.value = false
  document.body.style.overflow = ''
})
onUnmounted(() => {
  stopListening()
  window.removeEventListener('beforeunload', onBeforeUnload)
  ctrl?.abort()
  for (const it of items.value) if (it.thumb) URL.revokeObjectURL(it.thumb)
  for (const u of heldThumbs) URL.revokeObjectURL(u)
  if (hintTimer) clearTimeout(hintTimer)
  if (toastTimer) clearTimeout(toastTimer)
  if (clearTimer) clearTimeout(clearTimer)
  document.body.style.overflow = ''
})
</script>
