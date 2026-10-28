<template>
  <!-- Desktop sidebar (≥1080px): one entry per feature plus the compressor
  history, then the active feature's info card (slot). -->
  <aside id="sideNav">
    <nav class="side-links">
      <button type="button" :class="{ active: active === 'compress' }" @click="emit('compress')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>{{ t('navTool') }}</button>
      <button type="button" :class="{ active: active === 'pdf' }" @click="emit('pdf')"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5" /><path d="M8.5 15l2-4 2 4 2-4 2 4" /></svg>{{ t('navPdf') }}</button>
      <button type="button" :class="{ active: active === 'history' }" @click="emit('history')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{{ t('navHistory') }}</button>
    </nav>
    <slot />
  </aside>
</template>

<script setup lang="ts">
defineProps<{ active: 'compress' | 'pdf' | 'history' | ''; t: (key: string, ...args: (string | number)[]) => string }>()
const emit = defineEmits<{ (e: 'compress'): void; (e: 'pdf'): void; (e: 'history'): void }>()
</script>
