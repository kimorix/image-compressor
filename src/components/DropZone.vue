<template>
  <div
    id="dropzone"
    tabindex="0"
    role="button"
    :aria-label="t('dropAria')"
    :class="{ dragover, compact }"
    @click="openPicker"
    @keydown.enter="openPicker"
    @keydown.space.prevent="openPicker"
    @dragenter.prevent="dragover = true"
    @dragover.prevent="dragover = true"
    @dragleave.prevent="dragover = false"
    @drop.prevent="onDrop"
  >
    <template v-if="!compact">
      <svg class="drop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4m0 0L8 8m4-4l4 4" /><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
      <strong>{{ isTouch ? t('dropTitleTouch') : t('dropTitle') }}</strong>
      <p>{{ isTouch ? t('dropSubTouch') : t('dropSub') }}</p>
      <p class="drop-local">{{ t('dropLocal') }}</p>
    </template>
    <strong v-else class="add-more">{{ t('addMore') }}</strong>
    <input ref="fileInput" type="file" id="fileInput" accept="image/*,.heic,.heif" multiple hidden @change="onPick" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  t: (key: string, ...args: (string | number)[]) => string
  compact: boolean
}>()
const emit = defineEmits<{ (e: 'files', files: File[]): void }>()

const dragover = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
// Phones have no Ctrl+V: the paste hint swaps to a tap-friendly wording.
const isTouch = typeof window !== 'undefined'
  && (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window)

function openPicker() {
  fileInput.value?.click()
}
defineExpose({ openPicker })

function onPick() {
  const files = fileInput.value?.files
  if (files && files.length) emit('files', [...files])
  if (fileInput.value) fileInput.value.value = ''
}

function onDrop(e: DragEvent) {
  dragover.value = false
  // No filtering here: App.addFiles is the single funnel (it also covers
  // paste and the file picker), so a dropped file is never silently lost.
  const files = [...(e.dataTransfer?.files ?? [])]
  if (files.length) emit('files', files)
}

void props
</script>
