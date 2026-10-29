<template>
  <AppHeader :sub="m('sub')" :inert="overlayOpen ? true : undefined" @lang="setLang">
    <template #title><span class="title-desk">{{ m('title') }}</span><span class="title-hub">{{ t('hubTitle') }}</span></template>
  </AppHeader>
  <div class="layout pm-layout" :inert="overlayOpen ? true : undefined">
    <SideNav :t="t" active="pdf-merge" @nav="onNav">
      <div class="side-card">
        <strong>{{ m('sideTitle') }}</strong>
        <p>{{ m('sideDesc') }}</p>
      </div>
    </SideNav>
    <main class="pm-main">
      <PdfHubSwitch active="pdf-merge" :t="t" />

      <!-- Phone: mode + add on one row above the file list -->
      <div v-if="isMobile" class="pm-mbar">
        <SegmentedControl class="pm-mode" :model-value="settings.mode" :options="modeOptions" :aria-label="m('modeAria')" @update:model-value="setMode" />
        <button v-if="files.length" type="button" class="pm-add-sm" @click="openPicker">{{ m('add') }}</button>
      </div>

      <div class="card pm-work" :class="{ empty: !files.length }">
        <div v-if="!isMobile" class="pm-toolbar">
          <SegmentedControl class="pm-mode" :model-value="settings.mode" :options="modeOptions" :aria-label="m('modeAria')" @update:model-value="setMode" />
          <div v-if="files.length" class="pm-tools">
            <button type="button" @click="openPicker">{{ m('addMore') }}</button>
            <button type="button" :disabled="!pages.length || busy" @click="rotateAll"><Icon name="rotateR" />{{ m('rotateAll') }}</button>
            <button type="button" :disabled="readyFiles.length < 2 || busy" @click="sortByName"><Icon name="sort" />{{ m('sortByName') }}</button>
            <button type="button" :disabled="!canUndo || busy" :title="m('undo') + ' (⌘Z)'" @click="doUndo"><Icon name="undo" />{{ m('undo') }}</button>
            <button type="button" class="pm-link" :class="{ danger: clearConfirm }" :disabled="busy" @click="onClear">{{ clearConfirm ? m('clearConfirm') : m('clear') }}</button>
          </div>
        </div>

        <template v-if="files.length && !isMobile">
          <FileChips :chips="chips" :m="m" @reorder="reorderFiles" @select="selectFile" @rotate="rotateFile" @remove="removeFile" />
          <p class="pm-hint-line">{{ m('dragFileHint') }} · {{ m('totalPages', livePages(pages).length) }}</p>
        </template>

        <div
          v-if="!files.length"
          class="pm-drop"
          :class="{ dragover }"
          tabindex="0"
          role="button"
          :aria-label="m('dropAria')"
          @click="openPicker"
          @keydown.enter.prevent="openPicker"
          @keydown.space.prevent="openPicker"
          @dragenter.prevent="dragover = true"
          @dragover.prevent="dragover = true"
          @dragleave.prevent="dragover = false"
          @drop.prevent.stop="onZoneDrop"
        >
          <strong>+ {{ isTouch ? m('dropTitleTouch') : m('dropTitle') }}</strong>
          <p>{{ isTouch ? m('dropSubTouch') : m('dropSub') }}</p>
        </div>
        <input ref="fileInput" type="file" accept="application/pdf,.pdf" multiple hidden @change="onPick" />
        <p v-if="hint" class="pm-hint" role="status">{{ hint }}</p>

        <!-- Desktop page grid -->
        <PageGrid
          v-if="!isMobile && pages.length"
          class="pm-grid"
          :items="gridItems"
          :selection="selection"
          :actions="['rotateL', 'rotateR', 'dup', 'delete']"
          :min-tile-width="118"
          :disabled="busy"
          :aria-label="m('title')"
          :messages="gridMessages"
          @reorder="onReorder"
          @select="(k: string[]) => (selection = k)"
          @action="onTileAction"
          @need-thumb="onNeedThumb"
        />

        <!-- Phone file list -->
        <template v-if="isMobile && files.length">
          <MobileFileList :files="files" :colors="colorMap" :counts="liveCounts" :thumbs="fileThumbs" :m="m" @move="moveFile" @rotate="rotateFile" @remove="removeFile" />
          <p class="pm-hint-line center">{{ m('dragFileHintTouch') }} · {{ m('totalPages', livePages(pages).length) }}</p>
        </template>

        <!-- Desktop: files that cannot be used -->
        <template v-if="!isMobile">
          <div v-for="f in blockedFiles" :key="f.id" class="pm-locked" :class="`st-${f.status}`">
            <Icon name="lock" />
            <div>
              <strong>{{ f.name }} <span class="pm-tag bad">{{ f.status === 'locked' ? m('locked') : '!' }}</span></strong>
              <p>{{ f.status === 'locked' ? m('openPwUnsupported') : m('errOpen') }}</p>
            </div>
            <button type="button" class="pm-icon-btn" :title="m('removeFile')" :aria-label="m('removeFile') + ' ' + f.name" @click="removeFile(f.id)"><Icon name="delete" /></button>
          </div>
        </template>

        <SelectionBar
          v-if="!isMobile && selection.length"
          class="pm-selbar-desk"
          :count="selection.length"
          :all-deleted="selectionAllDeleted"
          :can-export="settings.mode === 'merge'"
          :m="m"
          @rotate="(d: number) => change(rotateKeys(pages, selection, d))"
          @dup="dupSelection"
          @export="exportSelected"
          @delete="deleteSelection"
          @clear="selection = []"
        />
      </div>
      <p v-if="files.length === 1 && settings.mode === 'merge' && !isMobile" class="pm-note pm-need-two">{{ m('needTwo') }}</p>
    </main>

    <div id="rightPanel" class="pm-right">
      <div v-if="!isMobile && result" class="card pm-result-card">
        <ResultList :result="result" :zipping="zipping" :touch="false" :m="m" @one="downloadOne" @zip="zipAll" @share-all="zipAll" @close="closeResult" />
      </div>
      <div v-if="!isMobile" class="card pm-settings-card">
        <h3>{{ settings.mode === 'merge' ? m('mergeSettings') : m('splitSettings') }}</h3>
        <MergeSettingsPanel
          v-if="settings.mode === 'merge'"
          :settings="settings.merge"
          :placeholder-name="autoMergeStem"
          :summary="summary"
          :can-run="canMerge"
          :busy="busy"
          :progress="progress"
          :note="mergeNote"
          :m="m"
          @update="(s: MergeSettings) => saveSettingsPart({ merge: s })"
          @run="runMergeNow"
          @cancel="cancelRun"
        />
        <SplitSettingsPanel
          v-else
          :settings="settings.split"
          :preview="splitPreview.groups"
          :error="splitPreview.error"
          :outputs="splitPreview.outputs"
          :files="splitPreview.files"
          :selected-count="selection.length"
          :sample-name="splitPreview.sample"
          :can-run="canSplit"
          :busy="busy"
          :progress="progress"
          :m="m"
          @update="(s: SplitSettingsT) => saveSettingsPart({ split: s })"
          @run="runSplitNow"
          @cancel="cancelRun"
        />
      </div>
    </div>
  </div>

  <!-- Phone sticky actions -->
  <div class="pm-sticky" v-show="isMobile && files.length > 0" :inert="overlayOpen ? true : undefined">
    <template v-if="busy">
      <div class="pm-sticky-progress"><div class="pm-progress"><span :style="{ width: `${Math.round(progress * 100)}%` }"></span></div><span>{{ m('progress', Math.round(progress * 100)) }}</span></div>
      <button type="button" @click="cancelRun">{{ m('cancel') }}</button>
    </template>
    <template v-else>
      <button type="button" :disabled="!pages.length" @click="openEditor">{{ m('editPages') }}</button>
      <button v-if="settings.mode === 'merge'" type="button" class="primary" :disabled="!canMerge" @click="runMergeNow">{{ m('mergeN', livePages(pages).length) }}</button>
      <button v-else type="button" class="primary" @click="toggleSettings">{{ canSplit ? m('splitN', splitPreview.outputs) : m('splitSettings') }}</button>
    </template>
  </div>
  <div class="pm-sticky-spacer" v-show="isMobile && files.length > 0" aria-hidden="true"></div>

  <TabBar
    :t="t"
    :inert="overlayOpen ? true : undefined"
    :active="moreOpen ? 'more' : settingsOpen ? 'settings' : 'pdf'"
    :settings-open="settingsOpen"
    :more-open="moreOpen"
    @compress="goCompress"
    @pdf="onPdfTab"
    @settings="toggleSettings"
    @more="moreOpen = !moreOpen"
  />
  <MoreMenu :t="t" :open="moreOpen" :menu-inert="overlayOpen" @close="moreOpen = false" @nav="onNav" />
  <div v-if="pageDragging" class="page-drop-hint" aria-hidden="true">{{ m('dropAnywhere') }}</div>

  <!-- Phone per-page editor -->
  <section v-if="editorOpen && isMobile" class="pm-editor" role="dialog" aria-modal="true" :aria-label="m('editTitle', pages.length)" @keydown.esc="closeEditor">
    <header class="pm-editor-head">
      <button type="button" class="pm-editor-btn" @click="closeEditor">‹ {{ m('back') }}</button>
      <strong>{{ m('editTitle', livePages(pages).length) }}</strong>
      <button type="button" class="pm-editor-btn" :disabled="!canUndo" :aria-label="m('undo')" @click="doUndo"><Icon name="undo" /></button>
      <button type="button" class="pm-editor-btn primary" @click="closeEditor">{{ m('done') }}</button>
    </header>
    <FileChips :chips="chips" readonly :m="m" />
    <div ref="editorScroll" class="pm-editor-body">
      <PageGrid
        :items="gridItems"
        :selection="selection"
        :columns="3"
        :gap="10"
        select-mode
        :actions="[]"
        :aria-label="m('editPages')"
        :messages="gridMessages"
        @reorder="onReorder"
        @select="(k: string[]) => (selection = k)"
        @need-thumb="onNeedThumb"
      />
    </div>
    <SelectionBar
      v-if="selection.length"
      class="pm-selbar-mob"
      compact
      :count="selection.length"
      :all-deleted="selectionAllDeleted"
      :m="m"
      @rotate="(d: number) => change(rotateKeys(pages, selection, d))"
      @dup="dupSelection"
      @delete="deleteSelection"
      @clear="selection = []"
    />
  </section>

  <BottomSheet
    v-if="settingsOpen && isMobile"
    :title="settings.mode === 'merge' ? m('mergeSettings') : m('splitSettings')"
    :close-label="m('close')"
    label-id="pmSettingsTitle"
    sheet-class="settings-sheet"
    overlay-class="settings-overlay"
    @close="settingsOpen = false"
  >
    <div class="sheet-body">
      <MergeSettingsPanel
        v-if="settings.mode === 'merge'"
        :settings="settings.merge"
        :placeholder-name="autoMergeStem"
        :summary="summary"
        :can-run="canMerge"
        :busy="busy"
        :progress="progress"
        :note="mergeNote"
        :m="m"
        @update="(s: MergeSettings) => saveSettingsPart({ merge: s })"
        @run="settingsOpen = false; runMergeNow()"
        @cancel="cancelRun"
      />
      <SplitSettingsPanel
        v-else
        :settings="settings.split"
        :preview="splitPreview.groups"
        :error="splitPreview.error"
        :outputs="splitPreview.outputs"
        :files="splitPreview.files"
        :selected-count="selection.length"
        :sample-name="splitPreview.sample"
        :can-run="canSplit"
        :busy="busy"
        :progress="progress"
        :m="m"
        @update="(s: SplitSettingsT) => saveSettingsPart({ split: s })"
        @run="settingsOpen = false; runSplitNow()"
        @cancel="cancelRun"
      />
    </div>
  </BottomSheet>
  <BottomSheet
    v-if="resultOpen && result && isMobile"
    :title="result.kind === 'merge' ? m('resultMerged') : m('resultSplit')"
    :close-label="m('close')"
    label-id="pmResultTitle"
    sheet-class="pm-result-sheet"
    @close="closeResult"
  >
    <div class="sheet-body">
      <ResultList :result="result" :zipping="zipping" :touch="true" :m="m" @one="shareOne" @zip="zipAll" @share-all="shareAll" @close="closeResult" />
    </div>
  </BottomSheet>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'
