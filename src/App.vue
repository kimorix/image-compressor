<template>
  <header>
    <div>
      <h1><span>{{ t('appTitle') }}</span><span class="badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z" /><path d="M9 12l2 2 4-4" /></svg><span class="badge-text"><span class="badge-main">{{ t('badgeLocal') }}</span><span class="badge-sub">{{ t('badgeSub') }}</span></span></span></h1>
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
  <div class="layout">
    <aside id="sideNav">
      <nav class="side-links">
        <button type="button" :class="{ active: view === 'tool' }" @click="goTool"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>{{ t('navTool') }}</button>
        <button type="button" :class="{ active: view === 'history' }" @click="goHistory"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{{ t('navHistory') }}</button>
      </nav>
      <div class="side-card">
        <strong>{{ t('sideFormats') }}</strong>
        <p class="side-formats">JPG · PNG · WebP · AVIF · HEIC · HEIF</p>
      </div>
    </aside>
    <main :class="{ 'no-result': items.length === 0 }" v-show="view === 'tool'">
    <div class="card" id="uploadCard">
      <DropZone ref="dropzoneRef" :t="t" :compact="items.length > 0" @files="addFiles" />
      <p v-if="fileHint" class="file-hint">{{ fileHint }}</p>
      <div v-if="items.length > 0" class="thumb-strip">
        <button v-show="stripHasOverflow" type="button" class="strip-nav" :disabled="!stripCanPrev" :aria-label="t('stripPrev')" @click="stripScroll(-1)">‹</button>
        <div class="strip-viewport" ref="stripViewportRef" @scroll="updateStripNav">
          <div class="strip-track">
            <div v-for="item in items" :key="item.id" :class="['strip-tile', { selected: previewItem && previewItem.id === item.id }]" :title="item.file.name" @click="selectPreview(item)">
              <img class="strip-thumb" :src="item.done && item.outUrl ? item.outUrl : item.url" :alt="item.file.name" onerror="this.style.visibility='hidden'" />
              <span class="strip-name">{{ shortName(item.file.name) }}</span>
              <span class="strip-size">{{ fmtSize(item.file.size) }}</span>
              <button type="button" class="strip-remove" :title="t('btnRemove')" :aria-label="t('btnRemove')" @click.stop="removeItem(item)">×</button>
            </div>
          </div>
        </div>
        <button v-show="stripHasOverflow" type="button" class="strip-nav" :disabled="!stripCanNext" :aria-label="t('stripNext')" @click="stripScroll(1)">›</button>
      </div>
    </div>

    <div class="card" id="resultCard" v-show="items.length > 0">
      <ProgressBar :finished="finishedCount" :total="items.length" :t="t" />
      <div class="result-head">
        <h3>{{ t('resultTitle') }}</h3>
        <div class="actions">
          <button id="clearAll" :class="{ danger: clearConfirm }" :disabled="items.length === 0" @click="onClearClick">{{ clearConfirm ? t('clearConfirm') : t('clearAll') }}</button>
          <button class="primary" id="downloadAll" :disabled="doneCount === 0 || zipping" @click="downloadAll">{{ t('downloadAll') }}</button>
        </div>
      </div>
      <div id="summary" v-html="summaryHtml"></div>
      <div id="list">
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
      <div v-if="items.length > PAGE_SIZE" class="pager">
        <button type="button" :disabled="page <= 1" @click="page--">{{ t('pagePrev') }}</button>
        <span class="pager-label">{{ t('pageLabel', page, pageCount) }}</span>
        <button type="button" :disabled="page >= pageCount" @click="page++">{{ t('pageNext') }}</button>
      </div>
      <div v-if="allAlreadyBest" class="dl-note">{{ t('allBestNote', items.length) }}</div>
    </div>
  </main>
  <div id="rightPanel" v-show="view === 'tool'">
      <div class="card" id="settingsCard">
        <div class="settings-head">
          <h3>{{ t('settingsTitle') }}</h3>
          <button type="button" class="settings-collapse-btn" :aria-expanded="!settingsCollapsed" @click="settingsCollapsed = !settingsCollapsed">{{ settingsCollapsed ? t('expandBtn') : t('collapseBtn') }}</button>
        </div>
        <button class="settings-summary" type="button" :aria-expanded="!settingsCollapsed" @click="settingsCollapsed = !settingsCollapsed">
          <span>{{ settingsSummary }}</span><span class="settings-caret">{{ settingsCollapsed ? '▾' : '▴' }}</span>
        </button>
        <div class="settings-body" :class="{ 'settings-body-collapsed': settingsCollapsed }">
          <SettingsPanel :settings="settings" :t="t" @update="onSettingsUpdate" @preset="onPreset" @start="recompressAll" />
        </div>
      </div>
      <div class="card" id="previewCard" v-if="previewItem && !previewClosed">
        <div class="pv-head">
          <h3>{{ t('previewTitle') }}</h3>
          <button type="button" class="pv-close" :title="t('lbClose')" :aria-label="t('lbClose')" @click="previewClosed = true">×</button>
        </div>
        <div class="pv-stage" @click="onPvStageClick">
          <div class="pv-compare" ref="pvCompareRef" :class="{ zoomed: pvZoom !== 'fit' }" :style="pvCompareStyle">
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
        <div class="pv-zoom">
          <button type="button" class="pv-zoom-btn" :class="{ active: pvZoom === 'fit' }" :aria-pressed="pvZoom === 'fit'" @click="pvZoom = 'fit'">{{ t('lbFit') }}</button>
          <button type="button" class="pv-zoom-btn" :class="{ active: pvZoom === '100' }" :aria-pressed="pvZoom === '100'" @click="pvZoom = '100'">100%</button>
          <button type="button" class="pv-zoom-btn" :class="{ active: pvZoom === '200' }" :aria-pressed="pvZoom === '200'" @click="pvZoom = '200'">200%</button>
        </div>
        <div class="pv-info">
          <span class="pv-name">{{ previewItem.file.name }}</span>
          <span v-if="previewItem.done && previewItem.outUrl" class="pv-save">−{{ previewPct }}% · {{ t('pvSaved') }} {{ fmtSize(previewItem.file.size - previewItem.outSize) }}</span>
          <span v-if="previewItem.done && previewItem.outUrl">{{ fmtSize(previewItem.file.size) }} → {{ fmtSize(previewItem.outSize) }} (−{{ previewPct }}%)</span>
          <span v-if="previewItem.done && previewItem.origW">{{ previewItem.origW }}×{{ previewItem.origH }} → {{ previewItem.outW }}×{{ previewItem.outH }}</span>
          <span v-if="previewItem.error">{{ t('statusFailed') }}</span>
          <span v-if="!previewItem.done && !previewItem.error">{{ t('statusProcessing') }}</span>
        </div>
        <div class="pv-actions" v-if="(previewItem.done && previewItem.outUrl) || previewItem.error">
          <button v-if="previewItem.done && previewItem.outUrl" type="button" class="primary" @click="downloadPreview">{{ t('pvDownload') }}</button>
          <button v-if="previewItem.error" type="button" @click="retryItem(previewItem)">{{ t('retryBtn') }}</button>
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
  <div class="sticky-bar" v-show="items.length > 0">
    <button class="sticky-add" type="button" @click="openPicker">{{ t('addBtn') }}</button>
    <button class="sticky-clear" type="button" :disabled="items.length === 0" @click="onClearClick">{{ clearConfirm ? t('clearConfirm') : t('clearAll') }}</button>
    <button class="sticky-download primary" type="button" :disabled="doneCount === 0 || zipping" @click="downloadAll">{{ t('downloadAll') }}</button>
  </div>
  <div class="sticky-spacer" v-show="items.length > 0" aria-hidden="true"></div>
  <nav class="tab-bar">
    <button type="button" :class="{ active: view === 'tool' }" @click="goHome"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8" /><path d="M5 9v11h14V9" /></svg>{{ t('tabHome') }}</button>
    <button type="button" @click="goSettings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>{{ t('tabSettings') }}</button>
    <button type="button" :class="{ active: moreOpen }" @click="moreOpen = !moreOpen"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>{{ t('tabMore') }}</button>
  </nav>
  <div class="more-menu" v-show="moreOpen">
    <button type="button" @click="toggleTheme(); moreOpen = false">{{ t('moreTheme') }}</button>
    <a href="https://github.com/kimorix/image-compressor" target="_blank" rel="noopener">{{ t('githubBtn') }}</a>
    <button type="button" :disabled="items.length === 0" @click="onClearClick(); moreOpen = false">{{ t('clearAll') }}</button>
  </div>
  <!-- Global recompress indicator: the centered "processing" pill is the
  single loading indicator. pointer-events none: it must never block taps
  while a run is in flight. -->
  <div class="global-loading" :class="{ show: recompressing }" aria-hidden="true"><span class="gl-spin"></span><span>{{ t('processing') }}</span></div>
  <div v-if="pageDragging" class="page-drop-hint" aria-hidden="true">{{ t('dropAnywhere') }}</div>
  <Lightbox v-if="lbItem" :item="lbItem" :t="t" :has-prev="lbIndex > 0" :has-next="lbIndex >= 0 && lbIndex < items.length - 1" @close="lightboxId = null" @prev="lbStep(-1)" @next="lbStep(1)" />
  <footer v-html="t('footer')"></footer>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'
