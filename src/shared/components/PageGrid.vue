<template>
  <!-- Sortable thumbnail grid shared by images to PDF and PDF merge/split.
  Pointer Events only (no sortable library): mouse drags after 4px, touch
  and pen pick up after a long press (~350ms, a short buzz) and a move
  beyond 8px before that leaves the page scrolling. While dragging, the
  other tiles shift to show the drop slot, the page auto-scrolls near the
  edges, and the floating tile shows "3 → 6". Keyboard: arrows move focus;
  Space picks up / drops, arrows then move the page, Escape cancels;
  Ctrl/⌘+arrows move without picking up; Enter toggles selection,
  Shift+arrows extend it; Delete removes; R / Shift+R rotate; D duplicates.
  Moves are announced in an aria-live region. Over `virtualizeOver` items
  only the visible rows (plus overscan) are rendered. The grid never
  mutates `items`: it emits reorder(from, to) and the parent applies it
  (moveItem from page-grid.ts does exactly that). -->
  <div
    ref="root"
    class="page-grid"
    :class="{ 'pg-dragging': drag.active, 'pg-virtual': virtual, 'pg-disabled': disabled }"
    :style="rootStyle"
    role="listbox"
    aria-multiselectable="true"
    :aria-label="ariaLabel"
    :aria-describedby="hintId"
  >
    <!-- FLIP moves via TransitionGroup; a plain div in virtual mode, where
    leaving rows must disappear at once (lingering ones shift the grid). -->
    <component :is="animated ? TransitionGroup : 'div'" v-bind="animated ? { tag: 'div', name: 'pg' } : {}" class="pg-inner" :style="innerStyle">
      <div
        v-for="(item, vi) in visible"
        :key="item.key"
        :ref="(el) => tileRef(el as HTMLElement | null, item.key)"
        class="pg-tile"
        :class="{
          'pg-selected': selSet.has(item.key),
          'pg-placeholder': drag.active && item.key === drag.key,
          'pg-grabbed': kbd.key === item.key,
          'pg-dimmed': item.dimmed,
          'pg-has-color': !!item.color,
        }"
        :style="item.color ? { '--pg-color': item.color } : undefined"
        role="option"
        :aria-selected="selSet.has(item.key)"
        :aria-label="m.page(offset + vi + 1) + (item.label ? ', ' + item.label : '')"
        :tabindex="(focusKey ?? display[0]?.key) === item.key ? 0 : -1"
        :data-key="item.key"
        @pointerdown="onDown($event, offset + vi)"
        @click="onClick($event, offset + vi)"
        @keydown="onKey($event, offset + vi)"
        @focus="focusKey = item.key"
      >
        <div class="pg-frame" :style="{ aspectRatio: `1 / ${pageAspect}` }">
          <slot name="tile" :item="item" :index="offset + vi">
            <img v-if="item.thumb" class="pg-img" :src="item.thumb" alt="" draggable="false" :style="imgStyle(item)" />
            <span v-else class="pg-wait" aria-hidden="true"></span>
          </slot>
          <span v-if="showNumbers" class="pg-num" aria-hidden="true">{{ offset + vi + 1 }}</span>
          <span v-if="selSet.has(item.key)" class="pg-check" aria-hidden="true">✓</span>
          <div v-if="actions.length && !disabled" class="pg-actions" @pointerdown.stop @click.stop>
            <button
              v-for="a in actions"
              :key="a"
              type="button"
              class="pg-act"
              :class="`pg-act-${a}`"
              tabindex="-1"
              :title="m[a]"
              :aria-label="m[a]"
              @click="emit('action', item.key, a)"
            ><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="ICONS[a]" /></svg></button>
          </div>
        </div>
        <div v-if="item.label || item.tag" class="pg-caption">
          <span v-if="item.label" class="pg-label" :title="item.label">{{ item.label }}</span>
          <span v-if="item.tag" class="pg-tag" :class="item.tagKind ? `pg-tag-${item.tagKind}` : ''">{{ item.tag }}</span>
        </div>
      </div>
    </component>
    <div v-if="drag.active && dragItem" class="pg-ghost" :style="ghostStyle" aria-hidden="true">
      <div class="pg-frame" :style="{ aspectRatio: `1 / ${pageAspect}` }">
        <img v-if="dragItem.thumb" class="pg-img" :src="dragItem.thumb" alt="" draggable="false" :style="imgStyle(dragItem)" />
      </div>
      <span class="pg-ghost-badge">{{ m.moveBadge(drag.from + 1, drag.to + 1) }}</span>
    </div>
    <p :id="hintId" class="pg-sr">{{ m.instructions }}</p>
    <div class="pg-sr" aria-live="assertive" aria-atomic="true">{{ live }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, TransitionGroup, watch } from 'vue'
