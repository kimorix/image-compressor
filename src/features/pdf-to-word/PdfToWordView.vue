<template>
  <AppHeader :sub="p('sub')" :inert="sheetOpen ? true : undefined" @lang="setLang">
    <template #title><span class="title-desk">{{ p('title') }}</span><span class="title-hub">{{ t('hubTitle') }}</span></template>
  </AppHeader>
  <div class="layout pdf-layout" :inert="sheetOpen ? true : undefined">
    <SideNav :t="t" active="pdf" @nav="onNav">
      <div class="side-card">
        <strong>{{ p('sideTitle') }}</strong>
        <p>{{ p('sideDesc') }}</p>
      </div>
    </SideNav>
    <main class="pdf-main">
      <PdfHubSwitch active="pdf" :t="t" />
      <div class="card pdf-upload" :class="{ compact: items.length > 0 }">
        <div
          id="pdfDrop"
          class="pdf-drop"
          :class="{ dragover }"
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
          <strong>{{ items.length ? p('addMore') : `+ ${isTouch ? p('dropTitleTouch') : p('dropTitle')}` }}</strong>
          <p v-if="!items.length || !isMobile">{{ isTouch ? p('dropSubTouch') : p('dropSub') }}</p>
          <input ref="fileInput" id="pdfFileInput" type="file" accept="application/pdf,.pdf" multiple hidden @change="onPick" />
        </div>
        <p v-if="hint" class="pdf-hint" role="status">{{ hint }}</p>
      </div>

      <div v-if="items.length" class="card pdf-list-card">
        <div class="pdf-list-head">
          <h3>{{ p('listTitle') }}</h3>
          <div class="pdf-list-actions">
            <button type="button" class="pdf-link-btn" :class="{ danger: clearConfirm }" @click="onClear">{{ clearConfirm ? p('clearConfirm') : p('clear') }}</button>
            <button type="button" :disabled="!startable.length" @click="startAll">{{ p('start') }}</button>
            <button type="button" class="primary" :disabled="!doneItems.length || zipping" @click="downloadAll">{{ zipping ? p('zipping') : p('downloadAll') }}</button>
          </div>
        </div>
        <ul class="pdf-list">
          <li v-for="item in items" :key="item.id" class="pdf-item" :class="[`st-${item.status}`, { clickable: isMobile && item.status !== 'locked' }]" @click="onCardClick(item)">
            <div class="pdf-thumb" :class="{ scanned: item.kind === 'scanned', locked: item.status === 'locked' }">
              <img v-if="item.thumb" :src="item.thumb" alt="" />
              <span v-else-if="item.status === 'locked'" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg></span>
              <span v-else class="pdf-thumb-wait" aria-hidden="true"></span>
            </div>
            <div class="pdf-info">
              <strong class="pdf-name" :title="item.file.name">{{ item.file.name }}</strong>
              <div class="pdf-meta">
                <span v-if="item.status === 'locked'">{{ p('needPassword') }}</span>
                <span v-else-if="item.pages">{{ p('pagesSize', item.pages, fmtSize(item.file.size)) }}<template v-if="isMobile && item.outBlob"> → {{ fmtSize(item.outBlob.size) }}</template></span>
                <span v-else>{{ fmtSize(item.file.size) }}</span>
                <span class="pdf-tags">
                  <span v-if="item.status === 'locked'" class="pdf-tag bad">{{ p('locked') }}</span>
                  <template v-else>
                    <span v-if="item.kind === 'text' && !isMobile" class="pdf-tag info">{{ p('kindText') }}</span>
                    <span v-if="item.kind === 'scanned' && !(item.status === 'converting' && isMobile)" class="pdf-tag warn">{{ settings.ocr || item.stats?.ocrPages ? p('kindScannedOcr') : p('kindScanned') }}</span>
                    <span v-if="statusTag(item)" class="pdf-tag" :class="statusClass(item)">{{ statusTag(item) }}</span>
                  </template>
                </span>
              </div>
              <div v-if="item.status === 'converting' || item.status === 'queued'" class="pdf-progress" role="progressbar" :aria-valuenow="Math.round(item.progress * 100)" aria-valuemin="0" aria-valuemax="100">
                <span :style="{ width: `${Math.round(item.progress * 100)}%` }"></span>
              </div>
              <p v-if="item.status === 'done' && item.outBlob && !isMobile" class="pdf-out">→ {{ item.outName }} · {{ fmtSize(item.outBlob.size) }}<template v-if="noteOf(item)"> · <span class="pdf-out-note">{{ noteOf(item) }}</span></template></p>
              <p v-if="item.kind === 'scanned' && !settings.ocr && (item.status === 'ready' || item.status === 'probing') && !isMobile" class="pdf-sub">{{ p('scannedHint') }}</p>
              <p v-if="item.status === 'error' && item.error" class="pdf-sub bad">{{ item.error }}</p>
              <form v-if="item.status === 'locked' && (!isMobile || pwOpen === item.id)" class="pdf-pw" @submit.prevent="unlock(item)" @click.stop>
                <input class="pdf-input" type="password" autocomplete="off" :placeholder="p('passwordPh')" :aria-label="p('passwordAria', item.file.name)" v-model="pwDraft[item.id]" />
                <button type="submit" class="primary" :disabled="!pwDraft[item.id]">{{ p('unlock') }}</button>
              </form>
              <p v-if="item.badPassword" class="pdf-sub bad" role="alert">{{ p('badPassword') }}</p>
            </div>
            <!-- Desktop actions -->
            <div class="pdf-actions desk" @click.stop>
              <button v-if="item.status === 'done'" type="button" class="primary" @click="downloadOne(item)">{{ p('downloadDocx') }}</button>
              <button v-else-if="item.status === 'converting' || item.status === 'queued'" type="button" @click="cancel(item)">{{ p('cancel') }}</button>
              <button v-else-if="item.kind === 'scanned' && !settings.ocr && item.status === 'ready'" type="button" @click="enableOcr">{{ p('enableOcr') }}</button>
              <button v-else-if="item.status === 'error' || item.status === 'cancelled'" type="button" @click="startOne(item)">{{ p('retry') }}</button>
              <button v-if="item.status !== 'converting' && item.status !== 'queued'" type="button" class="pdf-icon-btn" :title="p('remove')" :aria-label="p('remove')" @click="removeItem(item)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg></button>
            </div>
            <!-- Phone: one round action per card -->
            <div class="pdf-actions mob" @click.stop>
              <button v-if="item.status === 'done'" type="button" class="pdf-round accent" :title="p('downloadDocx')" :aria-label="p('downloadDocx')" @click="shareOne(item)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" /></svg></button>
              <button v-else-if="item.status === 'converting' || item.status === 'queued'" type="button" class="pdf-round" :title="p('cancel')" :aria-label="p('cancel')" @click="cancel(item)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
              <button v-else-if="item.status === 'locked'" type="button" class="pdf-round accent text" @click="pwOpen = pwOpen === item.id ? null : item.id">{{ p('unlock') }}</button>
              <button v-else-if="item.kind === 'scanned' && !settings.ocr && item.status === 'ready'" type="button" class="pdf-round warn text" @click="enableOcr">OCR</button>
              <button v-else-if="item.status === 'error' || item.status === 'cancelled'" type="button" class="pdf-round text" @click="startOne(item)">{{ p('retry') }}</button>
              <button v-else type="button" class="pdf-round" :title="p('remove')" :aria-label="p('remove')" @click="removeItem(item)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg></button>
            </div>
          </li>
        </ul>
      </div>
    </main>
    <div id="rightPanel" class="pdf-right">
      <div v-if="!isMobile" class="card pdf-settings-card">
        <h3>{{ p('settingsTitle') }}</h3>
        <PdfSettingsPanel :settings="settings" :p="p" :can-start="startable.length > 0" @update="onSettings" @start="startAll" />
      </div>
      <div v-if="!isMobile" class="card pdf-cap-card">
        <h3>{{ p('capTitle') }}</h3>
        <ul class="pdf-cap">
          <li><span class="ok" aria-hidden="true">✓</span>{{ p('cap1') }}</li>
          <li><span class="ok" aria-hidden="true">✓</span>{{ p('cap2') }}</li>
          <li><span class="part" aria-hidden="true">△</span>{{ p('cap3') }}</li>
        </ul>
      </div>
    </div>
  </div>
  <div class="pdf-sticky" v-show="items.length > 0" :inert="sheetOpen ? true : undefined">
    <button type="button" :disabled="!startable.length" @click="startAll">{{ p('start') }}</button>
    <button type="button" class="primary" :disabled="!doneItems.length || zipping || sharing" @click="saveAllMobile">{{ zipping ? p('zipping') : p('saveAll') }}</button>
  </div>
  <div class="pdf-sticky-spacer" v-show="items.length > 0" aria-hidden="true"></div>
  <TabBar
    :t="t"
    :inert="detailId ? true : undefined"
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
    label-id="pdfSettingsTitle"
    sheet-class="settings-sheet"
    overlay-class="settings-overlay"
    @close="settingsOpen = false"
  >
    <div class="sheet-body">
      <PdfSettingsPanel :settings="settings" :p="p" :can-start="startable.length > 0" @update="onSettings" @start="startFromSheet" />
    </div>
  </BottomSheet>
  <PdfDetailSheet
    v-if="detailItem && isMobile"
    :item="detailItem"
    :p="p"
    :busy="detailItem.status === 'converting' || detailItem.status === 'queued'"
    :previews="sheetPreviews"
    :rev="rev"
    @close="detailId = null"
    @remove="removeFromSheet"
    @reconvert="reconvertFromSheet"
    @share="shareOne"
    @need="(n: number) => needPreview(detailItem!, n)"
  />
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, reactive, ref, shallowRef, triggerRef, watch } from 'vue'
import AppHeader from '../../shared/components/AppHeader.vue'
import SideNav from '../../shared/components/SideNav.vue'
import TabBar from '../../shared/components/TabBar.vue'
import MoreMenu from '../../shared/components/MoreMenu.vue'
import PdfHubSwitch from '../../shared/components/PdfHubSwitch.vue'
import BottomSheet from '../../shared/components/BottomSheet.vue'
import { usePrefs } from '../../shared/composables/usePrefs'
import { useHashRoute, type NavKey } from '../../shared/composables/useHashRoute'
import { fmtSize } from '../../shared/lib/format'
import { filesFromDrop } from '../../shared/lib/drop'
import { shareFilesOr } from '../../shared/lib/share'
import { downloadUrl, ymd, zipEntries } from '../../shared/lib/zip'
import type { Lang } from '../../shared/i18n'
import PdfSettingsPanel from './components/PdfSettingsPanel.vue'
import PdfDetailSheet from './components/PdfDetailSheet.vue'
import { pdfT } from './i18n'
import { DEFAULT_PDF_SETTINGS, type PdfItem, type PdfSettings } from './types'
import { defaultOcrLang, loadSettings, saveSettings, isPdfFile, fileKey, pdfConcurrency } from './lib/settings'
import type { PdfDoc } from '../../shared/pdf/pdf-loader'
import './styles/pdf.less'

