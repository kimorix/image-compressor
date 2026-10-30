// The app's tool map, shared by the desktop side nav, the phone More menu
// and the PDF tools hub, so a new tool is added in one place.
import type { NavKey, PdfFeature } from '../composables/useHashRoute'

export interface NavEntry { key: NavKey; label: string }
export interface NavGroup { id: string; label: string; items: NavEntry[] }

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'image',
    label: 'navGroupImage',
    items: [
      { key: 'compress', label: 'navTool' },
      { key: 'convert', label: 'navConvert' },
      { key: 'resize', label: 'navResize' },
    ],
  },
  {
    id: 'pdf',
    label: 'navGroupPdf',
    items: [
      { key: 'pdf', label: 'navPdf' },
      { key: 'img2pdf', label: 'navImgToPdf' },
      { key: 'pdf-merge', label: 'navPdfMerge' },
    ],
  },
  { id: 'other', label: '', items: [{ key: 'history', label: 'navHistory' }] },
]

/** Phone PDF tools hub: one segment per PDF tool (short labels). */
export const PDF_HUB: { key: PdfFeature; label: string }[] = [
  { key: 'pdf', label: 'hubToWord' },
  { key: 'img2pdf', label: 'hubImgToPdf' },
  { key: 'pdf-merge', label: 'hubMerge' },
]

/** Phone More menu: image tools that have no tab of their own. */
export const MORE_TOOLS: { key: NavKey; label: string; desc: string }[] = [
  { key: 'convert', label: 'navConvert', desc: 'moreImageConvertDesc' },
  { key: 'resize', label: 'navResize', desc: 'moreResizeDesc' },
]

/** Phone More menu, below the tools: the compressor history (the desktop
side nav lists it under the tool groups). */
export const MORE_OTHER: { key: NavKey; label: string; desc: string }[] = [
  { key: 'history', label: 'navHistory', desc: 'moreHistoryDesc' },
]