import {
  autoScrollStep, columnsFor, gridIndexAt, keyTarget, moveItem, nextSelection, normRotation,
  rotatedScale, virtualRows, type GridGeom, type PageAction, type PageGridItem,
} from './page-grid'

export interface PageGridMessages {
  page: (n: number) => string
  moveBadge: (from: number, to: number) => string
  moved: (from: number, to: number) => string
  picked: (n: number) => string
  dropped: (n: number) => string
  cancelled: string
  instructions: string
  rotateL: string
  rotateR: string
  dup: string
  delete: string
}

const DEFAULT_MESSAGES: PageGridMessages = {
  page: (n) => `Page ${n}`,
  moveBadge: (from, to) => `${from} → ${to}`,
  moved: (from, to) => `Page ${from} moved to position ${to}`,
  picked: (n) => `Picked up page ${n}. Arrow keys move it, Space drops it, Escape cancels.`,
  dropped: (n) => `Dropped at position ${n}`,
  cancelled: 'Move cancelled',
  instructions: 'Space picks up a page, arrow keys move it. Enter selects. Delete removes, R rotates.',
  rotateL: 'Rotate left',
  rotateR: 'Rotate right',
  dup: 'Duplicate',
  delete: 'Delete',
}

const ICONS: Record<PageAction, string> = {
  rotateL: 'M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8M3 3v5h5',
  rotateR: 'M21 12a9 9 0 11-9-9 9.7 9.7 0 016.7 2.8L21 8M21 3v5h-5',
  dup: 'M8 8h12v12H8zM4 16V4h12',
  delete: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
}

const props = withDefaults(defineProps<{
  items: PageGridItem[]
  selection?: string[]
  /** Fixed column count, or 'auto' (as many `minTileWidth` tiles as fit, ≥ 2). */
  columns?: number | 'auto'
  minTileWidth?: number
  gap?: number
  /** Tile frame height / width (A4 portrait ≈ 1.414). */
  pageAspect?: number
  showNumbers?: boolean
  actions?: PageAction[]
  /** Touch "select mode": a tap toggles instead of replacing the selection. */
  selectMode?: boolean
  /** Lock the grid (e.g. while generating): no drag, no actions, no keyboard moves. */
  disabled?: boolean
  longPressMs?: number
  virtualizeOver?: number
  /** FLIP animation when tiles change place (off in virtual mode). */
  animate?: boolean
  ariaLabel?: string
  messages?: Partial<PageGridMessages>
}>(), {
  selection: () => [],
  columns: 'auto',
  minTileWidth: 104,
  gap: 12,
  pageAspect: 1.414,
  showNumbers: true,
  actions: () => ['rotateL', 'rotateR', 'delete'],
  selectMode: false,
  disabled: false,
  longPressMs: 350,
  virtualizeOver: 200,
  animate: true,
  ariaLabel: undefined,
  messages: () => ({}),
})

const emit = defineEmits<{
  (e: 'reorder', from: number, to: number): void
  (e: 'select', keys: string[]): void
  (e: 'action', key: string, action: PageAction): void
  /** A tile without a thumbnail scrolled into (or near) view; may repeat. */
  (e: 'need-thumb', key: string): void
  /** Pointer drag started / ended (e.g. to show a "Done" button or dim chrome). */
  (e: 'drag', active: boolean): void
}>()

const m = computed<PageGridMessages>(() => ({ ...DEFAULT_MESSAGES, ...props.messages }))
const hintId = `pg-hint-${Math.random().toString(36).slice(2, 8)}`
const root = ref<HTMLElement | null>(null)
const selSet = computed(() => new Set(props.selection))
const live = ref('')
const focusKey = ref<string | null>(null)
let anchor: string | null = null