import AppHeader from '../../shared/components/AppHeader.vue'
import SideNav from '../../shared/components/SideNav.vue'
import TabBar from '../../shared/components/TabBar.vue'
import MoreMenu from '../../shared/components/MoreMenu.vue'
import PdfHubSwitch from '../../shared/components/PdfHubSwitch.vue'
import BottomSheet from '../../shared/components/BottomSheet.vue'
import SegmentedControl from '../../shared/components/SegmentedControl.vue'
import PageGrid, { type PageGridMessages } from '../../shared/components/PageGrid.vue'
import type { PageAction, PageGridItem } from '../../shared/components/page-grid'
import { usePrefs } from '../../shared/composables/usePrefs'
import { useHashRoute, type NavKey } from '../../shared/composables/useHashRoute'
import { fmtSize } from '../../shared/lib/format'
import { filesFromDrop } from '../../shared/lib/drop'
import { shareFilesOr } from '../../shared/lib/share'
import { downloadUrl, ymd, zipEntries } from '../../shared/lib/zip'
import type { Lang } from '../../shared/i18n'
import FileChips, { type Chip } from './components/FileChips.vue'
import SelectionBar from './components/SelectionBar.vue'
import MergeSettingsPanel, { type MergeSummary } from './components/MergeSettingsPanel.vue'
import SplitSettingsPanel, { type GroupPreview } from './components/SplitSettingsPanel.vue'
import ResultList from './components/ResultList.vue'
import MobileFileList from './components/MobileFileList.vue'
import Icon from './components/Icon.vue'
import { mergeT, MERGE_SUFFIX } from './i18n'
import {
  applySourceOrder, commit, duplicateKeys, emptyHistory, keysOfSource, livePages, pagesForSource,
  removeSource, reorder, rotateKeys, sortSourcesByName, toggleDeleteKeys, undo as undoStep, redo as redoStep,
} from './lib/ops'
import { groupLabel, planSplit, specFor } from './lib/split-plan'
import { mergeName, sanitize, splitName, stem, withPdf } from './lib/names'
import { ThumbService, thumbKey } from './lib/thumbs'
import { colorOf } from './lib/colors'
import { loadSettings, saveSettings } from './lib/settings'
import type { MergeSettings, Mode, OutFile, PageRef, RunResult, Settings, SplitSettings as SplitSettingsT, SrcFile } from './types'
import type { OutPageSpec, SourceBytes, WriteJob } from './lib/write'
import './styles/merge.less'

