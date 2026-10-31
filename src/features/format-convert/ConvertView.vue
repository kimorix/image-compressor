<template>
  <AppHeader :sub="p('sub')" :inert="sheetOpen ? true : undefined" @lang="setLang">
    <template #title>{{ p('title') }}</template>
  </AppHeader>
  <div class="layout cv-layout" :inert="sheetOpen ? true : undefined">
    <SideNav :t="t" active="convert" @nav="onNav">
      <div class="side-card">
        <strong>{{ p('sideTitle') }}</strong>
        <p>{{ p('sideIn') }}</p>
        <p>{{ p('sideOut') }}</p>
      </div>
    </SideNav>
    <main class="cv-main">
      <div class="card cv-upload" :class="{ compact: items.length > 0 }">
        <div
          id="cvDrop"
          class="cv-drop"
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
          <input ref="fileInput" id="cvFileInput" type="file" :accept="ACCEPT" multiple hidden @change="onPick" />
          <input ref="folderInput" type="file" webkitdirectory multiple hidden @change="onPick" />
        </div>
        <div v-if="!isTouch && !isMobile" class="cv-drop-extra">
          <button type="button" class="cv-link-btn" @click="openFolder">{{ p('pickFolder') }}</button>
        </div>
        <p v-if="hint" class="cv-hint" role="status">{{ hint }}</p>
      </div>

      <button v-if="items.length && isMobile" type="button" class="cv-summary" @click="toggleSettings">
        <span class="cv-summary-k">{{ p('sumOut') }}</span>
        <span class="cv-pill to">{{ settings.format === 'auto' ? p('fmtAuto') : FORMAT_LABEL[settings.format] }}</span>
        <span class="cv-summary-v">{{ summaryText }}</span>
        <span class="cv-summary-go">{{ p('sumChange') }} ›</span>
      </button>

      <div v-if="items.length" class="card cv-list-card">
        <div class="cv-list-head">
          <h3>{{ p('listTitle') }} <small>{{ p('count', items.length) }}</small></h3>
          <div class="cv-list-actions">
            <button type="button" class="cv-link-btn" :class="{ danger: clearConfirm }" @click="onClear">{{ clearConfirm ? p('clearConfirm') : p('clear') }}</button>
            <button type="button" :disabled="!redoable.length" @click="convertAgain">{{ p('reconvert') }}</button>
            <button type="button" class="primary" :disabled="!doneItems.length || zipping" @click="downloadAll">{{ zipping ? p('zipping') : p('downloadAll') }}</button>
          </div>
        </div>
        <div class="cv-strip" role="status">
          <span>{{ p('stripDone') }} <b>{{ counts.done }}</b></span>
          <span v-if="counts.running">{{ p('stripRunning') }} <b>{{ counts.running }}</b></span>
          <span v-if="counts.failed">{{ p('stripFailed') }} <b>{{ counts.failed }}</b></span>
          <span v-if="counts.unsupported">{{ p('stripUnsupported') }} <b>{{ counts.unsupported }}</b></span>
          <span v-if="counts.done" class="cv-strip-total">{{ p('stripTotal', fmtSize(counts.inBytes), '') }}<b>{{ fmtSize(counts.outBytes) }}</b></span>
        </div>
        <ul class="cv-list">
          <li v-for="item in items" :key="item.id" class="cv-item" :class="[`st-${item.status}`, { clickable: isMobile && item.status !== 'unsupported' }]" @click="onCardClick(item)">
            <div class="cv-thumb" :class="{ checker: item.status === 'done' || !!thumbOf(item), plain: !thumbOf(item) }">
              <img v-if="thumbOf(item)" :src="thumbOf(item)!" alt="" loading="lazy" @error="dropPreview(item)" />
              <span v-else-if="item.status === 'error'" class="cv-thumb-bad" aria-hidden="true">!</span>
              <span v-else class="cv-thumb-label">{{ sourceLabel(item.src, item.file.name) }}</span>
            </div>
            <div class="cv-info">
              <strong class="cv-name" :title="item.file.name">{{ item.file.name }}</strong>
              <div class="cv-meta">
                <template v-if="item.status !== 'unsupported'">
                  <span class="cv-pill">{{ sourceLabel(item.src, item.file.name) }}</span>
                  <span class="cv-arrow" aria-hidden="true">→</span>
                  <span class="cv-pill to">{{ isMobile ? OUT_EXT[item.target].toUpperCase() : FORMAT_LABEL[item.target] }}</span>
                </template>
                <span v-if="item.width && !isMobile" class="cv-dim">{{ item.width }}×{{ item.height }}</span>
                <span class="cv-size">{{ isMobile ? fmtSizeShort(item.file.size) : fmtSize(item.file.size) }}<template v-if="item.outBlob && item.status === 'done'"> → {{ isMobile ? fmtSizeShort(item.outBlob.size) : fmtSize(item.outBlob.size) }}</template></span>
                <span v-if="!isMobile || item.status !== 'converting'" class="cv-tag" :class="statusClass(item)">{{ statusText(item) }}</span>
              </div>
              <div v-if="item.status === 'converting' || item.status === 'queued'" class="cv-progress" :class="{ running: item.status === 'converting' }" role="progressbar" :aria-label="statusText(item)"><span></span></div>
              <div v-if="noteChips(item).length" class="cv-notes">
                <span v-for="(n, i) in noteChips(item)" :key="i" class="cv-tag" :class="n.cls">{{ n.text }}</span>
              </div>
              <p v-if="item.status === 'error' && item.error" class="cv-sub bad">{{ item.error }}</p>
              <p v-if="item.status === 'unsupported'" class="cv-sub">{{ p('unsupportedHint', sourceLabel(item.src, item.file.name)) }}</p>
            </div>
            <!-- Desktop actions -->
            <div class="cv-actions desk" @click.stop>
              <button v-if="item.status === 'done'" type="button" class="primary" @click="downloadOne(item)">{{ p('download', OUT_EXT[item.target]) }}</button>
              <button v-else-if="item.status === 'converting' || item.status === 'queued'" type="button" @click="cancel(item)">{{ p('cancel') }}</button>
              <button v-else-if="item.status === 'error' || item.status === 'cancelled'" type="button" @click="startOne(item)">{{ p('retry') }}</button>
              <button v-if="item.status !== 'converting' && item.status !== 'queued'" type="button" class="cv-icon-btn" :title="p('remove')" :aria-label="p('remove')" @click="removeItem(item)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg></button>
            </div>
            <!-- Phone: one round action per card -->
            <div class="cv-actions mob" @click.stop>
              <button v-if="item.status === 'done'" type="button" class="cv-round accent" :title="p('download', OUT_EXT[item.target])" :aria-label="p('download', OUT_EXT[item.target])" @click="shareOne(item)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" /></svg></button>
              <button v-else-if="item.status === 'converting' || item.status === 'queued'" type="button" class="cv-round" :title="p('cancel')" :aria-label="p('cancel')" @click="cancel(item)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
              <button v-else-if="item.status === 'error' || item.status === 'cancelled'" type="button" class="cv-round accent text" @click="startOne(item)">{{ p('retry') }}</button>
              <button v-else type="button" class="cv-round" :title="p('remove')" :aria-label="p('remove')" @click="removeItem(item)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg></button>
            </div>
          </li>
        </ul>
      </div>
    </main>
    <div id="rightPanel" class="cv-right">
      <div v-if="!isMobile" class="card cv-settings-card">
        <h3>{{ p('settingsTitle') }}</h3>
        <ConvertSettings :settings="settings" :p="p" :start-count="redoable.length" :show-pages="hasMultiPage" @update="onSettings" @start="convertAgain" />
      </div>
      <div v-if="!isMobile" class="card cv-guide-card">
        <h3>{{ p('guideTitle') }}</h3>
        <ul class="cv-guide">
          <li>{{ p('guideJpeg') }}</li>
          <li>{{ p('guidePng') }}</li>
          <li>{{ p('guideWebp') }}</li>
          <li>{{ p('guideAvif') }}</li>
          <li>{{ p('guideMore') }}</li>
        </ul>
      </div>
    </div>
  </div>
  <div class="cv-sticky" v-show="items.length > 0" :inert="sheetOpen ? true : undefined">
    <button type="button" :disabled="!redoable.length" @click="convertAgain">{{ redoable.length ? p('reconvert') : p('start') }}</button>
    <button type="button" class="primary" :disabled="!doneItems.length || zipping || sharing" @click="saveAllMobile">{{ zipping ? p('zipping') : p('saveAll') }}</button>
  </div>
  <div class="cv-sticky-spacer" v-show="items.length > 0" aria-hidden="true"></div>
  <TabBar
    :t="t"
    :inert="detailId ? true : undefined"
    :active="settingsOpen ? 'settings' : 'more'"
    :settings-open="settingsOpen"
    :more-open="moreOpen"
    @compress="go('compress')"
    @pdf="go(lastPdfTool())"
    @settings="toggleSettings"
    @more="toggleMore"
  />
  <MoreMenu :t="t" :open="moreOpen" active="convert" :menu-inert="sheetOpen" @close="moreOpen = false" @nav="onNav" />
  <div v-if="pageDragging" class="page-drop-hint" aria-hidden="true">{{ p('dropAnywhere') }}</div>
  <BottomSheet
    v-if="settingsOpen && isMobile"
    :title="p('settingsTitle')"
    :close-label="p('close')"
    label-id="cvSettingsTitle"
    sheet-class="settings-sheet"
    overlay-class="settings-overlay"
    @close="settingsOpen = false"
  >
    <div class="sheet-body">
      <ConvertSettings :settings="settings" :p="p" :start-count="redoable.length" :show-pages="hasMultiPage" @update="onSettings" @start="startFromSheet" />
    </div>
  </BottomSheet>
  <ConvertDetailSheet
    v-if="detailItem && isMobile"
    :item="detailItem"
    :p="p"
    :rev="rev"
    :notes="noteChips(detailItem).map((n) => n.text)"
    @close="detailId = null"
    @remove="removeFromSheet"
    @change="changeFormat"
    @share="shareOne"
    @retry="startOne"
  />
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref, shallowRef, triggerRef, watch } from 'vue'
import AppHeader from '../../shared/components/AppHeader.vue'
import SideNav from '../../shared/components/SideNav.vue'
import TabBar from '../../shared/components/TabBar.vue'
import MoreMenu from '../../shared/components/MoreMenu.vue'
import BottomSheet from '../../shared/components/BottomSheet.vue'
import { usePrefs } from '../../shared/composables/usePrefs'
import { useHashRoute, type Feature, type NavKey } from '../../shared/composables/useHashRoute'
import { fmtSize, fmtSizeShort } from '../../shared/lib/format'
import { filesFromDrop, type DroppedFile } from '../../shared/lib/drop'
import { shareFilesOr } from '../../shared/lib/share'
import { downloadUrl, ymd, zipEntries } from '../../shared/lib/zip'
import { getImagePool } from '../../shared/image/image-pool'
import { sniffAny } from '../../shared/image/sniff'
import type { Lang } from '../../shared/i18n'
import ConvertSettings from './components/ConvertSettings.vue'
import ConvertDetailSheet from './components/ConvertDetailSheet.vue'
import { convertT, CONVERT_MESSAGES } from './i18n'
import type { ConvertItem, ConvertJobPayload, ConvertJobResult, ConvertSettings as Settings, NoteKey, OutFormat } from './types'
import {
  ACCEPT, countItems, FORMAT_LABEL, formatFromParam, isAnimated, isLossy, isSameFormat, isSupportedInput, looksLikeImage,
  MAYBE_ALPHA_INPUT, OUT_EXT, outputName, pngMayHaveAlpha, predictTarget, requestedFormat, settingsSig, sourceLabel, uniqueOutNames,
} from './lib/convert'
import { canPreview } from './lib/preview'
import { loadConvertSettings, saveConvertSettings } from './lib/settings-store'
import './styles/convert.less'

