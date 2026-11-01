<template>
  <!-- Desktop sidebar (≥1080px): tools grouped as image tools / PDF tools,
  then the compressor history, then the active feature's info card (slot).
  Every entry emits `nav` with its key; the feature view decides what that
  means (scroll to top for itself, a sub-view, or a route change). -->
  <aside id="sideNav">
    <nav class="side-links" :aria-label="t('navGroupImage') + ' / ' + t('navGroupPdf')">
      <template v-for="group in NAV_GROUPS" :key="group.id">
        <p v-if="group.label" class="side-group" :id="`sideGroup-${group.id}`">{{ t(group.label) }}</p>
        <div v-else class="side-sep" role="separator"></div>
        <div class="side-group-items" role="group" :aria-labelledby="group.label ? `sideGroup-${group.id}` : undefined">
          <button
            v-for="entry in group.items"
            :key="entry.key"
            type="button"
            :class="{ active: current === entry.key }"
            :aria-current="current === entry.key ? 'page' : undefined"
            @click="emit('nav', entry.key)"
          ><NavIcon :name="entry.key" />{{ t(entry.label) }}</button>
        </div>
      </template>
    </nav>
    <slot />
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { NavKey } from '../composables/useHashRoute'
import { pendingFeature } from '../composables/useViewSwitch'
import NavIcon from './NavIcon.vue'
import { NAV_GROUPS } from './nav'

const props = defineProps<{ active: NavKey | ''; t: (key: string, ...args: (string | number)[]) => string }>()
// A tool whose chunk is still loading is highlighted right away.
const current = computed<NavKey | ''>(() => pendingFeature.value ?? props.active)
const emit = defineEmits<{ (e: 'nav', key: NavKey): void }>()
</script>
