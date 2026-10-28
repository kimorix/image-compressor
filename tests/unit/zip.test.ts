import { describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { uniqueNames, zipEntries } from '../../src/shared/lib/zip'

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
