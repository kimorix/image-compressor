// Files from a drop, including the contents of dropped folders.
//
// DataTransfer.files lists a dropped folder as one zero-byte entry, so
// folders are walked through webkitGetAsEntry instead (supported by every
// current browser despite the prefix). Each file comes back with the
// folder path it was found under ('' for loose files), so the zip can keep
// the structure. The entries must be grabbed synchronously inside the drop
// event: the DataTransfer is emptied once the handler returns.

export interface DroppedFile {
  file: File
  dir: string
}

export function grabEntries(dt: DataTransfer | null): { entries: FileSystemEntry[]; files: File[] } {
  const entries: FileSystemEntry[] = []
  const files: File[] = []
  if (!dt) return { entries, files }
  const items = dt.items ? [...dt.items] : []
  const canWalk = items.length > 0 && typeof items[0].webkitGetAsEntry === 'function'
  if (!canWalk) return { entries, files: [...dt.files] }
  for (const it of items) {
    if (it.kind !== 'file') continue
    const e = it.webkitGetAsEntry()
    if (e) entries.push(e)
    else {
      const f = it.getAsFile()
      if (f) files.push(f)
    }
  }
  return { entries, files }
}

const MAX_FILES = 2000

export async function walkEntries(entries: FileSystemEntry[]): Promise<DroppedFile[]> {
  const out: DroppedFile[] = []
  const visit = async (entry: FileSystemEntry, dir: string): Promise<void> => {
    if (out.length >= MAX_FILES) return
    if (entry.isFile) {
      const file = await new Promise<File | null>((res) => (entry as FileSystemFileEntry).file(res, () => res(null)))
      if (file) out.push({ file, dir })
      return
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader()
      const sub = dir ? `${dir}/${entry.name}` : entry.name
      // readEntries returns batches (100 in Chrome) until an empty one.
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res) => reader.readEntries(res, () => res([])))
        if (!batch.length) break
        for (const child of batch) await visit(child, sub)
      }
    }
  }
  for (const e of entries) await visit(e, '')
  return out
}

export async function filesFromDrop(dt: DataTransfer | null): Promise<DroppedFile[]> {
  const { entries, files } = grabEntries(dt)
  const walked = await walkEntries(entries)
  return [...walked, ...files.map((file) => ({ file, dir: '' }))]
}
