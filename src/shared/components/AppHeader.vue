<template>
  <!-- Shared page header: the feature's title block (slot) on the left,
  theme toggle, language select and GitHub link on the right. Every feature
  view renders it first so the DOM order (header, .layout, …) stays the
  same for the shared styles. -->
  <header>
    <div>
      <h1><slot name="title" /></h1>
      <p>{{ sub }}</p>
    </div>
    <div class="header-actions">
      <button class="gh-btn icon-btn" id="themeBtn" type="button" :title="themeTitle" :aria-label="t('themeAria')" @click="toggleTheme" v-html="themeIcon"></button>
      <select id="langSelect" class="lang-select" :value="lang" :aria-label="t('langAria')" @change="emit('lang', ($event.target as HTMLSelectElement).value as Lang)">
        <option v-for="l in LANGS" :key="l.code" :value="l.code">{{ l.label }}</option>
      </select>
      <a class="gh-btn" href="https://github.com/kimorix/image-compressor" target="_blank" rel="noopener"><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" /></svg><span class="gh-text">{{ t('githubBtn') }}</span></a>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Lang } from '../i18n'
import { usePrefs } from '../composables/usePrefs'

defineProps<{ sub: string }>()
// Language changes go through the feature (it also updates the document
// title/description for its own page); the theme is app-wide.
const emit = defineEmits<{ (e: 'lang', l: Lang): void }>()
const { lang, theme, toggleTheme, t, LANGS, SUN_ICON, MOON_ICON } = usePrefs()
const themeIcon = computed(() => (theme.value === 'dark' ? SUN_ICON : MOON_ICON))
const themeTitle = computed(() => (theme.value === 'dark' ? t('themeToDay') : t('themeToNight')))
</script>
