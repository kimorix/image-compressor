<template>
  <AppHeader :sub="t('headerSub')" :inert="busy || sheetOpen ? true : undefined" @lang="setLang">
    <template #title><span>{{ t('appTitle') }}</span><span class="badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z" /><path d="M9 12l2 2 4-4" /></svg><span class="badge-text"><span class="badge-main">{{ t('badgeLocal') }}</span><span class="badge-sub">{{ t('badgeSub') }}</span></span></span></template>
  </AppHeader>
  <div class="layout" :inert="busy || sheetOpen ? true : undefined">
    <SideNav :t="t" :active="view === 'history' ? 'history' : 'compress'" @compress="goTool" @pdf="goPdf" @history="goHistory">
        <div class="side-card">
          <strong>{{ t('sideFormats') }}</strong>
          <p class="side-formats">JPG · PNG · WebP · AVIF · HEIC · HEIF</p>
        </div>
    </SideNav>
    <main :class="{ 'no-result': items.length === 0 }" v-show="view === 'tool'">
    <div class="card" id="uploadCard" :class="{ 'has-items': items.length > 0, 'show-hint': !!fileHint }">
      <DropZone ref="dropzoneRef" :t="t" :compact="items.length > 0" @files="addFiles" />
      <p v-if="fileHint" class="file-hint">{{ fileHint }}</p>
    </div>

      <div v-if="items.length > 0" class="thumb-strip" ref="thumbStripRef" :class="{ stuck: stripStuck }">
        <button v-show="stripHasOverflow" type="button" class="strip-nav" :disabled="!stripCanPrev" :aria-label="t('stripPrev')" @click="stripScroll(-1)">‹</button>
        <div class="strip-viewport" ref="stripViewportRef" @scroll="updateStripNav">
          <div class="strip-track">
            <div v-for="item in items" :key="item.id" :class="['strip-tile', { selected: previewItem && previewItem.id === item.id }]" :title="item.file.name">
              <button type="button" class="strip-select" :aria-pressed="previewItem && previewItem.id === item.id" @click="selectPreview(item)">
                <img class="strip-thumb" :src="item.done && item.outUrl ? item.outUrl : item.url" :alt="item.file.name" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'" />
                <span class="strip-name">{{ shortName(item.file.name) }}</span>
                <span class="strip-size">{{ fmtSize(item.file.size) }}</span>
              </button>
              <button type="button" class="strip-remove" :title="t('btnRemove')" :aria-label="t('btnRemove')" @click.stop="removeItem(item)">×</button>
            </div>
          </div>
        </div>
        <button v-show="stripHasOverflow" type="button" class="strip-nav" :disabled="!stripCanNext" :aria-label="t('stripNext')" @click="stripScroll(1)">›</button>
      </div>

    <div class="card" id="resultCard" v-show="items.length > 0">
      <ProgressBar :finished="finishedCount" :total="items.length" :t="t" />
      <div class="result-head">
        <h3>{{ t('resultTitle') }}</h3>
        <div class="actions">
          <button id="clearAll" :class="{ danger: clearConfirm }" :disabled="items.length === 0" @click="onClearClick">{{ clearConfirm ? t('clearConfirm') : t('clearAll') }}</button>
          <button class="primary" id="downloadAll" :disabled="doneCount === 0 || zipping || sharing" @click="downloadAll">{{ t('downloadAll') }}</button>
        </div>
      </div>
      <div id="summary" v-html="summaryHtml"></div>
      <div v-if="items.length" class="list-head" aria-hidden="true">
        <span class="lh-thumb">{{ t('thImage') }}</span>
        <div class="lh-main">
          <span class="lh-format">{{ t('thFormat') }}</span>
          <span class="lh-orig">{{ t('thOrig') }}</span>
          <span class="lh-comp">{{ t('thComp') }}</span>
          <span class="lh-save">{{ t('thSave') }}</span>
          <span class="lh-dims">{{ t('thDims') }}</span>
          <span class="lh-status">{{ t('thStatus') }}</span>
          <span class="lh-actions">{{ t('thActions') }}</span>
        </div>
      </div>
      <div v-if="!isMobile" id="list">
        <ImageItem
          v-for="item in pagedItems"
          :key="item.id"
          :item="item"
          :t="t"
          @remove="removeItem"
          @preview="selectPreview($event); lightboxId = $event.id"
          @use-webp="onUseWebp"
          @retry="retryItem"
        />
      </div>
      <!-- Phones use a JS-balanced two-column masonry. Desktop (≥720px)
      keeps the existing table/list branch above untouched. -->
      <div v-if="isMobile" id="masonry" class="masonry" ref="masonryRef" :aria-label="t('resultTitle')">
        <div
          v-for="(col, ci) in masonryColumns"
          :key="ci"
          class="masonry-col"
          :data-col="ci"
        >
          <MobileCard
            v-for="item in col"
            :key="item.id"
            :item="item"
            :t="t"
            :active="activeIds.has(item.id)"
            :processing="processingIds.has(item.id)"
            :leaving="removingIds.has(item.id)"
            @open="openDetail"
            @retry="retryItem"
          />
        </div>
      </div>
      <div v-if="!isMobile && items.length > PAGE_SIZE" class="pager">
        <button type="button" :disabled="page <= 1" @click="goPage(-1)">{{ t('pagePrev') }}</button>
        <span class="pager-label">{{ t('pageLabel', page, pageCount) }}</span>
        <button type="button" :disabled="page >= pageCount" @click="goPage(1)">{{ t('pageNext') }}</button>
      </div>
      <div v-if="allAlreadyBest" class="dl-note">{{ t('allBestNote', items.length) }}</div>
    </div>
  </main>
  <div id="rightPanel" v-show="view === 'tool'">
      <!-- Phones open the same SettingsPanel in a bottom sheet from the tab
      bar instead (see the BottomSheet below), so the card is desktop-only. -->
      <div v-if="!isMobile" class="card" id="settingsCard">
        <div class="settings-head">
          <h3>{{ t('settingsTitle') }}</h3>
          <button type="button" class="settings-collapse-btn" :class="{ collapsed: settingsCollapsed }" :aria-expanded="!settingsCollapsed" :title="settingsCollapsed ? t('expandBtn') : t('collapseBtn')" :aria-label="settingsCollapsed ? t('expandBtn') : t('collapseBtn')" @click="settingsCollapsed = !settingsCollapsed"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg></button>
        </div>
        <div class="settings-body" :class="{ 'settings-body-collapsed': settingsCollapsed }">
          <SettingsPanel :settings="settings" :t="t" :has-items="items.length > 0" @update="onSettingsUpdate" @preset="onPreset" @start="recompressAll" />
        </div>
      </div>
      <div class="card" id="previewCard" v-if="previewItem && !previewClosed && !isMobile">
        <div class="pv-head">
          <h3>{{ t('previewTitle') }}</h3>
          <button type="button" class="pv-close" :title="t('lbClose')" :aria-label="t('lbClose')" @click="previewClosed = true">×</button>
        </div>
        <div class="pv-stage" @click="onPvStageClick">
          <div class="pv-compare" ref="pvCompareRef" :style="pvCompareStyle">
            <img class="pv-img" :src="pvCompSrc" :alt="previewItem.file.name" />
            <div v-if="previewItem.done && previewItem.outUrl" class="pv-orig-clip" :style="{ clipPath: `inset(0 ${100 - pvPos}% 0 0)` }">
              <img class="pv-img" :src="previewItem.url" :alt="previewItem.file.name" />
            </div>
            <div v-if="previewItem.done && previewItem.outUrl" class="pv-divider" :style="{ left: pvPos + '%' }" tabindex="0" role="slider" :aria-label="t('lbCompare')" :aria-valuemin="0" :aria-valuemax="100" :aria-valuenow="Math.round(pvPos)" @pointerdown="onPvDividerDown" @keydown="onPvDividerKey">
              <span class="pv-handle">↔</span>
            </div>
            <span v-if="previewItem.done && previewItem.outUrl" class="pv-side-tag left">{{ t('tagOrig') }}</span>
            <span v-if="previewItem.done && previewItem.outUrl" class="pv-side-tag right">{{ t('tagComp') }}</span>
          </div>
        </div>
        <div class="pv-info">
          <div class="pv-info-text">
            <span class="pv-name">{{ previewItem.file.name }}</span>
            <template v-if="previewItem.done && previewItem.outUrl">
              <span>{{ fmtSize(previewItem.file.size) }} → {{ fmtSize(previewItem.outSize) }}</span>
              <span class="pv-pct">−{{ previewPct }}%</span>
              <span v-if="previewItem.origW && (previewItem.origW !== previewItem.outW || previewItem.origH !== previewItem.outH)" class="pv-dims">{{ previewItem.origW }}×{{ previewItem.origH }} → {{ previewItem.outW }}×{{ previewItem.outH }}</span>
            </template>
            <span v-else-if="previewItem.error">{{ previewItem.cancelled ? t('cancelled') : t('statusFailed') }}</span>
            <span v-else>{{ t('statusProcessing') }}</span>
          </div>
          <button v-if="previewItem.done && previewItem.outUrl" type="button" class="primary pv-dl" @click="downloadPreview">{{ t('pvDownload') }}</button>
          <button v-else-if="previewItem.error" type="button" class="pv-dl" @click="retryItem(previewItem)">{{ t('retryBtn') }}</button>
        </div>
      </div>
  </div>
    <section id="historyView" v-show="view === 'history'">
      <div class="card">
        <div class="hist-head">
          <h2>{{ t('histTitle') }}</h2>
          <button v-if="historyRecords.length" type="button" class="link-btn" @click="clearHistory">{{ t('histClear') }}</button>
        </div>
        <p v-if="historyRecords.length" class="hist-summary">{{ t('histSummary', historyRecords.length, fmtSize(histSaved)) }}</p>
        <p v-else class="hist-empty">{{ t('histEmpty') }}</p>
        <ul v-if="historyRecords.length" class="hist-list">
          <li v-for="r in historyRecords" :key="r.t + r.n">
            <span class="hist-name">{{ r.n }}</span>
            <span class="hist-sizes">{{ fmtSize(r.o) }} → {{ fmtSize(r.c) }}</span>
            <span class="hist-pct">-{{ r.p }}%</span>
            <span class="hist-date">{{ new Date(r.t).toLocaleDateString() }}</span>
          </li>
        </ul>
      </div>
    </section>
  </div>
  <div class="sticky-bar" v-show="items.length > 0 && view === 'tool'" :inert="busy || sheetOpen ? true : undefined">
    <button class="sticky-add" type="button" @click="openPicker">{{ t('addBtn') }}</button>
    <button class="sticky-clear" type="button" :disabled="items.length === 0" @click="onClearClick">{{ clearConfirm ? t('clearConfirm') : t('clearAll') }}</button>
    <button class="sticky-download primary" type="button" :disabled="doneCount === 0 || zipping || sharing" @click="downloadAll">{{ t('downloadAll') }}</button>
  </div>
  <div class="sticky-spacer" v-show="items.length > 0 && view === 'tool'" aria-hidden="true"></div>
  <!-- The settings sheet stops above the tab bar, so the bar stays live
  there (Settings shows active; Home or Settings closes the sheet). The
  detail sheet covers it. -->
  <TabBar
    :t="t"
    :inert="busy || detailId ? true : undefined"
    :active="moreOpen || view === 'history' ? 'more' : settingsOpen ? 'settings' : 'compress'"
    :settings-open="settingsOpen"
    :more-open="moreOpen"
    @compress="goHome"
    @pdf="goPdf"
    @settings="goSettings"
    @more="moreOpen = !moreOpen"
  />
  <MoreMenu :t="t" :open="moreOpen" :menu-inert="busy || sheetOpen" @close="moreOpen = false" />
  <!-- Blocking global loading: the scrim captures pointer/touch, the page
  sections above are inert, and the status pill stays visible above it. -->
  <div v-if="busy" class="busy-scrim" aria-hidden="true"></div>
  <div class="global-loading" :class="{ show: busy }" role="status" aria-live="polite">
    <span class="gl-spin"></span>
    <span class="gl-copy"><span>{{ busyText }}</span><small>{{ busyAddBlocked ? t('busyAddBlocked') : t('busyWait') }}</small></span>
    <button v-if="activeRuns > 0" type="button" class="busy-cancel" @click="cancelBusy">{{ t('cancelBtn') }}</button>
  </div>
  <div v-if="pageDragging" class="page-drop-hint" aria-hidden="true">{{ t('dropAnywhere') }}</div>
  <Lightbox v-if="lbItem" :item="lbItem" :t="t" :has-prev="lbIndex > 0" :has-next="lbIndex >= 0 && lbIndex < items.length - 1" :inert="busy || undefined" :busy="busy" @close="lightboxId = null" @prev="lbStep(-1)" @next="lbStep(1)" />
  <MobileDetailSheet
    v-if="detailItem && isMobile"
    :item="detailItem"
    :t="t"
    @close="detailId = null"
    @remove="removeItem"
    @retry="retryFromSheet"
    @use-webp="onUseWebp"
    @preview="openFromSheet"
  />
  <BottomSheet
    v-if="settingsOpen && isMobile"
    :title="t('settingsTitle')"
    :close-label="t('lbClose')"
    label-id="settingsSheetTitle"
    sheet-class="settings-sheet"
    overlay-class="settings-overlay"
    @close="settingsOpen = false"
  >
    <div class="sheet-body">
      <SettingsPanel :settings="settings" :t="t" :has-items="items.length > 0" @update="onSettingsUpdate" @preset="onPreset" @start="startFromSheet" />
    </div>
  </BottomSheet>
  <footer v-html="t('footer')" :inert="busy || sheetOpen ? true : undefined"></footer>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'
