<template>
  <!-- Social / e-commerce / ID-photo sizes: name + pixel size. -->
  <div class="rw-presets">
    <button
      v-for="p in list"
      :key="p.id"
      type="button"
      class="rw-preset"
      :class="{ active: active === p.id }"
      :aria-pressed="active === p.id"
      @click="emit('pick', p.id)"
    >
      <strong>{{ t(`preset_${p.id}`) }}</strong>
      <span>{{ p.h ? `${p.w}×${p.h}` : t('presetLongSide', p.w) }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { findPreset, PRESETS, type SizePreset } from '../lib/presets'

const props = defineProps<{ ids?: readonly string[]; active: string | null; t: (key: string, ...a: (string | number)[]) => string }>()
const emit = defineEmits<{ (e: 'pick', id: string): void }>()
const list = computed<SizePreset[]>(() => (props.ids ? props.ids.map(findPreset).filter((p): p is SizePreset => !!p) : [...PRESETS]))
</script>