const { lang, t, setLang: setPrefLang } = usePrefs()
const { navigate } = useHashRoute()
function p(key: string, ...args: (string | number)[]): string {
  return pdfT(lang.value, key, ...args)
}

const settings = ref<PdfSettings>({ ...DEFAULT_PDF_SETTINGS, ocrLang: defaultOcrLang(lang.value), ...loadSettings() })
function onSettings(s: PdfSettings) {
  settings.value = s
  saveSettings(s)
}
// Until the user picks an OCR language, it follows the UI language.
watch(lang, (l) => {
  if (!settings.value.ocrLangPicked) settings.value = { ...settings.value, ocrLang: defaultOcrLang(l) }
})

// shallowRef: File/Blob objects must never be wrapped in reactive proxies.
// Items are mutated in place, then triggerRef() re-renders.
const items = shallowRef<PdfItem[]>([])
// rev re-renders children that hold an item (same object, new contents).
const rev = ref(0)
const touch = () => { rev.value++; triggerRef(items) }

const isTouch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window)
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 720 : false)
function onResize() {
  isMobile.value = window.innerWidth < 720
}

const settingsOpen = ref(false)
const moreOpen = ref(false)
const detailId = ref<string | null>(null)
const detailItem = computed(() => items.value.find((i) => i.id === detailId.value) ?? null)
const sheetOpen = computed(() => isMobile.value && (settingsOpen.value || !!detailId.value))
watch(sheetOpen, (open) => { document.body.style.overflow = open ? 'hidden' : '' })
watch(moreOpen, (open) => { if (open) settingsOpen.value = false })
watch(isMobile, (m) => { if (!m) { settingsOpen.value = false; detailId.value = null } })

