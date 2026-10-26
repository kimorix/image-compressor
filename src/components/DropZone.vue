<template>
  <div
    id="dropzone"
    tabindex="0"
    role="button"
    :aria-label="t('dropAria')"
    :class="{ dragover }"
    @click="openPicker"
    @keydown.enter="openPicker"
    @keydown.space.prevent="openPicker"
    @dragenter.prevent="dragover = true"
    @dragover.prevent="dragover = true"
    @dragleave.prevent="dragover = false"
    @drop.prevent="onDrop"
  >
    <svg class="drop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4m0 0L8 8m4-4l4 4" /><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
    <strong>{{ t('dropTitle') }}</strong>
    <p>{{ t('dropSub') }}</p>
    <input ref="fileInput" type="file" id="fileInput" accept="image/*,.heic,.heif" multiple hidden @change="onPick" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ t: (key: string, ...args: (string | number)[]) => string }>()
const emit = defineEmits<{ (e: 'files', files: File[]): void }>()

const dragover = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function openPicker() {
  fileInput.value?.click()
}

function onPick() {
  const files = fileInput.value?.files
  if (files && files.length) emit('files', [...files])
  if (fileInput.value) fileInput.value.value = ''
}

function onDrop(e: DragEvent) {
  dragover.value = false
  const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'))
  if (files.length) emit('files', files)
}

void props
</script>