import { zipSync } from 'fflate'
import DropZone from './components/DropZone.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import ImageItem from './components/ImageItem.vue'
import Lightbox from './components/Lightbox.vue'
import ProgressBar from './components/ProgressBar.vue'
import { LANGS, initialLang, t as tx, type Lang } from './i18n'
import { applyTheme, initialTheme, MOON_ICON, SUN_ICON, type Theme } from './lib/theme'
import { CompressPool } from './lib/compress-pool'
import { baseName, fmtSize, shortName } from './lib/format'
import { filesFromDrop } from './lib/drop'
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
// one-line summary (tapping it expands). Collapsed by default on narrow
// screens so the results are visible right under the upload area;
// desktop starts expanded (the panel is a fixed sidebar there, and
// folding is opt-in via the header button).
const settingsCollapsed = ref(typeof window !== 'undefined' ? window.innerWidth < 720 : true)
// Shell views: tool (default) vs history. The sidebar and the mobile tab
// bar switch between them; settings is an action (expand + scroll), not a
// view, because the panel already lives on the tool page.
const view = ref<'tool' | 'history'>('tool')
const moreOpen = ref(false)
type HistRec = { n: string; o: number; c: number; p: number; f: string; t: number }
const historyRecords = ref<HistRec[]>([])
function loadHistory() {
  try {
    const raw = localStorage.getItem('ic-history')
    const arr = raw ? JSON.parse(raw) : []
    historyRecords.value = Array.isArray(arr) ? arr.filter((r) => r && typeof r.n === 'string') : []
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
}
// Tab bar Home: back to the tool, scrolled to the top. (Templates cannot
// reach window, so this lives in script: the old inline call threw.)
function goHome() {
  goTool()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function goHistory() {
  loadHistory()
  view.value = 'history'
  moreOpen.value = false
}
async function goSettings() {
  view.value = 'tool'
  moreOpen.value = false
  settingsCollapsed.value = false
  await nextTick()
  document.getElementById('settingsCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
const settingsSummary = computed(() => {
  const fmt = settings.format === 'auto' ? t('fmtAutoShort')
    : settings.format === 'original' ? t('fmtOriginal')
    : settings.format === 'image/webp' ? 'WebP' : settings.format.split('/')[1].toUpperCase()
  const parts = [fmt]
  if (settings.mode === 'target') parts.push(`≤${settings.targetSize}KB`)
  else if (settings.mode === 'quality') parts.push(`${settings.quality}%`)
  else if (settings.format !== 'auto') parts.push(t('modeAuto'))
  if (settings.resizeMode === 'exact') parts.push(`${settings.maxSize}×${settings.maxHeight}`)
  else if (settings.maxSize) parts.push(settings.resizeMode === 'percent' ? `${settings.maxSize}%` : `${settings.maxSize}px`)
  return parts.join(' · ')
})

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
  const savedBytes = Math.max(0, doneOrig - comp)
  // Stat strip (mock layout): done count, original total, compressed
  // (done only), saved percent + bytes. The numbers match the old detail
  // line; only the layout changed. sum-big keeps its class and pure
  // percent text so the saved-percent assertion still reads it.
  const strip = `<div class="stat-strip">`
    + `<div class="stat"><span class="stat-label">${t('statDone')}</span><span class="stat-value">${doneCount.value}/${items.value.length}</span></div>`
    + `<div class="stat"><span class="stat-label">${t('statOrig')}</span><span class="stat-value">${fmtSize(orig)}</span></div>`
    + `<div class="stat"><span class="stat-label">${t('statComp')}</span><span class="stat-value">${fmtSize(comp)}</span></div>`
    + `<div class="stat"><span class="stat-label">${t('statSaved')}</span><span class="stat-value sum-big">${t('sumBig', saved)}</span><span class="stat-sub">${fmtSize(savedBytes)}</span></div>`
    + `</div>`
  // The thumbnail-toggle hint used to repeat on every row; once, under the
  // summary, is enough.
  return `${strip}<div class="list-hint">${t('thumbHint')}</div>`
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
      // First completion only: recompresses of an already-done item are
      // not new history entries.
      if (!item.done && res.done) {
        const fmtMap: Record<string, string> = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/avif': 'AVIF' }
        const ext = item.file.name.split('.').pop()?.toUpperCase() ?? ''
        saveHistory({ n: item.file.name, o: item.file.size, c: res.outSize, p: Math.max(0, Math.round((1 - res.outSize / item.file.size) * 100)), f: fmtMap[res.outType] ?? ext, t: Date.now() })
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

function addFiles(files: File[], dirs?: string[]) {
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
  const hints: string[] = []
  if (filtered > 0) hints.push(t('filteredNote', filtered))
  if (oversize > 0) hints.push(t('oversizeNote', oversize))
  if (hints.length) {
    fileHint.value = hints.join(' ')
    if (hintTimer) clearTimeout(hintTimer)
    hintTimer = setTimeout(() => { fileHint.value = null }, 5000)
  }
  if (!withinLimit.length) return
  for (const file of withinLimit) items.value.push(newItem(file, dirOf.get(file) ?? ''))
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
  if (prev.format !== next.format || prev.mode !== next.mode || prev.quantize !== next.quantize) return false
  // Crop boxes change the framing, not just the scale: any change re-runs.
  if (prev.resizeMode === 'exact' || next.resizeMode === 'exact') {
    if (prev.resizeMode !== next.resizeMode || prev.maxSize !== next.maxSize || prev.maxHeight !== next.maxHeight) return false
  }
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

// Retry a failed item under the current settings: the row first clears
// the stale error (so it reads "processing" while the new run is in
// flight); runCompress then replaces it with the fresh result.
function retryItem(item: CompressItem) {
  const cleared = { ...item, error: null }
  replaceItem(cleared)
  const g = ++runGen
  void runCompress([cleared], g, { ...settings })
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
const previewItem = computed(() => items.value.find((i) => i.id === previewId.value) ?? items.value[0] ?? null)
const previewPct = computed(() => {
  const it = previewItem.value
  if (!it || !it.done || it.file.size <= 0) return 0
  return Math.max(0, Math.round((1 - it.outSize / it.file.size) * 100))
})
function selectPreview(item: CompressItem) {
  previewId.value = item.id
  previewClosed.value = false
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
// Same slider/zoom mechanism as the lightbox, in card form: the base
// (compressed) layer fills the wrapper, the original layer clips to the
// divider, and zoom scales the wrapper's explicit width.
const pvZoom = ref<'fit' | '100' | '200'>('fit')
// Manual thumbnail carousel: arrows page the strip viewport; no autoplay,
// no dots. Nav buttons only show when tiles overflow the viewport.
const stripViewportRef = ref<HTMLElement | null>(null)
const stripHasOverflow = ref(false)
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
watch(() => items.value.length, async () => { await nextTick(); updateStripNav() })
// #8 results pagination: 20 rows per page; stats, strip and downloads stay global.
const PAGE_SIZE = 20
const page = ref(1)
const pageCount = computed(() => Math.max(1, Math.ceil(items.value.length / PAGE_SIZE)))
const pagedItems = computed(() => items.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
watch(pageCount, () => { if (page.value > pageCount.value) page.value = pageCount.value })
if (typeof window !== 'undefined') window.addEventListener('resize', updateStripNav)

// Preview click opens the lightbox (same enlarged compare the row thumbs
// open). A divider drag ends in a click too, so clicks right after a drag
// (or on the divider itself) must not open it.
let pvLastDragEnd = 0
function onPvStageClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.pv-divider')) return
  if (Date.now() - pvLastDragEnd < 300) return
  if (previewItem.value) lightboxId.value = previewItem.value.id
}
const pvPos = ref(50)
const pvCompareRef = ref<HTMLElement | null>(null)
const pvCompSrc = computed(() => {
  const it = previewItem.value
  if (!it) return ''
  return it.done && it.outUrl ? it.outUrl : it.url
})
const pvBaseW = computed(() => {
  const it = previewItem.value
  if (!it) return 0
  const w = it.done && it.outUrl && it.outW ? it.outW : it.origW
  return w > 0 ? w : 0
})
const pvCompareStyle = computed(() => {
  if (pvZoom.value === 'fit' || !pvBaseW.value) return {}
  const factor = pvZoom.value === '200' ? 2 : 1
  return { width: `${pvBaseW.value * factor}px` }
})
function pvSetPosFromClientX(clientX: number) {
  const el = pvCompareRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  if (r.width <= 0) return
  pvPos.value = Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100))
}
function onPvDividerDown(e: PointerEvent) {
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  const move = (ev: PointerEvent) => pvSetPosFromClientX(ev.clientX)
  let moved = false
  const move2 = (ev: PointerEvent) => { moved = true; move(ev) }
  const up = () => {
    if (moved) pvLastDragEnd = Date.now()
    window.removeEventListener('pointermove', move2)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move2)
  window.addEventListener('pointerup', up)
}
function onPvDividerKey(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') { pvPos.value = Math.max(0, pvPos.value - 5); e.preventDefault() }
  else if (e.key === 'ArrowRight') { pvPos.value = Math.min(100, pvPos.value + 5); e.preventDefault() }
  else if (e.key === 'Home') { pvPos.value = 0; e.preventDefault() }
  else if (e.key === 'End') { pvPos.value = 100; e.preventDefault() }
}


// One finished image downloads as itself; a zip is only for two or more.
function downloadAll() {
  const done = items.value.filter((i) => i.done && i.outUrl)
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
      // Dropped folders keep their structure inside the zip.
      let name = (item.relDir ? item.relDir + '/' : '') + (item.outName ?? item.file.name)
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