const pwDraft = reactive<Record<string, string>>({})
const pwOpen = ref<string | null>(null)
const hint = ref<string | null>(null)
let hintTimer: ReturnType<typeof setTimeout> | null = null
function showHint(s: string) {
  hint.value = s
  if (hintTimer) clearTimeout(hintTimer)
  hintTimer = setTimeout(() => { hint.value = null }, 3500)
}

const doneItems = computed(() => items.value.filter((i) => i.status === 'done' && i.outBlob))
const startable = computed(() => items.value.filter((i) => i.status === 'ready' || i.status === 'error' || i.status === 'cancelled'))

function statusTag(item: PdfItem): string {
  switch (item.status) {
    case 'probing': return p('stProbing')
    case 'queued': return p('stQueued')
    case 'converting':
      if (item.phase === 'build') return p('stBuilding')
      if (item.phase === 'ocr') return p('stOcr', item.pageNow, item.pageTotal)
      return p('stConverting', item.pageNow || 1, item.pageTotal || item.pages)
    case 'done': return p('stDone')
    case 'error': return p('stFailed')
    case 'cancelled': return p('stCancelled')
    default: return ''
  }
}
function statusClass(item: PdfItem): string {
  if (item.status === 'done') return 'ok'
  if (item.status === 'error') return 'bad'
  if (item.status === 'converting' || item.status === 'queued') return 'info'
  return 'mute'
}
function noteOf(item: PdfItem): string {
  if (item.warnings.length) return p(item.warnings[0])
  if (item.stats?.twoColumnPages) return p('twoCol', item.stats.twoColumnPages)
  return ''
}

