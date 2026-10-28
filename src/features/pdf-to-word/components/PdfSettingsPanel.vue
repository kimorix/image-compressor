<template>
  <!-- Conversion settings: shared by the desktop right-panel card and the
  phone settings sheet. Emits whole-object updates; the view persists. -->
  <div class="pdf-settings">
    <div class="pdf-field">
      <span class="pdf-label" id="pdfModeLabel">{{ p('modeLabel') }}</span>
      <div class="pdf-seg" role="radiogroup" aria-labelledby="pdfModeLabel">
        <button type="button" role="radio" :aria-checked="settings.mode === 'editable'" :class="{ active: settings.mode === 'editable' }" @click="set({ mode: 'editable' })">{{ p('modeEditable') }}</button>
        <button type="button" role="radio" :aria-checked="settings.mode === 'layout'" :class="{ active: settings.mode === 'layout' }" @click="set({ mode: 'layout' })">{{ p('modeLayout') }}</button>
      </div>
      <p class="pdf-note">{{ settings.mode === 'editable' ? p('modeEditableDesc') : p('modeLayoutDesc') }}</p>
    </div>
    <label class="pdf-row">
      <span class="pdf-label">{{ p('rangeLabel') }}</span>
      <input
        class="pdf-input"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        :value="settings.pageRange"
        :placeholder="p('rangePh')"
        :aria-invalid="rangeBad ? 'true' : undefined"
        @input="set({ pageRange: ($event.target as HTMLInputElement).value })"
      />
    </label>
    <p v-if="rangeBad" class="pdf-note pdf-warn" role="alert">{{ p('rangeBad') }}</p>
    <label class="pdf-row pdf-toggle-row">
      <span class="pdf-label">{{ p('keepImages') }}</span>
      <input class="pdf-switch" type="checkbox" role="switch" :checked="settings.keepImages" @change="set({ keepImages: ($event.target as HTMLInputElement).checked })" />
    </label>
    <label class="pdf-row pdf-toggle-row">
      <span class="pdf-label">{{ p('ocrLabel') }}</span>
      <input class="pdf-switch" type="checkbox" role="switch" :checked="settings.ocr" @change="set({ ocr: ($event.target as HTMLInputElement).checked })" />
    </label>
    <label class="pdf-row" :class="{ 'pdf-dim': !settings.ocr }">
      <span class="pdf-label">{{ p('ocrLang') }}</span>
      <select class="pdf-input" :value="settings.ocrLang" :disabled="!settings.ocr" @change="set({ ocrLang: ($event.target as HTMLSelectElement).value as OcrLang, ocrLangPicked: true })">
        <option v-for="l in OCR_LANGS" :key="l" :value="l">{{ p(`lang_${l}`) }}</option>
      </select>
    </label>
    <p class="pdf-note">{{ p('ocrSize', ocrDownloadMB(settings.ocrLang)) }}</p>
    <button type="button" class="primary pdf-start" :disabled="!canStart || rangeBad" @click="emit('start')">{{ p('start') }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OcrLang, PdfSettings } from '../types'
import { isValidRangeSyntax } from '../lib/page-range'
import { OCR_LANGS, ocrDownloadMB } from '../lib/settings'

const props = defineProps<{
  settings: PdfSettings
  canStart: boolean
  p: (key: string, ...args: (string | number)[]) => string
}>()
const emit = defineEmits<{ (e: 'update', s: PdfSettings): void; (e: 'start'): void }>()

const rangeBad = computed(() => !isValidRangeSyntax(props.settings.pageRange))
function set(patch: Partial<PdfSettings>) {
  emit('update', { ...props.settings, ...patch })
}
</script>
