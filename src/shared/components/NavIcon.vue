<template>
  <!-- Line icons for the tool map (side nav, More menu, placeholders). -->
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'compress'"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></template>
    <template v-else-if="name === 'convert'"><path d="M4 9h13l-3-3M20 15H7l3 3" /></template>
    <template v-else-if="name === 'resize'"><path d="M6 2v14a2 2 0 002 2h14" /><path d="M18 22V8a2 2 0 00-2-2H2" /></template>
    <template v-else-if="name === 'pdf'"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5" /><path d="M8.5 15l2-4 2 4 2-4 2 4" /></template>
    <template v-else-if="name === 'img2pdf'"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5" /><circle cx="10" cy="12" r="1.5" /><path d="M18 17l-3-3-6 6" /></template>
    <template v-else-if="name === 'pdf-merge'"><rect x="3" y="7" width="11" height="14" rx="1.5" /><path d="M7 7V4.5A1.5 1.5 0 018.5 3h11A1.5 1.5 0 0121 4.5v11a1.5 1.5 0 01-1.5 1.5H14" /></template>
    <template v-else><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></template>
  </svg>
</template>

<script setup lang="ts">
defineProps<{ name: string }>()
</script>
