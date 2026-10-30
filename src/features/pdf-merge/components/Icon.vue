<template>
  <svg class="pm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" :stroke-width="name === 'more' || name === 'grip' ? 3 : 2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="ICON[name]" /></svg>
</template>

<script setup lang="ts">
import { ICON, type IconName } from './icons'
defineProps<{ name: IconName }>()
</script>
