// BMP writer for the format converter. Lossless, uncompressed, bottom-up
// rows (the layout every reader handles):
//   no transparency -> 24-bit BI_RGB with a BITMAPINFOHEADER (40 bytes)
//   transparency    -> 32-bit BI_BITFIELDS with a BITMAPV4HEADER (108
//                      bytes) whose alpha mask is 0xFF000000, the form
//                      Windows, Photoshop, browsers and Pillow read as BGRA.
// BMP decoding is left to the browser (every engine decodes BMP natively).
// Lazy chunk ("codec-" prefix: not precached).

export function encodeBmp(img: { data: Uint8Array | Uint8ClampedArray; width: number; height: number }, alpha: boolean): Uint8Array {
  const { width: w, height: h, data: d } = img
  const bpp = alpha ? 4 : 3
  const stride = (w * bpp + 3) & ~3
  const headerSize = alpha ? 108 : 40
  const dataAt = 14 + headerSize
  const fileSize = dataAt + stride * h
  const out = new Uint8Array(fileSize)
  const dv = new DataView(out.buffer)
  out[0] = 0x42 // 'B'
  out[1] = 0x4d // 'M'
  dv.setUint32(2, fileSize, true)
  dv.setUint32(10, dataAt, true)
  dv.setUint32(14, headerSize, true)
  dv.setInt32(18, w, true)
  dv.setInt32(22, h, true) // positive: bottom-up
  dv.setUint16(26, 1, true)
  dv.setUint16(28, alpha ? 32 : 24, true)
  dv.setUint32(30, alpha ? 3 : 0, true) // BI_BITFIELDS : BI_RGB
  dv.setUint32(34, stride * h, true)
  dv.setInt32(38, 2835, true) // 72 dpi
  dv.setInt32(42, 2835, true)
  if (alpha) {
    dv.setUint32(54, 0x00ff0000, true) // R
    dv.setUint32(58, 0x0000ff00, true) // G
    dv.setUint32(62, 0x000000ff, true) // B
    dv.setUint32(66, 0xff000000, true) // A
    dv.setUint32(70, 0x73524742, true) // 'sRGB'
  }
  for (let y = 0; y < h; y++) {
    let o = dataAt + (h - 1 - y) * stride
    let s = y * w * 4
    for (let x = 0; x < w; x++, s += 4, o += bpp) {
      out[o] = d[s + 2]
      out[o + 1] = d[s + 1]
      out[o + 2] = d[s]
      if (alpha) out[o + 3] = d[s + 3]
    }
  }
  return out
}
