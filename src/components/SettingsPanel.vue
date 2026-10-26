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
        :title="activePreset === p.id ? t('presetCancelTitle') : ''"
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
      <input type="number" id="targetSize" min="10" max="51200" :value="settings.targetSize" @input="onTargetDebounced(($event.target as HTMLInputElement).value)" />
    </div>
    <div class="field" id="qualityField" v-show="settings.mode !== 'target'">
      <label for="quality" class="qlabel"><span>{{ t('qualityLabel') }}</span> <span class="value" id="qualityValue">{{ qualityShown }}%</span></label>
      <input type="range" id="quality" min="10" max="100" :value="qualityShown" :disabled="qualityLocked" @input="onQuality(($event.target as HTMLInputElement).value)" />
    </div>
    <div class="field">
      <label for="maxSize">{{ t('maxLabel') }}</label>
      <input type="number" id="maxSize" min="0" max="20000" :value="settings.maxSize" @input="onMaxDebounced(($event.target as HTMLInputElement).value)" />
      <label class="check"><input type="checkbox" id="noUpscale" :checked="settings.noUpscale" @change="onNoUpscale(($event.target as HTMLInputElement).checked)" /> <span>{{ t('noUpscale') }}</span></label>
    </div>
    <!-- PNG notes live in their own full-width row below the grid, not
    inside a field cell: toggling quantization used to change the quality
    cell's height and push every field below it down mid-interaction. -->
    <div class="settings-note" id="qualityHint" v-show="showPngHint">{{ t('pngHint') }}</div>
    <div class="settings-note" id="quantHint" v-show="showQuantHint">{{ t('pngQuantHint') }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Settings } from '../types'
import { matchPreset, PRESETS } from '../lib/presets'

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
function debounce(patch: Partial<Settings>) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => emit('update', patch, true), 500)
}

function onFormat(v: string) { emit('update', { format: v }, true) }
function onMode(v: string) { emit('update', { mode: v as Settings['mode'] }, true) }
// Number inputs commit through the debounced input handler only. A @change
// handler on top of it would fire again on blur and start a duplicate
// recompress — which can even remove the download button mid-click.
function onTargetDebounced(v: string) { debounce({ targetSize: parseInt(v, 10) || 200 }) }
function onMaxDebounced(v: string) { debounce({ maxSize: parseInt(v, 10) || 0 }) }
function onNoUpscale(v: boolean) { emit('update', { noUpscale: v }, true) }
function onQuantize(v: boolean) { emit('update', { quantize: v }, true) }
function onKeepExif(v: boolean) { emit('update', { keepExif: v }, true) }
</script>
