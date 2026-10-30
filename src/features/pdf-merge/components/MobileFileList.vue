<template>
  <!-- Phone file list: one card per source. Drag the ⋮⋮ handle to reorder
  (Pointer Events, touch-action: none on the handle only, so the list still
  scrolls everywhere else); ⋯ opens the file's actions. -->
  <ul ref="list" class="pm-mfiles" :class="{ dragging: drag.idx >= 0 }">
    <li
      v-for="(f, i) in files"
      :key="f.id"
      class="pm-mfile"
      :class="[`st-${f.status}`, { lifted: drag.idx === i }]"
      :style="[{ '--pm-c': colors[f.id] }, styleFor(i)]"
    >
      <button
        type="button"
        class="pm-grip"
        :aria-label="m('dragHandle') + ' ' + f.name"
        :disabled="files.length < 2"
        @pointerdown="onDown($event, i)"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onCancel"
        @keydown.up.prevent="emit('move', i, i - 1)"
        @keydown.down.prevent="emit('move', i, i + 1)"
      ><Icon name="grip" /></button>
      <div class="pm-mthumb">
        <img v-if="thumbs[f.id]" :src="thumbs[f.id]!" alt="" />
        <Icon v-else-if="f.status === 'locked'" name="lock" />
        <span v-else class="pm-wait" aria-hidden="true"></span>
      </div>
      <div class="pm-minfo">
        <strong :title="f.name">{{ f.name }}</strong>
        <span v-if="f.status === 'locked'" class="pm-mmeta"><span class="pm-tag bad">{{ m('locked') }}</span>{{ m('needPassword') }}</span>
        <span v-else-if="f.status === 'error'" class="pm-mmeta bad">{{ m('errOpen') }}</span>
        <span v-else-if="f.status === 'probing'" class="pm-mmeta">{{ m('probing') }}</span>
        <span v-else class="pm-mmeta"><span class="pm-dot" aria-hidden="true"></span>{{ m('pagesSize', counts[f.id] ?? f.pages, fmtSize(f.file.size)) }}<span v-if="f.ownerLocked" class="pm-tag">{{ m('ownerTag') }}</span></span>
        <p v-if="f.status === 'locked' && open === f.id" class="pm-mnote">{{ m('openPwUnsupported') }}</p>
      </div>
      <button type="button" class="pm-mmore" :aria-label="m('fileActions', f.name)" :aria-expanded="open === f.id" @click="open = open === f.id ? null : f.id"><Icon name="more" /></button>
      <div v-if="open === f.id && f.status !== 'locked'" class="pm-mmenu" role="menu">
        <button v-if="f.status === 'ready'" type="button" role="menuitem" @click="act(() => emit('rotate', f.id))"><Icon name="rotateR" />{{ m('rotateFile') }}</button>
        <button v-if="i > 0" type="button" role="menuitem" @click="act(() => emit('move', i, i - 1))"><Icon name="up" />{{ m('moveUp') }}</button>
        <button v-if="i < files.length - 1" type="button" role="menuitem" @click="act(() => emit('move', i, i + 1))"><Icon name="down" />{{ m('moveDown') }}</button>
        <button type="button" role="menuitem" class="danger" @click="act(() => emit('remove', f.id))"><Icon name="delete" />{{ m('removeFile') }}</button>
      </div>
      <button v-if="open === f.id && f.status === 'locked'" type="button" class="pm-mremove danger" @click="act(() => emit('remove', f.id))">{{ m('remove') }}</button>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { fmtSize } from '../../../shared/lib/format'
import type { SrcFile } from '../types'
import Icon from './Icon.vue'

defineProps<{
  files: SrcFile[]
  colors: Record<string, string>
  counts: Record<string, number>
  thumbs: Record<string, string | null>
  m: (k: string, ...a: (string | number)[]) => string
}>()
const emit = defineEmits<{ (e: 'move', from: number, to: number): void; (e: 'rotate', id: string): void; (e: 'remove', id: string): void }>()

const open = ref<string | null>(null)
const list = ref<HTMLElement | null>(null)
function act(fn: () => void) {
  open.value = null
  fn()
}

// ---- handle drag ----
const drag = reactive({ idx: -1, to: -1, startY: 0, dy: 0, tops: [] as number[], h: 0, id: -1 })
function onDown(e: PointerEvent, i: number) {
  if (e.button !== 0 || !list.value) return
  const items = [...list.value.children] as HTMLElement[]
  drag.tops = items.map((el) => el.getBoundingClientRect().top + el.offsetHeight / 2)
  drag.h = items[i].offsetHeight + 10
  drag.idx = i
  drag.to = i
  drag.startY = e.clientY
  drag.dy = 0
  drag.id = e.pointerId
  open.value = null
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  e.preventDefault()
}
function onMove(e: PointerEvent) {
  if (drag.idx < 0 || e.pointerId !== drag.id) return
  drag.dy = e.clientY - drag.startY
  const y = drag.tops[drag.idx] + drag.dy
  // Final index = how many other cards have their centre above the dragged one.
  drag.to = drag.tops.reduce((n, top, k) => (k !== drag.idx && top < y ? n + 1 : n), 0)
}
function onUp(e: PointerEvent) {
  if (drag.idx < 0 || e.pointerId !== drag.id) return
  const { idx, to } = drag
  drag.idx = -1
  if (to !== idx) emit('move', idx, to)
}
function onCancel() {
  drag.idx = -1
}
function styleFor(i: number) {
  if (drag.idx < 0) return undefined
  if (i === drag.idx) return { transform: `translateY(${drag.dy}px)`, zIndex: 2 }
  if (drag.idx < drag.to && i > drag.idx && i <= drag.to) return { transform: `translateY(${-drag.h}px)` }
  if (drag.idx > drag.to && i < drag.idx && i >= drag.to) return { transform: `translateY(${drag.h}px)` }
  return undefined
}
</script>
