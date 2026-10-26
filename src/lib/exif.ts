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
    // Meaningful tags only: GPS and the 1st IFD are stripped below (GPS
    // for privacy, 1st is the embedded thumbnail), so neither by itself
    // justifies injecting a block.
    const hasTags = ['0th', 'Exif', 'Interop'].some(
      (ifd) => exifObj[ifd] && Object.keys(exifObj[ifd]).length > 0,
    )
    // No tags to preserve: injecting an empty EXIF block would only add bytes.
    if (!hasTags) return compressed
    // The canvas already applied the Orientation rotation, so writing the
    // original Orientation back would double-rotate the image in viewers.
    // Normalize it to 1 (normal) before writing back.
    if (!exifObj['0th']) exifObj['0th'] = {}
    exifObj['0th'][piexif.ImageIFD.Orientation] = 1
    // Drop the embedded thumbnail (1st IFD + thumbnail bytes): it costs
    // tens of KB, and it would show the unrotated original anyway.
    delete exifObj['1st']
    delete exifObj['thumbnail']
    // Drop GPS by default: "keep shooting info" must not leak location.
    // (A split keep-location toggle could preserve it on request; the
    // default is to strip.)
    delete exifObj['GPS']
    const exifBytes = piexif.dump(exifObj)
    const outBinary = piexif.insert(exifBytes, toBinary(compBytes))
    return new Blob([fromBinary(outBinary)], { type: 'image/jpeg' })
  } catch (err) {
    console.warn('[image-compressor] EXIF restore failed, keeping stripped output:', err)
    return compressed
  }
}
