<template>
  <div id="lightbox" role="dialog" aria-modal="true" @click.self="close" >
    <div class="lb-head">
      <div class="lb-name" id="lbName">{{ item.file.name }}</div>
      <div class="lb-switch">
        <button type="button" id="lbOrig" :class="{ active: view === 'orig' }" @click="setView('orig')">{{ t('lbOrig') }}</button>
        <button type="button" id="lbComp" :class="{ active: view === 'comp' }" @click="setView('comp')">{{ t('lbComp') }}</button>
      </div>
      <button type="button" class="lb-close" id="lbClose" :aria-label="t('lbCloseAria')" @click="close">×</button>
    </div>
    <div class="lb-body" id="lbBody" @click.self="close">
      <img
        id="lbImg"
        :src="view === 'comp' ? (item.outUrl ?? item.url) : item.url"
        :alt="item.file.name"
        :class="{ zoomed }"
        @click.stop="zoomed = !zoomed"
      />
    </div>
    <div class="lb-foot" id="lbFoot">{{ info }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { CompressItem } from '../types'
import { fmtSize } from '../lib/format'

const props = defineProps<{
  item: CompressItem
  initialView: 'orig' | 'comp'
  t: (key: string, ...args: (string | number)[]) => string
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

const view = ref<'orig' | 'comp'>(props.initialView)
const zoomed = ref(false)

const info = computed(() => {
  const it = props.item
  return view.value === 'comp'
    ? props.t('lbInfoComp', it.outW, it.outH, fmtSize(it.outSize))
    : props.t('lbInfoOrig', it.origW, it.origH, fmtSize(it.file.size))
})

function setView(v: 'orig' | 'comp') {
  view.value = v
  zoomed.value = false
}

function close() {
  emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  document.body.style.overflow = ''
  document.removeEventListener('keydown', onKey)
})
</script>
