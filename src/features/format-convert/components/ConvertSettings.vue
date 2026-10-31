<template>
  <!-- Converter settings: shared by the desktop right-panel card and the
  phone settings sheet. Emits whole-object updates; the view persists. -->
  <div class="cv-settings">
    <div class="cv-field">
      <span class="cv-label" :id="`${uid}-fmt`">{{ p('outFormat') }}</span>
      <div class="cv-fmt" role="radiogroup" :aria-labelledby="`${uid}-fmt`">
        <div v-for="(row, r) in ROWS" :key="r" class="cv-chips" :class="{ more: r > 0 }">
          <button
            v-for="f in row"
            :key="f"
            type="button"
            role="radio"
            :aria-checked="settings.format === f"
            :class="{ active: settings.format === f }"
            :title="f === 'auto' ? undefined : FORMAT_LABEL[f]"
            @click="setFormat(f)"
          >{{ f === 'auto' ? p('fmtAuto') : CHIP_LABEL[f] ?? FORMAT_LABEL[f] }}</button>
        </div>
      </div>
      <p class="cv-note">{{ p(HINT[settings.format]) }}</p>
    </div>

    <div class="cv-field">
      <div class="cv-label-row">
        <label class="cv-label" :for="`${uid}-q`">{{ p('quality') }}</label>
        <strong v-if="qFormat" class="cv-qval">{{ settings.quality[qFormat] }}</strong>
      </div>
      <template v-if="qFormat">
        <input
          :id="`${uid}-q`"
          class="cv-range"
          type="range"
          min="1"
          max="100"
          step="1"
          :value="settings.quality[qFormat]"
          :style="{ '--fill': `${settings.quality[qFormat]}%` }"
          @input="setQuality(qFormat, ($event.target as HTMLInputElement).valueAsNumber)"
        />
        <div class="cv-range-ends" aria-hidden="true"><span>{{ p('smaller') }}</span><span>{{ p('sharper') }}</span></div>
        <p v-if="settings.format === 'auto'" class="cv-note">{{ p('qualityAuto', settings.quality.jpeg, settings.quality.webp) }}</p>
      </template>
      <p v-else class="cv-note">{{ settings.format === 'png' ? p('pngLossless') : settings.format === 'gif' ? p('gifNoQuality') : p('losslessNoQuality', FORMAT_LABEL[settings.format]) }}</p>
    </div>

    <div v-if="settings.format === 'ico'" class="cv-field">
      <span class="cv-label" :id="`${uid}-ico`">{{ p('icoSizes') }}</span>
      <div class="cv-chips cv-ico-sizes" role="group" :aria-labelledby="`${uid}-ico`">
        <button
          v-for="n in ICO_SIZE_CHOICES"
          :key="n"
          type="button"
          :aria-pressed="settings.icoSizes.includes(n)"
          :class="{ active: settings.icoSizes.includes(n) }"
          @click="toggleIco(n)"
        >{{ n }}</button>
      </div>
      <p class="cv-note">{{ p('icoSizesHint') }}</p>
    </div>

    <div v-if="showPages" class="cv-field">
      <span class="cv-label" :id="`${uid}-pages`">{{ p('tiffPages') }}</span>
      <div class="cv-chips" role="radiogroup" :aria-labelledby="`${uid}-pages`">
        <button type="button" role="radio" :aria-checked="settings.tiffPages === 'all'" :class="{ active: settings.tiffPages === 'all' }" @click="set({ tiffPages: 'all' })">{{ p('tiffPagesAll') }}</button>
        <button type="button" role="radio" :aria-checked="settings.tiffPages === 'first'" :class="{ active: settings.tiffPages === 'first' }" @click="set({ tiffPages: 'first' })">{{ p('tiffPagesFirst') }}</button>
      </div>
      <p v-if="settings.tiffPages === 'all'" class="cv-note">{{ p('tiffPagesHint') }}</p>
    </div>

    <div v-if="showFill" class="cv-field">
      <span class="cv-label" :id="`${uid}-fill`">{{ p('fill') }}</span>
      <div class="cv-fill" role="group" :aria-labelledby="`${uid}-fill`">
        <button
          v-for="sw in SWATCHES"
          :key="sw.hex"
          type="button"
          class="cv-swatch"
          :class="{ active: settings.fill === sw.hex }"
          :style="{ background: sw.hex }"
          :title="p(sw.label)"
          :aria-label="p(sw.label)"
          :aria-pressed="settings.fill === sw.hex"
          @click="setFill(sw.hex)"
        ></button>
        <input
          class="cv-input cv-hex"
          type="text"
          spellcheck="false"
          autocomplete="off"
          maxlength="7"
          :aria-label="p('fillHexAria')"
          :aria-invalid="hexBad ? 'true' : undefined"
          :value="hexDraft"
          @input="onHex(($event.target as HTMLInputElement).value)"
          @blur="hexDraft = settings.fill.toUpperCase()"
        />
      </div>
      <p class="cv-note">{{ p('fillHint') }}</p>
    </div>

    <label class="cv-toggle-row">
      <span><span class="cv-label">{{ p('keepExif') }}</span><small class="cv-note">{{ p('keepExifHint') }}</small></span>
      <input class="cv-switch" type="checkbox" role="switch" :checked="settings.keepExif" @change="set({ keepExif: ($event.target as HTMLInputElement).checked })" />
    </label>
    <label class="cv-toggle-row">
      <span><span class="cv-label">{{ p('keepName') }}</span><small v-if="!settings.keepName" class="cv-note">{{ p('keepNameHint') }}</small></span>
      <input class="cv-switch" type="checkbox" role="switch" :checked="settings.keepName" @change="set({ keepName: ($event.target as HTMLInputElement).checked })" />
    </label>

    <button v-if="showStart" type="button" class="primary cv-start" :disabled="!startCount" @click="emit('start')">{{ startCount ? p('startN', startCount) : p('start') }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ConvertSettings, FormatChoice, LossyFormat } from '../types'
