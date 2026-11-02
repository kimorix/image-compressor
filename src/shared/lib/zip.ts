// Streamed STORE zip of already-compressed outputs (images, .docx), shared by
// every feature's "download all". Entries are fetched one by one from their
// object URLs (or taken as Blobs) and passed through fflate without
// deflating, so memory stays at roughly one copy of the archive.
// fflate is loaded on the first "download all", not with the page.

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

/** onProgress(i, n) fires as entry i (1-based) of n starts, so a UI can
say "打包中 12/19" while the archive is built. */
export async function zipEntries(entries: ZipEntry[], onProgress?: (i: number, n: number) => void): Promise<Blob> {
  const { Zip, ZipPassThrough } = await import('fflate')
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
          onProgress?.(i + 1, entries.length)
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

/** Path of an output inside a ZIP: the dropped folder it came from, if any. */
export function zipPath(dir: string | undefined, name: string): string {
  return dir ? `${dir}/${name}` : name
}

/**
 * Open a Blob (a PDF, say) in a new tab; download it instead when the popup
 * is blocked. window.open with the 'noopener' feature always returns null
 * (HTML spec), which made the fallback download fire on every click, so the
 * tab is opened plainly and its opener cut by hand.
 */
export function openBlob(blob: Blob, name: string, win: Pick<Window, 'open'> = window): void {
  const url = URL.createObjectURL(blob)
  const w = win.open(url, '_blank')
  if (w) {
    try { w.opener = null } catch { /* cross-origin: nothing to cut */ }
  } else {
    downloadUrl(blob, name)
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** yyyymmdd stamp for archive names. */
export function ymd(d = new Date()): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