// ---- geometry ----
const width = ref(0)
const measuredRowH = ref(0)
const cols = computed(() => columnsFor(width.value || 600, props.minTileWidth, props.gap, props.columns === 'auto' ? undefined : props.columns))
const colW = computed(() => Math.max(1, ((width.value || 600) - props.gap * (cols.value - 1)) / cols.value))
const rowH = computed(() => measuredRowH.value || Math.round(colW.value * props.pageAspect + 24))
const geom = computed<GridGeom>(() => ({ cols: cols.value, colW: colW.value, rowH: rowH.value, gap: props.gap, n: props.items.length }))

// ---- drag state ----
const drag = reactive({ active: false, key: '', from: -1, to: -1, x: 0, y: 0, offX: 0, offY: 0, w: 0 })
const kbd = reactive<{ key: string | null; origin: number }>({ key: null, origin: -1 })
const dragItem = computed(() => props.items.find((i) => i.key === drag.key) ?? null)

/** Display order: the real order, or the preview order while dragging. */
const display = computed(() => (drag.active && drag.from >= 0 ? moveItem(props.items, drag.from, drag.to) : props.items))

// ---- virtualization ----
const virtual = computed(() => props.items.length > props.virtualizeOver)
const animated = computed(() => props.animate && !virtual.value)
const viewTop = ref(0)
const viewH = ref(typeof window !== 'undefined' ? window.innerHeight : 800)
const rowsRange = computed(() => (virtual.value ? virtualRows(viewTop.value, viewH.value, geom.value, 3) : { start: 0, end: Math.ceil(props.items.length / cols.value) }))
const offset = computed(() => rowsRange.value.start * cols.value)
const visible = computed(() => (virtual.value ? display.value.slice(offset.value, rowsRange.value.end * cols.value) : display.value))
const totalRows = computed(() => Math.ceil(props.items.length / cols.value))
const rootStyle = computed(() => (virtual.value ? { height: `${Math.max(0, totalRows.value * (rowH.value + props.gap) - props.gap)}px` } : undefined))
const innerStyle = computed(() => ({
  gridTemplateColumns: `repeat(${cols.value}, minmax(0, 1fr))`,
  gap: `${props.gap}px`,
  ...(virtual.value ? { transform: `translateY(${rowsRange.value.start * (rowH.value + props.gap)}px)` } : {}),
}))
const ghostStyle = computed(() => ({ left: `${drag.x - drag.offX}px`, top: `${drag.y - drag.offY}px`, width: `${drag.w}px` }))

function imgStyle(item: PageGridItem) {
  const rot = normRotation(item.rotate ?? 0)
  if (!rot) return undefined
  const s = rotatedScale(item.aspect ?? 1 / props.pageAspect, props.pageAspect, rot)
  return { transform: `rotate(${rot}deg) scale(${s})` }
}

// ---- scroll parent (auto-scroll, virtualization, need-thumb root) ----
let scroller: HTMLElement | null = null
function findScroller(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return null
}
function viewport(): { top: number; bottom: number } {
  if (scroller) {
    const r = scroller.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom }
  }
  return { top: 0, bottom: window.innerHeight }
}
function updateView() {
  if (!root.value) return
  const r = root.value.getBoundingClientRect()
  const vp = viewport()
  viewTop.value = Math.max(0, vp.top - r.top)
  viewH.value = vp.bottom - vp.top
}

// ---- tiles: element map, need-thumb observer, row height ----
const tileEls = new Map<string, HTMLElement>()
let io: IntersectionObserver | null = null
function tileRef(el: HTMLElement | null, key: string) {
  const old = tileEls.get(key)
  if (old === el) return
  if (old) io?.unobserve(old)
  if (el) {
    tileEls.set(key, el)
    io?.observe(el)
  } else tileEls.delete(key)
}
function onIntersect(entries: IntersectionObserverEntry[]) {
  for (const e of entries) {
    if (!e.isIntersecting) continue
    const key = (e.target as HTMLElement).dataset.key
    if (!key) continue
    const item = props.items.find((i) => i.key === key)
    if (item && !item.thumb) emit('need-thumb', key)
  }
}
function measure() {
  if (!root.value) return
  width.value = root.value.clientWidth
  const first = tileEls.values().next().value as HTMLElement | undefined
  if (first && first.offsetHeight) measuredRowH.value = first.offsetHeight
}

