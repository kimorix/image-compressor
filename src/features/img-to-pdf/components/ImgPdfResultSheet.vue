
<template>
  <!-- The finished output. `card`: the desktop right-panel card (file row,
  preview + download). `sheet`: the phone result sheet body (swipeable page
  previews, file / size / pages / notes rows, share-or-save, start over,
  change settings). -->
  <div class="i2p-result" :class="`i2p-result-${variant}`">
    <template v-if="variant === 'card'">
      <div class="i2p-result-head">
        <h3>{{ p('resultTitle') }}</h3>
        <span class="i2p-pill ok">{{ p('statusDone') }}</span>
      </div>
      <div class="i2p-file">
        <div class="i2p-file-thumb">
          <PaperThumb v-if="first" :thumb="first.thumb" :w="first.w" :h="first.h" :rotation="first.rotation" :layout="result.settings" :frame-h-w="frameHW" />
        </div>
        <div class="i2p-file-info">
          <strong :title="displayName">{{ displayName }}</strong>
          <span>{{ metaLine }}</span>
        </div>
      </div>
      <p v-if="notesText" class="i2p-result-notes">{{ notesText }}</p>
      <p v-if="stale" class="i2p-result-stale">{{ p('stale') }}</p>
      <div class="i2p-result-actions">
        <button type="button" @click="emit('preview')">{{ p('preview') }}</button>
        <button type="button" class="primary" @click="emit('download')">{{ isZip ? p('downloadZip') : p('downloadPdf') }}</button>
      </div>
    </template>
    <template v-else>
      <div class="i2p-strip" role="list">
        <div v-for="(t, i) in stripThumbs" :key="i" class="i2p-strip-page" role="listitem">
          <PaperThumb :thumb="t.thumb" :w="t.w" :h="t.h" :rotation="t.rotation" :layout="result.settings" :frame-h-w="frameHW" />
        </div>
      </div>
      <dl class="i2p-rows">
        <div><dt>{{ p('rFile') }}</dt><dd class="i2p-strong">{{ displayName }}</dd></div>
        <div><dt>{{ p('rSize') }}</dt><dd>{{ sizeLine }}</dd></div>
        <div><dt>{{ p('rPages') }}</dt><dd>{{ pagesLine }}</dd></div>
        <div v-if="notesText"><dt>{{ p('rNotes') }}</dt><dd class="i2p-warn">{{ notesText }}</dd></div>
      </dl>
      <p v-if="stale" class="i2p-result-stale">{{ p('stale') }}</p>
      <div class="i2p-result-actions">
        <button type="button" @click="emit('preview')">{{ p('preview') }}</button>
        <button type="button" class="primary" :disabled="sharing" @click="emit('share')">{{ p('sharePdf') }}</button>
      </div>
      <div class="i2p-result-links">
        <button type="button" class="i2p-link" @click="emit('restart')">{{ p('restart') }}</button>
        <button type="button" class="i2p-link accent" @click="emit('regenerate')">{{ p('regenerate') }}</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PaperThumb from './PaperThumb.vue'
import type { BuildResult } from '../types'
import { frameAspect } from '../lib/layout'
import { fmtSize } from '../../../shared/lib/format'

const props = defineProps<{
  result: BuildResult
  name: string
  variant: 'card' | 'sheet'
  stale?: boolean
  sharing?: boolean
  p: (key: string, ...args: (string | number)[]) => string
}>()
const emit = defineEmits<{
  (e: 'preview'): void
  (e: 'download'): void
  (e: 'share'): void
  (e: 'restart'): void
  (e: 'regenerate'): void
}>()

const frameHW = computed(() => frameAspect(props.result.settings.paper))
const first = computed(() => props.result.thumbs[0] ?? null)
const stripThumbs = computed(() => props.result.thumbs.slice(0, 24))
const isZip = computed(() => props.result.files.length > 1)
const displayName = computed(() => props.name)

const paperName = computed(() => {
  const s = props.result.settings
  return s.paper === 'fit' ? props.p('paperFit') : s.paper === 'letter' ? props.p('paperLetter') : props.p('paperA4')
})
const marginName = computed(() => props.p(`margin${props.result.settings.margin[0].toUpperCase()}${props.result.settings.margin.slice(1)}Long`))
const pagesWord = computed(() => props.p('pagesN', props.result.pages))
const metaLine = computed(() => [isZip.value ? props.p('filesCount', props.result.files.length) : pagesWord.value, fmtSize(props.result.bytes), paperName.value].join(' · '))
const pct = computed(() => {
  const { bytes, sourceBytes } = props.result
  if (!sourceBytes) return ''
  const d = Math.round((bytes / sourceBytes - 1) * 100)
  return `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}%`
})
const sizeLine = computed(() => props.p('sizeVs', fmtSize(props.result.bytes), fmtSize(props.result.sourceBytes), pct.value))
const pagesLine = computed(() => {
  const parts = [pagesWord.value, paperName.value, marginName.value]
  if (isZip.value) parts.unshift(props.p('filesCount', props.result.files.length))
  return parts.join(' · ')
})
const notesText = computed(() => {
  const n = props.result.notes
  const out: string[] = []
  if (n.heic) out.push(props.p('noteHeic', n.heic))
  if (n.landscape) out.push(props.p('noteLandscape', n.landscape))
  if (n.downscaled) out.push(props.p('noteDownscaled', n.downscaled))
  if (n.firstFrame) out.push(props.p('noteFirstFrame', n.firstFrame))
  if (n.skipped) out.push(props.p('noteSkipped', n.skipped))
  return out.join(props.p('listSep'))
})
</script>