// ---- adding files ----
const fileInput = ref<HTMLInputElement | null>(null)
function openPicker() {
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
  void filesFromDrop(e.dataTransfer).then((d) => addFiles(d.map((x) => x.file)))
}

let seq = 0
function newItem(file: File): PdfItem {
  return {
    id: `pdf-${Date.now().toString(36)}-${seq++}`,
    file,
    status: 'probing',
    pages: 0,
    kind: 'unknown',
    thumb: null,
    password: '',
    badPassword: false,
    progress: 0,
    pageNow: 0,
    pageTotal: 0,
    phase: '',
    outBlob: null,
    outUrl: null,
    outName: '',
    stats: null,
    outMode: null,
    error: null,
    warnings: [],
  }
}

function addFiles(files: File[]) {
  const pdfs = files.filter(isPdfFile)
  const skipped = files.length - pdfs.length
  const have = new Set(items.value.map((i) => fileKey(i.file)))
  const fresh = pdfs.filter((f) => {
    const k = fileKey(f)
    if (have.has(k)) return false
    have.add(k)
    return true
  })
  if (skipped) showHint(p('notPdf', skipped))
  else if (fresh.length < pdfs.length) showHint(p('dupSkipped', pdfs.length - fresh.length))
  if (!fresh.length) return
  const added = fresh.map(newItem)
  items.value = [...items.value, ...added]
  for (const it of added) void probe(it)
}

