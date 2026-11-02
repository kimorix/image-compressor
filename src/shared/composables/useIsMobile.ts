// Phone layout (< 720px wide), one ref for the whole app. Every view used to
// keep its own copy plus a resize listener while active; a single window
// listener keeps this one current, including for views that are hidden by
// KeepAlive (they come back already in the right layout).
import { readonly, ref, type Ref } from 'vue'

export const MOBILE_MAX = 720

const mobile = ref(false)
let bound = false

function measure(): void {
  mobile.value = window.innerWidth < MOBILE_MAX
}

export function useIsMobile(): Readonly<Ref<boolean>> {
  if (!bound && typeof window !== 'undefined') {
    bound = true
    measure()
    window.addEventListener('resize', measure)
  }
  return readonly(mobile)
}
