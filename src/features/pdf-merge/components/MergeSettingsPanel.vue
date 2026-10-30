<template>
  <div class="pm-settings">
    <label class="pm-field">
      <span class="pm-label">{{ m('fileName') }}</span>
      <span class="pm-input-wrap">
        <input class="pm-input" type="text" :value="settings.fileName" :placeholder="placeholderName" autocomplete="off" spellcheck="false" @input="set({ fileName: ($event.target as HTMLInputElement).value })" />
        <span class="pm-input-ext" aria-hidden="true">.pdf</span>
      </span>
    </label>
    <div class="pm-field">
      <span class="pm-label" id="pmSizeLabel">{{ m('pageSize') }}</span>
      <SegmentedControl
        variant="chips"
        :model-value="settings.pageSize"
        :options="[{ value: 'keep', label: m('sizeKeep') }, { value: 'a4', label: m('sizeA4') }, { value: 'first', label: m('sizeFirst') }]"
        :aria-label="m('pageSize')"
        @update:model-value="(v: PageSizeMode) => set({ pageSize: v })"
      />
      <p class="pm-note">{{ m('sizeHint') }}</p>
    </div>
    <label class="pm-toggle">
      <span><span class="pm-toggle-title">{{ m('bookmarks') }}</span><small>{{ m('bookmarksHint') }}</small></span>
      <input class="pm-switch" type="checkbox" role="switch" :checked="settings.bookmarks" @change="set({ bookmarks: ($event.target as HTMLInputElement).checked })" />
    </label>
    <label class="pm-toggle">
      <span><span class="pm-toggle-title">{{ m('keepForms') }}</span><small v-if="!settings.keepForms">{{ m('keepFormsOff') }}</small></span>
      <input class="pm-switch" type="checkbox" role="switch" :checked="settings.keepForms" @change="set({ keepForms: ($event.target as HTMLInputElement).checked })" />
    </label>
    <label class="pm-toggle">
      <span><span class="pm-toggle-title">{{ m('blankBetween') }}</span><small>{{ m('blankHint') }}</small></span>
      <input class="pm-switch" type="checkbox" role="switch" :checked="settings.blankBetween" @change="set({ blankBetween: ($event.target as HTMLInputElement).checked })" />
    </label>
    <dl class="pm-summary">
      <div><dt>{{ m('labelSources') }}</dt><dd>{{ m('sumSources', summary.sources, summary.unusable) }}</dd></div>
      <div><dt>{{ m('labelOutput') }}</dt><dd>{{ m('sumOutput', summary.pages, summary.deleted, summary.rotated) }}</dd></div>
      <div><dt>{{ m('labelEstimate') }}</dt><dd>{{ m('sumEstimate', summary.estimate) }}</dd></div>
    </dl>
    <p v-if="note" class="pm-note warn">{{ note }}</p>
    <div v-if="busy" class="pm-run">
      <div class="pm-progress" role="progressbar" :aria-valuenow="Math.round(progress * 100)" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: `${Math.round(progress * 100)}%` }"></span></div>
      <div class="pm-run-row"><span>{{ m('progress', Math.round(progress * 100)) }}</span><button type="button" @click="emit('cancel')">{{ m('cancel') }}</button></div>
    </div>
    <button v-else type="button" class="primary pm-go" :disabled="!canRun" @click="emit('run')">{{ m('mergeDownload') }}</button>
    <p class="pm-kbd">{{ m('kbdHint') }}</p>
  </div>
</template>

<script setup lang="ts">
import SegmentedControl from '../../../shared/components/SegmentedControl.vue'
import type { MergeSettings, PageSizeMode } from '../types'

export interface MergeSummary { sources: number; unusable: number; pages: number; deleted: number; rotated: number; estimate: string }

const props = defineProps<{
  settings: MergeSettings
  placeholderName: string
  summary: MergeSummary
  canRun: boolean
  busy: boolean
  progress: number
  note?: string
  m: (k: string, ...a: (string | number)[]) => string
}>()
const emit = defineEmits<{ (e: 'update', s: MergeSettings): void; (e: 'run'): void; (e: 'cancel'): void }>()
function set(patch: Partial<MergeSettings>) {
  emit('update', { ...props.settings, ...patch })
}
</script>