async function probe(item: PdfItem, password = '') {
  const { openPdf, PdfPasswordError } = await import('../../shared/pdf/pdf-loader')
  const { probeDoc } = await import('./lib/extract')
  try {
    const doc = await openPdf(await item.file.arrayBuffer(), password)
    try {
      const r = await probeDoc(doc)
      item.pages = r.pages
      item.kind = r.kind
      if (r.thumb) {
        if (item.thumb) URL.revokeObjectURL(item.thumb)
        item.thumb = URL.createObjectURL(r.thumb)
      }
      item.password = password
      item.badPassword = false
      if (item.status === 'probing' || item.status === 'locked') item.status = 'ready'
    } finally {
      void doc.loadingTask.destroy()
    }
  } catch (err) {
    if (err instanceof PdfPasswordError) {
      item.status = 'locked'
      item.badPassword = err.incorrect && !!password
    } else {
      item.status = 'error'
      item.error = p('errOpen')
      console.warn('[pdf-to-word] open failed', err)
    }
  }
  touch()
}

async function unlock(item: PdfItem) {
  const pw = pwDraft[item.id]
  if (!pw) return
  item.badPassword = false
  touch()
  await probe(item, pw)
  if (item.status !== 'locked') {
    delete pwDraft[item.id]
    pwOpen.value = null
  }
}

// ---- converting (in list order, 2 files at once on desktop, 1 on phones) ----
const controllers = new Map<string, AbortController>()
let active = 0

function enqueue(list: PdfItem[]) {
  for (const it of list) {
    if (it.status === 'locked' || it.status === 'probing' || it.status === 'converting') continue
    it.status = 'queued'
    it.progress = 0
    it.error = null
  }
  touch()
  void runQueue()
}
function startAll() {
  enqueue(startable.value)
}
function startOne(item: PdfItem) {
  enqueue([item])
}

function runQueue() {
  const limit = pdfConcurrency({ innerWidth: window.innerWidth, hardwareConcurrency: navigator.hardwareConcurrency })
  while (active < limit) {
    const next = items.value.find((i) => i.status === 'queued')
    if (!next) break
    active++
    // convertOne marks the item 'converting' before its first await, so the
    // next find() cannot pick the same item twice.
    void convertOne(next).finally(() => {
      active--
      runQueue()
    })
  }
}

async function convertOne(item: PdfItem) {
  const ctrl = new AbortController()
  controllers.set(item.id, ctrl)
  item.status = 'converting'
  item.phase = 'read'
  item.pageNow = 0
  item.pageTotal = item.pages
  item.warnings = []
  touch()
  const snapshot = { ...settings.value }
  try {
    const { convertPdf, isAbort, PageRangeError } = await import('./lib/convert')
    try {
      const r = await convertPdf(item.file, item.password, snapshot, (pr) => {
        item.phase = pr.phase
        item.pageNow = pr.page
        item.pageTotal = pr.total
        item.progress = pr.progress
        touch()
      }, ctrl.signal)
      if (item.outUrl) URL.revokeObjectURL(item.outUrl)
      item.outBlob = r.blob
      item.outUrl = URL.createObjectURL(r.blob)
      item.outName = r.name
      item.stats = r.stats
      item.outMode = snapshot.mode
      item.warnings = r.warnings
      item.status = 'done'
      item.progress = 1
    } catch (err) {
      if (isAbort(err) || ctrl.signal.aborted) {
        item.status = 'cancelled'
      } else {
        item.status = 'error'
        item.error = err instanceof PageRangeError ? p('errRange') : (err as Error)?.name === 'OcrError' ? p('errOcr') : p('errFailed')
        console.error(err)
      }
    }
  } finally {
    controllers.delete(item.id)
    item.phase = ''
    touch()
  }
}