const { lang, t, setLang: setPrefLang } = usePrefs()
const { navigate, route } = useHashRoute()
function m(key: string, ...args: (string | number)[]): string {
  return mergeT(lang.value, key, ...args)
}

// ---- settings ----
const settings = ref<Settings>(loadSettings())
function saveSettingsPart(patch: Partial<Settings>) {
  settings.value = { ...settings.value, ...patch }
  saveSettings(settings.value)
}
const modeOptions = computed(() => [{ value: 'merge' as Mode, label: m('modeMerge') }, { value: 'split' as Mode, label: m('modeSplit') }])
function setMode(mode: Mode) {
  saveSettingsPart({ mode })
  result.value = null
}

// ---- viewport ----
const isTouch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window)
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 720 : false)
function onResize() {
  isMobile.value = window.innerWidth < 720
}

// ---- state ----
// shallowRef: File objects must never be wrapped in reactive proxies.
const files = shallowRef<SrcFile[]>([])
const pages = shallowRef<PageRef[]>([])
const selection = ref<string[]>([])
let history = emptyHistory()
const canUndo = ref(false)
const canRedo = ref(false)
const thumbs = reactive<Record<string, string>>({})
const aspects = reactive<Record<string, number>>({})
const thumbSvc = new ThumbService((key, url, aspect) => {
  if (url) thumbs[key] = url
  else delete thumbs[key]
  if (aspect) aspects[key] = aspect
})

