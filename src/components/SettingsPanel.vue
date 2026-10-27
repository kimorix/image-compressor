<template>
  <div class="settings">
    <!-- Four rows: scene, format, compression, size. Picking a scene fills
    the rows below; touching any row afterwards falls back to "Custom" on
    its own, because the active scene is derived from the settings. -->
    <div class="srow">
      <label class="srow-label" for="presetSelect">{{ t('presetLabel') }}</label>
      <div class="srow-ctl">
        <select id="presetSelect" :value="activePreset ?? ''" @change="onPresetSelect(($event.target as HTMLSelectElement).value)">
          <option value="">{{ t('presetNone') }}</option>
          <option v-for="p in PRESETS" :key="p.id" :value="p.id">{{ t('preset_' + p.id) }}</option>
        </select>
      </div>
    </div>

    <div class="srow">
      <label class="srow-label" for="formatSelect">{{ t('fmtLabel') }}</label>
      <div class="srow-ctl">
        <select id="formatSelect" :value="settings.format" @change="onFormat(($event.target as HTMLSelectElement).value)">
          <option v-for="f in FORMATS" :key="f.value" :value="f.value">{{ t(f.label) }}</option>
        </select>
      </div>
    </div>

    <div class="srow">
      <span class="srow-label">{{ t('compressLabel') }}</span>
      <div class="srow-ctl">
        <div class="seg" id="modeSeg" role="group" :aria-label="t('compressLabel')">
          <button v-for="m in MODES" :key="m.value" type="button" class="seg-btn" :data-mode="m.value" :class="{ active: settings.mode === m.value }" @click="onMode(m.value)">{{ t(m.label) }}</button>
        </div>
        <!-- The mode's own parameter sits right under its buttons, never on
        a row of its own. v-show, never v-if: hidden controls keep their
        values (and DOM) across toggles. -->
        <div v-show="settings.mode === 'quality'" class="inline-param" id="qualityField">
          <input type="range" id="quality" min="10" max="100" :value="qualityShown" :disabled="qualityLocked" :aria-label="t('qualityLabel')" @input="onQuality(($event.target as HTMLInputElement).value)" />
          <span class="value" id="qualityValue">{{ qualityShown }}%</span>
        </div>
        <div v-show="settings.mode === 'target'" class="inline-param" id="targetField">
          <input type="number" id="targetSize" inputmode="numeric" min="10" max="51200" :value="settings.targetSize" :aria-label="t('targetLabel')" @input="onTargetDebounced(($event.target as HTMLInputElement).value)" @blur="onTargetBlur(($event.target as HTMLInputElement))" />
          <span class="unit">KB</span>
          <button v-for="k in TARGET_CHIPS" :key="k" type="button" class="chip-btn" :class="{ active: settings.targetSize === k }" @click="onTargetChip(k)">{{ k }}</button>
        </div>
      </div>
    </div>

    <div class="srow">
      <label class="srow-label" for="sizeSelect">{{ t('sizeLabel') }}</label>
      <div class="srow-ctl">
        <select id="sizeSelect" :value="sizeChoice" @change="onSizeSelect(($event.target as HTMLSelectElement).value)">
          <option value="0">{{ t('sizeNone') }}</option>
          <option v-for="n in SIZE_STEPS" :key="n" :value="String(n)">{{ t('sizeLongest', n) }}</option>
          <option v-for="z in ID_SIZES" :key="z.id" :value="z.id">{{ t('size_' + z.id, z.w, z.h) }}</option>
          <option value="custom">{{ t('sizeCustom') }}</option>
        </select>
        <div v-show="sizeChoice === 'custom'" class="inline-param wrap" id="customSize">
          <div class="seg" id="resizeSeg" role="group" :aria-label="t('resizeModeLabel')">
            <button v-for="r in RESIZES" :key="r.value" type="button" class="seg-btn" :data-resize="r.value" :class="{ active: settings.resizeMode === r.value }" @click="onResizeMode(r.value)">{{ t(r.label) }}</button>
          </div>
          <div class="inline-param">
            <input type="number" id="maxSize" inputmode="numeric" :min="settings.resizeMode === 'percent' ? 1 : 0" :max="settings.resizeMode === 'percent' ? 100 : 20000" :value="settings.maxSize" :aria-label="resizeValueLabel" @input="onMaxDebounced(($event.target as HTMLInputElement).value)" />
            <span class="unit" v-show="settings.resizeMode === 'exact'">×</span>
              <input v-show="settings.resizeMode === 'exact'" type="number" id="maxHeight" inputmode="numeric" min="1" max="20000" :value="settings.maxHeight" :aria-label="t('resizeHeightLabel')" @input="onMaxHeightDebounced(($event.target as HTMLInputElement).value)" />
            <span class="unit">{{ settings.resizeMode === 'percent' ? '%' : 'px' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- One contextual line at most, instead of a stack of notes: per-image
    caveats (JPEG transparency, GIF first frame, WebP fallback) already
    show on the rows and in the preview. -->
    <div class="settings-note" id="settingsNote" v-if="note">{{ note }}</div>

    <div class="adv">
      <button type="button" class="adv-head" :aria-expanded="advOpen" @click="advOpen = !advOpen"><span>{{ t('advLabel') }}</span><span class="adv-caret">{{ advOpen ? '▴' : '▾' }}</span></button>
      <div class="adv-body" v-show="advOpen">
        <label class="check" v-show="showQuantize"><input type="checkbox" id="quantize" :checked="settings.quantize" @change="onQuantize(($event.target as HTMLInputElement).checked)" /> <span>{{ t('quantizeLabel') }}</span></label>
        <label class="check" v-show="showJpegOpts"><input type="checkbox" id="keepExif" :checked="settings.keepExif" @change="onKeepExif(($event.target as HTMLInputElement).checked)" /> <span>{{ t('keepExifLabel') }}</span></label>
        <label class="check" v-show="settings.format === 'image/jpeg'"><input type="color" id="jpegFill" :value="settings.jpegFill" @change="onJpegFill(($event.target as HTMLInputElement).value)" /> <span>{{ t('jpegFillLabel') }}</span></label>
        <label class="check" v-show="settings.resizeMode !== 'exact'"><input type="checkbox" id="noUpscale" :checked="settings.noUpscale" @change="onNoUpscale(($event.target as HTMLInputElement).checked)" /> <span>{{ t('noUpscale') }}</span></label>
        <label class="check"><input type="checkbox" id="keepOriginalName" :checked="settings.keepOriginalName" @change="onKeepOriginalName(($event.target as HTMLInputElement).checked)" /> <span>{{ t('keepOriginalNameLabel') }}</span></label>
      </div>
    </div>
    <button type="button" class="primary start-btn" @click="emit('start')">{{ t('compressStart') }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Settings } from '../types'
import { DEFAULT_SETTINGS, ID_SIZES, matchPreset, PRESETS } from '../lib/presets'

const props = defineProps<{
  settings: Settings
  t: (key: string, ...args: (string | number)[]) => string
}>()
const emit = defineEmits<{
  (e: 'update', patch: Partial<Settings>, immediate: boolean): void
  (e: 'preset', id: string): void
  (e: 'start'): void
}>()

// Option lists: the controls render from these, so the label keys stay the
// single source of truth (no duplicated option text in markup).
const FORMATS = [
  { value: 'auto', label: 'fmtAuto' },
  { value: 'original', label: 'fmtOriginal' },
  { value: 'image/jpeg', label: 'fmtJpeg' },
  { value: 'image/png', label: 'fmtPng' },
  { value: 'image/webp', label: 'fmtWebp' },
  { value: 'image/avif', label: 'fmtAvif' },
]
const MODES: { value: Settings['mode']; label: string }[] = [
  { value: 'auto', label: 'modeAuto' },
  { value: 'quality', label: 'modeQualityShort' },
  { value: 'target', label: 'modeTargetShort' },
]
const RESIZES = [
  { value: 'longest', label: 'resizeLongest' },
  { value: 'width', label: 'resizeWidth' },
  { value: 'height', label: 'resizeHeight' },
  { value: 'percent', label: 'resizePercent' },
  { value: 'exact', label: 'resizeExact' },
]
const SIZE_STEPS = [2560, 1920, 1280]
const TARGET_CHIPS = [200, 500, 1000]
// Collapsed by default: smart format + smart quality needs none of these.
const advOpen = ref(false)

const activePreset = computed(() => matchPreset(props.settings))
// Picking a scene applies it; picking "Custom" while a scene is active
// hands back to the app's toggle-off (restores the pre-scene settings).
function onPresetSelect(id: string) {
  customSize.value = false
  if (id) emit('preset', id)
  else if (activePreset.value) emit('preset', activePreset.value)
}

// Size dropdown: common longest-side values and the ID photo sizes are
// one pick; anything else is "custom", which also sticks while the user
// is mid-edit on a value that happens to match a listed one.
const customSize = ref(false)
const sizeChoice = computed(() => {
  const s = props.settings
  if (customSize.value) return 'custom'
  if (s.resizeMode === 'exact') {
    const z = ID_SIZES.find((x) => x.w === s.maxSize && x.h === s.maxHeight)
    return z ? z.id : 'custom'
  }
  if (s.resizeMode !== 'longest') return 'custom'
  if (s.maxSize === 0) return '0'
  return SIZE_STEPS.includes(s.maxSize) ? String(s.maxSize) : 'custom'
})
function onSizeSelect(v: string) {
  if (v === 'custom') { customSize.value = true; return }
  customSize.value = false
  const z = ID_SIZES.find((x) => x.id === v)
  if (z) emit('update', { resizeMode: 'exact', maxSize: z.w, maxHeight: z.h }, true)
  else emit('update', { resizeMode: 'longest', maxSize: parseInt(v, 10) }, true)
}

const resizeValueLabel = computed(() => {
  switch (props.settings.resizeMode) {
    case 'width': case 'exact': return props.t('resizeWidthLabel')
    case 'height': return props.t('resizeHeightLabel')
    case 'percent': return props.t('resizePercentLabel')
    default: return props.t('maxLabel')
  }
})
// Switching resize modes resets the value into the new mode's range, so a
// longest-side 1920 does not silently become a 1920% scale or a 50% a
// 50px width.
function onResizeMode(v: string) {
  const m = v as Settings['resizeMode']
  const s = props.settings
  const patch: Partial<Settings> = { resizeMode: m }
  if (m === 'percent' && s.resizeMode !== 'percent' && s.maxSize > 100) patch.maxSize = 100
  if (m !== 'percent' && s.resizeMode === 'percent' && s.maxSize <= 100) patch.maxSize = 1920
  if (m === 'exact' && !s.maxHeight) { patch.maxSize = ID_SIZES[0].w; patch.maxHeight = ID_SIZES[0].h }
  emit('update', patch, true)
}

// Quality slider: the % label follows the drag immediately, the recompress
// is debounced 300ms so dragging does not recompress every frame.
const qualityShown = ref(props.settings.quality)
watch(() => props.settings.quality, (q) => { qualityShown.value = q })
let qualityTimer: ReturnType<typeof setTimeout> | null = null
function onQuality(v: string) {
  const q = parseInt(v, 10) || 80
  qualityShown.value = q
  if (qualityTimer) clearTimeout(qualityTimer)
  qualityTimer = setTimeout(() => emit('update', { quality: q }, true), 300)
}

const isPng = computed(() => props.settings.format === 'image/png')
// Lossless PNG ignores quality, so the slider locks (not a bug).
const qualityLocked = computed(() => isPng.value && !props.settings.quantize)
// Quantize matters only where PNG comes out by choice: explicit PNG or
// keep-original (smart format always quantizes the graphics it picks).
const showQuantize = computed(() => isPng.value || props.settings.format === 'original')
const showJpegOpts = computed(() => props.settings.format === 'image/jpeg' || props.settings.format === 'original')

const note = computed(() => {
  const s = props.settings
  if (s.format === 'image/avif') return props.t('avifNote')
  if (s.mode === 'quality' && qualityLocked.value) return props.t('pngHint')
  if (s.mode === 'target') return props.t('modeTargetNote')
  if (s.format === 'auto' && s.mode === 'auto') return props.t('autoNote')
  if (s.mode === 'auto') return props.t('autoQualityNote')
  return ''
})

let timer: ReturnType<typeof setTimeout> | null = null
// Whether the shared debounce slot holds a target patch (vs a size patch):
// the blur handler needs to know whether clearing it drops a stale target.
let pendingTarget = false
function debounce(patch: Partial<Settings>) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { timer = null; pendingTarget = false; emit('update', patch, true) }, 500)
}
function cancelPendingTarget() {
  if (pendingTarget) { if (timer) clearTimeout(timer); timer = null; pendingTarget = false }
}

