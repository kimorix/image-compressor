<template>
  <!-- Phone file details: swipeable page previews, what the conversion
  found, and delete / convert again / share. Built on the shared sheet. -->
  <BottomSheet :title="item.file.name" :close-label="p('close')" label-id="pdfDetailTitle" sheet-class="pdf-detail-sheet" @close="emit('close')">
    <div class="sheet-body">
      <div class="pdf-tags">
        <span v-if="item.status === 'done'" class="pdf-tag ok">{{ p('stDone') }}</span>
        <span v-else-if="item.status === 'error'" class="pdf-tag bad">{{ p('stFailed') }}</span>
        <span v-if="item.outMode" class="pdf-tag info">{{ item.outMode === 'layout' ? p('tagLayout') : p('tagEditable') }}</span>
        <span v-if="item.kind === 'scanned'" class="pdf-tag warn">{{ item.stats?.ocrPages ? p('kindScannedOcr') : p('kindScanned') }}</span>
      </div>
      <div class="pdf-pages" ref="stripRef" @scroll.passive="onScroll">
        <div v-for="n in previewCount" :key="n" class="pdf-page" :class="{ current: n === current }">
          <img v-if="previews[n]" :src="previews[n]" :alt="p('pagesOnly', n)" />
          <span v-else class="pdf-page-wait" aria-hidden="true"></span>
        </div>
      </div>
      <p class="pdf-page-label">{{ p('pageSwipe', current, item.pages) }}</p>
      <dl class="sheet-rows">
        <div><dt>{{ p('detailOrig') }}</dt><dd>{{ fmtSize(item.file.size) }} · {{ p('pagesOnly', item.pages) }}</dd></div>
        <div v-if="item.outBlob"><dt>{{ p('detailWord') }}</dt><dd>{{ fmtSize(item.outBlob.size) }} · .docx</dd></div>
        <div v-if="item.stats"><dt>{{ p('detailFound') }}</dt><dd>{{ p('found', item.stats.headings, item.stats.images, item.stats.tables) }}</dd></div>
        <div v-for="(n, i) in notes" :key="i"><dt>{{ i === 0 ? p('detailNote') : '' }}</dt><dd class="warn">{{ n }}</dd></div>
        <div v-if="item.error"><dt>{{ p('detailNote') }}</dt><dd class="warn">{{ item.error }}</dd></div>
      </dl>
    </div>
    <div class="sheet-actions">
      <button type="button" class="sheet-secondary danger pdf-icon-btn" :title="p('remove')" :aria-label="p('remove')" @click="emit('remove', item)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg></button>
      <button type="button" class="sheet-secondary" :disabled="busy" @click="emit('reconvert', item)">{{ p('reconvert') }}</button>
      <button type="button" class="primary" :disabled="!item.outBlob" @click="emit('share', item)">{{ p('share') }}</button>
    </div>
  </BottomSheet>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BottomSheet from '../../../shared/components/BottomSheet.vue'
import { fmtSize } from '../../../shared/lib/format'
import type { PdfItem } from '../types'

const props = defineProps<{
  item: PdfItem
  busy: boolean
  /** Bumped by the view whenever an item changes in place. */
  rev: number
  previews: Record<number, string>
  p: (key: string, ...args: (string | number)[]) => string
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'remove', item: PdfItem): void
  (e: 'reconvert', item: PdfItem): void
  (e: 'share', item: PdfItem): void
  (e: 'need', n: number): void
}>()

// At most 12 pages are previewed; the label still counts the whole file.
const previewCount = computed(() => Math.min(props.item.pages || 1, 12))
const current = ref(1)
const stripRef = ref<HTMLElement | null>(null)
const notes = computed(() => {
  const out = props.item.warnings.map((w) => props.p(w))
  const s = props.item.stats
  if (s?.twoColumnPages) out.push(props.p('twoCol', s.twoColumnPages))
  if (s?.ocrPages) out.push(props.p('ocrPages', s.ocrPages))
  return out
})
function onScroll() {
  const el = stripRef.value
  if (!el || !el.firstElementChild) return
  const w = (el.firstElementChild as HTMLElement).offsetWidth + 10
  current.value = Math.min(previewCount.value, Math.max(1, Math.round(el.scrollLeft / w) + 1))
  emit('need', current.value + 1)
}
onMounted(() => {
  emit('need', 1)
  emit('need', 2)
  emit('need', 3)
})
</script>
