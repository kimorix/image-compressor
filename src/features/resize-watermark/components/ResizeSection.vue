<template>
  <section class="rw-section">
    <label v-if="!bare" class="rw-section-head">
      <h3>{{ t('resizeTitle') }}</h3>
      <input class="rw-switch" type="checkbox" role="switch" :checked="r.enabled" :aria-label="t('resizeTitle')" @change="set({ enabled: checked($event) })" />
    </label>
    <label v-else class="rw-row rw-toggle-row">
      <span class="rw-label">{{ t('resizeTitle') }}</span>
      <input class="rw-switch" type="checkbox" role="switch" :checked="r.enabled" @change="set({ enabled: checked($event) })" />
    </label>
    <div class="rw-section-body" :class="{ 'rw-dim': !r.enabled }" :inert="!r.enabled ? true : undefined">
      <span class="rw-label" id="rwModeLabel">{{ t('resizeMode') }}</span>
      <div class="rw-seg rw-seg-4" role="radiogroup" aria-labelledby="rwModeLabel">
        <button v-for="m in MODES" :key="m.v" type="button" role="radio" :aria-checked="r.mode === m.v" :class="{ active: r.mode === m.v }" @click="set({ mode: m.v })">{{ t(m.k) }}</button>
      </div>

      <label v-if="r.mode === 'long'" class="rw-row">
        <span class="rw-label">{{ t('longLabel') }}</span>
        <input class="rw-input" type="number" inputmode="numeric" min="1" max="16384" :value="r.long" @change="set({ long: num($event, r.long) })" />
      </label>

      <RwSlider v-else-if="r.mode === 'pct'" :label="t('pctLabel')" :model-value="r.pct" :min="1" :max="400" unit="%" @update:model-value="(v: number) => set({ pct: v })" />

      <template v-else-if="r.mode === 'box'">
        <div class="rw-wh">
          <label class="rw-input-wrap">
            <input class="rw-input" type="number" inputmode="numeric" min="1" max="16384" :value="r.w" :aria-label="t('width')" @change="onW" />
            <span>{{ t('width') }}</span>
          </label>
          <button type="button" class="rw-lock" :class="{ active: r.lockRatio }" :aria-pressed="r.lockRatio" :title="r.lockRatio ? t('unlockRatio') : t('lockRatio')" :aria-label="r.lockRatio ? t('unlockRatio') : t('lockRatio')" @click="toggleLock">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7" /></svg>
          </button>
          <label class="rw-input-wrap">
            <input class="rw-input" type="number" inputmode="numeric" min="1" max="16384" :value="r.h" :aria-label="t('height')" @change="onH" />
            <span>{{ t('height') }}</span>
          </label>
        </div>
        <span class="rw-label" id="rwFitLabel">{{ t('fitLabel') }}</span>
        <div class="rw-seg rw-seg-3" role="radiogroup" aria-labelledby="rwFitLabel">
          <button v-for="f in FITS" :key="f.v" type="button" role="radio" :aria-checked="r.fit === f.v" :class="{ active: r.fit === f.v }" @click="set({ fit: f.v })">{{ t(f.k) }}</button>
        </div>
        <p class="rw-note">{{ fitDesc }}</p>
        <div v-if="r.fit === 'pad'" class="rw-row rw-pad-row">
          <span class="rw-label">{{ t('padColor') }}</span>
          <ColorSwatches :model-value="r.padColor" :label="t('padColor')" :custom-label="t('wmCustomColor')" @update:model-value="(c: string) => set({ padColor: c })" />
        </div>
        <label v-if="r.fit === 'pad'" class="rw-row rw-toggle-row">
          <span class="rw-label">{{ t('padTransparent') }}</span>
          <input class="rw-switch" type="checkbox" role="switch" :checked="r.padTransparent" @change="set({ padTransparent: checked($event) })" />
        </label>
        <span class="rw-label">{{ t('presetsLabel') }}</span>
        <PresetGrid :ids="QUICK_PRESETS" :active="quickActive" :t="t" @pick="pickQuick" />
      </template>

      <template v-else>
        <PresetGrid :active="r.preset" :t="t" @pick="(id: string) => set({ preset: id })" />
      </template>

      <label class="rw-row rw-toggle-row">
        <span class="rw-label">{{ t('noUpscale') }}</span>
        <input class="rw-switch" type="checkbox" role="switch" :checked="r.noUpscale" @change="set({ noUpscale: checked($event) })" />
      </label>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FitMode, ResizeMode, ResizeSettings, RwSettings } from '../types'
import { findPreset, QUICK_PRESETS } from '../lib/presets'
import { lockedHeight, lockedWidth } from '../lib/geometry'
import PresetGrid from './PresetGrid.vue'
import ColorSwatches from './ColorSwatches.vue'
import RwSlider from './RwSlider.vue'

const props = defineProps<{
  settings: RwSettings
  /** Size of the image in the preview (ratio lock reference); 0 when none. */
  refW: number
  refH: number
  bare?: boolean
  t: (key: string, ...a: (string | number)[]) => string
}>()
const emit = defineEmits<{ (e: 'update', s: RwSettings): void }>()

const MODES: { v: ResizeMode; k: string }[] = [
  { v: 'long', k: 'modeLong' }, { v: 'box', k: 'modeBox' }, { v: 'pct', k: 'modePct' }, { v: 'preset', k: 'modePreset' },
]
const FITS: { v: FitMode; k: string }[] = [{ v: 'contain', k: 'fitContain' }, { v: 'pad', k: 'fitPad' }, { v: 'cover', k: 'fitCover' }]

const r = computed(() => props.settings.resize)
const fitDesc = computed(() => {
  const { w, h, fit } = r.value
  return props.t(fit === 'cover' ? 'fitCoverDesc' : fit === 'pad' ? 'fitPadDesc' : 'fitContainDesc', w, h)
})
// A quick preset stays lit while the box still matches it.
const quickActive = computed(() => {
  const p = findPreset(r.value.preset)
  return p && p.w === r.value.w && p.h === r.value.h && r.value.fit === 'cover' ? p.id : null
})

function set(patch: Partial<ResizeSettings>) {
  emit('update', { ...props.settings, resize: { ...r.value, ...patch } })
}
const checked = (e: Event) => (e.target as HTMLInputElement).checked
function num(e: Event, d: number): number {
  const v = Math.round(Number((e.target as HTMLInputElement).value))
  const n = Number.isFinite(v) && v >= 1 ? Math.min(16384, v) : d
  ;(e.target as HTMLInputElement).value = String(n)
  return n
}
function onW(e: Event) {
  const w = num(e, r.value.w)
  if (r.value.lockRatio && props.refW && props.refH) set({ w, h: lockedHeight(w, props.refW, props.refH) })
  else set({ w })
}
function onH(e: Event) {
  const h = num(e, r.value.h)
  if (r.value.lockRatio && props.refW && props.refH) set({ h, w: lockedWidth(h, props.refW, props.refH) })
  else set({ h })
}
function toggleLock() {
  const lock = !r.value.lockRatio
  if (lock && props.refW && props.refH) set({ lockRatio: true, h: lockedHeight(r.value.w, props.refW, props.refH) })
  else set({ lockRatio: lock })
}
function pickQuick(id: string) {
  const p = findPreset(id)
  if (!p) return
  set({ preset: id, w: p.w, h: p.h || p.w, fit: 'cover', lockRatio: false })
}
</script>
