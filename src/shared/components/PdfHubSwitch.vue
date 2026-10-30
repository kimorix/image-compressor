<template>
  <!-- Phone PDF tools hub (≤719px): one segment per PDF tool. Switching
  pushes the tool's hash, so Back returns to the previous tool. Hidden on
  desktop, where the side nav lists the PDF tools. -->
  <div class="pdf-hub">
    <SegmentedControl :model-value="active" :options="options" :aria-label="t('hubTitle')" @update:model-value="go" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SegmentedControl from './SegmentedControl.vue'
import { PDF_HUB } from './nav'
import { useHashRoute, type PdfFeature } from '../composables/useHashRoute'

const props = defineProps<{ active: PdfFeature; t: (key: string, ...args: (string | number)[]) => string }>()
const { navigate } = useHashRoute()
const options = computed(() => PDF_HUB.map((h) => ({ value: h.key, label: props.t(h.label) })))
function go(f: PdfFeature) {
  navigate(f)
}
</script>

<style lang="less">
// ---- phone PDF tools hub: header title + segments (≤719px only) ----
.pdf-hub,
.title-hub {
  display: none;
}
@media (max-width: 719px) {
  .pdf-hub {
    display: block;
    margin-bottom: 12px;
  }
  .title-hub {
    display: inline;
  }
  .title-desk {
    display: none;
  }
}
</style>
