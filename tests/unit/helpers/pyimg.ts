// Bridge to tests/unit/helpers/pyimg.py: decode a file with an independent
// implementation (Pillow / tifffile / imagecodecs). Tests that need it are
// skipped when Python or those packages are missing (CI installs them).
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SCRIPT = join(__dirname, 'pyimg.py')
const dir = mkdtempSync(join(tmpdir(), 'pyimg-'))
let n = 0

export const pyAvailable: boolean = (() => {
  const r = spawnSync('python3', ['-c', 'import numpy, PIL, tifffile, imagecodecs; assert imagecodecs.JPEGXL.available'], { encoding: 'utf8' })
  return r.status === 0
})()

export interface PyImage {
  width: number
  height: number
  data: Uint8Array
  meta: Record<string, any>
}

export function pyDecode(bytes: Uint8Array, decoder = 'pil', arg?: string | number): PyImage {
  const src = join(dir, `in-${n++}`)
  const out = src + '.raw'
  writeFileSync(src, bytes)
  const args = [SCRIPT, decoder, src, out]
  if (arg !== undefined) args.push(String(arg))
  const r = spawnSync('python3', args, { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`pyimg ${decoder} failed: ${r.stderr}`)
  const meta = JSON.parse(r.stdout)
  if (decoder === 'exif') return { width: 0, height: 0, data: new Uint8Array(), meta }
  return { width: meta.width, height: meta.height, data: new Uint8Array(readFileSync(out)), meta }
}

/** Largest per-channel difference (alpha included); `skipTransparent` ignores colour under alpha 0. */
export function maxDiff(a: Uint8Array | Uint8ClampedArray, b: Uint8Array | Uint8ClampedArray, skipTransparent = true): number {
  if (a.length !== b.length) return Infinity
  let m = 0
  for (let i = 0; i < a.length; i += 4) {
    const transparent = a[i + 3] === 0 && b[i + 3] === 0
    for (let c = 0; c < 4; c++) {
      if (skipTransparent && transparent && c < 3) continue
      const d = Math.abs(a[i + c] - b[i + c])
      if (d > m) m = d
    }
  }
  return m
}

/** Mean absolute difference over RGB of opaque pixels. */
export function meanDiff(a: Uint8Array | Uint8ClampedArray, b: Uint8Array | Uint8ClampedArray): number {
  let s = 0
  let k = 0
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] === 0) continue
    for (let c = 0; c < 3; c++) { s += Math.abs(a[i + c] - b[i + c]); k++ }
  }
  return k ? s / k : 0
}