import { clampQuality, FORMAT_LABEL, ICO_SIZE_CHOICES, isLossy, normalizeHex, OUT_FORMATS } from '../lib/convert'

const props = withDefaults(defineProps<{
  settings: ConvertSettings
  startCount: number
  showStart?: boolean
  /** A multi-page TIFF is in the list: offer every page / first page. */
  showPages?: boolean
  p: (key: string, ...args: (string | number)[]) => string
}>(), { showStart: true, showPages: false })
const emit = defineEmits<{ (e: 'update', s: ConvertSettings): void; (e: 'start'): void }>()

const uid = `cvs${Math.random().toString(36).slice(2, 8)}`

// Two rows: auto + the everyday four, then the specialist formats.
const ROWS: FormatChoice[][] = [['auto', ...OUT_FORMATS.slice(0, 4)], [...OUT_FORMATS.slice(4)]]
const CHIP_LABEL: Partial<Record<FormatChoice, string>> = { jxl: 'JXL' }
const HINT: Record<FormatChoice, string> = {
  auto: 'fmtHintAuto', jpeg: 'fmtHintJpeg', png: 'fmtHintPng', webp: 'fmtHintWebp', avif: 'fmtHintAvif',
  jxl: 'fmtHintJxl', gif: 'fmtHintGif', bmp: 'fmtHintBmp', tiff: 'fmtHintTiff', ico: 'fmtHintIco', qoi: 'fmtHintQoi',
}
const SWATCHES = [
  { hex: '#ffffff', label: 'fillWhite' },
  { hex: '#000000', label: 'fillBlack' },
  { hex: '#eeeeee', label: 'fillGray' },
]

/** Slider target: the chosen lossy format; auto edits JPEG (its usual pick). */
const qFormat = computed<LossyFormat | null>(() => {
  const f = props.settings.format
  if (f === 'auto') return 'jpeg'
  return isLossy(f) ? f : null
})
// Auto can land on JPEG for a transparent WebP/GIF, so the fill shows there too.
const showFill = computed(() => props.settings.format === 'jpeg' || props.settings.format === 'auto')

const hexDraft = ref(props.settings.fill.toUpperCase())
const hexBad = ref(false)
watch(() => props.settings.fill, (f) => {
  if (normalizeHex(hexDraft.value) !== f) hexDraft.value = f.toUpperCase()
})

function set(patch: Partial<ConvertSettings>) {
  emit('update', { ...props.settings, ...patch })
}
function setFormat(f: FormatChoice) {
  set({ format: f })
}
function setQuality(f: LossyFormat, q: number) {
  set({ quality: { ...props.settings.quality, [f]: clampQuality(q) } })
}
function toggleIco(n: number) {
  const cur = props.settings.icoSizes
  const next = cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort((a, b) => a - b)
  // At least one size stays selected.
  if (next.length) set({ icoSizes: next })
}
function setFill(hex: string) {
  hexDraft.value = hex.toUpperCase()
  hexBad.value = false
  set({ fill: hex })
}
function onHex(v: string) {
  hexDraft.value = v
  const n = normalizeHex(v)
  hexBad.value = !n && v.trim().length > 0
  if (n && n !== props.settings.fill) set({ fill: n })
}
</script>