const { lang, t, setLang: setPrefLang } = usePrefs()
const { route, navigate, lastPdfTool } = useHashRoute()
function p(key: string, ...args: (string | number)[]): string {
  return convertT(lang.value, key, ...args)
}


// ---- settings ----
const settings = ref<Settings>(loadConvertSettings())
// `#/convert?to=webp` (SEO landing links) preselects the output for this
// visit without overwriting a remembered choice.
function applyParam() {
  const to = formatFromParam(route.value.params.to)
  if (to && to !== settings.value.format) settings.value = { ...settings.value, format: to }
}
applyParam()
function onSettings(s: Settings) {
  const pagesChanged = s.tiffPages !== settings.value.tiffPages
  settings.value = s
  saveConvertSettings(s)
  if (pagesChanged) applyTiffPages()
  touch()
}

// ---- items ----
// shallowRef: File/Blob objects must never be wrapped in reactive proxies.
// Items are mutated in place, then touch() re-renders.
const items = shallowRef<ConvertItem[]>([])
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
const detailItem = computed(() => (void rev.value, items.value.find((i) => i.id === detailId.value) ?? null))
const sheetOpen = computed(() => isMobile.value && (settingsOpen.value || !!detailId.value))
watch(sheetOpen, (open) => { document.body.style.overflow = open ? 'hidden' : '' })
watch(isMobile, (m) => { if (!m) { settingsOpen.value = false; detailId.value = null } })