function cancel(item: PdfItem) {
  if (item.status === 'queued') {
    item.status = 'cancelled'
    touch()
    return
  }
  const ctrl = controllers.get(item.id)
  if (ctrl) {
    ctrl.abort()
    // A page being OCR'd only stops when the recogniser is stopped. The
    // recogniser is shared: with another conversion running, let the abort
    // take effect after this page instead of breaking the other file's OCR.
    const others = items.value.some((i) => i !== item && i.status === 'converting')
    if (item.phase === 'ocr' && !others) void import('./lib/ocr').then((m) => m.terminateOcr())
  }
}

function enableOcr() {
  onSettings({ ...settings.value, ocr: true })
}

// ---- removing ----
const clearConfirm = ref(false)
let clearTimer: ReturnType<typeof setTimeout> | null = null
function release(item: PdfItem) {
  controllers.get(item.id)?.abort()
  dropPreviewDoc(item.id)
  if (item.thumb) URL.revokeObjectURL(item.thumb)
  if (item.outUrl) URL.revokeObjectURL(item.outUrl)
  const pv = previews[item.id]
  if (pv) Object.values(pv).forEach((u) => URL.revokeObjectURL(u))
  delete previews[item.id]
  delete pwDraft[item.id]
}
function removeItem(item: PdfItem) {
  release(item)
  items.value = items.value.filter((i) => i !== item)
  if (detailId.value === item.id) detailId.value = null
}
function onClear() {
  if (!clearConfirm.value) {
    clearConfirm.value = true
    if (clearTimer) clearTimeout(clearTimer)
    clearTimer = setTimeout(() => { clearConfirm.value = false }, 3000)
    return
  }
  clearConfirm.value = false
  items.value.forEach(release)
  items.value = []
  detailId.value = null
}

