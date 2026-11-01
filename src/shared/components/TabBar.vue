<template>
  <!-- Phone bottom tab bar (hidden from 720px): one tab per feature, then
  Settings (opens the current feature's settings sheet) and More. -->
  <nav class="tab-bar">
    <button type="button" :class="{ active: current === 'compress' }" @click="emit('compress')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>{{ t('tabCompress') }}</button>
    <button type="button" :class="{ active: current === 'pdf' }" @click="emit('pdf')"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5" /><path d="M8.5 15l2-4 2 4 2-4 2 4" /></svg>{{ t('tabPdf') }}</button>
    <button type="button" :class="{ active: current === 'settings' }" :aria-expanded="settingsOpen" @click="emit('settings')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>{{ t('tabSettings') }}</button>
    <button type="button" :class="{ active: current === 'more' }" :aria-expanded="moreOpen" @click="emit('more')"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>{{ t('tabMore') }}</button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { pendingFeature, tabOf } from '../composables/useViewSwitch'

const props = defineProps<{
  active: 'compress' | 'pdf' | 'settings' | 'more' | ''
  settingsOpen: boolean
  moreOpen: boolean
  t: (key: string, ...args: (string | number)[]) => string
}>()
// While the next tool's chunk loads, its tab is highlighted right away.
const current = computed(() => (pendingFeature.value ? tabOf(pendingFeature.value) : props.active))
const emit = defineEmits<{ (e: 'compress'): void; (e: 'pdf'): void; (e: 'settings'): void; (e: 'more'): void }>()
</script>
