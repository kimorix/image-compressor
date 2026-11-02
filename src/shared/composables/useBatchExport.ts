// "Download all" / "save all" for a list of finished outputs, shared by
// every tool: one finished file downloads directly, two or more are packed
// into one STORE zip (browsers, Safari above all, block many downloads in a
// row), with an i/n progress and a single error path. On phones, "save all"
// offers the files to the share sheet and falls back to the zip.
import { ref } from 'vue'
import { shareFilesOr } from '../lib/share'
import { downloadUrl, zipEntries, type ZipEntry } from '../lib/zip'

export interface BatchExportOptions<T> {
  /** The finished items, in list order. */
  done: () => T[]
  /** ZIP entries for the finished items (names may include folders). */
  entries: (list: T[]) => ZipEntry[]
  /** A lone finished item is downloaded as itself, not as a one-file zip. */
  downloadOne: (item: T) => void
  zipName: (list: T[]) => string
  /** Files for the share sheet ("save all" on phones). */
  files?: (list: T[]) => File[]
  /** Packing failed (memory, a revoked URL…): tell the user. */
  onError: (err: unknown) => void
}

export function useBatchExport<T>(opts: BatchExportOptions<T>) {
  const zipping = ref(false)
  const sharing = ref(false)
  const zipProgress = ref({ done: 0, total: 0 })

  async function zipAll(): Promise<void> {
    const list = opts.done()
    if (!list.length || zipping.value) return
    if (list.length === 1) { opts.downloadOne(list[0]); return }
    zipping.value = true
    try {
      zipProgress.value = { done: 0, total: list.length }
      const blob = await zipEntries(opts.entries(list), (i, n) => { zipProgress.value = { done: i, total: n } })
      downloadUrl(blob, opts.zipName(list))
    } catch (err) {
      opts.onError(err)
    } finally {
      zipping.value = false
      zipProgress.value = { done: 0, total: 0 }
    }
  }
  function downloadAll(): void {
    void zipAll()
  }
  async function saveAll(): Promise<void> {
    const list = opts.done()
    if (!list.length || !opts.files) return
    sharing.value = true
    try {
      await shareFilesOr(typeof navigator !== 'undefined' ? navigator : undefined, opts.files(list), zipAll)
    } finally {
      sharing.value = false
    }
  }
  return { zipping, sharing, zipProgress, zipAll, downloadAll, saveAll }
}
