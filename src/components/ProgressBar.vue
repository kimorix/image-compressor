<template>
  <div class="progress" id="progress" v-show="total > 0 && finished < total">
    <div class="bar"><div class="fill" id="progressFill" :style="{ width: pct + '%' }"></div></div>
    <div class="text" id="progressText">{{ t('processingCount', finished, total) }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  finished: number
  total: number
  t: (key: string, ...args: (string | number)[]) => string
}>()

const pct = computed(() => (props.total > 0 ? Math.round((props.finished / props.total) * 100) : 0))
</script>