let ro: ResizeObserver | null = null
const onScroll = () => {
  updateView()
  if (drag.active) updateTarget()
}
onMounted(() => {
  scroller = findScroller(root.value)
  measure()
  updateView()
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    ro = new ResizeObserver(() => { measure(); updateView() })
    ro.observe(root.value)
  }
  if (typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver(onIntersect, { root: scroller, rootMargin: '50% 0px' })
    for (const el of tileEls.values()) io.observe(el)
  }
  ;(scroller ?? window).addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
})
watch(() => [props.items.length, cols.value, props.pageAspect], () => void nextTick(measure))

// ---- pointer drag ----
let pending: { id: number; idx: number; x: number; y: number; touch: boolean; timer: ReturnType<typeof setTimeout> | null } | null = null
let suppressClick = false
let raf = 0

function onDown(e: PointerEvent, idx: number) {
  if (props.disabled || e.button !== 0 || pending || drag.active) return
  const touch = e.pointerType !== 'mouse'
  pending = { id: e.pointerId, idx, x: e.clientX, y: e.clientY, touch, timer: null }
  if (touch) pending.timer = setTimeout(() => startDrag(), props.longPressMs)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
}

function startDrag() {
  if (!pending) return
  const item = props.items[pending.idx]
  const el = item && tileEls.get(item.key)
  if (!item || !el) { endPointer(); return }
  const r = el.getBoundingClientRect()
  Object.assign(drag, { active: true, key: item.key, from: pending.idx, to: pending.idx, x: pending.x, y: pending.y, offX: pending.x - r.left, offY: pending.y - r.top, w: r.width })
  if (pending.timer) clearTimeout(pending.timer)
  pending.timer = null
  if (pending.touch) {
    try { navigator.vibrate?.(10) } catch { /* unsupported */ }
    // Keep the page from scrolling under the finger while a tile is held.
    document.addEventListener('touchmove', blockTouch, { passive: false })
  }
  suppressClick = true
  live.value = m.value.picked(pending.idx + 1)
  emit('drag', true)
  raf = requestAnimationFrame(autoScroll)
}

function blockTouch(e: TouchEvent) {
  if (drag.active) e.preventDefault()
}

function onMove(e: PointerEvent) {
  if (!pending || e.pointerId !== pending.id) return
  if (!drag.active) {
    const d = Math.hypot(e.clientX - pending.x, e.clientY - pending.y)
    if (pending.touch) {
      // Moving before the long press completes means scrolling.
      if (d > 8) endPointer()
      return
    }
    if (d < 4) return
    startDrag()
  }
  drag.x = e.clientX
  drag.y = e.clientY
  updateTarget()
}

function updateTarget() {
  if (!root.value) return
  const r = root.value.getBoundingClientRect()
  // Hit-test the centre of the floating tile, not the finger: the drop slot
  // then matches what the user sees.
  const cx = drag.x - drag.offX + drag.w / 2 - r.left
  const cy = drag.y - drag.offY + rowH.value / 2 - r.top
  const to = gridIndexAt(cx, cy, geom.value)
  if (to >= 0) drag.to = to
}

function autoScroll() {
  if (!drag.active) return
  const vp = viewport()
  const step = autoScrollStep(drag.y, vp.top, vp.bottom)
  if (step) {
    if (scroller) scroller.scrollTop += step
    else window.scrollBy(0, step)
    updateTarget()
  }
  raf = requestAnimationFrame(autoScroll)
}

function onUp(e: PointerEvent) {
  if (!pending || e.pointerId !== pending.id) return
  if (drag.active) {
    const { from, to } = drag
    if (to !== from) {
      emit('reorder', from, to)
      live.value = m.value.moved(from + 1, to + 1)
    } else live.value = m.value.dropped(to + 1)
    focusKey.value = drag.key
  }
  endPointer()
}

function onCancel(e: PointerEvent) {
  if (!pending || e.pointerId !== pending.id) return
  if (drag.active) live.value = m.value.cancelled
  endPointer()
}

function endPointer() {
  if (pending?.timer) clearTimeout(pending.timer)
  pending = null
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onCancel)
  document.removeEventListener('touchmove', blockTouch)
  cancelAnimationFrame(raf)
  if (drag.active) {
    drag.active = false
    drag.from = drag.to = -1
    drag.key = ''
    emit('drag', false)
    // The click that ends a mouse drag must not also select.
    setTimeout(() => { suppressClick = false }, 0)
  }
}

