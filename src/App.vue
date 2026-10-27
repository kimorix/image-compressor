<template>
  <!-- Thin shell: the hash route picks the feature view. Both stay alive
  once opened (KeepAlive), so switching never drops a running batch or its
  results. The PDF feature is its own lazy chunk; the compressor bundle
  never loads pdf.js, docx or tesseract. -->
  <KeepAlive>
    <component :is="route.feature === 'pdf' ? PdfToWordView : CompressorView" />
  </KeepAlive>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import CompressorView from './features/image-compressor/CompressorView.vue'
import { useHashRoute } from './shared/composables/useHashRoute'

const PdfToWordView = defineAsyncComponent(() => import('./features/pdf-to-word/PdfToWordView.vue'))
const { route } = useHashRoute()
</script>