const hint = ref<string | null>(null)
let hintTimer: ReturnType<typeof setTimeout> | null = null
function showHint(s: string) {
  hint.value = s
  if (hintTimer) clearTimeout(hintTimer)
  hintTimer = setTimeout(() => { hint.value = null }, 3500)
}

const counts = computed(() => (void rev.value, countItems(items.value)))
const doneItems = computed(() => (void rev.value, items.value.filter((i) => i.status === 'done' && i.outBlob)))
/** Done items whose output no longer matches the settings ("convert again"). */
function isStale(item: ConvertItem): boolean {
  return item.status === 'done' && item.sig !== settingsSig(item, settings.value)
}
const redoable = computed(() => {
  void rev.value
  return items.value.filter((i) => isStale(i) || (i.status === 'error' && i.retryable) || i.status === 'cancelled')
})
const summaryText = computed(() => {
  const s = settings.value
  const parts: string[] = []
  if (s.format === 'auto' || isLossy(s.format)) parts.push(p('sumQuality', s.quality[s.format === 'auto' ? 'jpeg' : s.format]))
  if (s.keepExif) parts.push(p('sumExif'))
  return parts.length ? `· ${parts.join(' · ')}` : ''
})

/** The browser cannot show this source (damaged, or a format it lacks): no preview. */
function dropPreview(item: ConvertItem) {
  if (!item.srcUrl) return
  URL.revokeObjectURL(item.srcUrl)
  item.srcUrl = null
  touch()
}
function thumbOf(item: ConvertItem): string | null {
  return item.srcUrl ?? (item.outUrl && canPreview(item.target) ? item.outUrl : null)
}
function statusText(item: ConvertItem): string {
  if (isStale(item)) return p('stStale')
  switch (item.status) {
    case 'queued': return p('stQueued')
    case 'converting': return p('stConverting')
    case 'done': return p('stDone')
    case 'error': return p('stFailed')
    case 'unsupported': return p('stUnsupported')
    default: return p('stCancelled')
  }
}
function statusClass(item: ConvertItem): string {
  if (isStale(item)) return 'warn'
  if (item.status === 'done') return 'ok'
  if (item.status === 'error') return 'bad'
  if (item.status === 'unsupported') return 'warn'
  if (item.status === 'converting' || item.status === 'queued') return 'info'
  return 'mute'
}
const NOTE_CLASS: Record<NoteKey, string> = {
  filled: 'warn', firstFrame: 'info', exifKept: 'mute', exifAvif: 'mute', sameFormat: 'mute', p3Kept: 'mute',
  rawPreview: 'info', svgRaster: 'mute', icoLargest: 'mute', psdComposite: 'info', psdEmpty: 'warn', gifAlpha: 'warn', gifColors: 'mute', icoSizes: 'mute', tiffPage: 'info',
}
function noteText(item: ConvertItem, n: NoteKey): string {
  switch (n) {
    case 'filled': return p('noteFilled', item.fill.toUpperCase())
    case 'firstFrame': return p('noteFirstFrame')
    case 'exifKept': return p('noteExifKept')
    case 'exifAvif': return p('noteExifAvif', FORMAT_LABEL[item.target])
    case 'sameFormat': return p('noteSameFormat', item.quality ?? '')
    case 'p3Kept': return p('noteP3')
    case 'rawPreview': return p('noteRawPreview', item.width, item.height)
    case 'svgRaster': return p('noteSvgRaster', item.width, item.height)
    case 'icoLargest': return p('noteIcoLargest', item.width, item.height)
    case 'psdComposite': return p('notePsdComposite')
    case 'psdEmpty': return p('notePsdEmpty')
    case 'gifAlpha': return p('noteGifAlpha')
    case 'gifColors': return p('noteGifColors')
    case 'icoSizes': return p('noteIcoSizes', item.icoSizes.join('/'))
    default: return p('noteTiffPage', item.page + 1, item.pages)
  }
}
function noteChips(item: ConvertItem): { text: string; cls: string }[] {
  const out: { text: string; cls: string }[] = []
  if (item.pages > 1 && item.status !== 'unsupported') out.push({ text: noteText(item, 'tiffPage'), cls: NOTE_CLASS.tiffPage })
  if (item.status === 'converting' && (item.target === 'avif' || item.target === 'jxl')) out.push({ text: p('noteAvifSlow', FORMAT_LABEL[item.target]), cls: 'mute' })
  if (item.status !== 'done') return out
  for (const n of item.notes) out.push({ text: noteText(item, n), cls: NOTE_CLASS[n] })
  return out
}

