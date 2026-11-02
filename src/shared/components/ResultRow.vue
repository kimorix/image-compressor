<template>
  <component
    :is="tag"
    :tabindex="selectable ? 0 : undefined"
    :aria-current="current ? 'true' : undefined"
    @click="emit('select')"
    @keydown.enter.self="onKey"
    @keydown.space.self="onKey"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
// One result row of a tool's list (compress, convert, resize, PDF to
// Word): thumbnail | file info | actions. Each tool keeps its own classes and
// inner markup (the slot and fall-through attributes), so its look
// is unchanged; the row behaviour is shared: a click selects the row, and a
// selectable row is also reachable with Tab and picked with Enter / Space
// (keys on the row itself only, never from a button inside it).
const props = withDefaults(defineProps<{
  /** Element for the row: 'li' inside a list, 'div' for a standalone row. */
  tag?: 'li' | 'div'
  /** Focusable, Enter / Space select it. */
  selectable?: boolean
  /** The row the preview shows. */
  current?: boolean
}>(), { tag: 'li', selectable: false, current: false })
const emit = defineEmits<{ (e: 'select'): void }>()

function onKey(e: KeyboardEvent) {
  if (!props.selectable) return
  e.preventDefault()
  emit('select')
}
</script>
