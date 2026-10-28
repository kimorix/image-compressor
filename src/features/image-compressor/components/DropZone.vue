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
      <div v-if="!isTouch" class="drop-actions" @click.stop>
        <button type="button" class="primary" @click.stop="openPicker">{{ t('pickBtn') }}</button>
        <button type="button" @click.stop="pasteFromClipboard" @keydown.enter.stop @keydown.space.stop>{{ t('pasteBtn') }}</button>
      </div>
      <div v-if="!isTouch" class="drop-chips" @click.stop>
        <span class="chip">{{ t('chipMulti') }}</span><span class="chip">{{ t('chipMax') }}</span><span class="chip">{{ t('chipPasteKey', comboKey) }}</span>
      </div>
      <p v-if="pasteNote" class="paste-note">{{ pasteNote }}</p>
    </template>
    <strong v-else class="add-more">{{ t('addMore') }}</strong>
    <input ref="fileInput" type="file" id="fileInput" accept="image/*,.heic,.heif" multiple hidden @change="onPick" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { filesFromDrop } from '../../../shared/lib/drop'

const props = defineProps<{
  t: (key: string, ...args: (string | number)[]) => string
  compact: boolean
}>()
const emit = defineEmits<{ (e: 'files', files: File[], dirs?: string[]): void }>()

const dragover = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const pasteNote = ref<string | null>(null)
// Phones have no Ctrl+V: the paste hint swaps to a tap-friendly wording.
const isTouch = typeof window !== 'undefined'
  && (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window)
// Desktop shortcut chip follows the platform (Mac uses Cmd, not Ctrl).
const comboKey = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent) ? 'Cmd+V' : 'Ctrl+V'

// Mock's "paste" button: read image items off the clipboard (same funnel
// as drop/picker, so App.addFiles still filters and caps). Anything else
// — empty clipboard, denied permission — gets one quiet note, not silence.
async function pasteFromClipboard() {
  try {
    if (!navigator.clipboard?.read) throw new Error('unsupported')
    const clipboardItems = await navigator.clipboard.read()
    const files: File[] = []
    for (const ci of clipboardItems) {
      for (const type of ci.types) {
        if (!type.startsWith('image/')) continue
        const blob = await ci.getType(type)
        const ext = type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png'
        files.push(new File([blob], `pasted-${Date.now()}.${ext}`, { type }))
      }
    }
    if (!files.length) {
      pasteNote.value = props.t('pasteEmpty')
      return
    }
    pasteNote.value = null
    emit('files', files)
  } catch {
    pasteNote.value = props.t('pasteEmpty')
  }
}

function openPicker() {
  fileInput.value?.click()
}
defineExpose({ openPicker })

function onPick() {
  const files = fileInput.value?.files
  if (files && files.length) emit('files', [...files])
  if (fileInput.value) fileInput.value.value = ''
}

// Folders are walked recursively; each file keeps its folder path.
async function onDrop(e: DragEvent) {
  dragover.value = false
  const dropped = await filesFromDrop(e.dataTransfer)
  if (dropped.length) emit('files', dropped.map((d) => d.file), dropped.map((d) => d.dir))
}

void props
</script>