// ---- adding files ----
const fileInput = ref<HTMLInputElement | null>(null)
const folderInput = ref<HTMLInputElement | null>(null)
function openPicker() {
  fileInput.value?.click()
}
function openFolder() {
  folderInput.value?.click()
}
function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  // A folder pick carries the path in webkitRelativePath ("trip/day1/a.jpg").
  void addFiles(files.map((file) => {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || ''
    const cut = rel.lastIndexOf('/')
    return { file, dir: cut > 0 ? rel.slice(0, cut) : '' }
  }))
}
const dragover = ref(false)
function onZoneDrop(e: DragEvent) {
  dragover.value = false
  pageDragging.value = false
  void filesFromDrop(e.dataTransfer).then(addFiles)
}

let seq = 0
const fileKey = (f: File, dir: string) => `${dir}/${f.name}|${f.size}|${f.lastModified}`

async function addFiles(list: DroppedFile[]) {
  if (!list.length) return
  const have = new Set(items.value.map((i) => fileKey(i.file, i.dir)))
  let skipped = 0
  let dups = 0
  const added: ConvertItem[] = []
  for (const { file, dir } of list) {
    const k = fileKey(file, dir)
    if (have.has(k)) { dups++; continue }
    have.add(k)
    // The header decides (a ".jpg" that is HEIC, a name without extension);
    // 64 KB also covers a PNG's chunks before IDAT for the alpha hint.
    const head = new Uint8Array(await file.slice(0, 65536).arrayBuffer())
    // TGA has no signature: its 2.0 footer is the only byte-level hint.
    const tail = file.size > 26 ? new Uint8Array(await file.slice(file.size - 26).arrayBuffer()) : undefined
    const src = sniffAny(head, file.name, tail)
    if (!looksLikeImage(file, src)) { skipped++; continue }
    const supported = isSupportedInput(src)
    // A multi-page TIFF becomes one row per page (or just the first).
    const pages = src === 'tiff' ? await countTiffPages(file) : 1
    const item: ConvertItem = {
      id: `cv-${Date.now().toString(36)}-${seq++}`,
      file,
      dir,
      src,
      mayHaveAlpha: src === 'png' ? pngMayHaveAlpha(head) : !!src && MAYBE_ALPHA_INPUT.has(src),
      status: supported ? 'queued' : 'unsupported',
      override: null,
      target: 'jpeg',
      srcUrl: supported && canPreview(src) ? URL.createObjectURL(file) : null,
      outBlob: null,
      outUrl: null,
      outName: '',
      width: 0,
      height: 0,
      quality: null,
      notes: src === 'gif' && isAnimated(head, src) ? ['firstFrame'] : [],
      exif: null,
      error: null,
      retryable: true,
      sig: '',
      gen: 0,
      fill: settings.value.fill,
      page: 0,
      pages,
      icoSizes: [],
    }
    item.target = predictTarget(item, settings.value)
    added.push(item)
    if (pages > 1 && settings.value.tiffPages === 'all') added.push(...pageRows(item))
  }
  if (skipped) showHint(p('notImage', skipped))
  else if (dups) showHint(p('dupSkipped', dups))
  if (!added.length) return
  items.value = [...items.value, ...added]
  touch()
  // Auto-start: every supported file converts as soon as it is added.
  for (const it of added) if (it.status === 'queued') void convertOne(it)
}

