import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { useHint } from '../../src/shared/composables/useHint'
import { useArmedConfirm } from '../../src/shared/composables/useArmedConfirm'
import { useBatchExport } from '../../src/shared/composables/useBatchExport'
import { createFileIntake, stampPasted } from '../../src/shared/composables/useFileIntake'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('useHint', () => {
  it('shows a hint and clears it after its lifetime', () => {
    vi.useFakeTimers()
    const { hint, showHint } = useHint(3500)
    showHint('a')
    expect(hint.value).toBe('a')
    vi.advanceTimersByTime(3000)
    showHint('b')
    vi.advanceTimersByTime(3000)
    expect(hint.value).toBe('b')
    vi.advanceTimersByTime(600)
    expect(hint.value).toBeNull()
    showHint('c', 6000)
    vi.advanceTimersByTime(5000)
    expect(hint.value).toBe('c')
  })
  it('stops its timer with the scope', () => {
    vi.useFakeTimers()
    const scope = effectScope()
    const h = scope.run(() => useHint(1000))!
    h.showHint('x')
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('useArmedConfirm', () => {
  it('arms on the first click, confirms on the second', () => {
    vi.useFakeTimers()
    const { armed, confirm } = useArmedConfirm(3000)
    expect(confirm()).toBe(false)
    expect(armed.value).toBe(true)
    expect(confirm()).toBe(true)
    expect(armed.value).toBe(false)
  })
  it('disarms by itself', () => {
    vi.useFakeTimers()
    const { armed, confirm } = useArmedConfirm(3000)
    confirm()
    vi.advanceTimersByTime(3001)
    expect(armed.value).toBe(false)
    expect(confirm()).toBe(false)
  })
})

function fakeDocument() {
  const saved: { name: string; size: number }[] = []
  const doc = {
    createElement: () => {
      const a = { href: '', download: '', click() { saved.push({ name: a.download, size: 0 }) }, remove() {} }
      return a
    },
    body: { appendChild() {} },
  }
  return { doc, saved }
}

describe('useBatchExport', () => {
  type It = { name: string; blob: Blob }
  const mk = (n: number): It[] => Array.from({ length: n }, (_, i) => ({ name: `f${i}.png`, blob: new Blob([String(i)]) }))
  it('downloads a lone item as itself', async () => {
    const one = vi.fn()
    const ex = useBatchExport<It>({ done: () => mk(1), entries: (l) => l, downloadOne: one, zipName: () => 'x.zip', onError: vi.fn() })
    await ex.zipAll()
    expect(one).toHaveBeenCalledTimes(1)
    expect(ex.zipping.value).toBe(false)
  })
  it('packs several into one zip with progress', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const { doc, saved } = fakeDocument()
    vi.stubGlobal('document', doc)
    const seen: number[] = []
    const ex = useBatchExport<It>({ done: () => mk(3), entries: (l) => l, downloadOne: vi.fn(), zipName: (l) => `all-${l.length}.zip`, onError: vi.fn() })
    const run = ex.zipAll()
    expect(ex.zipping.value).toBe(true)
    await nextTick()
    seen.push(ex.zipProgress.value.total)
    await run
    expect(saved.map((s) => s.name)).toEqual(['all-3.zip'])
    expect(seen).toEqual([3])
    expect(ex.zipping.value).toBe(false)
    expect(ex.zipProgress.value).toEqual({ done: 0, total: 0 })
  })
  it('reports a failed zip and resets', async () => {
    const onError = vi.fn()
    const ex = useBatchExport<It>({ done: () => mk(2), entries: () => [{ name: 'a' }, { name: 'b', url: 'blob:gone' }], downloadOne: vi.fn(), zipName: () => 'x.zip', onError })
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('revoked')))
    await ex.zipAll()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(ex.zipping.value).toBe(false)
  })
  it('save all shares the files, falling back to the zip', async () => {
    const share = vi.fn(async () => {})
    vi.stubGlobal('navigator', { canShare: () => true, share })
    const files = vi.fn((l: It[]) => l.map((i) => new File([i.blob], i.name)))
    const ex = useBatchExport<It>({ done: () => mk(2), entries: (l) => l, downloadOne: vi.fn(), zipName: () => 'x.zip', files, onError: vi.fn() })
    await ex.saveAll()
    expect(share).toHaveBeenCalledTimes(1)
    expect(ex.sharing.value).toBe(false)
  })
})

describe('createFileIntake', () => {
  function dragEvent(type: string, files = true) {
    const e = new Event(type, { cancelable: true }) as Event & { dataTransfer: unknown }
    e.dataTransfer = { types: files ? ['Files'] : ['text/plain'], items: [], files: [new File(['x'], 'a.png')] }
    return e
  }
  it('tracks the page drag only while listening', () => {
    const doc = new EventTarget()
    const intake = createFileIntake(doc as unknown as Document, { onFiles: vi.fn() })
    doc.dispatchEvent(dragEvent('dragenter'))
    expect(intake.pageDragging.value).toBe(false)
    intake.start()
    doc.dispatchEvent(dragEvent('dragenter'))
    doc.dispatchEvent(dragEvent('dragenter'))
    doc.dispatchEvent(dragEvent('dragleave'))
    expect(intake.pageDragging.value).toBe(true)
    doc.dispatchEvent(dragEvent('dragleave'))
    expect(intake.pageDragging.value).toBe(false)
    doc.dispatchEvent(dragEvent('dragenter'))
    doc.dispatchEvent(dragEvent('dragend'))
    expect(intake.pageDragging.value).toBe(false)
    doc.dispatchEvent(dragEvent('dragenter', false))
    expect(intake.pageDragging.value).toBe(false)
    intake.stop()
  })
  it('hands dropped files over, or reports a blocked drop', async () => {
    const doc = new EventTarget()
    const onFiles = vi.fn()
    let busy = false
    const onBlocked = vi.fn()
    const intake = createFileIntake(doc as unknown as Document, { onFiles, blocked: () => busy, onBlocked })
    intake.start()
    const drop = dragEvent('drop')
    doc.dispatchEvent(drop)
    expect(drop.defaultPrevented).toBe(true)
    await new Promise((r) => setTimeout(r, 0))
    expect(onFiles).toHaveBeenCalledWith([{ file: expect.any(File), dir: '' }])
    busy = true
    doc.dispatchEvent(dragEvent('drop'))
    expect(onBlocked).toHaveBeenCalledTimes(1)
    intake.stop()
  })
  it('takes pasted files outside text fields', () => {
    const doc = new EventTarget()
    const onPaste = vi.fn()
    const onPasteEmpty = vi.fn()
    const intake = createFileIntake(doc as unknown as Document, { onFiles: vi.fn(), onPaste, onPasteEmpty, stampPasteNames: true })
    intake.start()
    const paste = (files: File[], target: unknown = null) => {
      const e = new Event('paste', { cancelable: true }) as Event & { clipboardData: unknown }
      e.clipboardData = { files, types: ['Files'] }
      Object.defineProperty(e, 'target', { value: target })
      doc.dispatchEvent(e)
      return e
    }
    expect(paste([new File(['x'], 'image.png', { type: 'image/png' })]).defaultPrevented).toBe(true)
    expect(onPaste.mock.calls[0][0][0].name).toMatch(/^paste-\d+-0\.png$/)
    paste([new File(['x'], 'b.png')], { tagName: 'INPUT' })
    expect(onPaste).toHaveBeenCalledTimes(1)
    paste([])
    expect(onPasteEmpty).toHaveBeenCalledTimes(1)
    intake.stop()
  })
  it('stamps only generic screenshot names', () => {
    const out = stampPasted([new File(['1'], 'image.png'), new File(['2'], 'shot.jpg')], 42)
    expect(out.map((f) => f.name)).toEqual(['paste-42-0.png', 'shot.jpg'])
  })
})
