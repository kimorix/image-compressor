// Streamed STORE zip of already-compressed outputs (images, .docx), shared by
// every feature's "download all". Entries are fetched one by one from their
// object URLs (or taken as Blobs) and passed through fflate without
// deflating, so memory stays at roughly one copy of the archive.
import { Zip, ZipPassThrough } from 'fflate'

export interface ZipEntry { name: string; url?: string; blob?: Blob }

/** Make every name unique ("a.docx", "a-2.docx", …) keeping folders. */
export function uniqueNames(names: string[]): string[] {
  const used = new Set<string>()
  return names.map((n) => {
    let name = n
    if (used.has(name)) {
      const dot = name.lastIndexOf('.')
      const stem = dot > 0 ? name.slice(0, dot) : name
      const ext = dot > 0 ? name.slice(dot) : ''
      let i = 2
      while (used.has(`${stem}-${i}${ext}`)) i++
      name = `${stem}-${i}${ext}`
    }
    used.add(name)
    return name
  })
}

export function zipEntries(entries: ZipEntry[]): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const parts: BlobPart[] = []
    let settled = false
    const zip = new Zip((err, chunk, final) => {
      if (err) {
        if (!settled) { settled = true; reject(err) }
        return
      }
      if (chunk) parts.push(chunk)
      if (final && !settled) {
        settled = true
        resolve(new Blob(parts, { type: 'application/zip' }))
      }
    })
    void (async () => {
      try {
        const names = uniqueNames(entries.map((e) => e.name))
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i]
          const src = e.blob ?? await (await fetch(e.url!)).blob()
          const buf = new Uint8Array(await src.arrayBuffer())
          const entry = new ZipPassThrough(names[i])
          zip.add(entry)
          entry.push(buf, true)
        }
        zip.end()
      } catch (err) {
        try { zip.terminate() } catch { /* already ended */ }
        if (!settled) { settled = true; reject(err) }
      }
    })()
  })
}

/** Trigger a download of a URL or Blob under a file name. */
export function downloadUrl(href: string | Blob, name: string): void {
  const url = typeof href === 'string' ? href : URL.createObjectURL(href)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  if (typeof href !== 'string') setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** yyyymmdd stamp for archive names. */
export function ymd(d = new Date()): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
