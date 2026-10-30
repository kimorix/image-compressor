<template>
  <!-- Thin shell: the hash route picks the feature view. Views stay alive
  once opened (KeepAlive), so switching never drops a running batch or its
  results. Everything but the compressor is its own lazy chunk; the
  compressor bundle never loads pdf.js, pdf-lib, docx or tesseract. Tools whose
  feature PR has not landed yet render the shared placeholder. -->
  <KeepAlive>
    <component :is="view" :key="route.feature" v-bind="viewProps" />
  </KeepAlive>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, type Component } from 'vue'
import CompressorView from './features/image-compressor/CompressorView.vue'
import { useHashRoute, type Feature } from './shared/composables/useHashRoute'

const PdfToWordView = defineAsyncComponent(() => import('./features/pdf-to-word/PdfToWordView.vue'))
const ConvertView = defineAsyncComponent(() => import('./features/format-convert/ConvertView.vue'))
const ResizeWatermarkView = defineAsyncComponent(() => import('./features/resize-watermark/ResizeWatermarkView.vue'))
const PdfMergeView = defineAsyncComponent(() => import('./features/pdf-merge/PdfMergeView.vue'))
const ImgToPdfView = defineAsyncComponent(() => import('./features/img-to-pdf/ImgToPdfView.vue'))
const ToolPlaceholder = defineAsyncComponent(() => import('./shared/components/ToolPlaceholder.vue'))

const VIEWS: Partial<Record<Feature, Component>> = {
  compress: CompressorView,
  convert: ConvertView,
  pdf: PdfToWordView,
  resize: ResizeWatermarkView,
  'pdf-merge': PdfMergeView,
  img2pdf: ImgToPdfView,
}

const { route } = useHashRoute()
const view = computed(() => VIEWS[route.value.feature] ?? ToolPlaceholder)
const viewProps = computed(() => (VIEWS[route.value.feature] ? {} : { feature: route.value.feature }))
</script>
