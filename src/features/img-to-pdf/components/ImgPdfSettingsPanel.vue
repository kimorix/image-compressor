
<template>
  <!-- PDF settings: the desktop right-panel card and the phone settings
  sheet render this same form. Whole-object updates go up; the view
  persists them. The file name is per document and not persisted. -->
  <div class="i2p-settings">
    <div class="i2p-field">
      <span class="i2p-label" :id="`${uid}-out`">{{ p('outLabel') }}</span>
      <SegmentedControl class="i2p-seg" variant="chips" :aria-label="p('outLabel')" :model-value="settings.output" :options="outOpts" @update:model-value="(v) => set({ output: v })" />
    </div>
    <div class="i2p-field">
      <span class="i2p-label">{{ p('paperLabel') }}</span>
      <SegmentedControl class="i2p-seg" variant="chips" :aria-label="p('paperLabel')" :model-value="settings.paper" :options="paperOpts" @update:model-value="(v) => set({ paper: v })" />
    </div>
    <div class="i2p-field" :class="{ 'i2p-dim': settings.paper === 'fit' }">
      <span class="i2p-label">{{ p('orientLabel') }}</span>
      <SegmentedControl class="i2p-seg" variant="chips" :aria-label="p('orientLabel')" :model-value="settings.orientation" :options="orientOpts" @update:model-value="(v) => set({ orientation: v })" />
    </div>
    <div class="i2p-field">
      <span class="i2p-label">{{ p('marginLabel') }}</span>
      <SegmentedControl class="i2p-seg i2p-seg4" variant="chips" :aria-label="p('marginLabel')" :model-value="settings.margin" :options="marginOpts" @update:model-value="(v) => set({ margin: v })" />
    </div>
    <div class="i2p-field">
      <span class="i2p-label">{{ p('qualityLabel') }}</span>
      <SegmentedControl class="i2p-seg" variant="chips" :aria-label="p('qualityLabel')" :model-value="settings.quality" :options="qualityOpts" @update:model-value="(v) => emit('update', withQuality(settings, v))" />
      <div v-if="settings.quality !== 'original'" class="i2p-adv">
        <label class="i2p-q">
          <span>{{ p('qualityValue', settings.jpegQuality) }}</span>
          <input type="range" min="30" max="95" step="1" :value="settings.jpegQuality" :aria-label="p('qualityAria')" @input="set({ jpegQuality: +($event.target as HTMLInputElement).value })" />
        </label>
        <label class="i2p-edge">
          <span>{{ p('longEdge', '') }}</span>
          <input class="i2p-input i2p-num" type="number" inputmode="numeric" :min="EDGE_MIN" :max="EDGE_MAX" step="100" :value="settings.maxEdge" :aria-label="p('edgeAria')" @change="onEdge" />
        </label>
      </div>
      <p class="i2p-note">{{ settings.quality === 'original' ? p('qualityHintOriginal') : p('qualityHint') }}</p>
    </div>
    <label class="i2p-name-row">
      <span class="i2p-label">{{ p('fileNameLabel') }}</span>
      <span class="i2p-name">
        <input
          class="i2p-input"
          type="text"
          autocomplete="off"
          spellcheck="false"
          maxlength="200"
          :value="fileName"
          :placeholder="placeholder"
          @input="emit('update:fileName', ($event.target as HTMLInputElement).value)"
        />
        <span class="i2p-ext" aria-hidden="true">{{ settings.output === 'perImage' && count > 1 ? '.zip' : '.pdf' }}</span>
      </span>
    </label>
    <div class="i2p-estimate" aria-live="polite">
      <span>{{ p('estimate') }}</span>
      <strong>{{ estimateText }}</strong>
    </div>
    <div v-if="busy" class="i2p-progress-wrap">
      <div class="i2p-progress" role="progressbar" :aria-valuenow="progress.done" aria-valuemin="0" :aria-valuemax="progress.total">
        <span :style="{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }"></span>
      </div>
      <div class="i2p-progress-row">
        <span>{{ p('generating', Math.min(progress.done + 1, progress.total), progress.total) }}</span>
        <button type="button" class="i2p-link" @click="emit('cancel')">{{ p('cancel') }}</button>
      </div>
    </div>
    <button v-else type="button" class="primary i2p-generate" :disabled="!count" @click="emit('generate')" @pointerenter="emit('warm')" @focus="emit('warm')">
      {{ settings.output === 'perImage' && count > 1 ? p('generateMany', count) : p('generate', count) }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SegmentedControl from '../../../shared/components/SegmentedControl.vue'
import type { Img2PdfSettings, Margin, Orientation, OutputMode, Paper, Quality } from '../types'
import { EDGE_MAX, EDGE_MIN, withQuality } from '../lib/settings'

const props = defineProps<{
  settings: Img2PdfSettings
  fileName: string
  placeholder: string
  estimateText: string
  count: number
  busy: boolean
  progress: { done: number; total: number }
  p: (key: string, ...args: (string | number)[]) => string
}>()
const emit = defineEmits<{
  (e: 'update', s: Img2PdfSettings): void
  (e: 'update:fileName', v: string): void
  (e: 'generate'): void
  (e: 'cancel'): void
  (e: 'warm'): void
}>()

const uid = `i2p-${Math.random().toString(36).slice(2, 7)}`
const p = (k: string, ...a: (string | number)[]) => props.p(k, ...a)
const outOpts = computed(() => [
  { value: 'single' as OutputMode, label: p('outSingle') },
  { value: 'perImage' as OutputMode, label: p('outPerImage') },
])
const paperOpts = computed(() => [
  { value: 'a4' as Paper, label: p('paperA4') },
  { value: 'letter' as Paper, label: p('paperLetter') },
  { value: 'fit' as Paper, label: p('paperFit') },
])
const orientOpts = computed(() => [
  { value: 'auto' as Orientation, label: p('orientAuto'), disabled: props.settings.paper === 'fit' },
  { value: 'portrait' as Orientation, label: p('orientPortrait'), disabled: props.settings.paper === 'fit' },
  { value: 'landscape' as Orientation, label: p('orientLandscape'), disabled: props.settings.paper === 'fit' },
])
const marginOpts = computed(() => [
  { value: 'none' as Margin, label: p('marginNone') },
  { value: 'small' as Margin, label: p('marginSmall') },
  { value: 'medium' as Margin, label: p('marginMedium') },
  { value: 'large' as Margin, label: p('marginLarge') },
])
const qualityOpts = computed(() => [
  { value: 'original' as Quality, label: p('qOriginal') },
  { value: 'balanced' as Quality, label: p('qBalanced') },
  { value: 'small' as Quality, label: p('qSmall') },
])

function set(patch: Partial<Img2PdfSettings>) {
  emit('update', { ...props.settings, ...patch })
}
function onEdge(e: Event) {
  const el = e.target as HTMLInputElement
  const n = Math.round(Number(el.value))
  const v = Number.isFinite(n) && n > 0 ? Math.min(EDGE_MAX, Math.max(EDGE_MIN, n)) : props.settings.maxEdge
  el.value = String(v)
  set({ maxEdge: v })
}
</script>
