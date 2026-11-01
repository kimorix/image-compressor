// Page-wide file intake for a tool view: files dropped anywhere on the page
// (folders walked, each file keeps the folder it came from) and, optionally,
// Ctrl+V / ⌘V. Listeners live only while the view is shown: the shell keeps
// views alive (KeepAlive), and a hidden tool must not take the drop.
//
// createFileIntake() is the DOM part (testable with any EventTarget);
// useFileIntake() binds it to the component's activate/deactivate/unmount.
import { getCurrentInstance, onActivated, onDeactivated, onUnmounted, ref } from 'vue'
import { filesFromDrop, type DroppedFile } from '../lib/drop'

export interface FileIntakeOptions {
  /** Files dropped on the page (outside the tool's own drop zone). */
  onFiles: (files: DroppedFile[]) => void
  /** Pasted files; omit to leave paste alone. */
  onPaste?: (files: File[]) => void
  /** The clipboard announced files but gave none (e.g. a copied Finder icon). */
  onPasteEmpty?: () => void
  /** Rename pasted "image.png" screenshots apart (paste-<time>-<i>.png). */
  stampPasteNames?: boolean
  /** Also take a paste aimed at a text field (default: leave fields alone). */
  pasteInFields?: boolean
  /** While true, a drag shows no overlay and a drop calls onBlocked. */
  blocked?: () => boolean
  onBlocked?: () => void
  /** Drops landing inside this selector are left to that element's handler. */
  ignoreDropIn?: string
}

const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types?.includes('Files')

/** Pasted screenshots are all called "image.png": stamp them apart. */
export function stampPasted(files: File[], now = Date.now()): File[] {
  return files.map((file, i) => (file.name === 'image.png'
    ? new File([file], `paste-${now}-${i}.png`, { type: file.type, lastModified: now })
    : file))
}

export function createFileIntake(doc: Pick<Document, 'addEventListener' | 'removeEventListener'>, opts: FileIntakeOptions) {
  const pageDragging = ref(false)
  let depth = 0
  let listening = false

  function reset() {
    depth = 0
    pageDragging.value = false
  }
  function onEnter(e: DragEvent) {
    if (!hasFiles(e) || opts.blocked?.()) return
    depth++
    pageDragging.value = true
  }
  function onLeave(e: DragEvent) {
    if (!hasFiles(e)) return
    depth = Math.max(0, depth - 1)
    if (!depth) pageDragging.value = false
  }
  function onOver(e: DragEvent) {
    if (hasFiles(e)) e.preventDefault()
  }
  function onDrop(e: DragEvent) {
    reset()
    if (!hasFiles(e)) return
    if (opts.blocked?.()) {
      e.preventDefault()
      opts.onBlocked?.()
      return
    }
    const target = e.target as HTMLElement | null
    if (opts.ignoreDropIn && target?.closest?.(opts.ignoreDropIn)) return
    e.preventDefault()
    // filesFromDrop grabs the entries synchronously, before its first await.
    void filesFromDrop(e.dataTransfer).then((d) => { if (d.length) opts.onFiles(d) })
  }
  function onPaste(e: ClipboardEvent) {
    const el = e.target as HTMLElement | null
    if (!opts.pasteInFields && el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
    const files = [...(e.clipboardData?.files ?? [])]
    if (!files.length) {
      if (e.clipboardData?.types?.includes('Files')) opts.onPasteEmpty?.()
      return
    }
    e.preventDefault()
    opts.onPaste!(opts.stampPasteNames ? stampPasted(files) : files)
  }
  const bindings: [string, EventListener][] = [
    ['dragenter', onEnter as EventListener],
    ['dragleave', onLeave as EventListener],
    ['dragend', reset as EventListener],
    ['dragover', onOver as EventListener],
    ['drop', onDrop as EventListener],
  ]
  if (opts.onPaste) bindings.push(['paste', onPaste as EventListener])

  function start() {
    if (listening) return
    listening = true
    for (const [type, fn] of bindings) doc.addEventListener(type, fn)
  }
  function stop() {
    if (!listening) return
    listening = false
    for (const [type, fn] of bindings) doc.removeEventListener(type, fn)
    reset()
  }
  return { pageDragging, start, stop, reset }
}

export function useFileIntake(opts: FileIntakeOptions) {
  const intake = createFileIntake(typeof document !== 'undefined' ? document : { addEventListener() {}, removeEventListener() {} }, opts)
  if (getCurrentInstance()) {
    onActivated(intake.start)
    onDeactivated(intake.stop)
    onUnmounted(intake.stop)
  }
  return intake
}