// ---- multi-page TIFF ----
async function countTiffPages(file: File): Promise<number> {
  try {
    const { tiffPageCount } = await import('../../shared/image/formats/codec-tiff-ifd')
    return tiffPageCount(new Uint8Array(await file.arrayBuffer()))
  } catch {
    return 1
  }
}
/** Rows for pages 2…n of a multi-page TIFF row (page 0). */
function pageRows(first: ConvertItem): ConvertItem[] {
  const out: ConvertItem[] = []
  for (let page = 1; page < first.pages; page++) {
    out.push({
      ...first,
      id: `cv-${Date.now().toString(36)}-${seq++}`,
      page,
      // Each row owns its URLs (revoked on removal); the source preview is not shared.
      srcUrl: null,
      outBlob: null,
      outUrl: null,
      notes: [],
      icoSizes: [],
      gen: 0,
    })
  }
  return out
}
const hasMultiPage = computed(() => (void rev.value, items.value.some((i) => i.pages > 1)))
/** The "every page / first page" switch applies to rows already in the list too. */
function applyTiffPages() {
  if (settings.value.tiffPages === 'first') {
    const drop = items.value.filter((i) => i.page > 0)
    drop.forEach(release)
    if (drop.some((i) => i.id === detailId.value)) detailId.value = null
    items.value = items.value.filter((i) => i.page === 0)
    return
  }
  const next: ConvertItem[] = []
  const fresh: ConvertItem[] = []
  for (const it of items.value) {
    next.push(it)
    if (it.page === 0 && it.pages > 1 && !items.value.some((o) => o !== it && o.file === it.file && o.dir === it.dir)) {
      const rows = pageRows(it)
      for (const r of rows) { r.status = it.status === 'unsupported' ? 'unsupported' : 'queued'; r.sig = '' }
      next.push(...rows)
      fresh.push(...rows)
    }
  }
  items.value = next
  for (const r of fresh) if (r.status === 'queued') void convertOne(r)
}

