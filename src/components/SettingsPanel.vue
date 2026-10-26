<template>
  <div class="settings">
    <div class="field">
      <label for="format">{{ t('fmtLabel') }}</label>
      <select id="format" :value="settings.format" @change="onFormat(($event.target as HTMLSelectElement).value)">
        <option value="original">{{ t('fmtOriginal') }}</option>
        <option value="image/jpeg">{{ t('fmtJpeg') }}</option>
        <option value="image/png">{{ t('fmtPng') }}</option>
        <option value="image/webp">{{ t('fmtWebp') }}</option>
      </select>
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
      <label for="quality"><span>{{ t('qualityLabel') }}</span> <span class="value" id="qualityValue">{{ qualityShown }}%</span></label>
      <input type="range" id="quality" min="10" max="100" :value="qualityShown" :disabled="qualityLocked" @input="onQuality(($event.target as HTMLInputElement).value)" />
      <div class="field-hint" id="qualityHint" v-show="showPngHint">{{ t('pngHint') }}</div>
    </div>
    <div class="field">
      <label for="maxSize">{{ t('maxLabel') }}</label>
      <input type="number" id="maxSize" min="0" max="20000" :value="settings.maxSize" @input="onMaxDebounced(($event.target as HTMLInputElement).value)" />
    </div>
    <div class="field">
      <label><input type="checkbox" id="noUpscale" :checked="settings.noUpscale" @change="onNoUpscale(($event.target as HTMLInputElement).checked)" /> <span>{{ t('noUpscale') }}</span></label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Settings } from '../types'

const props = defineProps<{
  settings: Settings
  t: (key: string, ...args: (string | number)[]) => string
}>()
const emit = defineEmits<{
  (e: 'update', patch: Partial<Settings>, immediate: boolean): void
}>()

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

// PNG is lossless: the quality slider does nothing, so it is locked (not a bug).
const qualityLocked = computed(() => props.settings.format === 'image/png' || props.settings.mode === 'target')
const showPngHint = computed(() => props.settings.format === 'image/png' && props.settings.mode !== 'target')

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
</script>
