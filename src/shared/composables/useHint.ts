// A transient one-line hint ("已跳过 2 个非图片文件") that clears itself.
// Shown through LiveHint, which keeps the live region in the DOM.
import { getCurrentScope, onScopeDispose, ref } from 'vue'

export function useHint(ms = 3500) {
  const hint = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null
  function clearHint() {
    if (timer) clearTimeout(timer)
    timer = null
    hint.value = null
  }
  /** Show a hint; `forMs` overrides the default lifetime for this one. */
  function showHint(text: string, forMs = ms) {
    hint.value = text
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { hint.value = null; timer = null }, forMs)
  }
  if (getCurrentScope()) onScopeDispose(() => { if (timer) clearTimeout(timer) })
  return { hint, showHint, clearHint }
}
