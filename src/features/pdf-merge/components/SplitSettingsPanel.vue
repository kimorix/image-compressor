<template>
  <div class="pm-settings">
    <div class="pm-field">
      <span class="pm-label">{{ m('splitBy') }}</span>
      <div class="pm-kinds" role="radiogroup" :aria-label="m('splitBy')">
        <button
          v-for="k in KINDS"
          :key="k.value"
          type="button"
          role="radio"
          class="pm-kind"
          :class="{ active: settings.kind === k.value }"
          :aria-checked="settings.kind === k.value"
          @click="set({ kind: k.value })"
        >{{ m(k.label) }}</button>
      </div>
    </div>
    <label v-if="settings.kind === 'ranges'" class="pm-field">
      <span class="pm-label">{{ m('rangeLabel') }}</span>
      <input class="pm-input" :class="{ bad: !!error && settings.ranges.trim() !== '' }" type="text" inputmode="text" :value="settings.ranges" :placeholder="m('rangePh')" autocomplete="off" spellcheck="false" @input="set({ ranges: ($event.target as HTMLInputElement).value })" />
      <span class="pm-note">{{ m('rangeHint') }}</span>
    </label>
    <label v-else-if="settings.kind === 'every'" class="pm-field">
      <span class="pm-label">{{ m('nLabel') }}</span>
      <input class="pm-input pm-input-n" type="number" min="1" step="1" inputmode="numeric" :value="settings.every" @input="set({ every: Number(($event.target as HTMLInputElement).value) })" />
    </label>
    <p v-else-if="settings.kind === 'selected'" class="pm-note">{{ selectedCount ? m('selectedInfo', selectedCount) : m('noSelection') }}</p>
    <p v-else class="pm-note">{{ m('singleInfo', outputs) }}</p>

    <p v-if="error && (settings.kind !== 'ranges' || settings.ranges.trim() !== '') && settings.kind !== 'selected'" class="pm-note bad" role="alert">{{ m(error) }}</p>
    <ul v-if="preview.length" class="pm-groups" :aria-label="m('splitN', outputs)">
      <li v-for="(g, i) in preview.slice(0, 12)" :key="i" :style="{ '--pm-c': g.color }">
        <strong><span class="pm-dot" aria-hidden="true"></span>{{ g.label }}</strong>
        <span>{{ m('groupPages', g.pages) }}</span>
      </li>
      <li v-if="preview.length > 12" class="pm-groups-more">+{{ preview.length - 12 }}</li>
    </ul>
    <p v-if="files > 1" class="pm-note">{{ m('splitEach') }}</p>

    <label class="pm-field">
      <span class="pm-label pm-label-row">{{ m('nameTemplate') }}<span class="pm-sample">{{ sampleName }}</span></span>
      <input class="pm-input" type="text" :value="settings.template" placeholder="{name}_{range}" autocomplete="off" spellcheck="false" @input="set({ template: ($event.target as HTMLInputElement).value })" />
      <span class="pm-note">{{ m('nameTplHint') }}</span>
    </label>

    <div v-if="busy" class="pm-run">
      <div class="pm-progress" role="progressbar" :aria-valuenow="Math.round(progress * 100)" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: `${Math.round(progress * 100)}%` }"></span></div>
      <div class="pm-run-row"><span>{{ m('progress', Math.round(progress * 100)) }}</span><button type="button" @click="emit('cancel')">{{ m('cancel') }}</button></div>
    </div>
    <button v-else type="button" class="primary pm-go" :disabled="!canRun" @click="emit('run')">{{ m('splitN', outputs) }}</button>
  </div>
</template>

<script setup lang="ts">
import type { SplitKind, SplitSettings } from '../types'

export interface GroupPreview { label: string; pages: number; color: string }

const KINDS: { value: SplitKind; label: string }[] = [
  { value: 'ranges', label: 'byRanges' },
  { value: 'every', label: 'everyN' },
  { value: 'selected', label: 'extractSelected' },
  { value: 'single', label: 'onePerPage' },
]

const props = defineProps<{
  settings: SplitSettings
  preview: GroupPreview[]
  error: string | null
  outputs: number
  files: number
  selectedCount: number
  sampleName: string
  canRun: boolean
  busy: boolean
  progress: number
  m: (k: string, ...a: (string | number)[]) => string
}>()
const emit = defineEmits<{ (e: 'update', s: SplitSettings): void; (e: 'run'): void; (e: 'cancel'): void }>()
function set(patch: Partial<SplitSettings>) {
  emit('update', { ...props.settings, ...patch })
}
</script>
