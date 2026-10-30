<template>
  <!-- Nine-grid watermark anchor. "free" (dragged) and "tile" light none. -->
  <div class="rw-posgrid" role="radiogroup" :aria-label="label">
    <button
      v-for="p in GRID_POSITIONS"
      :key="p"
      type="button"
      role="radio"
      class="rw-pos"
      :class="{ active: modelValue === p }"
      :aria-checked="modelValue === p"
      :title="t(`pos_${p}`)"
      :aria-label="t(`pos_${p}`)"
      @click="emit('update:modelValue', p)"
    ><span></span></button>
  </div>
</template>

<script setup lang="ts">
import type { WmPos } from '../types'
import { GRID_POSITIONS } from '../lib/watermark'

defineProps<{ modelValue: WmPos; label: string; t: (key: string) => string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: WmPos): void }>()
</script>
