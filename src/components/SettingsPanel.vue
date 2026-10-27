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
    <div class="field">
      <label for="format">{{ t('fmtLabel') }}</label>
      <select id="format" :value="settings.format" @change="onFormat(($event.target as HTMLSelectElement).value)">
        <option value="original">{{ t('fmtOriginal') }}</option>
        <option value="image/jpeg">{{ t('fmtJpeg') }}</option>
        <option value="image/png">{{ t('fmtPng') }}</option>
        <option value="image/webp">{{ t('fmtWebp') }}</option>
        <option value="image/avif">{{ t('fmtAvif') }}</option>
      </select>
      <label class="check" v-show="settings.format === 'image/png'"><input type="checkbox" id="quantize" :checked="settings.quantize" @change="onQuantize(($event.target as HTMLInputElement).checked)" /> <span>{{ t('quantizeLabel') }}</span></label>
      <label class="check" v-show="settings.format === 'image/jpeg'"><input type="checkbox" id="keepExif" :checked="settings.keepExif" @change="onKeepExif(($event.target as HTMLInputElement).checked)" /> <span>{{ t('keepExifLabel') }}</span></label>
      <label class="check" v-show="settings.format === 'image/jpeg'"><input type="color" id="jpegFill" :value="settings.jpegFill" @change="onJpegFill(($event.target as HTMLInputElement).value)" /> <span>{{ t('jpegFillLabel') }}</span></label>
      <label class="check"><input type="checkbox" id="keepOriginalName" :checked="settings.keepOriginalName" @change="onKeepOriginalName(($event.target as HTMLInputElement).checked)" /> <span>{{ t('keepOriginalNameLabel') }}</span></label>
    </div>
    <div class="field">
      <label for="mode">{{ t('modeLabel') }}</label>
      <select id="mode" :value="settings.mode" @change="onMode(($event.target as HTMLSelectElement).value)">
        <option value="quality">{{ t('modeQuality') }}</option>
        <option value="target">{{ t('modeTarget') }}</option>
      </select>
    </div>
    <div class="field" id="targetField" v-show="settings.mode === 'target'">
      <label for="targetSize">{{ t('targetLabel') }}</label>
      <input type="number" id="targetSize" min="10" max="51200" :value="settings.targetSize" @input="onTargetDebounced(($event.target as HTMLInputElement).value)" @blur="onTargetBlur(($event.target as HTMLInputElement))" />
    </div>
    <div class="field" id="qualityField" v-show="settings.mode !== 'target'">
      <label for="quality" class="qlabel"><span>{{ t('qualityLabel') }}</span> <span class="value" id="qualityValue">{{ qualityShown }}%</span></label>
      <input type="range" id="quality" min="10" max="100" :value="qualityShown" :disabled="qualityLocked" @input="onQuality(($event.target as HTMLInputElement).value)" />
    </div>
    <div class="field">
      <label for="resizeMode">{{ t('resizeModeLabel') }}</label>
      <select id="resizeMode" :value="settings.resizeMode" @change="onResizeMode(($event.target as HTMLSelectElement).value)">
        <option value="longest">{{ t('resizeLongest') }}</option>
        <option value="width">{{ t('resizeWidth') }}</option>
        <option value="height">{{ t('resizeHeight') }}</option>
        <option value="percent">{{ t('resizePercent') }}</option>
      </select>
    </div>
    <div class="field">
      <label for="maxSize">{{ resizeValueLabel }}</label>
      <input type="number" id="maxSize" :min="settings.resizeMode === 'percent' ? 1 : 0" :max="settings.resizeMode === 'percent' ? 100 : 20000" :value="settings.maxSize" @input="onMaxDebounced(($event.target as HTMLInputElement).value)" />
      <label class="check"><input type="checkbox" id="noUpscale" :checked="settings.noUpscale" @change="onNoUpscale(($event.target as HTMLInputElement).checked)" /> <span>{{ t('noUpscale') }}</span></label>
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
    <div class="settings-note" id="jpegNote" v-show="settings.format === 'image/jpeg'">{{ t('fmtJpegNote') }}</div>
    <div class="settings-note" id="webpNote" v-show="settings.format === 'image/webp'">{{ t('fmtWebpNote') }}</div>
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
const showPngHint = computed(() => props.settings.format === 'image/png' && !props.settings.quantize && props.settings.mode !== 'target')
const showQuantHint = computed(() => props.settings.format === 'image/png' && props.settings.quantize && props.settings.mode !== 'target')

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
