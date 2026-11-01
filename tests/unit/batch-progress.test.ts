import { describe, expect, it } from 'vitest'
import { BatchProgress, currentIndex, positionOf, readIndex } from '../../src/shared/lib/batch-progress'
import { LANGS, MESSAGES, t } from '../../src/shared/i18n'
import { zipEntries } from '../../src/shared/lib/zip'

describe('batch progress ("image i of n")', () => {
  it('names the image being worked on, not the finished count', () => {
    expect(currentIndex(0, 19)).toBe(1)
    expect(currentIndex(2, 19)).toBe(3)
    expect(currentIndex(19, 19)).toBe(19)
    expect(currentIndex(25, 19)).toBe(19)
    expect(currentIndex(0, 0)).toBe(0)
  })
  it('counts a batch by image id and resets when it drains', () => {
    const b = new BatchProgress()
    for (const id of ['a', 'b', 'c']) b.start(id)
    expect([b.index, b.total, b.active]).toEqual([1, 3, true])
    b.settle('a')
    expect([b.index, b.done]).toEqual([2, 1])
    b.start('b') // a retry of an image already in the batch is not counted twice
    expect(b.total).toBe(3)
    b.start('d') // more images added mid-run grow the batch
    expect([b.index, b.total]).toEqual([2, 4])
    b.remove('d')
    expect(b.total).toBe(3)
    b.settle('b')
    b.settle('zzz') // unknown ids are ignored
    expect(b.index).toBe(3)
    b.settle('c')
    expect([b.total, b.done, b.index, b.active]).toEqual([0, 0, 0, false])
    b.start('e') // next batch counts from 1 again
    expect([b.index, b.total]).toEqual([1, 1])
  })
  it('reports positions and the reading phase', () => {
    expect(positionOf(['x', 'y', 'z'], 'z')).toBe(3)
    expect(positionOf(['x'], 'q')).toBe(0)
    expect(readIndex(17, 19)).toBe(3)
    expect(readIndex(0, 19)).toBe(19)
  })
  it('has interpolated copy in all six languages', () => {
    const keys = ['progCompress', 'progConvert', 'progProcess', 'progRead', 'progZip', 'rowCompress', 'rowConvert', 'rowProcess', 'rowQueued', 'rowRead']
    for (const { code } of LANGS) {
      for (const k of keys) {
        expect(MESSAGES[code][k], `${code}.${k}`).toBeTypeOf('function')
        const s = t(code, k, 3, 19)
        expect(s, `${code}.${k}`).toContain('3')
        expect(s, `${code}.${k}`).toContain('19')
      }
    }
    expect(t('zh', 'progCompress', 3, 19)).toBe('正在压缩 第 3/19 张')
    expect(t('zh', 'progRead', 3, 19)).toBe('读取中 3/19')
    expect(t('zh', 'progZip', 12, 19)).toBe('打包中 12/19')
  })
  it('zip packaging reports entry i of n as it goes', async () => {
    const seen: [number, number][] = []
    await zipEntries([{ name: 'a', blob: new Blob(['1']) }, { name: 'b', blob: new Blob(['2']) }, { name: 'c', blob: new Blob(['3']) }], (i, n) => seen.push([i, n]))
    expect(seen).toEqual([[1, 3], [2, 3], [3, 3]])
  })
})
