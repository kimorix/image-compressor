// GIF frame counting by walking the block structure (no decoding): header
// + logical screen descriptor + optional global color table, then blocks
// until the trailer. An image descriptor (0x2C) is a frame; extensions
// (0x21) and image data sub-blocks are skipped by size. Returns 0 for
// non-GIF input. Used only for the "first frame only" tag: a single-frame
// GIF needs no warning.
function ascii(b: Uint8Array, off: number, len: number): string {
  let s = ''
  for (let i = 0; i < len; i++) s += String.fromCharCode(b[off + i])
  return s
}

export function gifFrameCount(buf: Uint8Array): number {
  if (buf.length < 13) return 0
  const sig = ascii(buf, 0, 6)
  if (sig !== 'GIF87a' && sig !== 'GIF89a') return 0
  const packed = buf[10]
  let off = 13
  if (packed & 0x80) off += 3 * (1 << ((packed & 0x07) + 1))
  let frames = 0
  while (off < buf.length) {
    const b = buf[off]
    if (b === 0x3b) break // trailer
    if (b === 0x2c) {
      // Image descriptor: separator + left/top/width/height/packed.
      if (off + 10 > buf.length) break
      frames++
      const p = buf[off + 9]
      off += 10
      if (p & 0x80) off += 3 * (1 << ((p & 0x07) + 1))
      if (off >= buf.length) break
      off += 1 // LZW minimum code size
      // Image data sub-blocks, terminated by a zero size byte.
      while (off < buf.length && buf[off] !== 0) off += 1 + buf[off]
      off += 1
    } else if (b === 0x21) {
      // Extension: introducer + label, then sub-blocks to a zero byte.
      off += 2
      while (off < buf.length && buf[off] !== 0) off += 1 + buf[off]
      off += 1
    } else {
      break // unknown block: stop rather than guess
    }
  }
  return frames
}
