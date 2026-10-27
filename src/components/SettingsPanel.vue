<template>
  <div class="settings">
    <div class="presets">
      <span class="presets-label">{{ t('presetLabel') }}</span>
      <button
        v-for="p in PRESETS"
        :key="p.id"
        type="button"
        class="preset-btn"
        :data-preset="p.id"
        :class="{ active: activePreset === p.id }"
        @click="emit('preset', p.id)"
      >{{ t('preset_' + p.id) }}</button>
    </div>
    <div class="field" v-show="settings.mode !== 'smart'">
      <span class="field-label">{{ t('fmtLabel') }}</span>
      <div class="seg" id="formatSeg" role="group" :aria-label="t('fmtLabel')">
        <button v-for="f in FORMATS" :key="f.value" type="button" class="seg-btn" :data-format="f.value" :class="{ active: settings.format === f.value }" @click="onFormat(f.value)">{{ t(f.label) }}</button>
      </div>
    </div>
    <div class="field">
      <span class="field-label">{{ t('modeLabel') }}</span>
      <div class="seg" id="modeSeg" role="group" :aria-label="t('modeLabel')">
        <button type="button" class="seg-btn" data-mode="smart" :class="{ active: settings.mode === 'smart' }" @click="onMode('smart')">{{ t('modeSmart') }}</button>
        <button type="button" class="seg-btn" data-mode="quality" :class="{ active: settings.mode === 'quality' }" @click="onMode('quality')">{{ t('modeQuality') }}</button>
        <button type="button" class="seg-btn" data-mode="target" :class="{ active: settings.mode === 'target' }" @click="onMode('target')">{{ t('modeTarget') }}</button>
      </div>
    </div>
    <div class="field" v-show="settings.mode === 'smart'">
      <label class="check"><input type="checkbox" id="smartKeepOriginal" :checked="settings.smartKeepOriginal" @change="onSmartKeepOriginal(($event.target as HTMLInputElement).checked)" /> <span>{{ t('smartKeepOriginalLabel') }}</span></label>
    </div>
    <div class="field" id="targetField" v-show="settings.mode === 'target'">
      <label for="targetSize">{{ t('targetLabel') }}</label>
      <input type="number" id="targetSize" min="10" max="51200" :value="settings.targetSize" @input="onTargetDebounced(($event.target as HTMLInputElement).value)" @blur="onTargetBlur(($event.target as HTMLInputElement))" />
    </div>
    <div class="field" id="qualityField" v-show="settings.mode === 'quality'">
      <label for="quality" class="qlabel"><span>{{ t('qualityLabel') }}</span> <span class="value" id="qualityValue">{{ qualityShown }}%</span></label>
      <input type="range" id="quality" min="10" max="100" :value="qualityShown" :disabled="qualityLocked" @input="onQuality(($event.target as HTMLInputElement).value)" />
    </div>
    <div class="field">
      <span class="field-label">{{ t('resizeModeLabel') }}</span>
      <div class="seg" id="resizeSeg" role="group" :aria-label="t('resizeModeLabel')">
        <button v-for="r in RESIZES" :key="r.value" type="button" class="seg-btn" :data-resize="r.value" :class="{ active: settings.resizeMode === r.value }" @click="onResizeMode(r.value)">{{ t(r.label) }}</button>
      </div>
    </div>
    <div class="field">
      <label for="maxSize">{{ resizeValueLabel }}</label>
      <input type="number" id="maxSize" :min="settings.resizeMode === 'percent' ? 1 : 0" :max="settings.resizeMode === 'percent' ? 100 : 20000" :value="settings.maxSize" @input="onMaxDebounced(($event.target as HTMLInputElement).value)" />
      <label class="check"><input type="checkbox" id="noUpscale" :checked="settings.noUpscale" @change="onNoUpscale(($event.target as HTMLInputElement).checked)" /> <span>{{ t('noUpscale') }}</span></label>
    </div>
    <!-- Advanced group: the pro options, grouped under one heading instead
    of scattered through the format row. Expanded by default (the settings
    card itself already folds on mobile); the header collapses it. -->
    <div class="adv">
      <button type="button" class="adv-head" :aria-expanded="advOpen" @click="advOpen = !advOpen"><span>{{ t('advLabel') }}</span><span class="adv-caret">{{ advOpen ? '▴' : '▾' }}</span></button>
      <div class="adv-body" v-show="advOpen">
        <label class="check" v-show="settings.mode !== 'smart' && settings.format === 'image/png'"><input type="checkbox" id="quantize" :checked="settings.quantize" @change="onQuantize(($event.target as HTMLInputElement).checked)" /> <span>{{ t('quantizeLabel') }}</span></label>
        <label class="check" v-show="settings.mode !== 'smart' && settings.format === 'image/jpeg'"><input type="checkbox" id="keepExif" :checked="settings.keepExif" @change="onKeepExif(($event.target as HTMLInputElement).checked)" /> <span>{{ t('keepExifLabel') }}</span></label>
        <label class="check" v-show="settings.mode !== 'smart' && settings.format === 'image/jpeg'"><input type="color" id="jpegFill" :value="settings.jpegFill" @change="onJpegFill(($event.target as HTMLInputElement).value)" /> <span>{{ t('jpegFillLabel') }}</span></label>
        <label class="check"><input type="checkbox" id="keepOriginalName" :checked="settings.keepOriginalName" @change="onKeepOriginalName(($event.target as HTMLInputElement).checked)" /> <span>{{ t('keepOriginalNameLabel') }}</span></label>
      </div>
    </div>
    <!-- PNG notes live in their own full-width row below the grid, not
    inside a field cell: toggling quantization used to change the quality
    cell's height and push every field below it down mid-interaction. -->
    <div class="settings-note" id="qualityHint" v-show="showPngHint">{{ t('pngHint') }}</div>
    <div class="settings-note" id="quantHint" v-show="showQuantHint">{{ t('pngQuantHint') }}</div>
    <!-- Footer notes, moved next to the control they describe: JPEG
    transparency and the WebP fallback belong to the format, the target
    mechanism to the mode. The GIF line stays in the footer until the
    per-file GIF tag lands (it describes inputs, not a setting). -->
    <div class="settings-note" id="smartNote" v-show="settings.mode === 'smart'">{{ t('smartNote') }}</div>
    <div class="settings-note" id="jpegNote" v-show="settings.mode !== 'smart' && settings.format === 'image/jpeg'">{{ t('fmtJpegNote') }}</div>
    <div class="settings-note" id="webpNote" v-show="settings.mode !== 'smart' && settings.format === 'image/webp'">{{ t('fmtWebpNote') }}</div>
    <div class="settings-note" id="targetModeNote" v-show="settings.mode === 'target'">{{ t('modeTargetNote') }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Settings } from '../types'