import DropZone from './components/DropZone.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import ImageItem from './components/ImageItem.vue'
import MobileCard from './components/MobileCard.vue'
import MobileDetailSheet from './components/MobileDetailSheet.vue'
import BottomSheet from '../../shared/components/BottomSheet.vue'
import AppHeader from '../../shared/components/AppHeader.vue'
import SideNav from '../../shared/components/SideNav.vue'
import TabBar from '../../shared/components/TabBar.vue'
import MoreMenu from '../../shared/components/MoreMenu.vue'
import Lightbox from './components/Lightbox.vue'
import ProgressBar from './components/ProgressBar.vue'
import { t as tx, type Lang } from '../../shared/i18n'
import { applyTheme } from '../../shared/lib/theme'
import { usePrefs } from '../../shared/composables/usePrefs'
import { useHashRoute } from '../../shared/composables/useHashRoute'
import { downloadUrl, ymd, zipEntries } from '../../shared/lib/zip'
import { CompressPool } from './lib/compress-pool'
import { baseName, extOf, fmtSize, shortName } from '../../shared/lib/format'
import { filesFromDrop } from '../../shared/lib/drop'
import { DEFAULT_SETTINGS, matchPreset, PRESETS } from './lib/presets'
import { loadSavedSettings, saveSettings } from './lib/settings-store'
import { newItem, type CompressItem, type Settings } from './types'
import { isUnaffected } from './lib/recompress'
import { useCompareSlider } from './composables/useCompareSlider'
import { appendMasonry, distributeMasonry, fallbackColumnWidth, type MasonryColumns } from './lib/masonry'
import { shareFilesOr } from '../../shared/lib/share'

