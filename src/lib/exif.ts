// EXIF preservation (JPEG only): re-encoding strips all metadata, so copy
// the original EXIF block back into the compressed JPEG with piexifjs.
// piexifjs is lazy-loaded: only JPEG + "keep metadata" runs ever fetch it.
// Anything unexpected (no EXIF, malformed JPEG) falls back to the stripped
// output — privacy-safe, never an error.
export async function restoreExif(original: Blob, compressed: Blob): Promise<Blob> {
  try {
    const piexif = (await import('piexifjs')).default
    const origBytes = new Uint8Array(await original.arrayBuffer())
    const compBytes = new Uint8Array(await compressed.arrayBuffer())
    const toBinary = (u: Uint8Array): string => {
      let s = ''
      const CHUNK = 0x8000
      for (let i = 0; i < u.length; i += CHUNK) {
        s += String.fromCharCode(...u.subarray(i, i + CHUNK))
      }
      return s
    }
    const fromBinary = (s: string): Uint8Array => {
      const u = new Uint8Array(s.length)
      for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff
      return u
    }
    const exifObj = piexif.load(toBinary(origBytes))
    const hasTags = ['0th', 'Exif', 'GPS', 'Interop', '1st'].some(
      (ifd) => exifObj[ifd] && Object.keys(exifObj[ifd]).length > 0,
    )
    // No tags to preserve: injecting an empty EXIF block would only add bytes.
    if (!hasTags) return compressed
    const exifBytes = piexif.dump(exifObj)
    const outBinary = piexif.insert(exifBytes, toBinary(compBytes))
    return new Blob([fromBinary(outBinary)], { type: 'image/jpeg' })
  } catch (err) {
    console.warn('[image-compressor] EXIF restore failed, keeping stripped output:', err)
    return compressed
  }
}
