<template>
  <!-- One line for a running batch: "正在转换 第 3/19 张" with a thin bar.
  Polite live region, so screen readers hear the count move without being
  interrupted on every image. Empty (but kept in the DOM, so the live
  region exists before the first update) while idle. -->
  <div class="batch-status" :class="{ idle: !text }" role="status" aria-live="polite">
    <template v-if="text">
      <div v-if="total > 0" class="batch-bar" aria-hidden="true"><span :style="{ width: `${pct}%` }"></span></div>
      <span class="batch-text">{{ text }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ text: string; done?: number; total?: number }>(), { done: 0, total: 0 })
const pct = computed(() => (props.total > 0 ? Math.round((props.done / props.total) * 100) : 0))
</script>

<style lang="less">
.batch-status {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 10px 0 2px;
  font-size: 13px;
  color: var(--accent);
  &.idle {
    margin: 0;
  }
}
.batch-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--accent-soft);
  overflow: hidden;
  span {
    display: block;
    height: 100%;
    border-radius: 2px;
    background: var(--accent);
    transition: width 0.25s ease;
  }
}
@media (prefers-reduced-motion: reduce) {
  .batch-bar span {
    transition: none;
  }
}
</style>