// ---- converting (the shared image pool; one cancel group per file) ----
const group = (item: ConvertItem) => `convert:${item.id}`

async function convertOne(item: ConvertItem) {
  if (!item.src || !isSupportedInput(item.src)) return
  const gen = ++item.gen
  const s = settings.value
  const req = requestedFormat(item, s)
  item.status = 'queued'
  item.error = null
  item.retryable = true
  item.target = predictTarget(item, s)
  touch()
  const payload: ConvertJobPayload = {
    file: item.file,
    src: item.src,
    format: req,
    quality: { ...s.quality },
    fill: s.fill,
    keepExif: s.keepExif,
    page: item.page,
    icoSizes: [...s.icoSizes],
  }
  const sig = settingsSig(item, s)
  const keepName = s.keepName
  const res = await getImagePool().run<ConvertJobResult>('convert', payload, {
    group: group(item),
    onStart: () => {
      if (item.gen !== gen) return
      item.status = 'converting'
      touch()
    },
  })
  // A newer run (convert again, change format) or a removal wins.
  if (item.gen !== gen || !items.value.includes(item)) return
  if (res.ok) {
    const r = res.result
    if (item.outUrl) URL.revokeObjectURL(item.outUrl)
    item.outBlob = r.blob
    item.outUrl = URL.createObjectURL(r.blob)
    item.outName = outputName(item.file.name, r.format, keepName, item.page, item.pages)
    item.target = r.format
    item.width = r.width
    item.height = r.height
    item.quality = r.quality
    item.fill = payload.fill
    const notes: NoteKey[] = []
    if (r.filled) notes.push('filled')
    if (r.animated) notes.push('firstFrame')
    if (r.exif === 'kept') notes.push('exifKept')
    if (r.exif === 'avif') notes.push('exifAvif')
    if (isSameFormat(item.src, r.format) && r.quality !== null) notes.push('sameFormat')
    if (r.p3) notes.push('p3Kept')
    notes.push(...r.extra)
    item.icoSizes = r.icoSizes
    item.notes = notes
    item.exif = r.exif
    item.sig = sig
    item.status = 'done'
  } else if (res.cancelled) {
    item.status = 'cancelled'
  } else {
    item.status = 'error'
    item.error = res.error in CONVERT_MESSAGES.en ? p(res.error) : p('errFailed')
    // Undecodable files fail the same way again: Retry stays on the row,
    // but "convert again" does not sweep them up.
    item.retryable = res.retryable !== false && res.error !== 'errDecode' && res.error !== 'errAvifDecode'
    if (!(res.error in CONVERT_MESSAGES.en)) console.warn('[format-convert]', item.file.name, res.error)
  }
  touch()
}

