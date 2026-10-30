<template>
  <!-- Label · range · value, one settings row. -->
  <label class="rw-slider">
    <span class="rw-label">{{ label }}</span>
    <input
      type="range"
      :min="min"
      :max="max"
      :step="step ?? 1"
      :value="modelValue"
      :aria-valuetext="display"
      @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
    />
    <span class="rw-slider-val">{{ display }}</span>
  </label>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ label: string; modelValue: number; min: number; max: number; step?: number; unit?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: number): void }>()
const display = computed(() => `${Math.round(props.modelValue * 10) / 10}${props.unit ?? ''}`)
</script>
