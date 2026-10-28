<template>
  <!-- Lightweight "coming soon" page for a tool whose feature PR has not
  landed yet: the real shell (header, side nav, phone tab bar, PDF hub) so
  the navigation already works end to end. Lazy chunk; replaced route by
  route as each feature view arrives. -->
  <AppHeader :sub="t('soonSub')" @lang="setLang">
    <template #title>
      <template v-if="pdfTool"><span class="title-desk">{{ t(label) }}</span><span class="title-hub">{{ t('hubTitle') }}</span></template>
      <span v-else>{{ t(label) }}</span>
    </template>
  </AppHeader>
  <div class="layout soon-layout">
    <SideNav :t="t" :active="feature" @nav="go" />
    <main class="soon-main">
      <PdfHubSwitch v-if="pdfTool" :active="pdfTool" :t="t" />
      <section class="card soon-card" aria-live="polite">
        <span class="soon-icon" aria-hidden="true"><NavIcon :name="feature" /></span>
        <h2>{{ t(label) }}</h2>
        <p class="soon-desc">{{ t(desc) }}</p>
        <span class="soon-pill">{{ t('comingSoon') }}</span>
        <p class="soon-note">{{ t('soonNote') }}</p>
        <button type="button" class="primary" @click="go(pdfTool ? 'pdf' : 'compress')">{{ pdfTool ? t('soonTryPdf') : t('soonTryCompress') }}</button>
      </section>
    </main>
  </div>
  <TabBar
    :t="t"
    :active="moreOpen ? 'more' : pdfTool ? 'pdf' : 'more'"
    :settings-open="false"
    :more-open="moreOpen"
    @compress="go('compress')"
    @pdf="onPdfTab"
    @settings="flash"
    @more="moreOpen = !moreOpen"
  />
  <MoreMenu :t="t" :open="moreOpen" :active="feature" @close="moreOpen = false" @nav="go" />
  <div v-if="toast" class="more-toast" role="status">{{ toast }}</div>
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, ref, watch } from 'vue'
import AppHeader from './AppHeader.vue'
import SideNav from './SideNav.vue'
import TabBar from './TabBar.vue'
import MoreMenu from './MoreMenu.vue'
import NavIcon from './NavIcon.vue'
import PdfHubSwitch from './PdfHubSwitch.vue'
import { usePrefs } from '../composables/usePrefs'
import { isPdfFeature, useHashRoute, type Feature, type NavKey } from '../composables/useHashRoute'
import type { Lang } from '../i18n'
import { placeholderT } from './placeholder-i18n'

const props = defineProps<{ feature: Feature }>()
const { t: shared, lang, setLang: setPrefLang } = usePrefs()
const OWN = new Set(['descImgToPdf', 'descPdfMerge', 'soonSub', 'soonNote', 'soonTryCompress', 'soonTryPdf'])
function t(key: string): string {
  return OWN.has(key) ? placeholderT(lang.value, key) : shared(key)
}
const { navigate, lastPdfTool } = useHashRoute()
const moreOpen = ref(false)
const toast = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null

const COPY: Partial<Record<Feature, { label: string; desc: string }>> = {
  convert: { label: 'navConvert', desc: 'moreImageConvertDesc' },
  resize: { label: 'navResize', desc: 'moreResizeDesc' },
  img2pdf: { label: 'navImgToPdf', desc: 'descImgToPdf' },
  'pdf-merge': { label: 'navPdfMerge', desc: 'descPdfMerge' },
}
const label = computed(() => COPY[props.feature]?.label ?? 'navTool')
const desc = computed(() => COPY[props.feature]?.desc ?? 'soonNote')
const pdfTool = computed(() => (isPdfFeature(props.feature) ? props.feature : null))

function go(key: NavKey) {
  moreOpen.value = false
  if (key === props.feature) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
  if (key === 'history') navigate('compress', 'history')
  else navigate(key)
}
function onPdfTab() {
  moreOpen.value = false
  if (pdfTool.value) window.scrollTo({ top: 0, behavior: 'smooth' })
  else navigate(lastPdfTool())
}
// No settings yet: the Settings tab says so instead of doing nothing.
function flash() {
  moreOpen.value = false
  toast.value = t('comingSoon')
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { toast.value = null }, 1600)
}
function applyDocMeta() {
  document.title = `${t(label.value)} - ${t('comingSoon')}`
}
function setLang(l: Lang) {
  setPrefLang(l)
  applyDocMeta()
}
watch(label, applyDocMeta)
onActivated(applyDocMeta)
onBeforeUnmount(() => { if (timer) clearTimeout(timer) })
</script>

<style lang="less">
// ---- tool placeholder ("coming soon") ----
@media (min-width: 720px) {
  .soon-layout .soon-main {
    grid-column: 1 / -1;
  }
}
@media (min-width: 1080px) {
  .soon-layout .soon-main {
    grid-column: 2 / -1;
  }
}
.soon-main {
  min-width: 0;
}
.soon-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 40px 20px;
  text-align: center;
  h2 {
    margin: 4px 0 0;
    font-size: 20px;
  }
  .soon-desc {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
  }
  .soon-note {
    margin: 0;
    max-width: 440px;
    color: var(--subtle);
    font-size: 13px;
    line-height: 1.6;
  }
  button {
    margin-top: 6px;
  }
}
.soon-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: var(--accent-soft);
  color: var(--accent);
  svg {
    width: 28px;
    height: 28px;
  }
}
.soon-pill {
  padding: 2px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--subtle);
  font-size: 12px;
}
@media (max-width: 719px) {
  .soon-layout {
    padding-bottom: calc(80px + env(safe-area-inset-bottom));
  }
  .soon-card {
    padding: 28px 16px;
  }
}
</style>
