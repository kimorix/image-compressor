// Two-step confirm for "清空": the first click only arms the button
// ("确认清空？"), a second click within `ms` runs the action, otherwise it
// disarms on its own.
import { getCurrentScope, onScopeDispose, ref } from 'vue'

export function useArmedConfirm(ms = 3000) {
  const armed = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null
  function disarm() {
    if (timer) clearTimeout(timer)
    timer = null
    armed.value = false
  }
  /** Returns true when this click confirms (and disarms); false when it only armed. */
  function confirm(): boolean {
    if (armed.value) {
      disarm()
      return true
    }
    armed.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { armed.value = false; timer = null }, ms)
    return false
  }
  if (getCurrentScope()) onScopeDispose(() => { if (timer) clearTimeout(timer) })
  return { armed, confirm, disarm }
}
