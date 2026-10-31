<template>
  <!-- Side nav (≥720px): tools grouped as image tools / PDF tools, then the
  compressor history, then the active feature's info card (slot). It is
  either the full 220px sidebar or a 64px icon rail (useSideNav decides;
  the toggle at the top switches). Every entry emits `nav` with its key;
  the feature view decides what that means (scroll to top for itself, a
  sub-view, or a route change). -->
  <aside id="sideNav" :class="{ rail, overlay: overlayOpen }">
    <div v-if="overlayOpen" class="side-scrim" aria-hidden="true" @click="closeOverlay"></div>
    <div class="side-inner" @keydown.esc="onEsc">
      <button
        ref="toggleRef"
        type="button"
        class="side-toggle"
        :aria-expanded="!rail"
        :aria-label="rail ? t('navExpand') : t('navCollapse')"
        :data-tip="rail ? t('navExpand') : undefined"
        @click="toggle"
      ><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /><path d="M16 10l-2 2 2 2" /></svg><span class="side-text">{{ t('navCollapse') }}</span></button>
      <nav class="side-links" :aria-label="t('navGroupImage') + ' / ' + t('navGroupPdf')">
        <template v-for="group in NAV_GROUPS" :key="group.id">
          <p v-if="group.label" class="side-group" :id="`sideGroup-${group.id}`">{{ t(group.label) }}</p>
          <div v-else class="side-sep" role="separator"></div>
          <div class="side-group-items" role="group" :aria-labelledby="group.label ? `sideGroup-${group.id}` : undefined">
            <button
              v-for="entry in group.items"
              :key="entry.key"
              type="button"
              :class="{ active: active === entry.key }"
              :aria-current="active === entry.key ? 'page' : undefined"
              :aria-label="rail ? t(entry.label) : undefined"
              :data-tip="rail ? t(entry.label) : undefined"
              @click="onNav(entry.key)"
            ><NavIcon :name="entry.key" /><span class="side-text">{{ t(entry.label) }}</span></button>
          </div>
        </template>
      </nav>
      <div v-if="!rail" class="side-slot"><slot /></div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { NavKey } from '../composables/useHashRoute'
import { useSideNav } from '../composables/useSideNav'
import NavIcon from './NavIcon.vue'
import { NAV_GROUPS } from './nav'

defineProps<{ active: NavKey | ''; t: (key: string, ...args: (string | number)[]) => string }>()
const emit = defineEmits<{ (e: 'nav', key: NavKey): void }>()
const { rail, overlayOpen, toggle, closeOverlay } = useSideNav()
const toggleRef = ref<HTMLButtonElement | null>(null)

function onNav(key: NavKey) {
  closeOverlay()
  emit('nav', key)
}
// Esc closes the tablet overlay and hands focus back to its toggle.
function onEsc() {
  if (!overlayOpen.value) return
  closeOverlay()
  toggleRef.value?.focus()
}
</script>