// ---- click selection ----
function onClick(e: MouseEvent, idx: number) {
  if (suppressClick) { suppressClick = false; return }
  const item = display.value[idx]
  if (!item) return
  const order = props.items.map((i) => i.key)
  const mod = { shift: e.shiftKey, toggle: e.ctrlKey || e.metaKey || props.selectMode }
  emit('select', nextSelection(order, props.selection, anchor, item.key, mod))
  if (!e.shiftKey) anchor = item.key
  focusKey.value = item.key
}

// ---- keyboard ----
function focusByKey(key: string) {
  focusKey.value = key
  void nextTick(() => {
    const idx = props.items.findIndex((i) => i.key === key)
    if (virtual.value && idx >= 0 && root.value) {
      // Bring the row into the rendered window first.
      const row = Math.floor(idx / cols.value)
      if (row < rowsRange.value.start || row >= rowsRange.value.end) {
        const y = root.value.getBoundingClientRect().top + row * (rowH.value + props.gap)
        const vp = viewport()
        const delta = y - vp.top - (vp.bottom - vp.top) / 3
        if (scroller) scroller.scrollTop += delta
        else window.scrollBy(0, delta)
        updateView()
      }
    }
    focusEl(key, 4)
  })
}
// The tile may only exist after the virtual window re-renders: retry for a
// few frames.
function focusEl(key: string, tries: number) {
  const el = root.value?.querySelector<HTMLElement>(`.pg-tile[data-key="${CSS.escape(key)}"]`)
  if (el) { el.focus({ preventScroll: false }); return }
  if (tries > 0) requestAnimationFrame(() => focusEl(key, tries - 1))
}

function onKey(e: KeyboardEvent, idx: number) {
  const item = props.items[idx]
  if (!item) return
  const n = props.items.length
  const target = keyTarget(e.key, idx, cols.value, n)
  const mod = e.ctrlKey || e.metaKey
  if (target !== null) {
    e.preventDefault()
    if (!props.disabled && (kbd.key === item.key || mod)) {
      if (target !== idx) {
        emit('reorder', idx, target)
        live.value = m.value.moved(idx + 1, target + 1)
      }
      focusByKey(item.key)
      return
    }
    const to = props.items[target]
    if (e.shiftKey && to) {
      const order = props.items.map((i) => i.key)
      emit('select', nextSelection(order, props.selection, anchor ?? item.key, to.key, { shift: true }))
      if (!anchor) anchor = item.key
    }
    if (to) focusByKey(to.key)
    return
  }
  switch (e.key) {
    case ' ':
      e.preventDefault()
      if (props.disabled) return
      if (kbd.key === item.key) {
        kbd.key = null
        live.value = m.value.dropped(idx + 1)
      } else {
        kbd.key = item.key
        kbd.origin = idx
        live.value = m.value.picked(idx + 1)
      }
      return
    case 'Escape':
      if (kbd.key === item.key) {
        e.preventDefault()
        if (kbd.origin >= 0 && kbd.origin !== idx) emit('reorder', idx, kbd.origin)
        kbd.key = null
        live.value = m.value.cancelled
        focusByKey(item.key)
      }
      return
    case 'Enter': {
      e.preventDefault()
      const order = props.items.map((i) => i.key)
      emit('select', nextSelection(order, props.selection, anchor, item.key, { toggle: true }))
      anchor = item.key
      return
    }
    case 'Delete':
    case 'Backspace':
      if (!props.disabled && props.actions.includes('delete')) { e.preventDefault(); emit('action', item.key, 'delete') }
      return
    case 'r':
    case 'R': {
      const a: PageAction = e.shiftKey ? 'rotateL' : 'rotateR'
      if (!props.disabled && props.actions.includes(a) && !mod) { e.preventDefault(); emit('action', item.key, a) }
      return
    }
    case 'd':
    case 'D':
      if (!props.disabled && props.actions.includes('dup') && !mod) { e.preventDefault(); emit('action', item.key, 'dup') }
      return
  }
}

