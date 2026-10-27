// Hard safety rails for the decode/encode pipeline. A compressed file can
// expand to a huge RGBA buffer (100 MP = 400 MB), and the pool can hold
// several at once; refuse the job before the encoders make more copies.
export const MAX_PIXELS = 80_000_000
export const MAX_PIXELS_MB = Math.round(MAX_PIXELS / 1_000_000)

export function exceedsPixelLimit(width: number, height: number): boolean {
  return width > 0 && height > 0 && width * height > MAX_PIXELS
}
