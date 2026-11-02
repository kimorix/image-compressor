import { afterEach, describe, expect, it, vi } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { openBlob, uniqueNames, zipEntries, zipPath } from '../../src/shared/lib/zip'

describe('zip (fflate loaded on demand)', () => {
  it('stores every entry under a unique name', async () => {
    const blob = await zipEntries([
      { name: 'a.docx', blob: new Blob(['one']) },
      { name: 'a.docx', blob: new Blob(['two']) },
    ])
    expect(blob.type).toBe('application/zip')
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    expect(Object.keys(files)).toEqual(['a.docx', 'a-2.docx'])
    expect(strFromU8(files['a-2.docx'])).toBe('two')
  })
  it('numbers duplicates past existing suffixes', () => {
    expect(uniqueNames(['x.png', 'x.png', 'x-2.png', 'dir/y', 'dir/y'])).toEqual(['x.png', 'x-2.png', 'x-2-2.png', 'dir/y', 'dir/y-2'])
  })
})

describe('zipPath', () => {
  it('keeps the dropped folder in front of the name', () => {
    expect(zipPath('', 'a.jpg')).toBe('a.jpg')
    expect(zipPath(undefined, 'a.jpg')).toBe('a.jpg')
    expect(zipPath('trip/day1', 'a.jpg')).toBe('trip/day1/a.jpg')
  })
})

describe('openBlob (preview in a new tab)', () => {
  function fakeDocument() {
    const clicks: string[] = []
    const doc = {
      createElement: () => ({ href: '', download: '', click() { clicks.push(this.download) }, remove() {} }),
      body: { appendChild() {} },
    }
    return { doc, clicks }
  }
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

  it('opens without the noopener feature and cuts the opener, no extra download', () => {
    vi.useFakeTimers()
    const { doc, clicks } = fakeDocument()
    vi.stubGlobal('document', doc)
    const tab = { opener: {} as unknown }
    const open = vi.fn(() => tab as unknown as Window)
    openBlob(new Blob(['%PDF']), 'a.pdf', { open })
    expect(open).toHaveBeenCalledTimes(1)
    expect((open.mock.calls[0] as unknown[]).length).toBe(2)
    expect(tab.opener).toBeNull()
    expect(clicks).toEqual([])
  })
  it('downloads instead when the popup is blocked', () => {
    vi.useFakeTimers()
    const { doc, clicks } = fakeDocument()
    vi.stubGlobal('document', doc)
    openBlob(new Blob(['%PDF']), 'a.pdf', { open: () => null })
    expect(clicks).toEqual(['a.pdf'])
  })
})