function syncHistoryFlags() {
  canUndo.value = history.past.length > 0
  canRedo.value = history.future.length > 0
}
/** Apply an edit with an undo step. */
function change(next: PageRef[]) {
  history = commit(history, pages.value)
  pages.value = next
  syncHistoryFlags()
}
function doUndo() {
  const r = undoStep(history, pages.value)
  if (!r) return
  history = r.history
  pages.value = r.pages
  pruneSelection()
  syncHistoryFlags()
}
function doRedo() {
  const r = redoStep(history, pages.value)
  if (!r) return
  history = r.history
  pages.value = r.pages
  pruneSelection()
  syncHistoryFlags()
}
function pruneSelection() {
  const have = new Set(pages.value.map((p) => p.key))
  selection.value = selection.value.filter((k) => have.has(k))
}

const fileById = computed(() => new Map(files.value.map((f) => [f.id, f])))
const colorMap = computed<Record<string, string>>(() => Object.fromEntries(files.value.map((f) => [f.id, colorOf(f.color)])))
const readyFiles = computed(() => files.value.filter((f) => f.status === 'ready'))
const blockedFiles = computed(() => files.value.filter((f) => f.status === 'locked' || f.status === 'error'))
const liveCounts = computed<Record<string, number>>(() => {
  const c: Record<string, number> = {}
  for (const p of pages.value) if (!p.deleted) c[p.src] = (c[p.src] ?? 0) + 1
  return c
})
const fileThumbs = computed<Record<string, string | null>>(() => Object.fromEntries(files.value.map((f) => [f.id, thumbs[thumbKey(f.id, 0)] ?? null])))
const chips = computed<Chip[]>(() => files.value.map((f) => ({ id: f.id, name: f.name, count: liveCounts.value[f.id] ?? 0, color: colorOf(f.color), status: f.status })))

const gridItems = computed<PageGridItem[]>(() => pages.value.map((p) => {
  const k = thumbKey(p.src, p.index)
  return {
    key: p.key,
    thumb: thumbs[k] ?? null,
    label: m('origPage', p.index + 1),
    color: colorMap.value[p.src],
    rotate: p.rotate,
    aspect: aspects[k] ?? fileById.value.get(p.src)?.aspect,
    dimmed: !!p.deleted,
  }
}))
const gridMessages = computed<Partial<PageGridMessages>>(() => ({
  page: (n) => m('pgPage', n),
  moved: (a, b) => m('pgMoved', a, b),
  picked: (n) => m('pgPicked', n),
  dropped: (n) => m('pgDropped', n),
  cancelled: m('pgCancelled'),
  instructions: m('pgInstructions'),
  rotateL: m('rotateLeft'),
  rotateR: m('rotateRight'),
  dup: m('duplicate'),
  delete: m('delete'),
}))
const selectionAllDeleted = computed(() => {
  const set = new Set(selection.value)
  const sel = pages.value.filter((p) => set.has(p.key))
  return sel.length > 0 && sel.every((p) => p.deleted)
})