function onFormat(v: string) { emit('update', { format: v }, true) }
function onMode(v: Settings['mode']) { emit('update', { mode: v }, true) }
// Number inputs commit through the debounced input handler only (a @change
// on top would fire again on blur and start a duplicate run). Clearing
// the target field is not a value: it stays empty until blur.
function onTargetDebounced(v: string) {
  if (v.trim() === '') { cancelPendingTarget(); return }
  pendingTarget = true
  debounce({ targetSize: parseInt(v, 10) || 200 })
}
function onTargetBlur(el: HTMLInputElement) {
  const v = el.value.trim()
  cancelPendingTarget()
  if (v === '') {
    el.value = String(DEFAULT_SETTINGS.targetSize)
    emit('update', { targetSize: DEFAULT_SETTINGS.targetSize }, true)
  } else {
    emit('update', { targetSize: parseInt(v, 10) || DEFAULT_SETTINGS.targetSize }, true)
  }
}
function onTargetChip(k: number) {
  cancelPendingTarget()
  emit('update', { targetSize: k }, true)
}
function onMaxDebounced(v: string) { pendingTarget = false; debounce({ maxSize: parseInt(v, 10) || 0 }) }
function onMaxHeightDebounced(v: string) { pendingTarget = false; debounce({ maxHeight: parseInt(v, 10) || 0 }) }
function onNoUpscale(v: boolean) { emit('update', { noUpscale: v }, true) }
function onQuantize(v: boolean) { emit('update', { quantize: v }, true) }
function onKeepExif(v: boolean) { emit('update', { keepExif: v }, true) }
// Color picker commits on change (not input): dragging the picker would
// otherwise fire a recompress per input event.
function onJpegFill(v: string) { emit('update', { jpegFill: v }, true) }
function onKeepOriginalName(v: boolean) { emit('update', { keepOriginalName: v }, true) }
</script>
