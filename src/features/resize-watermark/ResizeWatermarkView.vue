<template>
  <AppHeader :sub="r('sub')" :inert="sheetOpen ? true : undefined" @lang="setLang">
    <template #title>{{ r('title') }}</template>
  </AppHeader>
  <div class="layout rw-layout" :inert="sheetOpen ? true : undefined">
    <SideNav :t="t" active="resize" @nav="onNav">
      <div class="side-card">
        <strong>{{ r('tipTitle') }}</strong>
        <p>{{ r('tipDesc') }}</p>
      </div>
    </SideNav>
    <main class="rw-main">
      <div class="card rw-upload" :class="{ compact: items.length > 0 }">
        <div
          class="rw-drop"
          :class="{ dragover }"
          tabindex="0"
          role="button"
          :aria-label="r('dropAria')"
          @click="openPicker"
          @keydown.enter.prevent="openPicker"
          @keydown.space.prevent="openPicker"
          @dragenter.prevent="dragover = true"
          @dragover.prevent="dragover = true"
          @dragleave.prevent="dragover = false"
          @drop.prevent.stop="onZoneDrop"
        >
          <strong>{{ items.length && !isMobile ? r('addMore') : `+ ${isTouch ? r('dropTitleTouch') : r('dropTitle')}` }}</strong>
          <p v-if="!items.length || isMobile">{{ isTouch ? r('dropSubTouch') : r('dropSub') }}</p>
          <input ref="fileInput" type="file" accept="image/*,.heic,.heif,.avif,.webp" multiple hidden @change="onPick" />
        </div>
        <p v-if="hint" class="rw-hint" role="status">{{ hint }}</p>
      </div>

      <!-- Phone: settings summary chips (each opens its settings tab) -->
      <div v-if="isMobile" class="rw-chips-sum">
        <button type="button" class="rw-sum-chip" @click="openSettings('size')">{{ r('chipSize') }} <b>{{ sizeSummary }}</b></button>
        <button type="button" class="rw-sum-chip" @click="openSettings('wm')">{{ r('chipWm') }} <b>{{ wmSummary }}</b></button>
        <button type="button" class="rw-sum-chip" @click="openSettings('out')">{{ r('chipFormat') }} <b>{{ fmtSummary }}</b></button>
      </div>

      <!-- Desktop / tablet: live preview card -->
      <section v-if="!isMobile && items.length" class="card rw-preview-card">
        <div class="rw-preview-head">
          <h3>{{ r('previewTitle') }}<span v-if="current" class="rw-preview-name" :title="current.file.name"> · {{ current.file.name }}</span></h3>
          <div class="rw-preview-tools">
            <div class="rw-seg-pill" role="radiogroup" :aria-label="r('previewTitle')">
              <button type="button" role="radio" :aria-checked="view === 'effect'" :class="{ active: view === 'effect' }" @click="view = 'effect'">{{ r('viewEffect') }}</button>
              <button type="button" role="radio" :aria-checked="view === 'original'" :class="{ active: view === 'original' }" @click="view = 'original'">{{ r('viewOriginal') }}</button>
            </div>
            <template v-if="items.length > 1">
              <button type="button" class="rw-nav-btn" :title="r('prev')" :aria-label="r('prev')" @click="step(-1)">‹</button>
              <span class="rw-pager">{{ currentIndex + 1 }} / {{ items.length }}</span>
              <button type="button" class="rw-nav-btn" :title="r('next')" :aria-label="r('next')" @click="step(1)">›</button>
            </template>
          </div>
        </div>
        <PreviewStage
          :bmp="currentBmp"
          :src-w="current?.w ?? 0"
          :src-h="current?.h ?? 0"
          :settings="settings"
          :focus="current?.focus ?? CENTER"
          :out-type="currentOutType"
          :text="currentText"
          :logo="logoBmp"
          :view="view"
          :context="true"
          :touch="false"
          :max-h="stageMaxH"
          :label="r('previewTitle')"
          :empty-text="current?.status === 'error' ? (current.error ?? '') : r('stProbing')"
          @wm="onWmDrag"
          @focus="onFocusDrag"
        />
        <div class="rw-preview-foot">
          <span class="rw-foot-sum">{{ footLine }}</span>
          <span class="rw-foot-hint">{{ footHint }}</span>
        </div>
      </section>

      <div v-if="items.length" class="card rw-list-card">
        <div class="rw-list-head">
          <h3>{{ r('listTitle') }} <span class="rw-count">{{ r('countImages', items.length) }}</span></h3>
          <div class="rw-list-actions">
            <button type="button" class="rw-link-btn" :class="{ danger: clearConfirm }" @click="onClear">{{ clearConfirm ? r('clearConfirm') : r('clear') }}</button>
            <button type="button" @click="openPicker">{{ r('addMore') }}</button>
            <button type="button" class="primary" :disabled="!doneItems.length || zipping" @click="downloadAll">{{ zipping ? r('zipping') : r('downloadZip') }}</button>
          </div>
        </div>
        <ul class="rw-list">
          <li
            v-for="item in items"
            :key="item.id"
            class="rw-item"
            :class="[`st-${item.status}`, { current: !isMobile && item.id === currentId }]"
            @click="onRowClick(item)"
          >
            <div class="rw-thumb" :class="{ gif: item.format === 'gif' && !item.thumb }">
              <img v-if="item.thumb" :src="item.thumb" alt="" loading="lazy" />
              <span v-else-if="item.format === 'gif'">GIF</span>
              <span v-else class="rw-thumb-wait" aria-hidden="true"></span>
            </div>
            <div class="rw-info">
              <strong class="rw-name" :title="item.file.name">{{ item.file.name }}</strong>
              <div class="rw-meta">
                <span>{{ metaLine(item) }}</span>
                <span class="rw-tags">
                  <span v-if="statusTag(item)" class="rw-tag" :class="statusClass(item)">{{ statusTag(item) }}</span>
                  <span v-for="n in shortNotes(item)" :key="n" class="rw-tag warn">{{ n }}</span>
                </span>
              </div>
              <div v-if="item.status === 'processing' || item.status === 'queued'" class="rw-progress" :class="{ run: item.status === 'processing' }" role="progressbar" :aria-label="statusTag(item)"><span></span></div>
              <p v-if="item.status === 'error' && item.error" class="rw-sub bad">{{ item.error }}</p>
              <p v-else-if="!isMobile && longNotes(item).length" class="rw-sub">{{ longNotes(item).join(' · ') }}</p>
            </div>
            <div class="rw-actions desk" @click.stop>
              <button v-if="item.status === 'done'" type="button" @click="downloadOne(item)">{{ r('download') }}</button>
              <button v-else-if="item.status === 'processing' || item.status === 'queued'" type="button" @click="cancel(item)">{{ r('cancel') }}</button>
              <button v-else-if="item.status === 'error' && item.file" type="button" @click="enqueue([item])">{{ r('retry') }}</button>
              <button v-if="item.status !== 'processing' && item.status !== 'queued'" type="button" class="rw-icon-btn" :title="r('remove')" :aria-label="r('remove')" @click="removeItem(item)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg></button>
            </div>
            <div class="rw-actions mob" @click.stop>
              <button v-if="item.status === 'done'" type="button" class="rw-round accent" :title="r('share')" :aria-label="r('share')" @click="shareOne(item)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" /></svg></button>
              <button v-else-if="item.status === 'processing' || item.status === 'queued'" type="button" class="rw-round" :title="r('cancel')" :aria-label="r('cancel')" @click="cancel(item)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
              <button v-else-if="item.status === 'error'" type="button" class="rw-round text" @click="enqueue([item])">{{ r('retry') }}</button>
              <button v-else type="button" class="rw-round" :title="r('remove')" :aria-label="r('remove')" @click="removeItem(item)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg></button>
            </div>
          </li>
        </ul>
      </div>
    </main>
    <div id="rightPanel" class="rw-right">
      <div v-if="!isMobile" class="card rw-settings-card">
        <RwSettingsPanel
          :settings="settings"
          tab="all"
          :ref-w="current?.w ?? 0"
          :ref-h="current?.h ?? 0"
          :logo-url="logoUrl"
          :logo-name="logoName"
          :logo-error="logoError"
          :can-process="pending.length > 0"
          :process-label="pending.length ? r('processN', pending.length) : items.length ? r('processNone') : r('processN', 0)"
          :t="r"
          @update="onSettings"
          @logo-file="onLogoFile"
          @logo-remove="onLogoRemove"
          @process="processAll"
        />
      </div>
    </div>
  </div>
  <div class="rw-sticky" v-show="items.length > 0" :inert="sheetOpen ? true : undefined">
    <button type="button" class="rw-sticky-set" @click="openSettings('size')">⚙︎ {{ r('settings') }}</button>
    <button type="button" class="primary" :disabled="busyAll || zipping || sharing || (!pending.length && !doneItems.length)" @click="processAndSave">{{ pending.length ? r('processSaveN', pending.length) : zipping ? r('zipping') : r('saveAll') }}</button>
  </div>
  <div class="rw-sticky-spacer" v-show="items.length > 0" aria-hidden="true"></div>
  <TabBar
    :t="t"
    :inert="sheetOpen ? true : undefined"
    :active="settingsOpen ? 'settings' : 'more'"
    :settings-open="settingsOpen"
    :more-open="moreOpen"
    @compress="onNav('compress')"
    @pdf="onPdfTab"
    @settings="toggleSettings"
    @more="moreOpen = !moreOpen"
  />
  <MoreMenu :t="t" :open="moreOpen" :active="'resize'" :menu-inert="sheetOpen" @close="moreOpen = false" @nav="onNav" />
  <div v-if="pageDragging" class="page-drop-hint" aria-hidden="true">{{ r('dropAnywhere') }}</div>
  <BottomSheet
    v-if="settingsOpen && isMobile"
    :title="r('settingsTitle')"
    :close-label="r('close')"
    label-id="rwSettingsTitle"
    sheet-class="settings-sheet rw-settings-sheet"
    overlay-class="settings-overlay"
    @close="settingsOpen = false"
  >
    <div class="rw-tabs" role="tablist">
      <button v-for="tb in TABS" :key="tb.v" type="button" role="tab" :aria-selected="tab === tb.v" :class="{ active: tab === tb.v }" @click="tab = tb.v">{{ r(tb.k) }}</button>
      <button type="button" class="rw-done" @click="settingsOpen = false">{{ r('done') }}</button>
    </div>
    <div class="sheet-body">
      <RwSettingsPanel
        :settings="settings"
        :tab="tab"
        :ref-w="current?.w ?? 0"
        :ref-h="current?.h ?? 0"
        :logo-url="logoUrl"
        :logo-name="logoName"
        :logo-error="logoError"
        :can-process="pending.length > 0"
        :process-label="r('processN', pending.length)"
        :t="r"
        @update="onSettings"
        @logo-file="onLogoFile"
        @logo-remove="onLogoRemove"
        @process="processAll"
      />
    </div>
  </BottomSheet>
  <RwPreviewSheet
    v-if="sheetItem && isMobile"
    :item="sheetItem"
    :index="currentIndex"
    :total="items.length"
    :bmp="currentBmp"
    :logo="logoBmp"
    :settings="settings"
    :out-type="currentOutType"
    :text="currentText"
    :view="view"
    :tag="sheetTag"
    :out-line="outLine(sheetItem)"
    :wm-line="wmLine"
    :notes="longNotes(sheetItem)"
    :busy="sheetItem.status === 'processing' || sheetItem.status === 'queued' || sharing"
    :t="r"
    @close="sheetId = null"
    @prev="step(-1)"
    @next="step(1)"
    @wm="onWmDrag"
    @focus="onFocusDrag"
    @pos="onQuickPos"
    @view="(v) => (view = v)"
    @remove="removeFromSheet"
    @adjust="adjustFromSheet"
    @share="shareFromSheet"
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
import { lastPdfTool, useHashRoute, type NavKey } from '../../shared/composables/useHashRoute'
import { fmtSize } from '../../shared/lib/format'
import { filesFromDrop } from '../../shared/lib/drop'
import { shareFilesOr } from '../../shared/lib/share'
import { downloadUrl, ymd, zipEntries } from '../../shared/lib/zip'
import { getImagePool } from '../../shared/image/image-pool'
import type { Lang } from '../../shared/i18n'
import PreviewStage from './components/PreviewStage.vue'
import RwSettingsPanel from './components/RwSettingsPanel.vue'
import RwPreviewSheet from './components/RwPreviewSheet.vue'
import { rwError, rwT } from './i18n'
import type { Focus, RwItem, RwSettings, WmPos } from './types'
import { loadSettings, normalizeSettings, resolveOutType, saveSettings } from './lib/settings'
import { computeGeometry, effectiveResize } from './lib/geometry'
import { findPreset } from './lib/presets'
import { expandText, textVars } from './lib/watermark'
import { estimateSize, stageLayout } from './lib/preview'
import { loadPreviewImage, type LoadedPreview, type PreviewImage } from './lib/preview-bitmap'
import { clearLogo, loadLogo, prepareLogo, saveLogo } from './lib/logo-store'
import type { RwJobResult, RwPayload } from './lib/rw-job'
import './styles/rw.less'

