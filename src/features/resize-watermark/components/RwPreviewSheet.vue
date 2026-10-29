<template>
  <!-- Phone preview: full-height sheet with the live stage (drag the
  watermark, two fingers to reframe, swipe to switch), quick positions,
  the original / output / watermark summary and the item's actions. -->
  <BottomSheet :title="item.file.name" :close-label="t('close')" label-id="rwPreviewTitle" sheet-class="rw-preview-sheet" overlay-class="rw-preview-overlay" @close="emit('close')">
    <div class="rw-ps-sub">
      <span>{{ index + 1 }} / {{ total }}</span>
      <span v-if="tag" class="rw-tag info">{{ tag }}</span>
      <button type="button" class="rw-chip-btn" :class="{ active: view === 'original' }" :aria-pressed="view === 'original'" @click="emit('view', view === 'original' ? 'effect' : 'original')">{{ t('viewOriginal') }}</button>
    </div>
    <div class="rw-ps-stage">
      <PreviewStage
        :bmp="bmp"
        :src-w="item.w"
        :src-h="item.h"
        :settings="settings"
        :focus="item.focus"
        :out-type="outType"
        :text="text"
        :logo="logo"
        :view="view"
        :context="false"
        :touch="true"
        :max-h="stageH"
        :label="t('previewTitle')"
        :empty-text="t('stProbing')"
        @wm="(p) => emit('wm', p)"
        @focus="(f) => emit('focus', f)"
        @swipe="(d) => (d > 0 ? emit('next') : emit('prev'))"
      >
        <span v-if="bmp && view === 'effect'" class="rw-stage-hint">{{ t('dragHintTouch') }}</span>
      </PreviewStage>
    </div>
    <div v-if="total > 1" class="rw-dots" aria-hidden="true">
      <span v-for="i in Math.min(total, 9)" :key="i" :class="{ active: dotIndex === i - 1 }"></span>
    </div>
    <div class="sheet-body">
      <div class="rw-quickpos" role="radiogroup" :aria-label="t('wmPosition')">
        <button v-for="q in QUICK" :key="q.pos" type="button" role="radio" :aria-checked="pos === q.pos" :class="{ active: pos === q.pos }" :disabled="!settings.wm.enabled" @click="emit('pos', q.pos)">
          <span aria-hidden="true">{{ q.icon }}</span> {{ t(q.pos === 'free' ? 'posFree' : `pos_${q.pos}`) }}
        </button>
      </div>
      <dl class="rw-ps-info">
        <div><dt>{{ t('infoOrig') }}</dt><dd>{{ item.w }}×{{ item.h }} · {{ fmtSize(item.file.size) }}</dd></div>
        <div><dt>{{ t('infoOut') }}</dt><dd>{{ outLine }}</dd></div>
        <div><dt>{{ t('infoWm') }}</dt><dd>{{ wmLine }}</dd></div>
      </dl>
      <p v-for="n in notes" :key="n" class="rw-note">{{ n }}</p>
      <p v-if="item.error" class="rw-note rw-warn" role="alert">{{ item.error }}</p>
      <div class="sheet-actions rw-ps-actions">
        <button type="button" class="rw-icon-btn" :title="t('remove')" :aria-label="t('remove')" @click="emit('remove')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg></button>
        <button type="button" @click="emit('adjust')">⚙︎ {{ t('adjust') }}</button>
        <button type="button" class="primary" :disabled="busy" @click="emit('share')">{{ busy ? t('stProcessing') : t('share') }}</button>
      </div>
    </div>
  </BottomSheet>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import BottomSheet from '../../../shared/components/BottomSheet.vue'
import { fmtSize } from '../../../shared/lib/format'
import type { Focus, RwItem, RwSettings, WmPos } from '../types'
import PreviewStage from './PreviewStage.vue'

type Img = CanvasImageSource & { width: number; height: number }

const props = defineProps<{
  item: RwItem
  index: number
  total: number
  bmp: Img | null
  logo: Img | null
  settings: RwSettings
  outType: string
  text: string
  view: 'effect' | 'original'
  tag: string
  outLine: string
  wmLine: string
  notes: string[]
  busy: boolean
  t: (key: string, ...a: (string | number)[]) => string
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'prev'): void
  (e: 'next'): void
  (e: 'wm', p: { x: number; y: number }): void
  (e: 'focus', f: Focus): void
  (e: 'pos', p: WmPos): void
  (e: 'view', v: 'effect' | 'original'): void
  (e: 'remove'): void
  (e: 'adjust'): void
  (e: 'share'): void
}>()

const QUICK: { pos: WmPos; icon: string }[] = [
  { pos: 'tl', icon: '↖' }, { pos: 'free', icon: '⊙' }, { pos: 'br', icon: '↘' }, { pos: 'tile', icon: '▦' },
]
const pos = computed(() => props.settings.wm.pos)
const dotIndex = computed(() => (props.total <= 9 ? props.index : Math.round((props.index / Math.max(1, props.total - 1)) * 8)))

const stageH = ref(360)
function measure() {
  stageH.value = Math.max(220, Math.min(520, Math.round(window.innerHeight * 0.46)))
}
onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => window.removeEventListener('resize', measure))
</script>
