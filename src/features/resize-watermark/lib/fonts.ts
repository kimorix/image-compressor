// Watermark font stacks. v1 ships system fonts only: every stack resolves
// to fonts already on the device (CJK included), works offline, costs no
// download and renders identically in the worker's OffscreenCanvas. The
// Source Han web-font subsets from the design (1–2 MB each) are deferred;
// `loadFont` is the single hook to add them later (FontFace + fonts.add in
// whichever context draws).
import type { WmFont } from '../types'

const STACKS: Record<WmFont, string> = {
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans", Roboto, Arial, sans-serif',
  serif: '"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", "Noto Serif", Georgia, "Times New Roman", serif',
  mono: '"SF Mono", Menlo, Consolas, "Noto Sans Mono CJK SC", "DejaVu Sans Mono", monospace',
  kai: '"Kaiti SC", "STKaiti", "KaiTi", "Noto Serif CJK SC", "Segoe Script", "Bradley Hand", cursive',
}

export const FONTS: readonly WmFont[] = ['sans', 'serif', 'mono', 'kai']

/** CSS font shorthand for canvas: weight, pixel size and the stack. */
export function fontCss(font: WmFont, px: number, bold: boolean): string {
  return `${bold ? 700 : 400} ${Math.max(1, Math.round(px * 100) / 100)}px ${STACKS[font] ?? STACKS.sans}`
}

/** No web fonts in v1: resolves immediately (kept so callers already await it). */
export async function loadFont(_font: WmFont): Promise<boolean> {
  return true
}
