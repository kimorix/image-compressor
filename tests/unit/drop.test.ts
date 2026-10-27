import { describe, expect, it } from 'vitest'
import { walkEntries } from '../../src/shared/lib/drop'

// Minimal FileSystemEntry doubles: readEntries hands out one batch, then [].
function file(name: string) {
  return { isFile: true, isDirectory: false, name, file: (ok: (f: File) => void) => ok(new File(['x'], name)) } as unknown as FileSystemEntry
}
function dir(name: string, children: FileSystemEntry[]) {
  return {
    isFile: false, isDirectory: true, name,
    createReader: () => {
      let done = false
      return { readEntries: (ok: (e: FileSystemEntry[]) => void) => { ok(done ? [] : children); done = true } }
    },
  } as unknown as FileSystemEntry
}

describe('walkEntries', () => {
  it('flattens folders and keeps each file\'s folder path', async () => {
    const out = await walkEntries([file('a.jpg'), dir('trip', [file('b.jpg'), dir('day2', [file('c.png')])])])
    expect(out.map((d) => [d.dir, d.file.name])).toEqual([['', 'a.jpg'], ['trip', 'b.jpg'], ['trip/day2', 'c.png']])
  })
})
