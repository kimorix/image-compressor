<template>
  <!-- Dark multi-select bar: shows while pages are selected. Compact (phone)
  shows icon buttons only; the count stays on the left. -->
  <div class="pm-selbar" :class="{ compact }" role="toolbar" :aria-label="m('selectedN', count)">
    <span class="pm-selbar-count" aria-live="polite">{{ m('selectedN', count) }}</span>
    <div class="pm-selbar-actions">
      <button type="button" :title="m('rotateLeft')" :aria-label="m('rotateLeft')" @click="emit('rotate', -90)"><Icon name="rotateL" /><span v-if="!compact">{{ m('rotateLeft') }}</span></button>
      <button type="button" :title="m('rotateRight')" :aria-label="m('rotateRight')" @click="emit('rotate', 90)"><Icon name="rotateR" /><span v-if="!compact">{{ m('rotateRight') }}</span></button>
      <button type="button" :title="m('duplicate')" :aria-label="m('duplicate')" @click="emit('dup')"><Icon name="dup" /><span v-if="!compact">{{ m('duplicate') }}</span></button>
      <button v-if="canExport && !compact" type="button" @click="emit('export')"><Icon name="export" /><span>{{ m('exportSelected') }}</span></button>
      <button type="button" class="danger" :title="allDeleted ? m('restore') : m('delete')" :aria-label="allDeleted ? m('restore') : m('delete')" @click="emit('delete')"><Icon :name="allDeleted ? 'restore' : 'delete'" /><span v-if="!compact">{{ allDeleted ? m('restore') : m('delete') }}</span></button>
      <button type="button" class="pm-selbar-close" :title="m('clearSelection')" :aria-label="m('clearSelection')" @click="emit('clear')"><Icon name="close" /></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Icon from './Icon.vue'
defineProps<{ count: number; allDeleted: boolean; compact?: boolean; canExport?: boolean; m: (k: string, ...a: (string | number)[]) => string }>()
const emit = defineEmits<{ (e: 'rotate', d: number): void; (e: 'dup'): void; (e: 'export'): void; (e: 'delete'): void; (e: 'clear'): void }>()
</script>
