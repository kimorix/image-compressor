<template>
  <section class="rw-section">
    <label v-if="!bare" class="rw-section-head">
      <h3>{{ t('wmTitle') }}</h3>
      <input class="rw-switch" type="checkbox" role="switch" :checked="w.enabled" :aria-label="t('wmTitle')" @change="set({ enabled: checked($event) })" />
    </label>
    <label v-else class="rw-row rw-toggle-row">
      <span class="rw-label">{{ t('addWatermark') }}</span>
      <input class="rw-switch" type="checkbox" role="switch" :checked="w.enabled" @change="set({ enabled: checked($event) })" />
    </label>
    <div class="rw-section-body" :class="{ 'rw-dim': !w.enabled }" :inert="!w.enabled ? true : undefined">
      <div class="rw-seg rw-seg-2" role="radiogroup" :aria-label="t('wmTitle')">
        <button type="button" role="radio" :aria-checked="w.kind === 'text'" :class="{ active: w.kind === 'text' }" @click="set({ kind: 'text' })">{{ t('wmText') }}</button>
        <button type="button" role="radio" :aria-checked="w.kind === 'logo'" :class="{ active: w.kind === 'logo' }" @click="set({ kind: 'logo' })">{{ t('wmImage') }}</button>
      </div>

      <template v-if="w.kind === 'text'">
        <div class="rw-text-row">
          <input class="rw-input" type="text" maxlength="200" :value="w.text" :placeholder="t('wmTextPh')" :aria-label="t('wmText')" @input="set({ text: ($event.target as HTMLInputElement).value })" />
          <select class="rw-input rw-select" :value="w.font" :aria-label="t('wmFont')" @change="set({ font: ($event.target as HTMLSelectElement).value as WmFont })">
            <option v-for="f in FONTS" :key="f" :value="f">{{ t(`font_${f}`) }}</option>
          </select>
        </div>
        <p class="rw-note" :class="{ 'rw-warn': w.enabled && !w.text.trim() }">{{ w.enabled && !w.text.trim() ? t('wmEmpty') : t('wmVarsHint') }}</p>
        <div class="rw-chips">
          <label class="rw-chip"><input type="checkbox" :checked="w.bold" @change="set({ bold: checked($event) })" /><span>{{ t('wmBold') }}</span></label>
          <label class="rw-chip"><input type="checkbox" :checked="w.stroke" @change="set({ stroke: checked($event) })" /><span>{{ t('wmStroke') }}</span></label>
        </div>
      </template>
      <div v-else class="rw-logo">
        <div v-if="logoUrl" class="rw-logo-thumb"><img :src="logoUrl" alt="" /></div>
        <div class="rw-logo-info">
          <span v-if="logoName" class="rw-logo-name" :title="logoName">{{ logoName }}</span>
          <span v-if="logoName" class="rw-note">{{ t('logoKept') }}</span>
          <div class="rw-logo-btns">
            <button type="button" :class="{ primary: !logoName }" @click="pick">{{ logoName ? t('wmReplaceLogo') : t('wmUploadLogo') }}</button>
            <button v-if="logoName" type="button" class="rw-link-btn" @click="emit('logo-remove')">{{ t('wmRemoveLogo') }}</button>
          </div>
          <p v-if="logoError" class="rw-note rw-warn" role="alert">{{ logoError }}</p>
        </div>
        <input ref="fileInput" type="file" :accept="LOGO_ACCEPT" hidden @change="onFile" />
      </div>

      <div class="rw-pos-row">
        <div>
          <span class="rw-label">{{ t('wmPosition') }}</span>
          <PositionGrid :model-value="w.pos" :label="t('wmPosition')" :t="t" @update:model-value="(p: WmPos) => set({ pos: p })" />
          <p v-if="w.pos === 'free'" class="rw-note">{{ t('posFree') }}</p>
        </div>
        <div class="rw-pos-side">
          <template v-if="w.kind === 'text'">
            <span class="rw-label">{{ t('wmColor') }}</span>
            <ColorSwatches :model-value="w.color" :label="t('wmColor')" :custom-label="t('wmCustomColor')" @update:model-value="(c: string) => set({ color: c })" />
          </template>
          <label class="rw-row rw-toggle-row">
            <span class="rw-label">{{ t('wmTile') }}</span>
            <input class="rw-switch" type="checkbox" role="switch" :checked="w.pos === 'tile'" @change="toggleTile" />
          </label>
        </div>
      </div>

      <RwSlider v-if="w.kind === 'text'" :label="t('wmSize')" :model-value="w.size" :min="2" :max="20" :step="0.5" unit="%" @update:model-value="(v: number) => set({ size: v })" />
      <RwSlider v-else :label="t('wmSize')" :model-value="w.logoSize" :min="5" :max="50" unit="%" @update:model-value="(v: number) => set({ logoSize: v })" />
      <RwSlider :label="t('wmOpacity')" :model-value="w.opacity" :min="10" :max="100" unit="%" @update:model-value="(v: number) => set({ opacity: v })" />
      <RwSlider :label="t('wmRotate')" :model-value="w.rotate" :min="-90" :max="90" unit="°" @update:model-value="(v: number) => set({ rotate: v })" />
      <RwSlider v-if="w.pos === 'tile'" :label="t('wmTileGap')" :model-value="w.tileGap" :min="2" :max="40" unit="%" @update:model-value="(v: number) => set({ tileGap: v })" />
      <RwSlider v-else :label="t('wmMargin')" :model-value="w.margin" :min="0" :max="10" :step="0.5" unit="%" @update:model-value="(v: number) => set({ margin: v })" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RwSettings, WatermarkSettings, WmFont, WmPos } from '../types'
import { FONTS } from '../lib/fonts'
import { LOGO_ACCEPT } from '../lib/logo-store'
import PositionGrid from './PositionGrid.vue'
import ColorSwatches from './ColorSwatches.vue'
import RwSlider from './RwSlider.vue'

const props = defineProps<{
  settings: RwSettings
  logoUrl: string | null
  logoName: string | null
  logoError: string | null
  bare?: boolean
  t: (key: string, ...a: (string | number)[]) => string
}>()
const emit = defineEmits<{ (e: 'update', s: RwSettings): void; (e: 'logo-file', f: File): void; (e: 'logo-remove'): void }>()

const w = computed(() => props.settings.wm)
function set(patch: Partial<WatermarkSettings>) {
  emit('update', { ...props.settings, wm: { ...w.value, ...patch } })
}
const checked = (e: Event) => (e.target as HTMLInputElement).checked
function toggleTile(e: Event) {
  if (checked(e)) set({ pos: 'tile', rotate: w.value.rotate === 0 ? -30 : w.value.rotate })
  else set({ pos: 'br', rotate: w.value.rotate === -30 ? 0 : w.value.rotate })
}
const fileInput = ref<HTMLInputElement | null>(null)
function pick() {
  fileInput.value?.click()
}
function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (f) emit('logo-file', f)
}
</script>
