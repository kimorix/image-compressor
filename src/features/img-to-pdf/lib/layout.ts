// Page geometry, shared by the grid's paper previews and the PDF builder so
// the preview is exactly what gets generated. Pure functions, unit tested.
// Units are PDF points (1/72 in). Rectangles use a top-left origin; the
// builder flips to PDF's bottom-left origin.
import type { Margin, Orientation, Paper } from '../types'
import { normRotation } from '../../../shared/components/page-grid'

export const PAPER_PT: Record<Exclude<Paper, 'fit'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
}
export const MARGIN_PT: Record<Margin, number> = { none: 0, small: 18, medium: 36, large: 54 }
/** PDF viewers' practical page limit: 200 in (Acrobat's 14 400 pt). */
export const MAX_PAGE_PT = 14400

export interface LayoutSettings {
  paper: Paper
  orientation: Orientation
  margin: Margin
}

export interface PageLayout {
  pageW: number
  pageH: number
  /** Image rectangle on the page (top-left origin), after rotation. */
  x: number
  y: number
  w: number
  h: number
  landscape: boolean
}

/** Size after a clockwise rotation (90/270 swap the sides). */
export function rotatedSize(w: number, h: number, rotation: number): { w: number; h: number } {
  return normRotation(rotation) % 180 ? { w: h, h: w } : { w, h }
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Lay one image out on its page. `w`/`h` are the displayed pixel size
 * (EXIF orientation applied), `rotation` the user's extra rotation.
 * - A4 / Letter: auto orientation turns the page landscape for wide images
 *   (decided per page); the image is contained in the margin box and
 *   centred, never cropped.
 * - Fit: the page is the image at 72 dpi (1 px = 1 pt) plus margins,
 *   scaled down so no side exceeds 200 in.
 */
export function layoutPage(w: number, h: number, rotation: number, s: LayoutSettings): PageLayout {
  const img = rotatedSize(Math.max(1, w), Math.max(1, h), rotation)
  const m = MARGIN_PT[s.margin] ?? 0
  if (s.paper === 'fit') {
    const scale = Math.min(1, (MAX_PAGE_PT - 2 * m) / Math.max(img.w, img.h))
    const iw = img.w * scale
    const ih = img.h * scale
    return { pageW: r2(iw + 2 * m), pageH: r2(ih + 2 * m), x: m, y: m, w: r2(iw), h: r2(ih), landscape: iw > ih }
  }
  const [pw, ph] = PAPER_PT[s.paper] ?? PAPER_PT.a4
  const landscape = s.orientation === 'landscape' || (s.orientation === 'auto' && img.w > img.h)
  const pageW = landscape ? ph : pw
  const pageH = landscape ? pw : ph
  const boxW = Math.max(1, pageW - 2 * m)
  const boxH = Math.max(1, pageH - 2 * m)
  const scale = Math.min(boxW / img.w, boxH / img.h)
  const dw = img.w * scale
  const dh = img.h * scale
  return { pageW, pageH, x: r2((pageW - dw) / 2), y: r2((pageH - dh) / 2), w: r2(dw), h: r2(dh), landscape }
}

/** Tile frame aspect (height / width) for the grid: the portrait paper. */
export function frameAspect(paper: Paper): number {
  if (paper === 'fit') return PAPER_PT.a4[1] / PAPER_PT.a4[0]
  const [w, h] = PAPER_PT[paper]
  return h / w
}

/**
 * The page contained in a tile frame of aspect `frameHW` (height / width),
 * as percentages of the frame, plus the image rectangle as percentages of
 * the page. Lets the grid draw a true-to-layout paper preview with CSS only.
 */
export function previewBoxes(l: PageLayout, frameHW: number): {
  page: { left: number; top: number; width: number; height: number }
  img: { left: number; top: number; width: number; height: number }
} {
  const pageHW = l.pageH / l.pageW
  let width = 100
  let height = 100
  if (pageHW > frameHW) width = (frameHW / pageHW) * 100
  else height = (pageHW / frameHW) * 100
  return {
    page: { left: (100 - width) / 2, top: (100 - height) / 2, width, height },
    img: { left: (l.x / l.pageW) * 100, top: (l.y / l.pageH) * 100, width: (l.w / l.pageW) * 100, height: (l.h / l.pageH) * 100 },
  }
}

// ---- orientation matrix (EXIF orientation + user rotation) ----

type M2 = [number, number, number, number] // [m11, m12, m21, m22], y-up

const ROT_CW: M2 = [0, 1, -1, 0]
const MIRROR_H: M2 = [-1, 0, 0, 1]
const ID: M2 = [1, 0, 0, 1]
function mul(a: M2, b: M2): M2 {
  return [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3]]
}
function rotCw(quarters: number): M2 {
  let m = ID
  for (let i = 0; i < ((quarters % 4) + 4) % 4; i++) m = mul(ROT_CW, m)
  return m
}
/** Visual transform that displays a stored image with EXIF orientation `o` upright. */
export function exifMatrix(o: number): M2 {
  switch (o) {
    case 2: return MIRROR_H
    case 3: return rotCw(2)
    case 4: return mul(rotCw(2), MIRROR_H) // mirror vertical
    case 5: return mul(rotCw(3), MIRROR_H) // mirror horizontal, then 270° cw
    case 6: return rotCw(1)
    case 7: return mul(rotCw(1), MIRROR_H) // mirror horizontal, then 90° cw
    case 8: return rotCw(3)
    default: return ID
  }
}

/** EXIF orientations 5–8 swap width and height. */
export function exifSwaps(o: number): boolean {
  return o >= 5 && o <= 8
}

/**
 * PDF `cm` matrix [a b c d e f] drawing an image XObject (the unit square)
 * into the top-left-origin rectangle `r` of a page `pageH` tall, with the
 * stored image first oriented by EXIF `orientation`, then rotated
 * clockwise by `rotation`.
 */
export function placementMatrix(
  r: { x: number; y: number; w: number; h: number },
  pageH: number,
  rotation: number,
  orientation = 1,
): [number, number, number, number, number, number] {
  const m = mul(rotCw(normRotation(rotation) / 90), exifMatrix(orientation))
  const X = r.x
  const Y = pageH - r.y - r.h
  const W = r.w
  const H = r.h
  const z = (n: number) => (Object.is(n, -0) ? 0 : n)
  return [
    z(W * m[0]),
    z(H * m[2]),
    z(W * m[1]),
    z(H * m[3]),
    z(W * (0.5 - 0.5 * (m[0] + m[1])) + X),
    z(H * (0.5 - 0.5 * (m[2] + m[3])) + Y),
  ]
}