const { lang, t, setLang: setPrefLang } = usePrefs()
const { navigate } = useHashRoute()
function r(key: string, ...args: (string | number)[]): string {
  return rwT(lang.value, key, ...args)
}
const CENTER: Focus = { x: 0.5, y: 0.5 }
const GROUP = 'resize'
const TABS = [{ v: 'size', k: 'tabSize' }, { v: 'wm', k: 'tabWatermark' }, { v: 'out', k: 'tabOutput' }] as const

// ---- settings ----
const settings = ref<RwSettings>(loadSettings())
// Bumped on every settings change: a result made under an older generation
// comes back as "settings changed" instead of "done".
let gen = 0
let saveTimer: ReturnType<typeof setTimeout> | null = null
function onSettings(s: RwSettings) {
  settings.value = normalizeSettings(s)
  gen++
  markStale(() => true)
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveSettings(settings.value), 250)
}
function markStale(pred: (it: RwItem) => boolean) {
  let changed = false
  for (const it of items.value) {
    if (it.status === 'done' && pred(it)) { it.status = 'stale'; changed = true }
  }
  if (changed) touch()
}

// ---- items ----
const items = shallowRef<RwItem[]>([])
const rev = ref(0)
const touch = () => { rev.value++; triggerRef(items) }
const previews = new Map<string, Blob>()

