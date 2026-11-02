<template>
  <!-- A transient hint ("已跳过 2 个非图片文件"). The visible line comes and
  goes; the polite live region beside it stays in the DOM from the start and
  only its text changes, so screen readers announce every hint (a region
  inserted together with its text is often not read). -->
  <p v-if="text" :class="hintClass" aria-hidden="true">{{ text }}</p>
  <p class="sr-only" role="status" aria-live="polite">{{ text ?? '' }}</p>
</template>

<script setup lang="ts">
defineProps<{ text: string | null | undefined; hintClass?: string }>()
</script>
