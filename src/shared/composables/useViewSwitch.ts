// Tool switching state shared by the app shell and the nav components.
//
// The shell (App.vue) keeps the current tool on screen until the next
// tool's chunk is ready, so a first visit never shows a blank page. While
// that chunk loads, `pendingFeature` holds the target so the side nav, tab
// bar and PDF hub can already highlight it (instant feedback on the tap).
import { ref } from 'vue'
import { isPdfFeature, type Feature } from './useHashRoute'

export const pendingFeature = ref<Feature | null>(null)

/** The phone tab a tool lives under (convert / resize sit in "More"). */
export function tabOf(f: Feature): 'compress' | 'pdf' | 'more' {
  if (f === 'compress') return 'compress'
  return isPdfFeature(f) ? 'pdf' : 'more'
}
