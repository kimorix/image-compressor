<template>
  <!-- Source files as colour chips. Desktop: drag a chip to reorder files
  (HTML5 drag and drop; arrow keys with Alt move the focused chip), click it
  for file actions. `readonly` (phone page editor): colour legend only. -->
  <div class="pm-chips" role="list">
    <div
      v-for="(c, i) in chips"
      :key="c.id"
      class="pm-chip-wrap"
      role="listitem"
      :class="{ over: overIdx === i && dragIdx !== i }"
      @dragover.prevent="onOver(i)"
      @drop.prevent="onDrop(i)"
    >
      <button
        type="button"
        class="pm-chip"
        :class="[`st-${c.status}`, { open: menuFor === c.id }]"
        :style="{ '--pm-c': c.color }"
        :draggable="!readonly && c.status === 'ready'"
        :aria-haspopup="readonly ? undefined : 'menu'"
        :aria-expanded="readonly ? undefined : menuFor === c.id"
        :aria-label="readonly ? undefined : m('fileActions', c.name)"
        :title="c.name"
        :tabindex="readonly ? -1 : 0"
        @dragstart="onStart($event, i)"
        @dragend="dragIdx = overIdx = -1"
        @click="!readonly && toggle(c.id)"
        @keydown.alt.left.prevent="move(i, -1)"
        @keydown.alt.right.prevent="move(i, 1)"
      >
        <Icon v-if="c.status === 'locked'" name="lock" />
        <span v-else class="pm-dot" aria-hidden="true"></span>
        <span class="pm-chip-name">{{ short(c.name) }}</span>
        <span class="pm-chip-count">· {{ c.status === 'locked' ? m('needPassword') : c.status === 'error' ? '!' : c.status === 'probing' ? '…' : c.count }}</span>
      </button>
      <div v-if="menuFor === c.id" class="pm-menu" role="menu" @keydown.esc="menuFor = null">
        <button v-if="c.status === 'ready'" type="button" role="menuitem" @click="act('select', c.id)">{{ m('selectFile') }}</button>
        <button v-if="c.status === 'ready'" type="button" role="menuitem" @click="act('rotate', c.id)"><Icon name="rotateR" />{{ m('rotateFile') }}</button>
        <button v-if="i > 0 && c.status === 'ready'" type="button" role="menuitem" @click="move(i, -1); menuFor = null"><Icon name="up" />{{ m('moveUp') }}</button>
        <button v-if="i < chips.length - 1 && c.status === 'ready'" type="button" role="menuitem" @click="move(i, 1); menuFor = null"><Icon name="down" />{{ m('moveDown') }}</button>
        <button type="button" role="menuitem" class="danger" @click="act('remove', c.id)"><Icon name="delete" />{{ m('removeFile') }}</button>
      </div>
    </div>
  </div>
  <div v-if="menuFor" class="pm-menu-backdrop" @click="menuFor = null"></div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Icon from './Icon.vue'

export interface Chip { id: string; name: string; count: number; color: string; status: string }

const props = defineProps<{ chips: Chip[]; readonly?: boolean; m: (k: string, ...a: (string | number)[]) => string }>()
const emit = defineEmits<{
  (e: 'reorder', ids: string[]): void
  (e: 'select', id: string): void
  (e: 'rotate', id: string): void
  (e: 'remove', id: string): void
}>()

const dragIdx = ref(-1)
const overIdx = ref(-1)
const menuFor = ref<string | null>(null)

function short(name: string): string {
  const s = name.replace(/\.pdf$/i, '')
  return s.length > 14 ? s.slice(0, 13) + '…' : s
}
function toggle(id: string) {
  menuFor.value = menuFor.value === id ? null : id
}
function act(kind: 'select' | 'rotate' | 'remove', id: string) {
  menuFor.value = null
  if (kind === 'select') emit('select', id)
  else if (kind === 'rotate') emit('rotate', id)
  else emit('remove', id)
}
function onStart(e: DragEvent, i: number) {
  dragIdx.value = i
  menuFor.value = null
  e.dataTransfer?.setData('text/plain', props.chips[i].id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onOver(i: number) {
  if (dragIdx.value >= 0) overIdx.value = i
}
function reorderTo(from: number, to: number) {
  if (from < 0 || to < 0 || from === to) return
  const ids = props.chips.map((c) => c.id)
  const [x] = ids.splice(from, 1)
  ids.splice(to, 0, x)
  emit('reorder', ids)
}
function onDrop(i: number) {
  reorderTo(dragIdx.value, i)
  dragIdx.value = overIdx.value = -1
}
function move(i: number, d: number) {
  const to = i + d
  if (to < 0 || to >= props.chips.length) return
  reorderTo(i, to)
}
</script>
