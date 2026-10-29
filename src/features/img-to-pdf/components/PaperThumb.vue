
<template>
  <!-- One page as it will be generated: the paper (white, in the tile's
  portrait frame, letterboxed when the page is landscape) with the picture
  placed by the same layout function the PDF builder uses. CSS only. -->
  <div class="i2p-paper-frame">
    <div class="i2p-paper" :style="pct(boxes.page)">
      <div class="i2p-imgbox" :style="pct(boxes.img)">
        <img v-if="thumb" :src="thumb" alt="" draggable="false" :style="imgStyle" />
        <span v-else-if="state === 'loading'" class="i2p-wait" aria-hidden="true"></span>
        <span v-else-if="state === 'error'" class="i2p-bad" aria-hidden="true">!</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { layoutPage, previewBoxes, type LayoutSettings } from '../lib/layout'
import { normRotation } from '../../../shared/components/page-grid'

const props = defineProps<{
  thumb: string | null
  /** Displayed px size (EXIF applied); 0 while loading (A4-ish placeholder). */
  w: number
  h: number
  rotation: number
  layout: LayoutSettings
  frameHW: number
  state?: 'loading' | 'ready' | 'error'
  /** 'top': a landscape page sits at the top of the frame (grid tiles, so
   * the page number badge lands on the paper's corner). */
  valign?: 'center' | 'top'
}>()

const l = computed(() => layoutPage(props.w || 3, props.h || 4, props.rotation, props.layout))
const boxes = computed(() => {
  const b = previewBoxes(l.value, props.frameHW)
  return props.valign === 'top' ? { ...b, page: { ...b.page, top: 0 } } : b
})
const pct = (b: { left: number; top: number; width: number; height: number }) =>
  ({ left: `${b.left}%`, top: `${b.top}%`, width: `${b.width}%`, height: `${b.height}%` })

// The thumbnail is unrotated; at 90°/270° it is sized to the swapped box
// and turned about its centre, so it lands exactly on the image rectangle.
const imgStyle = computed(() => {
  const rot = normRotation(props.rotation)
  if (!rot) return undefined
  if (rot === 180) return { transform: 'rotate(180deg)' }
  const r = l.value.h / l.value.w // box h / w
  return {
    width: `${r * 100}%`,
    height: `${(1 / r) * 100}%`,
    left: '50%',
    top: '50%',
    transform: `translate(-50%, -50%) rotate(${rot}deg)`,
  }
})
</script>