// A page removed while picked up by keyboard drops the grab.
watch(() => props.items, (items) => {
  if (kbd.key && !items.some((i) => i.key === kbd.key)) kbd.key = null
  if (focusKey.value && !items.some((i) => i.key === focusKey.value)) focusKey.value = null
})

onBeforeUnmount(() => {
  endPointer()
  ro?.disconnect()
  io?.disconnect()
  ;(scroller ?? window).removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
})
</script>

<style lang="less">
.page-grid {
  position: relative;
  min-width: 0;
  // Virtual mode swaps the rendered rows on scroll; scroll anchoring would
  // "correct" the scroll position against those swaps.
  overflow-anchor: none;
}
.pg-inner {
  display: grid;
  align-items: start;
}
.pg-tile {
  position: relative;
  min-width: 0;
  border-radius: 10px;
  outline: none;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: pan-y;
  &:focus-visible .pg-frame {
    box-shadow: 0 0 0 2px var(--accent);
  }
}
.pg-disabled .pg-tile {
  cursor: default;
}
.pg-frame {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 8px;
  // Paper stays white in dark mode (it is what the PDF will look like).
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}
.pg-has-color .pg-frame {
  border-left: 4px solid var(--pg-color);
}
.pg-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  transition: transform 0.18s ease;
}
.pg-wait {
  width: 40%;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(90deg, #e5e7eb, #cbd5e1, #e5e7eb);
  background-size: 200% 100%;
  animation: pg-wait 1.2s linear infinite;
}
@keyframes pg-wait {
  to { background-position: -200% 0; }
}
.pg-num {
  position: absolute;
  top: 6px;
  left: 6px;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.72);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 20px;
  text-align: center;
}
.pg-check {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  line-height: 20px;
  text-align: center;
}
.pg-selected .pg-frame {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent);
}
.pg-dimmed .pg-frame {
  opacity: 0.45;
  background-image: repeating-linear-gradient(135deg, transparent 0 8px, rgba(220, 38, 38, 0.12) 8px 16px);
}
.pg-actions {
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: none;
  gap: 4px;
}
@media (hover: hover) {
  .pg-tile:hover .pg-actions,
  .pg-tile:focus-within .pg-actions {
    display: flex;
  }
}
.pg-selected .pg-actions {
  display: flex;
}
.pg-dragging .pg-actions {
  display: none !important;
}
.pg-act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-height: 0;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  color: var(--text);
  cursor: pointer;
  svg {
    width: 15px;
    height: 15px;
  }
  &.pg-act-delete {
    color: var(--red, #dc2626);
  }
}
.pg-caption {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  margin-top: 4px;
  font-size: 12px;
  line-height: 18px;
  color: var(--subtle);
}
.pg-label {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.pg-tag {
  flex: none;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  &.pg-tag-warn {
    background: rgba(234, 88, 12, 0.12);
    color: #c2410c;
  }
  &.pg-tag-bad {
    background: rgba(220, 38, 38, 0.12);
    color: #b91c1c;
  }
}
// Drop slot: the dragged tile's place in the preview order.
.pg-placeholder .pg-frame {
  border: 2px dashed var(--accent);
  background: var(--accent-soft);
  box-shadow: none;
  > * {
    visibility: hidden;
  }
}
.pg-placeholder .pg-caption {
  visibility: hidden;
}
.pg-grabbed .pg-frame {
  box-shadow: 0 0 0 3px var(--accent), 0 8px 20px rgba(15, 23, 42, 0.2);
  transform: scale(1.03);
}
.pg-ghost {
  position: fixed;
  z-index: 60;
  pointer-events: none;
  transform: scale(1.06) rotate(-1.5deg);
  transform-origin: center;
  .pg-frame {
    border: 2px solid var(--accent);
    box-shadow: 0 14px 32px rgba(15, 23, 42, 0.28);
  }
}
.pg-ghost-badge {
  position: absolute;
  left: 50%;
  bottom: -12px;
  transform: translateX(-50%);
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.pg-dragging .pg-tile:not(.pg-placeholder) {
  opacity: 0.85;
}
.pg-move {
  transition: transform 0.18s ease;
}
.pg-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
@media (prefers-reduced-motion: reduce) {
  .pg-move,
  .pg-img {
    transition: none;
  }
  .pg-wait {
    animation: none;
  }
}
</style>
