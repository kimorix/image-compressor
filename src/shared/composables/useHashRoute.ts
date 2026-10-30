// Minimal hash router. One route per tool, grouped like the side nav:
//   image tools  #/ (compress), #/convert, #/resize
//   PDF tools    #/pdf-to-word, #/img-to-pdf, #/pdf-merge
//   #/history    the compressor's history view
// An optional query (#/convert?to=webp) is parsed into `params`. Hash
// routing keeps the static GitHub Pages hosting and the PWA navigation
// fallback untouched.
import { ref } from 'vue'

export type Feature = 'compress' | 'convert' | 'resize' | 'pdf' | 'img2pdf' | 'pdf-merge'
export type PdfFeature = 'pdf' | 'img2pdf' | 'pdf-merge'
/** Everything the side nav can point at. */
export type NavKey = Feature | 'history'

export interface RouteState {
  feature: Feature
  sub: '' | 'history'
  params: Record<string, string>
}

export const ROUTE_HASH: Record<Feature, string> = {
  compress: '#/',
  convert: '#/convert',
  resize: '#/resize',
  pdf: '#/pdf-to-word',
  img2pdf: '#/img-to-pdf',
  'pdf-merge': '#/pdf-merge',
}

export const IMAGE_FEATURES: readonly Feature[] = ['compress', 'convert', 'resize']
export const PDF_FEATURES: readonly PdfFeature[] = ['pdf', 'img2pdf', 'pdf-merge']

export function isPdfFeature(f: string): f is PdfFeature {
  return (PDF_FEATURES as readonly string[]).includes(f)
}

const PATHS: Record<string, Feature> = {
  '': 'compress',
  convert: 'convert',
  resize: 'resize',
  'pdf-to-word': 'pdf',
  pdf: 'pdf',
  'img-to-pdf': 'img2pdf',
  'pdf-merge': 'pdf-merge',
}

export function parseHash(hash: string): RouteState {
  const raw = hash.replace(/^#\/?/, '')
  const q = raw.indexOf('?')
  const path = (q >= 0 ? raw.slice(0, q) : raw).replace(/\/+$/, '').toLowerCase()
  const params: Record<string, string> = {}
  if (q >= 0) {
    for (const [k, v] of new URLSearchParams(raw.slice(q + 1))) params[k] = v
  }
  if (path === 'history') return { feature: 'compress', sub: 'history', params }
  return { feature: PATHS[path] ?? 'compress', sub: '', params }
}

// ---- last PDF tool (the phone PDF tab reopens it) ----
const PDF_TOOL_KEY = 'ic-pdf-tool'

export function lastPdfTool(): PdfFeature {
  try {
    const v = localStorage.getItem(PDF_TOOL_KEY) || ''
    if (isPdfFeature(v)) return v
  } catch { /* ignore */ }
  return 'pdf'
}

function rememberPdfTool(f: Feature) {
  if (!isPdfFeature(f)) return
  try { localStorage.setItem(PDF_TOOL_KEY, f) } catch { /* ignore */ }
}

const route = ref<RouteState>(typeof location !== 'undefined' ? parseHash(location.hash) : { feature: 'compress', sub: '', params: {} })
if (typeof location !== 'undefined') rememberPdfTool(route.value.feature)
let listening = false

function sync() {
  route.value = parseHash(location.hash)
  rememberPdfTool(route.value.feature)
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
  if (location.hash === target || (!location.hash && !sub)) { route.value = { feature: 'compress', sub, params: {} }; return }
  try { history.replaceState(history.state, '', target) } catch { /* ignore */ }
  route.value = { feature: 'compress', sub, params: {} }
}

export function useHashRoute() {
  if (!listening && typeof window !== 'undefined') {
    listening = true
    window.addEventListener('hashchange', sync)
  }
  return { route, navigate, replaceSub, lastPdfTool }
}
