<template>
  <!-- Phone "More" menu: tools that are not tabs yet. Owns its own
  "coming soon" toast. -->
  <div v-if="open" class="more-backdrop" @click="emit('close')"></div>
  <div class="more-menu" v-show="open" :inert="menuInert ? true : undefined">
    <button type="button" class="more-tool" aria-disabled="true" @click="showComingSoon">
      <span class="more-tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="8" height="8" rx="1" /><rect x="13" y="12" width="8" height="8" rx="1" /><path d="M13 8h6M16 5v6M11 16H5M8 13v6" /></svg></span>
      <span class="more-tool-copy"><strong>{{ t('moreImageConvert') }}</strong><small>{{ t('moreImageConvertDesc') }}</small></span>
      <span class="more-soon">{{ t('comingSoon') }}</span>
    </button>
  </div>
  <div v-if="moreToast" class="more-toast" role="status">{{ moreToast }}</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ open: boolean; menuInert?: boolean; t: (key: string, ...args: (string | number)[]) => string }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const moreToast = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null
function showComingSoon() {
  moreToast.value = props.t('comingSoon')
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { moreToast.value = null }, 1600)
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  if (timer) clearTimeout(timer)
})
</script>