const isTouch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window)
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 720 : false)
const stageMaxH = ref(560)
function onResize() {
  isMobile.value = window.innerWidth < 720
  stageMaxH.value = Math.max(280, Math.min(640, window.innerHeight - 360))
}

const settingsOpen = ref(false)
const moreOpen = ref(false)
const tab = ref<'size' | 'wm' | 'out'>('size')
const sheetId = ref<string | null>(null)
const sheetItem = computed(() => (void rev.value, items.value.find((i) => i.id === sheetId.value) ?? null))
const sheetOpen = computed(() => isMobile.value && (settingsOpen.value || !!sheetId.value))
watch(sheetOpen, (open) => { document.body.style.overflow = open ? 'hidden' : '' })
watch(moreOpen, (open) => { if (open) settingsOpen.value = false })
watch(isMobile, (m) => { if (!m) { settingsOpen.value = false; sheetId.value = null } })

const hint = ref<string | null>(null)
let hintTimer: ReturnType<typeof setTimeout> | null = null
function showHint(s: string) {
  hint.value = s
  if (hintTimer) clearTimeout(hintTimer)
  hintTimer = setTimeout(() => { hint.value = null }, 3500)
}

const doneItems = computed(() => (void rev.value, items.value.filter((i) => i.status === 'done' && i.outBlob)))
const pending = computed(() => (void rev.value, items.value.filter((i) => i.status === 'ready' || i.status === 'stale' || i.status === 'error')))
const busyAll = computed(() => (void rev.value, items.value.some((i) => i.status === 'processing' || i.status === 'queued')))