// ---- hint toast ----
const hint = ref<string | null>(null)
let hintTimer: ReturnType<typeof setTimeout> | null = null
function showHint(s: string, ms = 3500) {
  hint.value = s
  if (hintTimer) clearTimeout(hintTimer)
  hintTimer = setTimeout(() => { hint.value = null }, ms)
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

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`
let seq = 0
let colorSeq = 0

function addFiles(list: File[]) {
  const pdfs = list.filter(isPdf)
  const skipped = list.length - pdfs.length
  const have = new Set(files.value.map((f) => fileKey(f.file)))
  const fresh = pdfs.filter((f) => {
    const k = fileKey(f)
    if (have.has(k)) return false
    have.add(k)
    return true
  })
  if (skipped) showHint(m('notPdf', skipped))
  else if (fresh.length < pdfs.length) showHint(m('dupSkipped', pdfs.length - fresh.length))
  if (!fresh.length) return
  const added: SrcFile[] = fresh.map((file) => ({
    id: `f${(seq++).toString(36)}`, file, name: file.name, pages: 0, color: colorSeq++, status: 'probing',
    ownerLocked: false, hasForm: false, xfa: false, hasOutline: false, aspect: 1 / 1.414,
  }))
  files.value = [...files.value, ...added]
  const total = files.value.reduce((s, f) => s + f.file.size, 0)
  if (total > 200 * 1024 * 1024) showHint(m('bigFileWarn'))
  result.value = null
  // Probe in order so pages are appended in the order the files were added.
  void added.reduce((chain, f) => chain.then(() => probe(f)), Promise.resolve())
}

async function probe(f: SrcFile) {
  try {
    const r = await thumbSvc.probe(f.id, f.file)
    if (!fileById.value.has(f.id)) { thumbSvc.drop(f.id); return }
    Object.assign(f, { pages: r.pages, ownerLocked: r.ownerLocked, hasForm: r.hasForm, xfa: r.xfa, hasOutline: r.hasOutline, aspect: r.aspect, status: 'ready' })
    const fresh = pagesForSource(f.id, r.pages)
    // Keep the new pages in every undo state too, so undo never drops a file.
    history = { past: history.past.map((s) => [...s, ...fresh]), future: history.future.map((s) => [...s, ...fresh]) }
    pages.value = applySourceOrder([...pages.value, ...fresh], files.value.map((x) => x.id))
    thumbSvc.request(f.id, 0)
  } catch (err) {
    const { PdfPasswordError } = await import('../../shared/pdf/pdf-loader')
    f.status = err instanceof PdfPasswordError ? 'locked' : 'error'
    if (f.status === 'error') console.warn('[pdf-merge] open failed', err)
  }
  files.value = [...files.value]
}

function onNeedThumb(key: string) {
  const p = pages.value.find((x) => x.key === key)
  if (p) thumbSvc.request(p.src, p.index)
}

// ---- page edits ----
function onReorder(from: number, to: number) {
  change(reorder(pages.value, from, to))
}
function onTileAction(key: string, action: PageAction) {
  if (action === 'rotateL') change(rotateKeys(pages.value, [key], -90))
  else if (action === 'rotateR') change(rotateKeys(pages.value, [key], 90))
  else if (action === 'dup') change(duplicateKeys(pages.value, [key]).pages)
  else if (action === 'delete') change(toggleDeleteKeys(pages.value, [key]))
}
function dupSelection() {
  const r = duplicateKeys(pages.value, selection.value)
  change(r.pages)
}
function deleteSelection() {
  change(toggleDeleteKeys(pages.value, selection.value))
  if (!selectionAllDeleted.value) return
  selection.value = []
}
function rotateAll() {
  change(rotateKeys(pages.value, pages.value.map((p) => p.key), 90))
}
function sortByName() {
  const order = sortSourcesByName(files.value)
  reorderFiles(order)
}
function reorderFiles(ids: string[]) {
  const byId = fileById.value
  files.value = ids.map((id) => byId.get(id)!).filter(Boolean)
  change(applySourceOrder(pages.value, ids))
}
function moveFile(from: number, to: number) {
  if (to < 0 || to >= files.value.length || from === to) return
  const ids = files.value.map((f) => f.id)
  const [x] = ids.splice(from, 1)
  ids.splice(to, 0, x)
  reorderFiles(ids)
}
function selectFile(id: string) {
  selection.value = keysOfSource(pages.value, id)
}
function rotateFile(id: string) {
  change(rotateKeys(pages.value, keysOfSource(pages.value, id), 90))
}
function removeFile(id: string) {
  thumbSvc.drop(id)
  files.value = files.value.filter((f) => f.id !== id)
  pages.value = removeSource(pages.value, id)
  history = { past: history.past.map((s) => removeSource(s, id)), future: history.future.map((s) => removeSource(s, id)) }
  syncHistoryFlags()
  pruneSelection()
  result.value = null
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
  thumbSvc.dispose()
  files.value = []
  pages.value = []
  selection.value = []
  history = emptyHistory()
  syncHistoryFlags()
  closeResult()
}

// ---- summary / names ----
const autoMergeStem = computed(() => stem(mergeName('', readyFiles.value[0]?.name, MERGE_SUFFIX[lang.value])))
const summary = computed<MergeSummary>(() => {
  const live = livePages(pages.value)
  let bytes = 0
  for (const p of live) {
    const f = fileById.value.get(p.src)
    if (f && f.pages) bytes += f.file.size / f.pages
  }
  return {
    sources: files.value.length,
    unusable: blockedFiles.value.length,
    pages: live.length,
    deleted: pages.value.length - live.length,
    rotated: live.filter((p) => p.rotate).length,
    estimate: fmtSize(Math.round(bytes)),
  }
})
const probing = computed(() => files.value.some((f) => f.status === 'probing'))
const canMerge = computed(() => !busy.value && !probing.value && livePages(pages.value).length > 0)
const mergeNote = computed(() => {
  const used = new Set(livePages(pages.value).map((p) => p.src))
  const fs = files.value.filter((f) => used.has(f.id))
  if (fs.some((f) => f.xfa)) return m('warn_xfaDropped')
  if (fs.some((f) => f.ownerLocked)) return m('ownerPwNote')
  if (fs.some((f) => f.hasForm) && settings.value.merge.keepForms && settings.value.merge.pageSize === 'keep') return m('formsNote')
  return ''
})

// ---- split plan ----
interface FilePlan { src: SrcFile; live: PageRef[]; groups: number[][] }
const splitPlans = computed<{ plans: FilePlan[]; error: string | null }>(() => {
  const s = settings.value.split
  const sel = new Set(selection.value)
  const plans: FilePlan[] = []
  let error: string | null = null
  for (const f of files.value) {
    if (f.status !== 'ready') continue
    const live = livePages(pages.value).filter((p) => p.src === f.id)
    if (!live.length) continue
    const positions = live.map((p, i) => (sel.has(p.key) ? i + 1 : 0)).filter(Boolean)
    if (s.kind === 'selected' && !positions.length) continue
    const plan = planSplit(specFor(s.kind, s.ranges, s.every, positions), live.length)
    if (plan.ok) plans.push({ src: f, live, groups: plan.groups })
    else error ??= plan.error
  }
  if (s.kind === 'selected' && !plans.length) error = 'noSelection'
  return { plans, error: plans.length ? (error === 'outOfRange' ? null : error) : error }
})
const ERROR_KEYS: Record<string, string> = { syntax: 'rangeBad', outOfRange: 'rangeOut', empty: 'rangeEmpty', badN: 'badN', noSelection: 'noSelection' }
const splitPreview = computed(() => {
  const { plans, error } = splitPlans.value
  const first = plans[0]
  const groups: GroupPreview[] = first ? first.groups.map((g, i) => ({ label: groupLabel(g), pages: g.length, color: colorOf(i) })) : []
  const outputs = plans.reduce((n, p) => n + p.groups.length, 0)
  const sample = first ? splitName(settings.value.split.template, { name: first.src.name, range: groupLabel(first.groups[0]), n: 1, total: first.groups.length }) : ''
  return { groups, error: error ? ERROR_KEYS[error] ?? 'rangeBad' : null, outputs, files: plans.length, sample }
})
const canSplit = computed(() => !busy.value && !probing.value && splitPlans.value.plans.length > 0 && !splitPreview.value.error)

// ---- running ----
const busy = ref(false)
const progress = ref(0)
const result = shallowRef<RunResult | null>(null)
const resultOpen = ref(false)
let ctrl: AbortController | null = null

async function readSources(ids: Set<string>): Promise<SourceBytes[] | null> {
  const list = files.value.filter((f) => ids.has(f.id))
  const total = list.reduce((s, f) => s + f.file.size, 0)
  if (isMobile.value && total > 500 * 1024 * 1024) {
    showHint(m('memoryBlock'), 6000)
    return null
  }
  return Promise.all(list.map(async (f) => ({ id: f.id, name: f.name, bytes: await f.file.arrayBuffer() })))
}
const spec = (p: PageRef): OutPageSpec => ({ src: p.src, index: p.index, rotate: p.rotate })

async function execute(job: WriteJob, kind: 'merge' | 'split', meta: { color: number; path: string }[]) {
  busy.value = true
  progress.value = 0
  ctrl = new AbortController()
  const t0 = performance.now()
  try {
    const { runInWorker } = await import('./lib/client')
    const r = await runInWorker(job, (d, total) => { progress.value = total ? d / total : 0 }, ctrl.signal)
    releaseResult()
    const out: OutFile[] = r.outputs.map((o, i) => {
      const blob = new Blob([o.bytes as BlobPart], { type: 'application/pdf' })
      return { name: o.name, blob, url: URL.createObjectURL(blob), pages: o.pages, color: meta[i]?.color ?? 0, path: meta[i]?.path ?? o.name }
    })
    result.value = { kind, files: out, ms: performance.now() - t0, warnings: r.warnings.map((w) => `warn_${w}`) }
    if (isMobile.value) resultOpen.value = true
    else if (kind === 'merge' && out.length === 1) downloadOne(out[0])
  } catch (err) {
    const { isCancel, SourceLockedError } = await import('./lib/client')
    if (!isCancel(err)) {
      if (err instanceof SourceLockedError) {
        const f = fileById.value.get(err.source)
        if (f) { f.status = 'locked'; files.value = [...files.value]; pages.value = removeSource(pages.value, f.id) }
        showHint(m('errLockedWrite'), 6000)
      } else {
        console.error('[pdf-merge] write failed', err)
        showHint(m('errWrite'), 6000)
      }
    }
  } finally {
    busy.value = false
    ctrl = null
  }
}

async function runMergeNow() {
  if (!canMerge.value) return
  const live = livePages(pages.value)
  const ids = new Set(live.map((p) => p.src))
  const sources = await readSources(ids)
  if (!sources) return
  const ms = settings.value.merge
  const order = [...new Set(live.map((p) => p.src))]
  const name = mergeName(ms.fileName, fileById.value.get(order[0])?.name, MERGE_SUFFIX[lang.value])
  await execute({
    kind: 'merge', sources, pages: live.map(spec), name, pageSize: ms.pageSize, bookmarks: ms.bookmarks, keepForms: ms.keepForms,
    blankBetween: ms.blankBetween, titles: Object.fromEntries(order.map((id) => [id, stem(fileById.value.get(id)?.name ?? id)])),
  }, 'merge', [{ color: fileById.value.get(order[0])?.color ?? 0, path: name }])
}

async function exportSelected() {
  const set = new Set(selection.value)
  const live = livePages(pages.value).filter((p) => set.has(p.key))
  if (!live.length || busy.value) return
  const sources = await readSources(new Set(live.map((p) => p.src)))
  if (!sources) return
  const first = fileById.value.get(live[0].src)
  const name = withPdf(sanitize(`${stem(first?.name ?? 'pages')}_${groupLabel(live.map((p) => p.index + 1))}`))
  const ms = settings.value.merge
  await execute({
    kind: 'merge', sources, pages: live.map(spec), name, pageSize: ms.pageSize, bookmarks: false, keepForms: ms.keepForms, blankBetween: false, titles: {},
  }, 'merge', [{ color: first?.color ?? 0, path: name }])
}

async function runSplitNow() {
  if (!canSplit.value) return
  const { plans } = splitPlans.value
  const sources = await readSources(new Set(plans.map((p) => p.src.id)))
  if (!sources) return
  const multi = plans.length > 1
  const parts: { name: string; pages: OutPageSpec[] }[] = []
  const meta: { color: number; path: string }[] = []
  for (const plan of plans) {
    plan.groups.forEach((g, i) => {
      const name = splitName(settings.value.split.template, { name: plan.src.name, range: groupLabel(g), n: i + 1, total: plan.groups.length })
      parts.push({ name, pages: g.map((pos) => spec(plan.live[pos - 1])) })
      meta.push({ color: multi ? plan.src.color : i, path: multi ? `${sanitize(stem(plan.src.name))}/${name}` : name })
    })
  }
  await execute({ kind: 'split', sources, parts, bookmarks: settings.value.merge.bookmarks, keepForms: settings.value.merge.keepForms }, 'split', meta)
}

function cancelRun() {
  ctrl?.abort()
}

// ---- results ----
const zipping = ref(false)
function releaseResult() {
  result.value?.files.forEach((f) => URL.revokeObjectURL(f.url))
}
function closeResult() {
  resultOpen.value = false
  releaseResult()
  result.value = null
}
function downloadOne(f: OutFile) {
  downloadUrl(f.url, f.name)
}
const asFile = (f: OutFile) => new File([f.blob], f.name, { type: 'application/pdf' })
async function shareOne(f: OutFile) {
  await shareFilesOr(typeof navigator !== 'undefined' ? navigator : undefined, [asFile(f)], () => downloadOne(f))
}
async function zipAll() {
  const r = result.value
  if (!r) return
  if (r.files.length === 1) { downloadOne(r.files[0]); return }
  zipping.value = true
  try {
    const blob = await zipEntries(r.files.map((f) => ({ name: f.path, blob: f.blob })))
    downloadUrl(blob, `pdf-${r.kind}-${ymd()}.zip`)
  } finally {
    zipping.value = false
  }
}
async function shareAll() {
  const r = result.value
  if (!r) return
  await shareFilesOr(typeof navigator !== 'undefined' ? navigator : undefined, r.files.map(asFile), zipAll)
}

// ---- phone surfaces ----
const editorOpen = ref(false)
const settingsOpen = ref(false)
const moreOpen = ref(false)
const overlayOpen = computed(() => isMobile.value && (settingsOpen.value || editorOpen.value || resultOpen.value))
watch(overlayOpen, (open) => { document.body.style.overflow = open ? 'hidden' : '' })
watch(moreOpen, (open) => { if (open) settingsOpen.value = false })
watch(isMobile, (mob) => { if (!mob) { settingsOpen.value = false; editorOpen.value = false; resultOpen.value = false } })
function openEditor() {
  moreOpen.value = false
  settingsOpen.value = false
  editorOpen.value = true
}
function closeEditor() {
  editorOpen.value = false
}
function toggleSettings() {
  moreOpen.value = false
  editorOpen.value = false
  settingsOpen.value = !settingsOpen.value
}

// ---- navigation ----
function goCompress() {
  moreOpen.value = false
  settingsOpen.value = false
  navigate('compress')
}
function onNav(key: NavKey) {
  if (key === 'pdf-merge') { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
  moreOpen.value = false
  settingsOpen.value = false
  if (key === 'history') navigate('compress', 'history')
  else navigate(key)
}
function onPdfTab() {
  settingsOpen.value = false
  moreOpen.value = false
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function setLang(l: Lang) {
  setPrefLang(l)
  applyDocMeta()
}
function applyDocMeta() {
  document.title = m('docTitle')
  document.querySelector('meta[name="description"]')?.setAttribute('content', m('metaDesc'))
}
watch(() => route.value.params.mode, (mode) => {
  if (route.value.feature === 'pdf-merge' && (mode === 'merge' || mode === 'split') && mode !== settings.value.mode) setMode(mode)
}, { immediate: true })

// ---- page-wide drop + keyboard ----
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
  void filesFromDrop(e.dataTransfer).then((d) => addFiles(d.map((x) => x.file)))
}
function onKeyDown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
  const mod = e.metaKey || e.ctrlKey
  if (mod && e.key.toLowerCase() === 'z' && !busy.value) {
    e.preventDefault()
    if (e.shiftKey) doRedo()
    else doUndo()
  } else if (mod && e.key.toLowerCase() === 'y' && !busy.value) {
    e.preventDefault()
    doRedo()
  } else if (e.key === 'Escape' && selection.value.length && !overlayOpen.value) {
    selection.value = []
  }
}
let listening = false
function startListening() {
  if (listening) return
  listening = true
  document.addEventListener('dragenter', onDocDragEnter)
  document.addEventListener('dragleave', onDocDragLeave)
  document.addEventListener('dragover', onDocDragOver)
  document.addEventListener('drop', onDocDrop)
  document.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', onResize)
}
function stopListening() {
  if (!listening) return
  listening = false
  document.removeEventListener('dragenter', onDocDragEnter)
  document.removeEventListener('dragleave', onDocDragLeave)
  document.removeEventListener('dragover', onDocDragOver)
  document.removeEventListener('drop', onDocDrop)
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', onResize)
}
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (busy.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}
// Warm the small worker client once files are in (the worker itself, with
// @cantoo/pdf-lib, is fetched on the first run and cached by the SW).
let prefetched = false
watch(() => files.value.length, (n) => {
  if (n && !prefetched) {
    prefetched = true
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500))
    idle(() => { void import('./lib/client') })
  }
})

onMounted(() => {
  applyDocMeta()
  window.addEventListener('beforeunload', onBeforeUnload)
})
onActivated(() => {
  applyDocMeta()
  onResize()
  startListening()
  if (overlayOpen.value) document.body.style.overflow = 'hidden'
})
onDeactivated(() => {
  stopListening()
  settingsOpen.value = false
  moreOpen.value = false
  editorOpen.value = false
  pageDragging.value = false
  document.body.style.overflow = ''
})
onUnmounted(() => {
  stopListening()
  window.removeEventListener('beforeunload', onBeforeUnload)
  ctrl?.abort()
  thumbSvc.dispose()
  releaseResult()
  if (hintTimer) clearTimeout(hintTimer)
  if (clearTimer) clearTimeout(clearTimer)
  document.body.style.overflow = ''
})
</script>
