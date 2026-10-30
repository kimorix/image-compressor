<template>
  <!-- Five quick colours + a custom picker (the rainbow swatch). -->
  <div class="rw-swatches" role="radiogroup" :aria-label="label">
    <button
      v-for="c in SWATCHES"
      :key="c"
      type="button"
      role="radio"
      class="rw-swatch"
      :class="{ active: modelValue === c, light: c === '#ffffff' }"
      :style="{ background: c }"
      :aria-checked="modelValue === c"
      :aria-label="c"
      :title="c"
      @click="emit('update:modelValue', c)"
    ></button>
    <label class="rw-swatch rw-swatch-custom" :class="{ active: custom }" :title="customLabel">
      <input type="color" :value="modelValue" :aria-label="customLabel" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value.toLowerCase())" />
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const SWATCHES = ['#ffffff', '#111111', '#2563eb', '#f59e0b']
const props = defineProps<{ modelValue: string; label: string; customLabel: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()
const custom = computed(() => !SWATCHES.includes(props.modelValue))
</script>
