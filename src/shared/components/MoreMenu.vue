<template>
  <!-- Phone "More" menu: image tools that have no tab of their own, then
  the compressor history (the phone's only way there; the desktop side nav
  lists it too). Each entry is a real route. -->
  <div v-if="open" class="more-backdrop" @click="emit('close')"></div>
  <div class="more-menu" v-show="open" :inert="menuInert ? true : undefined">
    <p class="more-group">{{ t('navGroupImage') }}</p>
    <button
      v-for="tool in MORE_TOOLS"
      :key="tool.key"
      type="button"
      class="more-tool"
      :class="{ active: active === tool.key }"
      :aria-current="active === tool.key ? 'page' : undefined"
      @click="go(tool.key)"
    >
      <span class="more-tool-icon" aria-hidden="true"><NavIcon :name="tool.key" /></span>
      <span class="more-tool-copy"><strong>{{ t(tool.label) }}</strong><small>{{ t(tool.desc) }}</small></span>
      <span class="more-chevron" aria-hidden="true">›</span>
    </button>
    <div class="more-sep" role="separator"></div>
    <button
      v-for="entry in MORE_OTHER"
      :key="entry.key"
      type="button"
      class="more-tool"
      :class="{ active: active === entry.key }"
      :aria-current="active === entry.key ? 'page' : undefined"
      @click="go(entry.key)"
    >
      <span class="more-tool-icon" aria-hidden="true"><NavIcon :name="entry.key" /></span>
      <span class="more-tool-copy"><strong>{{ t(entry.label) }}</strong><small>{{ t(entry.desc) }}</small></span>
      <span class="more-chevron" aria-hidden="true">›</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import type { NavKey } from '../composables/useHashRoute'
import NavIcon from './NavIcon.vue'
import { MORE_OTHER, MORE_TOOLS } from './nav'

const props = defineProps<{ open: boolean; active?: NavKey | ''; menuInert?: boolean; t: (key: string, ...args: (string | number)[]) => string }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'nav', key: NavKey): void }>()
function go(key: NavKey) {
  emit('close')
  emit('nav', key)
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