const { lang, theme, setLang: setPrefLang } = usePrefs()
const { route, navigate, replaceSub } = useHashRoute()
const settings = reactive<Settings>({ ...DEFAULT_SETTINGS, ...loadSavedSettings() })
// Remember the last-used settings across visits. Writing storage never
// mutates settings, so this watcher cannot loop.
watch(settings, () => saveSettings(settings), { deep: true })
// shallowRef on purpose: File/Blob objects must never be wrapped by Vue's
// reactive proxy (it breaks platform brand checks like createObjectURL).
const items = shallowRef<CompressItem[]>([])

// Desktop settings card collapse (header button). It starts expanded: the
// panel is a fixed sidebar there. Phones use the settings sheet instead.
const settingsCollapsed = ref(false)
// The compare preview card is a desktop rail feature. On phones the row tap
// opens the full-screen lightbox instead, so the card would only load two
// large images below 20 rows. Do not even mount it there.
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 720 : false)
// Shell views: tool (default) vs history. The sidebar and the mobile tab
// bar switch between them; settings is not a view: on phones the Settings
// tab opens the settings bottom sheet over the tool page.
const view = ref<'tool' | 'history'>('tool')
// Phone settings sheet. The Settings tab is active exactly while it is open
// (Home otherwise), wherever the result list happens to be scrolled.
const settingsOpen = ref(false)
const moreOpen = ref(false)