// ---- downloading / sharing ----
const zipping = ref(false)
const sharing = ref(false)
function docxFile(item: PdfItem): File {
  return new File([item.outBlob!], item.outName, { type: item.outBlob!.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}
function downloadOne(item: PdfItem) {
  if (item.outBlob) downloadUrl(item.outBlob, item.outName)
}
async function zipAll() {
  const done = doneItems.value
  if (done.length === 1) { downloadOne(done[0]); return }
  zipping.value = true
  try {
    const blob = await zipEntries(done.map((i) => ({ name: i.outName, blob: i.outBlob! })))
    downloadUrl(blob, `pdf-to-word-${ymd()}.zip`)
  } finally {
    zipping.value = false
  }
}
function downloadAll() {
  void zipAll()
}
async function saveAllMobile() {
  const done = doneItems.value
  if (!done.length) return
  sharing.value = true
  try {
    await shareFilesOr(typeof navigator !== 'undefined' ? navigator : undefined, done.map(docxFile), zipAll)
  } finally {
    sharing.value = false
  }
}
async function shareOne(item: PdfItem) {
  if (!item.outBlob) return
  await shareFilesOr(typeof navigator !== 'undefined' ? navigator : undefined, [docxFile(item)], () => downloadOne(item))
}

// ---- phone surfaces ----
function onCardClick(item: PdfItem) {
  if (!isMobile.value || item.status === 'locked' || item.status === 'probing') return
  moreOpen.value = false
  settingsOpen.value = false
  detailId.value = item.id
}
function toggleSettings() {
  moreOpen.value = false
  detailId.value = null
  settingsOpen.value = !settingsOpen.value
}
function startFromSheet() {
  settingsOpen.value = false
  startAll()
}
function removeFromSheet(item: PdfItem) {
  detailId.value = null
  removeItem(item)
}
function reconvertFromSheet(item: PdfItem) {
  detailId.value = null
  startOne(item)
}

// Page previews for the detail sheet, rendered on demand and cached. Page 1
// is the list thumbnail itself (rendered once at probe time, same size), so
// it is never rendered again. The other pages share one opened document
// while the sheet shows the file, instead of parsing the PDF per page.
const previews = reactive<Record<string, Record<number, string>>>({})
const sheetPreviews = computed<Record<number, string>>(() => {
  const it = detailItem.value
  if (!it) return {}
  void rev.value
  return it.thumb ? { ...(previews[it.id] ?? {}), 1: it.thumb } : (previews[it.id] ?? {})
})
const previewBusy = new Set<string>()
const previewDocs = new Map<string, Promise<PdfDoc>>()
function previewDoc(item: PdfItem): Promise<PdfDoc> {
  let d = previewDocs.get(item.id)
  if (!d) {
    d = import('../../shared/pdf/pdf-loader').then(async ({ openPdf }) => openPdf(await item.file.arrayBuffer(), item.password))
    previewDocs.set(item.id, d)
    d.catch(() => { if (previewDocs.get(item.id) === d) previewDocs.delete(item.id) })
  }
  return d
}
function dropPreviewDoc(id: string) {
  const d = previewDocs.get(id)
  if (!d) return
  previewDocs.delete(id)
  void d.then((doc) => doc.loadingTask.destroy()).catch(() => {})
}
watch(detailId, (_id, old) => { if (old) dropPreviewDoc(old) })
async function needPreview(item: PdfItem, n: number) {
  if (n < 1 || n > Math.min(item.pages, 12)) return
  if (n === 1 && item.thumb) return
  const key = `${item.id}:${n}`
  if (previews[item.id]?.[n] || previewBusy.has(key)) return
  previewBusy.add(key)
  try {
    const { renderThumb, THUMB_WIDTH } = await import('./lib/extract')
    const doc = await previewDoc(item)
    const blob = await renderThumb(doc, n, THUMB_WIDTH)
    if (blob && items.value.includes(item)) {
      previews[item.id] = { ...(previews[item.id] ?? {}), [n]: URL.createObjectURL(blob) }
    }
  } catch { /* preview is optional */ } finally {
    previewBusy.delete(key)
  }
}

// ---- navigation ----
function goCompress() {
  moreOpen.value = false
  settingsOpen.value = false
  detailId.value = null
  navigate('compress')
}
function goHistory() {
  navigate('compress', 'history')
}
// Side nav / More menu / hub entries other than this page.
function onNav(key: NavKey) {
  if (key === 'pdf') { scrollTop(); return }
  moreOpen.value = false
  settingsOpen.value = false
  detailId.value = null
  if (key === 'history') goHistory()
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

// Page-wide drop while this view is shown.
const pageDragging = ref(false)
let dragDepth = 0
function hasFiles(e: DragEvent) {
  return !!e.dataTransfer?.types?.includes('Files')
}
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
  void filesFromDrop(e.dataTransfer).then((d) => addFiles(d.map((x) => x.file)))
}
let listening = false
function startListening() {
  if (listening) return
  listening = true
  document.addEventListener('dragenter', onDocDragEnter)
  document.addEventListener('dragleave', onDocDragLeave)
  document.addEventListener('dragover', onDocDragOver)
  document.addEventListener('drop', onDocDrop)
  window.addEventListener('resize', onResize)
}
function stopListening() {
  if (!listening) return
  listening = false
  document.removeEventListener('dragenter', onDocDragEnter)
  document.removeEventListener('dragleave', onDocDragLeave)
  document.removeEventListener('dragover', onDocDragOver)
  document.removeEventListener('drop', onDocDrop)
  window.removeEventListener('resize', onResize)
}
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (items.value.some((i) => i.status === 'converting' || i.status === 'queued')) {
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
  settingsOpen.value = false
  moreOpen.value = false
  detailId.value = null
  pageDragging.value = false
  document.body.style.overflow = ''
})
onUnmounted(() => {
  stopListening()
  window.removeEventListener('beforeunload', onBeforeUnload)
  items.value.forEach(release)
  if (hintTimer) clearTimeout(hintTimer)
  if (clearTimer) clearTimeout(clearTimer)
  document.body.style.overflow = ''
})
</script>
