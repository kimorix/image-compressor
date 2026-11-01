<template>
  <div
    class="progress"
    id="progress"
    v-show="total > 0 && finished < total"
    role="progressbar"
    aria-valuemin="0"
    :aria-valuemax="total"
    :aria-valuenow="finished"
    :aria-valuetext="label"
    :aria-label="label"
  >
    <div class="bar"><div class="fill" id="progressFill" :style="{ width: pct + '%' }"></div></div>
    <div class="text" id="progressText">{{ label }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { currentIndex } from '../../../shared/lib/batch-progress'

const props = defineProps<{
  finished: number
  total: number
  t: (key: string, ...args: (string | number)[]) => string
}>()

// "正在压缩 第 3/19 张": the image being worked on, not the finished count.
const label = computed(() => props.t('progCompress', currentIndex(props.finished, props.total), props.total))
const pct = computed(() => (props.total > 0 ? Math.round((props.finished / props.total) * 100) : 0))
</script>