import { DEFAULT_SETTINGS, matchPreset, PRESETS } from '../lib/presets'

const props = defineProps<{
  settings: Settings
  t: (key: string, ...args: (string | number)[]) => string
}>()
const emit = defineEmits<{
  (e: 'update', patch: Partial<Settings>, immediate: boolean): void
  (e: 'preset', id: string): void
}>()

// Segmented option lists: the buttons render from these, so the label keys
// stay the single source of truth (no duplicated option text in markup).
const FORMATS = [
  { value: 'original', label: 'fmtOriginal' },
  { value: 'image/jpeg', label: 'fmtJpeg' },
  { value: 'image/png', label: 'fmtPng' },
  { value: 'image/webp', label: 'fmtWebp' },
  { value: 'image/avif', label: 'fmtAvif' },
]
const RESIZES = [
  { value: 'longest', label: 'resizeLongest' },
  { value: 'width', label: 'resizeWidth' },
  { value: 'height', label: 'resizeHeight' },
  { value: 'percent', label: 'resizePercent' },
]
const advOpen = ref(true)

// Active preset is derived from the settings themselves, so a manual tweak
// that leaves a preset's values automatically clears the highlight.
const activePreset = computed(() => matchPreset(props.settings))

// Resize value label follows the mode: longest keeps the old wording.
const resizeValueLabel = computed(() => {
  switch (props.settings.resizeMode) {
    case 'width': return props.t('resizeWidthLabel')
    case 'height': return props.t('resizeHeightLabel')
    case 'percent': return props.t('resizePercentLabel')
    default: return props.t('maxLabel')
  }
})
// Switching modes resets the value into the new mode's range, so a
// longest-side 1920 does not silently become a 1920% scale (capped to no
// resize by noUpscale) or a 50% becomes a 50px width.
function onResizeMode(v: string) {
  const m = v as Settings['resizeMode']
  const cur = props.settings.resizeMode
  const patch: Partial<Settings> = { resizeMode: m }
  if (m === 'percent' && cur !== 'percent' && props.settings.maxSize > 100) patch.maxSize = 100
  if (m !== 'percent' && cur === 'percent' && props.settings.maxSize <= 100) patch.maxSize = 1920
  emit('update', patch, true)
}

