// UTIF (utif2) calls `require("pako").inflateRaw` for Deflate-compressed
// TIFFs, and that is all it uses of pako. vite.config.ts points UTIF's
// `pako` import here, so the TIFF chunk reuses fflate (already shipped for
// zips and PNGs) instead of bundling a second deflate library.
import { inflateSync } from 'fflate'

export function inflateRaw(data: Uint8Array): Uint8Array {
  return inflateSync(data)
}

export default { inflateRaw }
