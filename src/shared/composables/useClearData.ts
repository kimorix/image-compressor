// App-wide "clear all local data" flow: any button (side nav footer, the
// History page) calls ask(); the single dialog in App.vue confirms; confirm()
// stops the views, clears, leaves the toast flag and reloads.
import { ref } from 'vue'
import { CLEAR_EVENT, clearAllLocalData, markCleared } from '../lib/clear-data'

const open = ref(false)
const working = ref(false)
let opener: HTMLElement | null = null

function ask() {
  opener = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null
  open.value = true
}
function cancel() {
  if (working.value) return
  open.value = false
  opener?.focus?.()
  opener = null
}
async function confirm() {
  if (working.value) return
  working.value = true
  // Views cancel their running jobs and drop their unload guard first.
  // Whatever happens (a view's handler throwing, a step failing), the page
  // reloads: the dialog must never stay stuck on "clearing".
  let ok = false
  try {
    window.dispatchEvent(new Event(CLEAR_EVENT))
    const report = await clearAllLocalData()
    ok = report.failed.length === 0
  } catch { /* reported as a partial clear */ }
  markCleared(window.sessionStorage, ok)
  window.location.reload()
}

export function useClearData() {
  return { open, working, ask, cancel, confirm }
}