// Mobile detail sheet. The item id (not the object) keeps the sheet live
// across recompresses that replace the item.
const detailId = ref<string | null>(null)
const detailItem = computed(() => items.value.find((i) => i.id === detailId.value) ?? null)
watch(detailItem, (it) => { if (!it) detailId.value = null })
function openDetail(item: CompressItem) {
  if (!isMobile.value) return
  moreOpen.value = false
  settingsOpen.value = false
  detailId.value = item.id
}
// Any phone sheet open: the page behind is inert and its scroll is locked.
const sheetOpen = computed(() => !!detailId.value || (settingsOpen.value && isMobile.value))
function retryFromSheet(item: CompressItem) {
  detailId.value = null
  retryItem(item)
}
function openFromSheet(item: CompressItem) {
  detailId.value = null
  selectPreview(item)
  lightboxId.value = item.id
}

// JS masonry state. IDs remain stable while item objects are replaced on
// every compression update; the columns themselves are only rebuilt on
// delete/clear (and when entering the mobile layout).
const masonryRef = ref<HTMLElement | null>(null)
const masonryCols = ref<[string[], string[]]>([[], []])
const removingIds = ref<Set<string>>(new Set())
const removalTimers = new Map<string, ReturnType<typeof setTimeout>>()
const masonryColumns = computed<MasonryColumns>(() => {
  const byId = new Map(items.value.map((i) => [i.id, i]))
  return masonryCols.value.map((ids) => ids.map((id) => byId.get(id)).filter((i): i is CompressItem => !!i)) as MasonryColumns
})
function masonryMetrics() {
  const container = masonryRef.value?.clientWidth ?? 0
  const vw = typeof window !== 'undefined' ? window.innerWidth : 390
  const columnWidth = container > 0 ? (container - 8) / 2 : fallbackColumnWidth(vw)
  return { columnWidth, vw }
}
function rebuildMasonry() {
  const { columnWidth, vw } = masonryMetrics()
  const [a, b] = distributeMasonry(items.value, columnWidth, vw)
  masonryCols.value = [a.map((i) => i.id), b.map((i) => i.id)]
}
function appendMasonryState() {
  const { columnWidth, vw } = masonryMetrics()
  const byId = new Map(items.value.map((i) => [i.id, i]))
  const existing: MasonryColumns = [
    masonryCols.value[0].map((id) => byId.get(id)).filter((i): i is CompressItem => !!i),
    masonryCols.value[1].map((id) => byId.get(id)).filter((i): i is CompressItem => !!i),
  ]
  const next = appendMasonry(existing, items.value, columnWidth, vw)
  masonryCols.value = [next[0].map((i) => i.id), next[1].map((i) => i.id)]
}
// Rebuild only when the current ids no longer cover the assignments (e.g.
// clear + re-add in the same tick); a plain state replacement keeps columns.
watch(items, (next, prev) => {
  if (!isMobile.value) return
  const ids = new Set(next.map((i) => i.id))
  const assigned = new Set(masonryCols.value[0].concat(masonryCols.value[1]))
  // Deletion/clear and any stale assignment rebuild the whole layout.
  const missing = [...assigned].some((id) => !ids.has(id))
  if (next.length < (prev?.length ?? 0) || missing) {
    rebuildMasonry()
    return
  }
  // A first render or a new import can arrive with the same length Vue
  // last saw (the shallow array is replaced several times in one tick);
  // append by "is this id assigned?" rather than by length alone.
  if (next.some((i) => !assigned.has(i.id))) appendMasonryState()
}, { flush: 'post' })
watch(isMobile, (mobile) => {
  if (mobile) void nextTick(rebuildMasonry)
  else {
    masonryCols.value = [[], []]
    detailId.value = null
    settingsOpen.value = false
  }
})
type HistRec = { n: string; o: number; c: number; p: number; f: string; t: number }
const historyRecords = ref<HistRec[]>([])
function loadHistory() {
  try {
    const raw = localStorage.getItem('ic-history')
    const arr = raw ? JSON.parse(raw) : []
    // Validate every field: an old/corrupt record with a missing size used to
    // render "NaN B" in the history total and the per-row sizes.
    historyRecords.value = Array.isArray(arr)
      ? arr.filter((r) => r && typeof r.n === 'string'
        && Number.isFinite(r.o) && Number.isFinite(r.c)
        && Number.isFinite(r.p) && Number.isFinite(r.t))
      : []
  } catch {
    historyRecords.value = []
  }
}
// Loaded at setup so the first saveHistory never clobbers stored records.
loadHistory()
function saveHistory(rec: HistRec) {
  const arr = [rec, ...historyRecords.value].slice(0, 200)
  historyRecords.value = arr
  try {
    localStorage.setItem('ic-history', JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}
const histSaved = computed(() => historyRecords.value.reduce((s, r) => s + Math.max(0, r.o - r.c), 0))
function clearHistory() {
  historyRecords.value = []
  try {
    localStorage.removeItem('ic-history')
  } catch {
    /* ignore */
  }
}
function goTool() {
  view.value = 'tool'
  moreOpen.value = false
  replaceSub('')
}
// Sidebar / tab bar: switch to the PDF to Word feature. This view stays
// alive (KeepAlive) so a running batch and its results survive the trip.
function goPdf() {
  moreOpen.value = false
  settingsOpen.value = false
  detailId.value = null
  navigate('pdf')
}
// Tab bar Home: back to the tool, scrolled to the top. (Templates cannot
// reach window, so this lives in script: the old inline call threw.)
function goHome() {
  settingsOpen.value = false
  goTool()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function goHistory() {
  loadHistory()
  view.value = 'history'
  moreOpen.value = false
  replaceSub('history')
}
// #/history (e.g. the PDF page's sidebar) opens the history view.
watch(() => route.value.sub, (sub) => {
  if (sub === 'history' && view.value !== 'history') goHistory()
  else if (sub === '' && view.value === 'history') view.value = 'tool'
}, { immediate: true })
// Tab bar Settings (phones only; the tab bar is hidden from 720px): open
// the settings sheet over the tool page instead of scrolling to a card.
function goSettings() {
  view.value = 'tool'
  moreOpen.value = false
  detailId.value = null
  settingsOpen.value = !settingsOpen.value
}
// Opening the More menu from the (still live) tab bar replaces the sheet.
watch(moreOpen, (open) => { if (open) settingsOpen.value = false })
// "Start / recompress" inside the sheet: close it so the progress and the
// results are visible, then run.
function startFromSheet() {
  settingsOpen.value = false
  void recompressAll()
}

const dropzoneRef = ref<{ openPicker: () => void } | null>(null)
function openPicker() { dropzoneRef.value?.openPicker() }

function t(key: string, ...args: (string | number)[]): string {
  return tx(lang.value, key, ...args)
}


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
  const savedBytes = Math.max(0, doneOrig - comp)
  // 0% is not a success: the big number is green only when bytes were
  // actually saved (DESIGN: green is earned by a measurement).
  const big = saved > 0
    ? `<span class="stat-value sum-big">${t('sumBig', saved)}</span>`
    : `<span class="stat-value sum-big zero">0%</span>`
  // Flat stat strip: done count, original total, compressed (done only),
  // saved percent + bytes. sum-big keeps its class and pure percent text so
  // the saved-percent assertion still reads it; the zero class greys the 0%
  // case (green is earned, never decorative).
  const strip = `<div class="stat-strip">`
    + `<div class="stat"><span class="stat-label">${t('statDone')}</span><span class="stat-value">${doneCount.value}/${items.value.length}</span></div>`
    + `<div class="stat"><span class="stat-label">${t('statOrig')}</span><span class="stat-value">${fmtSize(orig)}</span></div>`
    + `<div class="stat"><span class="stat-label">${t('statComp')}</span><span class="stat-value">${fmtSize(comp)}</span></div>`
    + `<div class="stat"><span class="stat-label">${t('statSaved')}</span>${big}<span class="stat-sub">${fmtSize(savedBytes)}</span></div>`
    + `</div>`
  // The flat stat strip is the whole summary. The old "click a thumbnail"
  // hint moved out: the table header and the clickable thumbnails say it.
  return strip
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
// Runs currently encoding (fresh or recompress). activeIds includes items
// waiting in the pool queue; processingIds contains only items whose encode
// has actually started, which is what distinguishes the grey queued badge
// from the accent progress bar on a card.
const activeRuns = ref(0)
const activeIds = ref<Set<string>>(new Set())
const processingIds = ref<Set<string>>(new Set())
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
  activeIds.value = new Set([...activeIds.value, ...list.map((i) => i.id)])
  try {
    await Promise.all(list.map(async (item) => {
      try {
        const res = await pool.run(item, snap, lang.value, () => {
          const next = new Set(processingIds.value)
          next.add(item.id)
          processingIds.value = next
        })
        if (g !== runGen) {
          if (res.done) URL.revokeObjectURL(res.outUrl)
          return
        }
        if (!res.done && res.cancelled) {
          // Keep a displayed result if this was a recompress; only a fresh item
          // that never finished gets the cancelled error.
          if (!item.done) replaceItem({ ...item, error: res.error, cancelled: true })
          return
        }
        // Only a successful result counts as "computed under snap": a
        // failed item keeps its displayed (older) result, so its snapshot
        // must stay at the older settings, not advance to snap.
        // keepOriginalName can be toggled while this run is in flight; rewrite
        // the name from the CURRENT setting so the result never resurrects the
        // naming that was active when the encode started.
        const applied = res.done && res.outSize < item.file.size
          ? { ...res, outName: baseName(item.file.name) + (settings.keepOriginalName ? '' : '-compressed') + '.' + extOf(res.outType) }
          : res
        replaceItem({ ...item, ...applied, ...(applied.done ? { lastSettings: snap, cancelled: false, retryable: true } : {}) })
        // First completion only: recompresses of an already-done item are
        // not new history entries.
        if (!item.done && res.done) {
          const fmtMap: Record<string, string> = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/avif': 'AVIF' }
          const ext = item.file.name.split('.').pop()?.toUpperCase() ?? ''
          saveHistory({ n: item.file.name, o: item.file.size, c: res.outSize, p: Math.max(0, Math.round((1 - res.outSize / item.file.size) * 100)), f: fmtMap[res.outType] ?? ext, t: Date.now() })
        }
      } finally {
        const nextActive = new Set(activeIds.value)
        nextActive.delete(item.id)
        activeIds.value = nextActive
        const nextProcessing = new Set(processingIds.value)
        nextProcessing.delete(item.id)
        processingIds.value = nextProcessing
      }
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
  setPrefLang(l)
  applyDocMeta()
}
function applyDocMeta() {
  document.title = t('docTitle')
  const md = document.querySelector('meta[name="description"]')
  if (md) md.setAttribute('content', t('metaDesc'))
}


// Transient note for files skipped by the addFiles funnel (non-images).
const fileHint = ref<string | null>(null)
let hintTimer: ReturnType<typeof setTimeout> | null = null

const busyAddBlocked = ref(false)
let busyAddTimer: ReturnType<typeof setTimeout> | null = null
function noteBusyAddBlocked() {
  busyAddBlocked.value = true
  if (busyAddTimer) clearTimeout(busyAddTimer)
  busyAddTimer = setTimeout(() => { busyAddBlocked.value = false }, 2500)
}

function addFiles(files: File[], dirs?: string[]) {
  // The blocking loading layer disables the picker/dropzone, but a document
  // drop or a paste can still reach this funnel; ignore it until the run ends,
  // and tell the user why in the loading pill instead of silently dropping it.
  if (busy.value) { noteBusyAddBlocked(); return }
  const dirOf = new Map<File, string>()
  if (dirs) files.forEach((f, i) => dirOf.set(f, dirs[i] ?? ''))
  // Single funnel for drop, paste and picker. Chrome/Windows often
  // reports an empty type for HEIC files, so the extension is the
  // fallback signal (same rule as isHeic in wasm-encoders). Anything
  // that is not an image is skipped with a visible hint instead of
  // silently vanishing, which was the old drop/paste behavior.
  const accepted = files.filter(
    (f) => f.type.startsWith('image/') || /\.hei[cf]$/i.test(f.name),
  )
  const filtered = files.length - accepted.length
  // Mock cap: a single image over 50 MB is skipped with a hint, not
  // silently dropped and not fed to the encoders.
  const MAX_FILE = 50 * 1024 * 1024
  const withinLimit = accepted.filter((f) => f.size <= MAX_FILE)
  const oversize = accepted.length - withinLimit.length
  // Re-dropping the same folder, or picking the same file twice, used to
  // append a duplicate row and compress the pixels again. Identity is
  // name + size + mtime: cheap, and stable for the same file on disk.
  // Include the folder path: two different folders can legitimately contain
  // files with the same name/size/mtime (e.g. two camera-card dumps), and
  // those must both be imported.
  const keyOf = (f: File, dir: string) => `${dir}|${f.name}|${f.size}|${f.lastModified}`
  const seen = new Set(items.value.map((i) => keyOf(i.file, i.relDir)))
  const fresh: File[] = []
  for (const f of withinLimit) {
    const key = keyOf(f, dirOf.get(f) ?? '')
    if (seen.has(key)) continue
    seen.add(key)
    fresh.push(f)
  }
  const duplicates = withinLimit.length - fresh.length
  const hints: string[] = []
  if (filtered > 0) hints.push(t('filteredNote', filtered))
  if (oversize > 0) hints.push(t('oversizeNote', oversize))
  if (duplicates > 0) hints.push(t('duplicateNote', duplicates))
  if (hints.length) {
    fileHint.value = hints.join(' ')
    if (hintTimer) clearTimeout(hintTimer)
    hintTimer = setTimeout(() => { fileHint.value = null }, 5000)
  }
  if (!fresh.length) return
  for (const file of fresh) items.value.push(newItem(file, dirOf.get(file) ?? ''))
  refresh()
  // New imports start on page 1: the first page is the only one that is
  // guaranteed to exist, and jumping to the last page hid the earlier
  // results the user may have been looking at before the import. Clear the
  // explicit preview selection so an open preview follows page 1 instead of
  // showing a file that is no longer in the visible list.
  page.value = 1
  previewId.value = null
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

// Retry a failed item under the current settings: the row first clears
// the stale error (so it reads "processing" while the new run is in
// flight); runCompress then replaces it with the fresh result.
function retryItem(item: CompressItem) {
  const cleared = { ...item, error: null, cancelled: false }
  replaceItem(cleared)
  const g = ++runGen
  void runCompress([cleared], g, { ...settings })
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function commitRemove(item: CompressItem) {
  // A delayed fade timer can fire after clearAll already removed the item.
  if (!items.value.some((i) => i.id === item.id)) return
  URL.revokeObjectURL(item.url)
  if (item.outUrl) URL.revokeObjectURL(item.outUrl)
  items.value = items.value.filter((i) => i.id !== item.id)
  if (lightboxId.value === item.id) lightboxId.value = null
  if (detailId.value === item.id) detailId.value = null
}

function removeItem(item: CompressItem) {
  if (detailId.value === item.id) detailId.value = null
  const nextActive = new Set(activeIds.value)
  nextActive.delete(item.id)
  activeIds.value = nextActive
  const nextProcessing = new Set(processingIds.value)
  nextProcessing.delete(item.id)
  processingIds.value = nextProcessing
  if (!isMobile.value || prefersReducedMotion()) {
    commitRemove(item)
    return
  }
  if (removingIds.value.has(item.id)) return
  const next = new Set(removingIds.value)
  next.add(item.id)
  removingIds.value = next
  const timer = setTimeout(() => {
    removalTimers.delete(item.id)
    const left = new Set(removingIds.value)
    left.delete(item.id)
    removingIds.value = left
    commitRemove(item)
  }, 200)
  removalTimers.set(item.id, timer)
}

// Preview overlay: stores only the id, so the overlay always shows the
// live item object (it survives recompresses that replace the item).
const lightboxId = ref<string | null>(null)
const lbItem = computed(() => items.value.find((i) => i.id === lightboxId.value) ?? null)
const lbIndex = computed(() => items.value.findIndex((i) => i.id === lightboxId.value))
// Lightbox ← / →: step through the list, keeping the side preview in sync.
function lbStep(d: number) {
  const next = items.value[lbIndex.value + d]
  if (!next) return
  lightboxId.value = next.id
  selectPreview(next)
}
// Bottom-right compare preview (mock layout): the selected image,
// defaulting to the first one. The thumbnail strip selects; the row
// thumbnail also selects (and still opens the lightbox). The × hides
// the card until the next selection.
const previewId = ref<string | null>(null)
const previewClosed = ref(false)
// Fall back to the first item on the CURRENT page, not the first overall:
// on page 2 the preview used to keep showing an image that scrolled off the
// list. An explicit selection still wins wherever it is.
const previewItem = computed(() =>
  items.value.find((i) => i.id === previewId.value)
  ?? pagedItems.value[0]
  ?? items.value[0]
  ?? null,
)
const previewPct = computed(() => {
  const it = previewItem.value
  if (!it || !it.done || it.file.size <= 0) return 0
  return Math.max(0, Math.round((1 - it.outSize / it.file.size) * 100))
})
function selectPreview(item: CompressItem) {
  previewId.value = item.id
  previewClosed.value = false
  // The strip lists every item; selecting one from another page must move
  // the list there too, or the highlighted row is nowhere visible.
  const idx = items.value.findIndex((i) => i.id === item.id)
  if (idx >= 0) page.value = Math.floor(idx / PAGE_SIZE) + 1
}
function downloadPreview() {
  const it = previewItem.value
  if (!it || !it.done || !it.outUrl) return
  const a = document.createElement('a')
  a.href = it.outUrl
  a.download = it.outName ?? it.file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
}
// Same slider mechanism as the lightbox, in card form: the base
// (compressed) layer fills the wrapper and the original layer clips to the
// divider. The card always fits; zooming lives in the lightbox.
// Manual thumbnail carousel: arrows page the strip viewport; no autoplay,
// no dots. Nav buttons only show when tiles overflow the viewport.
const thumbStripRef = ref<HTMLElement | null>(null)
const stripViewportRef = ref<HTMLElement | null>(null)
const stripHasOverflow = ref(false)
const stripStuck = ref(false)
const stripCanPrev = ref(false)
const stripCanNext = ref(false)
function updateStripNav() {
  const el = stripViewportRef.value
  if (!el) { stripHasOverflow.value = false; stripCanPrev.value = false; stripCanNext.value = false; return }
  const max = el.scrollWidth - el.clientWidth
  stripHasOverflow.value = max > 4
  stripCanPrev.value = el.scrollLeft > 4
  stripCanNext.value = el.scrollLeft < max - 4
}
function stripScroll(dir: number) {
  const el = stripViewportRef.value
  if (!el) return
  // Page by whole tiles (96px tile + 12px gap), clamped to the ends, so a
  // page never lands mid-tile and both ends sit flush (no trailing blank).
  const step = Math.max(1, Math.floor(el.clientWidth / 108)) * 108
  const max = el.scrollWidth - el.clientWidth
  const target = dir > 0 ? Math.min(el.scrollLeft + step, max) : Math.max(el.scrollLeft - step, 0)
  el.scrollTo({ left: target, behavior: 'smooth' })
}
// The strip moves from its normal position to a compact sticky bar once its
// top reaches the viewport top. Names/sizes are hidden only while stuck, so
// the carousel stays usable without covering a large part of the results.
function updateStripStuck() {
  const el = thumbStripRef.value
  if (!el) { stripStuck.value = false; return }
  // 2px hysteresis: the border does not flicker while the top sits exactly
  // on the threshold. No layout properties change in the stuck state.
  const top = el.getBoundingClientRect().top
  if (top <= 0) stripStuck.value = true
  else if (top > 2) stripStuck.value = false
}
function onViewportResize() {
  isMobile.value = window.innerWidth < 720
  updateStripNav()
  updateStripStuck()
}
watch(() => items.value.length, async () => { await nextTick(); updateStripNav(); updateStripStuck() })
// #8 results pagination: desktop keeps 20 rows per page. Phones render the
// whole masonry (no pager) so appending a file never replaces the visible
// page or scrolls back to the top. Stats, the strip and downloads stay global.
const PAGE_SIZE = 20
const page = ref(1)
const pageCount = computed(() => Math.max(1, Math.ceil(items.value.length / PAGE_SIZE)))
const pagedItems = computed(() => (isMobile.value
  ? items.value
  : items.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE)))
watch(pageCount, () => { if (page.value > pageCount.value) page.value = pageCount.value })
// Changing page at the bottom used to leave the viewport at the pager and
// show the *end* of the next page. Bring the results header back into view;
// on phones that means the first compact rows are immediately visible.
async function goPage(delta: number) {
  page.value = Math.min(pageCount.value, Math.max(1, page.value + delta))
  await nextTick()
  document.getElementById('resultCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
if (typeof window !== 'undefined') {
  window.addEventListener('resize', onViewportResize)
  window.addEventListener('scroll', updateStripStuck, { passive: true })
}

// Shared with the mobile detail sheet: the slider mechanics live in one
// composable, while both surfaces keep the same .pv-* markup.
const {
  pos: pvPos,
  compareRef: pvCompareRef,
  onDividerDown: onPvDividerDown,
  onDividerKey: onPvDividerKey,
  onStageClick: onPvStageClickBase,
} = useCompareSlider(previewItem)
function onPvStageClick(e: MouseEvent) {
  onPvStageClickBase(e, () => {
    if (previewItem.value) lightboxId.value = previewItem.value.id
  })
}
const pvCompSrc = computed(() => {
  const it = previewItem.value
  if (!it) return ''
  return it.done && it.outUrl ? it.outUrl : it.url
})
const pvCompareStyle = computed(() => {
  // Fill the card width, but cap tall (portrait) images at 55vh by
  // narrowing the wrapper to the matching width, so both layers stay
  // aligned and the slider still spans the whole picture.
  const it = previewItem.value
  const w = it && it.done && it.outUrl && it.outW ? it.outW : it?.origW
  const h = it && it.done && it.outUrl && it.outH ? it.outH : it?.origH
  return w && h ? { width: `min(100%, calc(55vh * ${w} / ${h}))` } : { width: '100%' }
})

// Phones: "download all" hands every compressed file to the share sheet
// (Save N images to Photos, AirDrop, …) when the browser can share files.
// Dismissing the sheet does nothing; any other failure, or no file-sharing
// support, falls back to the regular download below. Desktop is unchanged.
const sharing = ref(false)
async function downloadAll() {
  const done = items.value.filter((i) => i.done && i.outUrl)
  if (!done.length) return
  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  if (!isMobile.value || typeof nav?.canShare !== 'function') {
    downloadAllFiles(done)
    return
  }
  if (sharing.value) return
  sharing.value = true
  try {
    const files = await Promise.all(done.map(async (it) => {
      const blob = await (await fetch(it.outUrl!)).blob()
      return new File([blob], it.outName ?? it.file.name, { type: blob.type })
    }))
    await shareFilesOr(nav, files, () => downloadAllFiles(done))
  } catch (err) {
    console.warn('[image-compressor] Share failed, downloading instead:', err)
    downloadAllFiles(done)
  } finally {
    sharing.value = false
  }
}

// One finished image downloads as itself; a zip is only for two or more.
function downloadAllFiles(done: CompressItem[]) {
  if (done.length === 1) {
    const a = document.createElement('a')
    a.href = done[0].outUrl!
    a.download = done[0].outName ?? done[0].file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    return
  }
  void downloadAllZip()
}

const zipping = ref(false)
// Any asynchronous user operation that must lock the UI: compression runs and
// ZIP packaging. The blocking scrim/inert attributes use this; the status pill
// is the single visible indicator.
const busy = computed(() => activeRuns.value > 0 || zipping.value)
// Fresh batches can show finished/total; a recompress keeps all items done,
// so a count would be misleading there and the generic label is used.
const busyText = computed(() => doneCount.value < items.value.length
  ? t('processingCount', finishedCount.value, items.value.length)
  : t('processing'))
function cancelBusy() {
  if (activeRuns.value === 0) return
  pendingRecompress = false
  pool.cancelAll()
}
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!busy.value) return
  e.preventDefault()
  e.returnValue = ''
}
watch([busy, sheetOpen], ([isBusy, isSheet]) => {
  // A fixed scrim/sheet alone still lets the page scroll behind it.
  document.body.style.overflow = isBusy || isSheet ? 'hidden' : ''
  if (!isBusy) busyAddBlocked.value = false
})
async function downloadAllZip() {
  const done = items.value.filter((i) => i.done && i.outUrl)
  if (!done.length || zipping.value) return
  // One zip download instead of many consecutive downloads: browsers,
  // especially Safari/iOS, block the latter. Store (no deflate) — the files
  // are already compressed. Stream the entries through fflate instead of
  // collecting a files object and then zipSync-ing a second full copy.
  zipping.value = true
  try {
    // Dropped folders keep their structure inside the zip.
    const zipped = await zipEntries(done.map((item) => ({
      name: (item.relDir ? item.relDir + '/' : '') + (item.outName ?? item.file.name),
      url: item.outUrl!,
    })))
    downloadUrl(zipped, `images-compressed-${ymd()}-${done.length}.zip`)
  } finally {
    zipping.value = false
  }
}

function clearAll() {
  removalTimers.forEach((t) => clearTimeout(t))
  removalTimers.clear()
  removingIds.value = new Set()
  items.value.forEach((i) => {
    URL.revokeObjectURL(i.url)
    if (i.outUrl) URL.revokeObjectURL(i.outUrl)
  })
  items.value = []
  lightboxId.value = null
  detailId.value = null
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
  page.value = 1
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
  if (busy.value || !e.dataTransfer?.types.includes('Files')) return
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
  if (busy.value) { noteBusyAddBlocked(); e.preventDefault(); return }
  const target = e.target as HTMLElement | null
  if (target?.closest?.('#dropzone')) return
  if (!e.dataTransfer?.types.includes('Files')) return
  e.preventDefault()
  // filesFromDrop grabs the entries synchronously, before its first await.
  void filesFromDrop(e.dataTransfer).then((dropped) => {
    if (dropped.length) addFiles(dropped.map((d) => d.file), dropped.map((d) => d.dir))
  })
}

onMounted(() => {
  applyTheme(theme.value)
  setLang(lang.value)
  window.addEventListener('beforeunload', onBeforeUnload)
})
// The shell keeps this view alive (KeepAlive) while the PDF feature is
// shown: page-wide paste/drop only belong to the visible feature, and any
// open phone surface closes when leaving so nothing stays scroll-locked.
let listening = false
onActivated(() => {
  applyDocMeta()
  if (busy.value || sheetOpen.value) document.body.style.overflow = 'hidden'
  if (listening) return
  listening = true
  document.addEventListener('paste', onPaste)
  document.addEventListener('dragenter', onDocDragEnter)
  document.addEventListener('dragleave', onDocDragLeave)
  document.addEventListener('dragend', onDocDragEnd)
  document.addEventListener('dragover', onDocDragOver)
  document.addEventListener('drop', onDocDrop)
})
function stopPageListeners() {
  if (!listening) return
  listening = false
  document.removeEventListener('paste', onPaste)
  document.removeEventListener('dragenter', onDocDragEnter)
  document.removeEventListener('dragleave', onDocDragLeave)
  document.removeEventListener('dragend', onDocDragEnd)
  document.removeEventListener('dragover', onDocDragOver)
  document.removeEventListener('drop', onDocDrop)
}
onDeactivated(() => {
  stopPageListeners()
  moreOpen.value = false
  settingsOpen.value = false
  detailId.value = null
  lightboxId.value = null
  pageDragging.value = false
  document.body.style.overflow = ''
})
onUnmounted(() => {
  stopPageListeners()
  window.removeEventListener('resize', onViewportResize)
  window.removeEventListener('scroll', updateStripStuck)
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (busyAddTimer) clearTimeout(busyAddTimer)
  removalTimers.forEach((t) => clearTimeout(t))
  removalTimers.clear()
  document.body.style.overflow = ''
})
</script>
