<template>
  <section class="rw-section">
    <h3 v-if="!bare" class="rw-section-title">{{ t('outTitle') }}</h3>
    <div class="rw-section-body">
      <label class="rw-row">
        <span class="rw-label">{{ t('outFormat') }}</span>
        <select class="rw-input rw-select" :value="o.format" @change="set({ format: ($event.target as HTMLSelectElement).value as OutFormat })">
          <option value="follow">{{ t('fmtFollow') }}</option>
          <option value="image/jpeg">JPG</option>
          <option value="image/png">PNG</option>
          <option value="image/webp">WebP</option>
          <option value="image/avif">AVIF</option>
        </select>
      </label>
      <p v-if="o.format === 'follow'" class="rw-note">{{ t('fmtFollowDesc') }}</p>
      <RwSlider v-if="o.format !== 'image/png'" :label="t('quality')" :model-value="o.quality" :min="1" :max="100" @update:model-value="(v: number) => set({ quality: v })" />
      <label class="rw-row rw-toggle-row">
        <span class="rw-label">{{ t('keepExif') }}</span>
        <input class="rw-switch" type="checkbox" role="switch" :checked="o.keepExif" @change="set({ keepExif: ($event.target as HTMLInputElement).checked })" />
      </label>
      <p class="rw-note">{{ t('keepExifDesc') }}</p>
      <label class="rw-row">
        <span class="rw-label">{{ t('suffix') }}</span>
        <input class="rw-input" type="text" maxlength="60" :value="o.suffix" spellcheck="false" autocomplete="off" @change="onSuffix" />
      </label>
      <p class="rw-note">{{ t('suffixHint') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OutFormat, OutputSettings, RwSettings } from '../types'
import RwSlider from './RwSlider.vue'

const props = defineProps<{ settings: RwSettings; bare?: boolean; t: (key: string, ...a: (string | number)[]) => string }>()
const emit = defineEmits<{ (e: 'update', s: RwSettings): void }>()
const o = computed(() => props.settings.out)
function onSuffix(e: Event) {
  const input = e.target as HTMLInputElement
  input.value = input.value.replace(/[\\/:*?"<>|]/g, '')
  set({ suffix: input.value })
}
function set(patch: Partial<OutputSettings>) {
  emit('update', { ...props.settings, out: { ...o.value, ...patch } })
}
</script>
