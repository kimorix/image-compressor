// Side nav mode, shared by every feature view (module-level state, so a
// route switch keeps it). Two modes:
//   full  the 220px sidebar with labels, group titles and the tool's card
//   rail  a 64px icon-only rail (tooltips + aria-labels carry the names)
// Defaults: the rail on tablets (iPad portrait and landscape, incl. the
// 1366px iPad Pro, detected as a coarse pointer) and on desktop windows
// under 1280px; the full sidebar on desktop. The user's toggle is stored in
// localStorage and wins from then on. Below 1080px the middle column cannot
// spare 220px, so the track always stays a rail there and "expand" opens
// the full nav over the page (overlay) without changing the stored choice.
import { computed, ref, watch } from 'vue'

export type NavMode = 'rail' | 'full'
export const NAV_MODE_KEY = 'ic-sidenav'
/** Below this width the nav track is always the rail. */
export const RAIL_ONLY_BELOW = 1080

export function defaultNavMode(width: number, coarsePointer: boolean): NavMode {
  return width < 1280 || (coarsePointer && width <= 1366) ? 'rail' : 'full'
}

export function effectiveNavMode(stored: NavMode | null, width: number, coarsePointer: boolean): NavMode {
  if (width < RAIL_ONLY_BELOW) return 'rail'
  return stored ?? defaultNavMode(width, coarsePointer)
}

export function parseNavMode(raw: string | null | undefined): NavMode | null {
  return raw === 'rail' || raw === 'full' ? raw : null
}

const hasWindow = typeof window !== 'undefined'

function readStored(): NavMode | null {
  try { return parseNavMode(hasWindow ? localStorage.getItem(NAV_MODE_KEY) : null) } catch { return null }
}
function readCoarse(): boolean {
  try { return hasWindow && window.matchMedia('(pointer: coarse)').matches } catch { return false }
}

const width = ref(hasWindow ? window.innerWidth : 1440)
const coarse = ref(readCoarse())
const stored = ref<NavMode | null>(readStored())
const overlayOpen = ref(false)

const mode = computed(() => effectiveNavMode(stored.value, width.value, coarse.value))
/** The nav renders as the icon rail (not expanded, not the overlay). */
const rail = computed(() => mode.value === 'rail' && !overlayOpen.value)

function toggle() {
  if (width.value < RAIL_ONLY_BELOW) {
    overlayOpen.value = !overlayOpen.value
    return
  }
  overlayOpen.value = false
  stored.value = mode.value === 'rail' ? 'full' : 'rail'
  try { localStorage.setItem(NAV_MODE_KEY, stored.value) } catch { /* private mode */ }
}
function closeOverlay() {
  overlayOpen.value = false
}

if (hasWindow) {
  window.addEventListener('resize', () => {
    width.value = window.innerWidth
    coarse.value = readCoarse()
    if (width.value >= RAIL_ONLY_BELOW || width.value < 720) overlayOpen.value = false
  })
  // The grid track follows the mode through a class on <html> (style.less
  // reads --nav-w from it), so every view's .layout agrees without props.
  watch([mode, overlayOpen], ([m, o]) => {
    const cl = document.documentElement.classList
    cl.toggle('nav-rail', m === 'rail')
    cl.toggle('nav-overlay', o)
  }, { immediate: true })
}

export function useSideNav() {
  return { mode, rail, overlayOpen, toggle, closeOverlay }
}
