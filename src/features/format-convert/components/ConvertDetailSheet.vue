<template>
  <!-- Phone file details: original and result side by side (checkerboard
  under transparency), what changed, and delete / change format / share.
  Built on the shared sheet. -->
  <BottomSheet :title="item.file.name" :close-label="p('close')" label-id="cvDetailTitle" sheet-class="cv-detail-sheet" @close="emit('close')">
    <div class="sheet-body">
      <div class="cv-tags">
        <span class="cv-tag" :class="statusClass">{{ statusText }}</span>
        <span class="cv-pill">{{ srcLabel }}</span>
        <span class="cv-arrow" aria-hidden="true">→</span>
        <span class="cv-pill to">{{ FORMAT_LABEL[item.target] }}</span>
      </div>
      <div class="cv-compare">
        <figure class="cv-checker">
          <img v-if="item.srcUrl" :src="item.srcUrl" alt="" />
          <span v-else class="cv-thumb-label">{{ srcLabel }}</span>
          <figcaption>{{ p('origLabel', srcLabel) }}</figcaption>
        </figure>
        <figure class="cv-checker">
          <img v-if="item.outUrl && canPreview(item.target)" :src="item.outUrl" alt="" />
          <span v-else-if="item.outUrl" class="cv-thumb-label">{{ FORMAT_LABEL[item.target] }}</span>
          <span v-else-if="busy" class="cv-spinner" aria-hidden="true"></span>
          <figcaption>{{ FORMAT_LABEL[item.target] }}</figcaption>
        </figure>
      </div>
      <dl class="sheet-rows">
        <div><dt>{{ p('detailOrig') }}</dt><dd>{{ fmtSize(item.file.size) }}<template v-if="item.width"> · {{ item.width }}×{{ item.height }}</template> · {{ srcLabel }}</dd></div>
        <div v-if="item.outBlob"><dt>{{ p('detailOut') }}</dt><dd>{{ fmtSize(item.outBlob.size) }} · {{ FORMAT_LABEL[item.target] }} · {{ item.quality === null ? p('lossless') : p('qualityN', item.quality) }}</dd></div>
        <div v-if="item.outBlob"><dt>{{ p('detailSize') }}</dt><dd :class="delta <= 0 ? 'good' : 'warn'">{{ delta > 0 ? '+' : '' }}{{ delta }}%</dd></div>
        <div v-if="item.exif"><dt>{{ p('detailExif') }}</dt><dd>{{ p(EXIF_KEY[item.exif], FORMAT_LABEL[item.target]) }}</dd></div>
        <div v-for="(n, i) in notes" :key="i"><dt>{{ i === 0 ? p('detailNote') : '' }}</dt><dd class="warn">{{ n }}</dd></div>
        <div v-if="item.error"><dt>{{ p('detailNote') }}</dt><dd class="bad">{{ item.error }}</dd></div>
      </dl>
    </div>
    <div class="sheet-actions">
      <button type="button" class="sheet-secondary danger cv-icon-btn" :title="p('remove')" :aria-label="p('remove')" @click="emit('remove', item)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg></button>
      <button type="button" class="sheet-secondary" :disabled="busy" @click="emit('change', item, alt)">{{ p('changeTo', FORMAT_LABEL[alt]) }}</button>
      <button v-if="item.outBlob" type="button" class="primary" @click="emit('share', item)">{{ p('share', OUT_EXT[item.target]) }}</button>
      <button v-else-if="item.status === 'error' || item.status === 'cancelled'" type="button" class="primary" @click="emit('retry', item)">{{ p('retry') }}</button>
    </div>
  </BottomSheet>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BottomSheet from '../../../shared/components/BottomSheet.vue'
import { fmtSize } from '../../../shared/lib/format'
import type { ConvertItem, ExifOutcome, OutFormat } from '../types'
import { FORMAT_LABEL, OUT_EXT, sourceLabel } from '../lib/convert'
import { canPreview } from '../lib/preview'

const props = defineProps<{
  item: ConvertItem
  notes: string[]
  /** Bumped by the view whenever an item changes in place. */
  rev: number
  p: (key: string, ...args: (string | number)[]) => string
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'remove', item: ConvertItem): void
  (e: 'change', item: ConvertItem, fmt: OutFormat): void
  (e: 'share', item: ConvertItem): void
  (e: 'retry', item: ConvertItem): void
}>()

const EXIF_KEY: Record<ExifOutcome, string> = { kept: 'exifKept', none: 'exifNone', off: 'exifOff', avif: 'exifAvif' }

const busy = computed(() => (void props.rev, props.item.status === 'queued' || props.item.status === 'converting'))
const srcLabel = computed(() => sourceLabel(props.item.src, props.item.file.name))
// Quick switch: PNG for anything else (lossless, keeps transparency), JPEG for PNG.
const alt = computed<OutFormat>(() => (props.item.target === 'png' ? 'jpeg' : 'png'))
const delta = computed(() => {
  void props.rev
  const out = props.item.outBlob?.size ?? 0
  return props.item.file.size ? Math.round((out / props.item.file.size - 1) * 100) : 0
})
const statusText = computed(() => {
  void props.rev
  const s = props.item.status
  return props.p(s === 'done' ? 'stDone' : s === 'error' ? 'stFailed' : s === 'cancelled' ? 'stCancelled' : s === 'queued' ? 'stQueued' : s === 'unsupported' ? 'stUnsupported' : 'stConverting')
})
const statusClass = computed(() => {
  void props.rev
  const s = props.item.status
  return s === 'done' ? 'ok' : s === 'error' ? 'bad' : s === 'converting' || s === 'queued' ? 'info' : 'mute'
})
</script>
