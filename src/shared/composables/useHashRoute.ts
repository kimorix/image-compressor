// Minimal hash router: #/ = image compressor, #/pdf-to-word = PDF to Word,
// #/history = the compressor's history view. Hash routing keeps the static
// GitHub Pages hosting and the PWA navigation fallback untouched.
import { ref } from 'vue'

export type Feature = 'compress' | 'pdf'
export interface RouteState { feature: Feature; sub: '' | 'history' }

export const ROUTE_HASH: Record<Feature, string> = { compress: '#/', pdf: '#/pdf-to-word' }

export function parseHash(hash: string): RouteState {
  const h = hash.replace(/^#\/?/, '').replace(/\/+$/, '').toLowerCase()
  if (h === 'pdf-to-word' || h === 'pdf') return { feature: 'pdf', sub: '' }
  if (h === 'history') return { feature: 'compress', sub: 'history' }
  return { feature: 'compress', sub: '' }
}

const route = ref<RouteState>(typeof location !== 'undefined' ? parseHash(location.hash) : { feature: 'compress', sub: '' })
let listening = false

function sync() {
  route.value = parseHash(location.hash)
}

/** Go to a feature (pushes a history entry so Back returns). */
function navigate(feature: Feature, sub: '' | 'history' = '') {
  const target = sub === 'history' ? '#/history' : ROUTE_HASH[feature]
  if (location.hash === target) { sync(); return }
  location.hash = target
  sync()
}

/** Record a sub-view in the URL without a new history entry or event. */
function replaceSub(sub: '' | 'history') {
  if (route.value.feature !== 'compress') return
  const target = sub === 'history' ? '#/history' : '#/'
  if (location.hash === target || (!location.hash && !sub)) { route.value = { feature: 'compress', sub }; return }
  try { history.replaceState(history.state, '', target) } catch { /* ignore */ }
  route.value = { feature: 'compress', sub }
}

export function useHashRoute() {
  if (!listening && typeof window !== 'undefined') {
    listening = true
    window.addEventListener('hashchange', sync)
  }
  return { route, navigate, replaceSub }
}