// ---- logo state (handlers below) ----
const logoBlob = shallowRef<Blob | null>(null)
const logoName = ref<string | null>(null)
const logoUrl = ref<string | null>(null)
const logoBmp = shallowRef<ImageBitmap | null>(null)
const logoError = ref<string | null>(null)

// ---- current preview ----
const currentId = ref<string | null>(null)
const current = computed(() => (void rev.value, items.value.find((i) => i.id === currentId.value) ?? null))
const currentIndex = computed(() => Math.max(0, items.value.findIndex((i) => i.id === currentId.value)))
const view = ref<'effect' | 'original'>('effect')
const currentBmp = shallowRef<PreviewImage | null>(null)
const bmpCache = new Map<string, LoadedPreview>()
const BMP_CACHE = 4
let bmpToken = 0
async function loadBmp(id: string | null) {
  const token = ++bmpToken
  if (!id) { currentBmp.value = null; return }
  const hit = bmpCache.get(id)
  if (hit) {
    bmpCache.delete(id)
    bmpCache.set(id, hit)
    currentBmp.value = hit.img
    return
  }
  const blob = previews.get(id)
  if (!blob) { currentBmp.value = null; return }
  try {
    const loaded = await loadPreviewImage(blob)
    if (token !== bmpToken) { loaded.close(); return }
    bmpCache.set(id, loaded)
    while (bmpCache.size > BMP_CACHE) {
      const [k, v] = bmpCache.entries().next().value as [string, LoadedPreview]
      if (v.img === currentBmp.value) break
      bmpCache.delete(k)
      v.close()
    }
    currentBmp.value = loaded.img
  } catch (err) {
    console.warn('[resize] preview decode failed', err)
    if (token === bmpToken) currentBmp.value = null
  }
}
watch(currentId, (id) => { void loadBmp(id) })
function step(d: number) {
  const n = items.value.length
  if (!n) return
  const i = (currentIndex.value + d + n) % n
  currentId.value = items.value[i].id
  if (sheetId.value) sheetId.value = currentId.value
}

const currentOutType = computed(() => (void rev.value, resolveOutType(settings.value.out.format, current.value?.format ?? null)))
const currentText = computed(() => {
  void rev.value
  const it = current.value
  const w = settings.value.wm
  if (!it || w.kind !== 'text') return ''
  return expandText(w.text, textVars(it.file, it.date))
})

