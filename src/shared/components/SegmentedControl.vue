<template>
  <!-- Single-choice segmented control. `track` is the pill track (PDF tools
  hub, mode switches); `chips` reuses the settings' .seg / .seg-btn look.
  A radiogroup: arrow keys move the choice, Home/End jump to the ends. -->
  <div
    ref="root"
    :class="variant === 'chips' ? 'seg' : 'seg-track'"
    role="radiogroup"
    :aria-label="ariaLabel"
    @keydown="onKey"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="radio"
      :class="[variant === 'chips' ? 'seg-btn' : 'seg-track-btn', { active: opt.value === modelValue }]"
      :aria-checked="opt.value === modelValue"
      :tabindex="opt.value === modelValue || (!hasSelection && opt === options[0]) ? 0 : -1"
      :disabled="opt.disabled || undefined"
      @click="pick(opt.value)"
    >{{ opt.label }}</button>
  </div>
</template>

<script setup lang="ts" generic="V extends string">
import { computed, nextTick, ref } from 'vue'

export interface SegOption<T extends string = string> { value: T; label: string; disabled?: boolean }

const props = withDefaults(defineProps<{
  modelValue: V
  options: SegOption<V>[]
  ariaLabel?: string
  variant?: 'track' | 'chips'
}>(), { variant: 'track', ariaLabel: undefined })
const emit = defineEmits<{ (e: 'update:modelValue', v: V): void }>()
const root = ref<HTMLElement | null>(null)
const hasSelection = computed(() => props.options.some((o) => o.value === props.modelValue))

function pick(v: V) {
  if (v !== props.modelValue) emit('update:modelValue', v)
}

function onKey(e: KeyboardEvent) {
  const enabled = props.options.filter((o) => !o.disabled)
  if (!enabled.length) return
  const i = Math.max(0, enabled.findIndex((o) => o.value === props.modelValue))
  let next = -1
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % enabled.length
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + enabled.length) % enabled.length
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = enabled.length - 1
  if (next < 0) return
  e.preventDefault()
  pick(enabled[next].value)
  void nextTick(() => {
    const idx = props.options.indexOf(enabled[next])
    ;(root.value?.children[idx] as HTMLElement | undefined)?.focus()
  })
}
</script>

<style lang="less">
// ---- segmented track (pill track with a raised active segment) ----
.seg-track {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.seg-track-btn {
  flex: 1 1 0;
  min-width: 0;
  min-height: 36px;
  padding: 6px 4px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
  overflow-wrap: break-word;
  &.active {
    background: var(--card);
    color: var(--accent);
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
  }
  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
}
</style>
