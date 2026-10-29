<template>
  <div class="pm-result">
    <div class="pm-result-head">
      <span class="pm-result-ok" aria-hidden="true"><Icon name="check" /></span>
      <div>
        <strong>{{ result.kind === 'merge' ? m('resultMerged') : m('resultSplit') }}</strong>
        <p>{{ m('resultMeta', result.files.length, total, (result.ms / 1000).toFixed(1)) }}</p>
      </div>
    </div>
    <ul class="pm-result-list">
      <li v-for="f in result.files.slice(0, limit)" :key="f.url" :style="{ '--pm-c': colorOf(f.color) }">
        <span class="pm-result-icon" aria-hidden="true"><i></i><i></i><i></i></span>
        <div class="pm-result-info">
          <strong :title="f.name">{{ f.name }}</strong>
          <span><span class="pm-dot" aria-hidden="true"></span>{{ m('pagesOf', f.pages) }} · {{ fmtSize(f.blob.size) }}</span>
        </div>
        <button type="button" class="pm-round" :title="touch ? m('share') : m('download')" :aria-label="(touch ? m('share') : m('download')) + ' ' + f.name" @click="emit('one', f)"><Icon :name="touch ? 'share' : 'download'" /></button>
      </li>
      <li v-if="result.files.length > limit" class="pm-result-more">+{{ result.files.length - limit }}</li>
    </ul>
    <p v-for="w in result.warnings" :key="w" class="pm-note warn">{{ m(w) }}</p>
    <div class="pm-result-actions">
      <template v-if="result.files.length > 1">
        <button type="button" :disabled="zipping" @click="emit('zip')">{{ zipping ? m('zipping') : m('zip') }}</button>
        <button v-if="touch" type="button" class="primary" @click="emit('shareAll')">{{ m('shareAll', result.files.length) }}</button>
      </template>
      <button v-else type="button" class="primary" @click="emit('one', result.files[0])">{{ touch ? m('share') : m('download') }}</button>
    </div>
    <button type="button" class="pm-link" @click="emit('close')">{{ m('continueEdit') }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { fmtSize } from '../../../shared/lib/format'
import type { OutFile, RunResult } from '../types'
import Icon from './Icon.vue'
import { colorOf } from '../lib/colors'

const props = defineProps<{ result: RunResult; zipping: boolean; touch: boolean; m: (k: string, ...a: (string | number)[]) => string }>()
const emit = defineEmits<{ (e: 'one', f: OutFile): void; (e: 'zip'): void; (e: 'shareAll'): void; (e: 'close'): void }>()
const limit = 60
const total = computed(() => fmtSize(props.result.files.reduce((s, f) => s + f.blob.size, 0)))
</script>