// Desktop drag of the watermark / framing.
function onWmDrag(p: { x: number; y: number }) {
  onSettings({ ...settings.value, wm: { ...settings.value.wm, pos: 'free', x: p.x, y: p.y } })
}
function onFocusDrag(f: Focus) {
  const it = current.value
  if (!it) return
  it.focus = f
  it.focusRev++
  if (it.status === 'done') it.status = 'stale'
  touch()
}
function onQuickPos(p: WmPos) {
  const w = settings.value.wm
  if (p === 'tile') onSettings({ ...settings.value, wm: { ...w, pos: 'tile', rotate: w.rotate === 0 ? -30 : w.rotate } })
  else if (p === 'free') onSettings({ ...settings.value, wm: { ...w, pos: 'free', rotate: w.pos === 'tile' && w.rotate === -30 ? 0 : w.rotate } })
  else onSettings({ ...settings.value, wm: { ...w, pos: p, rotate: w.pos === 'tile' && w.rotate === -30 ? 0 : w.rotate } })
}

// ---- summaries ----
const FMT_LABEL: Record<string, string> = { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/avif': 'AVIF' }
function methodLabel(it: RwItem | null): string {
  const e = effectiveResize(settings.value.resize)
  if (e.kind === 'none') return r('sumNone')
  if (e.kind === 'long') return r('sumLong', e.long)
  if (e.kind === 'scale') return r('sumPct', Math.round(e.scale * 100))
  if (e.fit === 'cover') return it && (Math.abs(it.focus.x - 0.5) > 0.01 || Math.abs(it.focus.y - 0.5) > 0.01) ? r('sumCoverFocus') : r('sumCover')
  return e.fit === 'pad' ? r('sumPad') : r('sumContain')
}
const sizeSummary = computed(() => {
  const s = settings.value.resize
  if (!s.enabled) return r('off')
  const e = effectiveResize(s)
  if (e.kind === 'box') return `${e.w}×${e.h} ${methodLabel(null)}`
  if (s.mode === 'preset') { const p = findPreset(s.preset); if (p) return r(`preset_${p.id}`) }
  return methodLabel(null)
})
const wmSummary = computed(() => {
  const w = settings.value.wm
  if (!w.enabled) return r('off')
  return w.kind === 'logo' ? (logoName.value ? r('wmKindLogo') : r('wmImage')) : (w.text.trim() || r('wmText'))
})
const fmtSummary = computed(() => (settings.value.out.format === 'follow' ? r('fmtFollow') : FMT_LABEL[settings.value.out.format]))
const wmLine = computed(() => {
  const w = settings.value.wm
  if (!w.enabled) return r('off')
  return `${w.kind === 'logo' ? r('wmKindLogo') : r('wmKindText')} · ${w.opacity}% · ${w.rotate}°`
})
const sheetTag = computed(() => {
  const s = settings.value.resize
  if (!s.enabled) return ''
  if (s.mode === 'preset') { const p = findPreset(s.preset); return p ? r(`preset_${p.id}`) : '' }
  return sizeSummary.value
})

const estBytes = ref<number | null>(null)
let estTimer: ReturnType<typeof setTimeout> | null = null
let estToken = 0
function scheduleEstimate() {
  if (estTimer) clearTimeout(estTimer)
  estTimer = setTimeout(async () => {
    const it = current.value
    const bmp = currentBmp.value
    const token = ++estToken
    if (!it || !bmp || it.status === 'done') { estBytes.value = null; return }
    try {
      const L = stageLayout(it.w, it.h, settings.value, it.focus, 1000, 1000, false)
      const est = await estimateSize(L, { bmp, srcW: it.w, srcH: it.h, settings: settings.value, focus: it.focus, outType: currentOutType.value, text: currentText.value, logo: logoBmp.value, dpr: 1 })
      if (token === estToken) estBytes.value = est
    } catch {
      if (token === estToken) estBytes.value = null
    }
  }, 300)
}
const estKey = computed(() => { void rev.value; const it = current.value; return it ? `${it.id}:${it.status}:${it.focusRev}` : '' })
watch([settings, currentBmp, estKey, logoBmp], () => { if (!isMobile.value) scheduleEstimate() })

function outDims(it: RwItem): { w: number; h: number } {
  if (it.status === 'done' && it.outW) return { w: it.outW, h: it.outH }
  const g = computeGeometry(it.w, it.h, settings.value.resize, it.focus)
  return { w: g.canvas.w, h: g.canvas.h }
}
// Items are mutated in place (shallowRef + rev): computeds that read item
// fields depend on rev, since `current` itself keeps the same object.
const footLine = computed(() => {
  void rev.value
  const it = current.value
  if (!it || !it.w) return ''
  const o = outDims(it)
  const type = it.status === 'done' && it.outBlob ? it.outBlob.type : currentOutType.value
  const size = it.status === 'done' && it.outBlob ? fmtSize(it.outBlob.size) : estBytes.value ? r('estSize', fmtSize(estBytes.value)) : ''
  return [`${it.w}×${it.h} → ${o.w}×${o.h}`, methodLabel(it), `${FMT_LABEL[type] ?? ''} ${size}`.trim()].join(' · ')
})
const footHint = computed(() => {
  void rev.value
  const it = current.value
  if (!it || view.value !== 'effect') return ''
  const cropped = computeGeometry(it.w, it.h, settings.value.resize, it.focus).cropped
  const wm = settings.value.wm.enabled && settings.value.wm.pos !== 'tile'
  return cropped ? r('dragHint') : wm ? r('dragHintWm') : ''
})
function outLine(it: RwItem): string {
  if (!it.w) return ''
  const o = outDims(it)
  const type = it.status === 'done' && it.outBlob ? it.outBlob.type : resolveOutType(settings.value.out.format, it.format)
  const size = it.status === 'done' && it.outBlob ? fmtSize(it.outBlob.size) : ''
  return `${o.w}×${o.h} · ${FMT_LABEL[type] ?? ''}${size ? ` · ${size}` : ''}`
}
function metaLine(it: RwItem): string {
  if (!it.w) return fmtSize(it.file.size)
  const src = `${it.w}×${it.h}`
  const gif = it.gifFrames > 1 ? ` · ${r('frames', it.gifFrames)}` : ''
  if (it.status === 'done' && it.outBlob) {
    return isMobile.value ? `${src} → ${it.outW}×${it.outH} · ${fmtSize(it.outBlob.size)}` : `${src} · ${fmtSize(it.file.size)} → ${it.outW}×${it.outH} · ${fmtSize(it.outBlob.size)}`
  }
  return isMobile.value ? `${src}${gif}` : `${src} · ${fmtSize(it.file.size)}${gif}`
}
function statusTag(it: RwItem): string {
  switch (it.status) {
    case 'probing': return r('stProbing')
    case 'queued': return r('stQueued')
    case 'processing': return r('stProcessing')
    case 'done': return r('stDone')
    case 'stale': return r('stStale')
    case 'error': return r('stFailed')
    default: return ''
  }
}
function statusClass(it: RwItem): string {
  if (it.status === 'done') return 'ok'
  if (it.status === 'error') return 'bad'
  if (it.status === 'stale') return 'warn'
  if (it.status === 'processing' || it.status === 'queued') return 'info'
  return 'mute'
}
function shortNotes(it: RwItem): string[] {
  const out: string[] = []
  if (it.gifFrames > 1) out.push(r('noteGifShort'))
  else if (it.oriented && !isMobile.value) out.push(r('noteOrientedShort'))
  return out
}
function longNotes(it: RwItem): string[] {
  return it.notes.filter((n) => n !== 'noteGifFirstFrame' && n !== 'noteOriented').map((n) => r(n))
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
const IMG_EXT = /\.(jpe?g|jfif|png|gif|webp|avif|heic|heif|bmp|svg|ico|tiff?)$/i
function isImageFile(f: File): boolean {
  return /^image\//.test(f.type) || IMG_EXT.test(f.name)
}
const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`

let seq = 0
function newItem(file: File): RwItem {
  return {
    id: `rw-${Date.now().toString(36)}-${seq++}`,
    file,
    status: 'probing',
    w: 0,
    h: 0,
    format: '',
    thumb: null,
    oriented: false,
    gifFrames: 0,
    date: null,
    focus: { ...CENTER },
    focusRev: 0,
    outBlob: null,
    outUrl: null,
    outName: '',
    outW: 0,
    outH: 0,
    notes: [],
    error: null,
  }
}

function addFiles(files: File[]) {
  const imgs = files.filter(isImageFile)
  const skipped = files.length - imgs.length
  const have = new Set(items.value.map((i) => fileKey(i.file)))
  const fresh = imgs.filter((f) => {
    const k = fileKey(f)
    if (have.has(k)) return false
    have.add(k)
    return true
  })
  if (skipped) showHint(r('notImage', skipped))
  else if (fresh.length < imgs.length) showHint(r('dupSkipped', imgs.length - fresh.length))
  if (!fresh.length) return
  const added = fresh.map(newItem)
  items.value = [...items.value, ...added]
  if (!currentId.value) currentId.value = added[0].id
  for (const it of added) void probe(it)
}

async function probe(item: RwItem) {
  const res = await getImagePool().run<RwJobResult>('resize', { op: 'probe', file: item.file } satisfies RwPayload, { group: `${GROUP}:probe` })
  if (!items.value.includes(item)) return
  if (res.ok && res.result.op === 'probe') {
    const p = res.result.probe
    item.w = p.w
    item.h = p.h
    item.format = p.format ?? ''
    item.oriented = p.orientation > 1
    item.gifFrames = p.gifFrames
    item.date = p.date
    previews.set(item.id, p.preview)
    item.thumb = URL.createObjectURL(p.preview)
    item.status = 'ready'
    if (item.id === currentId.value) void loadBmp(item.id)
  } else if (!res.ok && !res.cancelled) {
    item.status = 'error'
    item.error = rwError(lang.value, res.error)
  }
  touch()
}

// ---- processing ----
function enqueue(list: RwItem[]) {
  for (const it of list) {
    if (it.status === 'probing' || it.status === 'processing' || it.status === 'queued' || !it.w) continue
    it.status = 'queued'
    it.error = null
    void runOne(it)
  }
  touch()
}
function processAll() {
  enqueue(pending.value)
}

async function runOne(item: RwItem) {
  const myGen = gen
  const myFocus = item.focusRev
  const payload: RwPayload = {
    op: 'process',
    file: item.file,
    settings: JSON.parse(JSON.stringify(settings.value)) as RwSettings,
    focus: { ...item.focus },
    logo: settings.value.wm.enabled && settings.value.wm.kind === 'logo' ? logoBlob.value : null,
  }
  const res = await getImagePool().run<RwJobResult>('resize', payload, {
    group: `${GROUP}:${item.id}`,
    onStart: () => { if (item.status === 'queued') { item.status = 'processing'; touch() } },
  })
  if (!items.value.includes(item)) return
  if (res.ok && res.result.op === 'process') {
    const o = res.result.out
    if (item.outUrl) URL.revokeObjectURL(item.outUrl)
    item.outBlob = o.blob
    item.outUrl = URL.createObjectURL(o.blob)
    item.outName = o.name
    item.outW = o.outW
    item.outH = o.outH
    item.notes = o.notes
    item.status = myGen === gen && myFocus === item.focusRev ? 'done' : 'stale'
  } else if (!res.ok) {
    if (res.cancelled) item.status = 'ready'
    else {
      item.status = 'error'
      item.error = rwError(lang.value, res.error)
    }
  }
  touch()
}

function cancel(item: RwItem) {
  getImagePool().cancel(`${GROUP}:${item.id}`)
}

// ---- removing ----
const clearConfirm = ref(false)
let clearTimer: ReturnType<typeof setTimeout> | null = null
function release(item: RwItem) {
  if (item.status === 'processing' || item.status === 'queued') getImagePool().cancel(`${GROUP}:${item.id}`)
  if (item.thumb) URL.revokeObjectURL(item.thumb)
  if (item.outUrl) URL.revokeObjectURL(item.outUrl)
  previews.delete(item.id)
  const b = bmpCache.get(item.id)
  if (b) {
    bmpCache.delete(item.id)
    if (b.img !== currentBmp.value) b.close()
  }
}
function removeItem(item: RwItem) {
  const idx = items.value.indexOf(item)
  release(item)
  items.value = items.value.filter((i) => i !== item)
  if (currentId.value === item.id) {
    const next = items.value[Math.min(idx, items.value.length - 1)]
    currentId.value = next?.id ?? null
  }
  if (sheetId.value === item.id) sheetId.value = null
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
  currentId.value = null
  sheetId.value = null
}

// ---- downloading / sharing ----
const zipping = ref(false)
const sharing = ref(false)
function outFile(it: RwItem): File {
  return new File([it.outBlob!], it.outName, { type: it.outBlob!.type })
}
function downloadOne(it: RwItem) {
  if (it.outBlob) downloadUrl(it.outBlob, it.outName)
}
async function zipAll() {
  const done = doneItems.value
  if (!done.length) return
  if (done.length === 1) { downloadOne(done[0]); return }
  zipping.value = true
  try {
    const blob = await zipEntries(done.map((i) => ({ name: i.outName, blob: i.outBlob! })))
    downloadUrl(blob, `resized-${ymd()}.zip`)
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
    await shareFilesOr(typeof navigator !== 'undefined' ? navigator : undefined, done.map(outFile), zipAll)
  } finally {
    sharing.value = false
  }
}
async function shareOne(it: RwItem) {
  if (!it.outBlob) return
  await shareFilesOr(typeof navigator !== 'undefined' ? navigator : undefined, [outFile(it)], () => downloadOne(it))
}
function waitIdle(list: RwItem[]): Promise<void> {
  return new Promise((resolve) => {
    const stop = watch(rev, () => {
      if (list.every((i) => !items.value.includes(i) || (i.status !== 'queued' && i.status !== 'processing'))) {
        stop()
        resolve()
      }
    })
  })
}
// Phone primary action: process what is pending, then hand everything to
// the share sheet (ZIP when sharing files is not possible).
async function processAndSave() {
  const list = pending.value.slice()
  if (list.length) {
    enqueue(list)
    await waitIdle(list)
  }
  await saveAllMobile()
}

// ---- logo ----
async function useLogo(blob: Blob | null, name: string | null) {
  if (logoUrl.value) URL.revokeObjectURL(logoUrl.value)
  logoBmp.value?.close()
  logoBlob.value = blob
  logoName.value = name
  logoUrl.value = blob ? URL.createObjectURL(blob) : null
  logoBmp.value = blob ? await createImageBitmap(blob) : null
}
async function onLogoFile(f: File) {
  logoError.value = null
  try {
    const l = await prepareLogo(f)
    await useLogo(l.blob, l.name)
    void saveLogo(l)
    if (settings.value.wm.kind !== 'logo' || !settings.value.wm.enabled) onSettings({ ...settings.value, wm: { ...settings.value.wm, kind: 'logo', enabled: true } })
    else { gen++; markStale(() => true) }
  } catch (err) {
    logoError.value = (err as Error)?.message === 'logoTooBig' ? r('logoTooBig') : r('logoBad')
  }
}
function onLogoRemove() {
  void useLogo(null, null)
  void clearLogo()
  if (settings.value.wm.kind === 'logo') { gen++; markStale(() => true) }
}

// ---- phone surfaces ----
function onRowClick(it: RwItem) {
  if (isMobile.value) {
    // Open even while the row is still reading (the sheet shows "Reading…"
    // and draws as soon as the probe lands) or failed (it shows why): a
    // tap that silently did nothing read as "preview doesn't work".
    moreOpen.value = false
    settingsOpen.value = false
    currentId.value = it.id
    sheetId.value = it.id
  } else {
    currentId.value = it.id
  }
}
function openSettings(tb: 'size' | 'wm' | 'out') {
  moreOpen.value = false
  sheetId.value = null
  tab.value = tb
  settingsOpen.value = true
}
function toggleSettings() {
  if (settingsOpen.value) settingsOpen.value = false
  else openSettings(tab.value)
}
function removeFromSheet() {
  const it = sheetItem.value
  sheetId.value = null
  if (it) removeItem(it)
}
function adjustFromSheet() {
  openSettings('wm')
}
async function shareFromSheet() {
  const it = sheetItem.value
  if (!it) return
  if (it.status !== 'done') {
    enqueue([it])
    await waitIdle([it])
  }
  if (it.status === 'done') {
    sharing.value = true
    try { await shareOne(it) } finally { sharing.value = false }
  }
}

// ---- navigation ----
function onNav(key: NavKey) {
  moreOpen.value = false
  settingsOpen.value = false
  sheetId.value = null
  if (key === 'resize') { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
  if (key === 'history') navigate('compress', 'history')
  else navigate(key)
}
function onPdfTab() {
  moreOpen.value = false
  settingsOpen.value = false
  navigate(lastPdfTool())
}
function setLang(l: Lang) {
  setPrefLang(l)
  applyDocMeta()
}
function applyDocMeta() {
  document.title = r('docTitle')
  document.querySelector('meta[name="description"]')?.setAttribute('content', r('metaDesc'))
}
watch(lang, applyDocMeta)

// Page-wide drop while this view is shown.
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
  if (busyAll.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

onMounted(() => {
  applyDocMeta()
  onResize()
  window.addEventListener('beforeunload', onBeforeUnload)
  void loadLogo().then((l) => { if (l && !logoBlob.value) void useLogo(l.blob, l.name).catch(() => {}) })
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
  sheetId.value = null
  pageDragging.value = false
  document.body.style.overflow = ''
})
onUnmounted(() => {
  stopListening()
  window.removeEventListener('beforeunload', onBeforeUnload)
  items.value.forEach(release)
  for (const b of bmpCache.values()) b.close()
  bmpCache.clear()
  logoBmp.value?.close()
  if (logoUrl.value) URL.revokeObjectURL(logoUrl.value)
  if (hintTimer) clearTimeout(hintTimer)
  if (clearTimer) clearTimeout(clearTimer)
  if (saveTimer) { clearTimeout(saveTimer); saveSettings(settings.value) }
  document.body.style.overflow = ''
})
</script>
