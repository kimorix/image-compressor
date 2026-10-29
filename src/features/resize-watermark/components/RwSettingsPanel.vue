<template>
  <!-- Settings: the desktop right column shows all three sections stacked;
  the phone sheet shows one section per tab (bare headers). Emits whole
  settings objects; the view validates, persists and marks results stale. -->
  <div class="rw-settings">
    <ResizeSection v-if="tab === 'all' || tab === 'size'" :settings="settings" :ref-w="refW" :ref-h="refH" :bare="tab !== 'all'" :t="t" @update="up" />
    <hr v-if="tab === 'all'" class="rw-divider" />
    <WatermarkSection
      v-if="tab === 'all' || tab === 'wm'"
      :settings="settings"
      :logo-url="logoUrl"
      :logo-name="logoName"
      :logo-error="logoError"
      :bare="tab !== 'all'"
      :t="t"
      @update="up"
      @logo-file="(f: File) => emit('logo-file', f)"
      @logo-remove="emit('logo-remove')"
    />
    <hr v-if="tab === 'all'" class="rw-divider" />
    <OutputSection v-if="tab === 'all' || tab === 'out'" :settings="settings" :bare="tab !== 'all'" :t="t" @update="up" />
    <button v-if="tab === 'all'" type="button" class="primary rw-process" :disabled="!canProcess" @click="emit('process')">{{ processLabel }}</button>
  </div>
</template>

<script setup lang="ts">
import type { RwSettings } from '../types'
import ResizeSection from './ResizeSection.vue'
import WatermarkSection from './WatermarkSection.vue'
import OutputSection from './OutputSection.vue'

defineProps<{
  settings: RwSettings
  tab: 'all' | 'size' | 'wm' | 'out'
  refW: number
  refH: number
  logoUrl: string | null
  logoName: string | null
  logoError: string | null
  canProcess: boolean
  processLabel: string
  t: (key: string, ...a: (string | number)[]) => string
}>()
const emit = defineEmits<{
  (e: 'update', s: RwSettings): void
  (e: 'logo-file', f: File): void
  (e: 'logo-remove'): void
  (e: 'process'): void
}>()
const up = (s: RwSettings) => emit('update', s)
</script>