// Quality slider: the % label follows the drag immediately, but the actual
// recompress is debounced 300ms so dragging doesn't recompress every frame.
const qualityShown = ref(props.settings.quality)
watch(() => props.settings.quality, (q) => { qualityShown.value = q })
let qualityTimer: ReturnType<typeof setTimeout> | null = null
function onQuality(v: string) {
  const q = parseInt(v, 10) || 80
  qualityShown.value = q
  if (qualityTimer) clearTimeout(qualityTimer)
  qualityTimer = setTimeout(() => emit('update', { quality: q }, true), 300)
}

// PNG is lossless when quantization is off: the quality slider does nothing,
// so it is locked (not a bug). With quantization on, the slider controls the
// palette quality and is live.
const qualityLocked = computed(() => (props.settings.format === 'image/png' && !props.settings.quantize) || props.settings.mode === 'target')
const showPngHint = computed(() => props.settings.mode !== 'smart' && props.settings.format === 'image/png' && !props.settings.quantize && props.settings.mode !== 'target')
const showQuantHint = computed(() => props.settings.mode !== 'smart' && props.settings.format === 'image/png' && props.settings.quantize && props.settings.mode !== 'target')

let timer: ReturnType<typeof setTimeout> | null = null
// Whether the shared debounce slot currently holds a target patch (vs a
// maxSize patch): the blur handler needs to know whether clearing the
// timer drops a stale target value.
let pendingTarget = false
function debounce(patch: Partial<Settings>) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { timer = null; pendingTarget = false; emit('update', patch, true) }, 500)
}

function onFormat(v: string) { emit('update', { format: v }, true) }
function onMode(v: string) { emit('update', { mode: v as Settings['mode'] }, true) }
function onSmartKeepOriginal(v: boolean) { emit('update', { smartKeepOriginal: v }, true) }
// Number inputs commit through the debounced input handler only. A @change
// handler on top of it would fire again on blur and start a duplicate
// recompress — which can even remove the download button mid-click.
// Empty while editing is not a value: clearing the target field must not
// snap back to 200 mid-typing (parseInt('') is NaN, NaN || 200 is 200).
// The field stays empty until blur, which commits the current content:
// empty refills the default, a number commits immediately (this also
// clears any pending debounced patch, so it cannot land after a preset
// tapped right after blur and clobber the preset's value).
function onTargetDebounced(v: string) {
  if (v.trim() === '') {
    // Clearing must also cancel a pending patch from keystrokes just
    // before the clear: otherwise it fires mid-pause and refills the
    // field with the just-deleted value — the same "refill while the
    // user is still editing" bug the blur rule exists to fix. Only a
    // pending target patch is cancelled; a maxSize patch in the shared
    // slot (pendingTarget false) is left alone.
    if (pendingTarget) { if (timer) clearTimeout(timer); timer = null; pendingTarget = false }
    return
  }
  pendingTarget = true
  debounce({ targetSize: parseInt(v, 10) || 200 })
}
function onTargetBlur(el: HTMLInputElement) {
  const v = el.value.trim()
  if (pendingTarget) { if (timer) clearTimeout(timer); timer = null; pendingTarget = false }
  if (v === '') {
    el.value = String(DEFAULT_SETTINGS.targetSize)
    emit('update', { targetSize: DEFAULT_SETTINGS.targetSize }, true)
  } else {
    emit('update', { targetSize: parseInt(v, 10) || DEFAULT_SETTINGS.targetSize }, true)
  }
}
function onMaxDebounced(v: string) { pendingTarget = false; debounce({ maxSize: parseInt(v, 10) || 0 }) }
function onNoUpscale(v: boolean) { emit('update', { noUpscale: v }, true) }
function onQuantize(v: boolean) { emit('update', { quantize: v }, true) }
function onKeepExif(v: boolean) { emit('update', { keepExif: v }, true) }
// Color picker commits on change (not input): dragging the picker would
// otherwise fire a recompress per input event.
function onJpegFill(v: string) { emit('update', { jpegFill: v }, true) }
function onKeepOriginalName(v: boolean) { emit('update', { keepOriginalName: v }, true) }
</script>
