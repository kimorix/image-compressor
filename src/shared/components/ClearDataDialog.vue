<template>
  <!-- Confirmation for "clear all local data" (destructive, cannot be
  undone): lists what goes, focuses Cancel first, Esc / backdrop cancel,
  Tab stays inside. Mounted once in App.vue, outside the KeepAlive views. -->
  <div v-if="open" class="cd-backdrop" @click.self="cancel">
    <div
      ref="boxRef"
      class="cd-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="cdTitle"
      aria-describedby="cdDesc"
      @keydown.esc.prevent="cancel"
      @keydown.tab="trapTab"
    >
      <h2 id="cdTitle">{{ t('clearDataTitle') }}</h2>
      <div id="cdDesc">
        <p>{{ t('clearDataIntro') }}</p>
        <ul class="cd-list">
          <li>{{ t('clearDataHistory') }}</li>
          <li>{{ t('clearDataSettings') }}</li>
          <li>{{ t('clearDataFiles') }}</li>
          <li>{{ t('clearDataOffline') }}</li>
          <li>{{ t('clearDataSession') }}</li>
        </ul>
        <p class="cd-note">{{ t('clearDataReload') }}</p>
      </div>
      <div class="cd-actions">
        <button ref="cancelRef" type="button" :disabled="working" @click="cancel">{{ t('clearDataCancel') }}</button>
        <button type="button" class="danger-solid" :disabled="working" @click="confirm">{{ working ? t('clearDataWorking') : t('clearDataConfirm') }}</button>
      </div>
    </div>
  </div>
  <div v-if="toast" class="cd-toast" :class="{ warn: toast === 'partial' }" role="status" aria-live="polite">{{ toast === 'ok' ? t('clearDataDone') : t('clearDataFail') }}</div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { usePrefs } from '../composables/usePrefs'
import { useClearData } from '../composables/useClearData'
import { takeClearedFlag } from '../lib/clear-data'

const { t } = usePrefs()
const { open, working, cancel, confirm } = useClearData()
const boxRef = ref<HTMLElement | null>(null)
const cancelRef = ref<HTMLButtonElement | null>(null)

watch(open, async (o) => {
  if (!o) return
  await nextTick()
  cancelRef.value?.focus()
})

function trapTab(e: KeyboardEvent) {
  const els = [...(boxRef.value?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])]
  if (!els.length) return
  const first = els[0]
  const last = els[els.length - 1]
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

// Success toast on the load after a clear (the flag survives the reload in
// sessionStorage and is removed as soon as it is read).
const toast = ref<'ok' | 'partial' | null>(null)
onMounted(() => {
  toast.value = takeClearedFlag(window.sessionStorage)
  if (toast.value) setTimeout(() => { toast.value = null }, 4000)
})
</script>