function startOne(item: ConvertItem) {
  void convertOne(item)
}
function convertAgain() {
  for (const it of redoable.value) void convertOne(it)
}
function cancel(item: ConvertItem) {
  item.gen++
  getImagePool().cancel(group(item))
  item.status = 'cancelled'
  touch()
}
function changeFormat(item: ConvertItem, fmt: OutFormat) {
  item.override = fmt
  void convertOne(item)
}

// ---- removing ----
const clearConfirm = ref(false)
let clearTimer: ReturnType<typeof setTimeout> | null = null
function release(item: ConvertItem) {
  if (item.status === 'queued' || item.status === 'converting') getImagePool().cancel(group(item))
  item.gen++
  if (item.srcUrl) URL.revokeObjectURL(item.srcUrl)
  if (item.outUrl) URL.revokeObjectURL(item.outUrl)
}
function removeItem(item: ConvertItem) {
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
/** Final names for the done items: same-folder clashes get "(1)", "(2)". */
function finalNames(list: ConvertItem[]): Map<ConvertItem, string> {
  const names = uniqueOutNames(list.map((i) => ({ dir: i.dir, name: i.outName })))
  return new Map(list.map((i, k) => [i, names[k]]))
}
function nameOf(item: ConvertItem): string {
  return finalNames(doneItems.value).get(item) ?? item.outName
}
function outFile(item: ConvertItem, name = nameOf(item)): File {
  return new File([item.outBlob!], name, { type: item.outBlob!.type })
}
function downloadOne(item: ConvertItem) {
  if (item.outBlob) downloadUrl(item.outBlob, nameOf(item))
}
async function zipAll() {
  const done = doneItems.value
  if (done.length === 1) { downloadOne(done[0]); return }
  zipping.value = true
  try {
    const names = finalNames(done)
    const blob = await zipEntries(done.map((i) => ({ name: i.dir ? `${i.dir}/${names.get(i)}` : names.get(i)!, blob: i.outBlob! })))
    downloadUrl(blob, `convert-${ymd()}.zip`)
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
    const names = finalNames(done)
    await shareFilesOr(typeof navigator !== 'undefined' ? navigator : undefined, done.map((i) => outFile(i, names.get(i))), zipAll)
  } finally {
    sharing.value = false
  }
}
async function shareOne(item: ConvertItem) {
  if (!item.outBlob) return
  await shareFilesOr(typeof navigator !== 'undefined' ? navigator : undefined, [outFile(item)], () => downloadOne(item))
}

// ---- phone surfaces ----
function onCardClick(item: ConvertItem) {
  if (!isMobile.value || item.status === 'unsupported') return
  moreOpen.value = false
  settingsOpen.value = false
  detailId.value = item.id
}
function toggleSettings() {
  moreOpen.value = false
  detailId.value = null
  settingsOpen.value = !settingsOpen.value
}
function toggleMore() {
  settingsOpen.value = false
  moreOpen.value = !moreOpen.value
}
function startFromSheet() {
  settingsOpen.value = false
  convertAgain()
}
function removeFromSheet(item: ConvertItem) {
  detailId.value = null
  removeItem(item)
}

// ---- navigation ----
function go(key: Feature) {
  moreOpen.value = false
  settingsOpen.value = false
  detailId.value = null
  navigate(key)
}
function onNav(key: NavKey) {
  if (key === 'convert') { moreOpen.value = false; window.scrollTo({ top: 0, behavior: 'smooth' }); return }
  if (key === 'history') { moreOpen.value = false; navigate('compress', 'history'); return }
  go(key)
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
  void filesFromDrop(e.dataTransfer).then(addFiles)
}
function onPaste(e: ClipboardEvent) {
  const target = e.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
  const files = [...(e.clipboardData?.files ?? [])]
  if (!files.length) {
    if (e.clipboardData?.types?.includes('Files')) showHint(p('pasteEmpty'))
    return
  }
  e.preventDefault()
  // Pasted screenshots are all called "image.png": stamp them apart.
  void addFiles(files.map((file, i) => ({
    file: file.name === 'image.png' ? new File([file], `paste-${Date.now()}-${i}.png`, { type: file.type, lastModified: Date.now() }) : file,
    dir: '',
  })))
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
  if (items.value.some((i) => i.status === 'converting' || i.status === 'queued')) {
    e.preventDefault()
    e.returnValue = ''
  }
}
watch(() => route.value.params.to, () => { if (route.value.feature === 'convert') applyParam() })

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
