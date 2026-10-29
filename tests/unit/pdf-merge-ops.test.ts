import { describe, expect, it } from 'vitest'
import {
  applySourceOrder, commit, deleteKeys, duplicateKeys, emptyHistory, HISTORY_LIMIT, isGrouped, keysOfSource, livePages,
  moveKeys, pagesForSource, redo, removeSource, reorder, restoreKeys, rotateKeys, sortSourcesByName, sourceOrder,
  toggleDeleteKeys, undo, type KeyGen,
} from '../../src/features/pdf-merge/lib/ops'
import type { PageRef } from '../../src/features/pdf-merge/types'

function keys(prefix = 'k'): KeyGen {
  let i = 0
  return () => `${prefix}${i++}`
}
const sig = (ps: PageRef[]) => ps.map((p) => `${p.src}${p.index + 1}${p.rotate ? '@' + p.rotate : ''}${p.deleted ? 'x' : ''}`).join(' ')

function doc(): PageRef[] {
  const k = keys()
  return [...pagesForSource('a', 3, k), ...pagesForSource('b', 2, k)]
}

describe('pdf-merge ops', () => {
  it('creates pages per source in order with unique keys', () => {
    const d = doc()
    expect(sig(d)).toBe('a1 a2 a3 b1 b2')
    expect(new Set(d.map((p) => p.key)).size).toBe(5)
  })

  it('reorders one page and moves a block', () => {
    const d = doc()
    expect(sig(reorder(d, 0, 4))).toBe('a2 a3 b1 b2 a1')
    expect(sig(moveKeys(d, ['k3', 'k1'], 0))).toBe('a2 b1 a1 a3 b2')
    expect(sig(d)).toBe('a1 a2 a3 b1 b2') // input untouched
  })

  it('rotates cumulatively and normalises', () => {
    let d = rotateKeys(doc(), ['k0'], 90)
    d = rotateKeys(d, ['k0', 'k1'], -90)
    expect(sig(d)).toBe('a1 a2@270 a3 b1 b2')
    expect(sig(rotateKeys(d, ['k1'], 450))).toBe('a1 a2 a3 b1 b2')
  })

  it('soft-deletes, restores and toggles', () => {
    const d = deleteKeys(doc(), ['k1', 'k4'])
    expect(sig(d)).toBe('a1 a2x a3 b1 b2x')
    expect(sig(livePages(d))).toBe('a1 a3 b1')
    expect(sig(restoreKeys(d, ['k1']))).toBe('a1 a2 a3 b1 b2x')
    expect(sig(toggleDeleteKeys(d, ['k1', 'k4']))).toBe('a1 a2 a3 b1 b2')
    // Mixed: some deleted → delete all.
    expect(sig(toggleDeleteKeys(d, ['k0', 'k1']))).toBe('a1x a2x a3 b1 b2x')
  })

  it('duplicates right after each page with new keys', () => {
    const d = rotateKeys(doc(), ['k2'], 90)
    const r = duplicateKeys(d, ['k0', 'k2'], keys('d'))
    expect(sig(r.pages)).toBe('a1 a1 a2 a3@90 a3@90 b1 b2')
    expect(r.added).toEqual(['d0', 'd1'])
  })

  it('removes a source and reports source order', () => {
    const d = reorder(doc(), 3, 0)
    expect(sourceOrder(d)).toEqual(['b', 'a'])
    expect(sourceOrder(d, ['a', 'b', 'c'])).toEqual(['b', 'a', 'c'])
    expect(sig(removeSource(d, 'b'))).toBe('a1 a2 a3')
    expect(keysOfSource(d, 'b')).toEqual(['k3', 'k4'])
  })

  it('detects grouped vs interleaved', () => {
    expect(isGrouped(doc())).toBe(true)
    expect(isGrouped(applySourceOrder(doc(), ['b', 'a']))).toBe(true)
    expect(isGrouped(reorder(doc(), 3, 0))).toBe(false) // b1 a1 a2 a3 b2: b in two runs
  })

  it('isGrouped is false once a file is split into two runs', () => {
    expect(isGrouped(reorder(doc(), 0, 4))).toBe(false)
    expect(isGrouped([])).toBe(true)
  })

  it('applies a new file order stably', () => {
    const d = reorder(doc(), 0, 4) // a2 a3 b1 b2 a1
    expect(sig(applySourceOrder(d, ['b', 'a']))).toBe('b1 b2 a2 a3 a1')
    expect(sig(applySourceOrder(doc(), ['b']))).toBe('b1 b2 a1 a2 a3')
  })

  it('sorts files by name naturally', () => {
    expect(sortSourcesByName([{ id: '1', name: 'scan 10.pdf' }, { id: '2', name: 'scan 2.pdf' }, { id: '3', name: 'A.pdf' }])).toEqual(['3', '2', '1'])
  })

  it('undo / redo with a 20-step limit', () => {
    let h = emptyHistory()
    let cur = doc()
    const first = cur
    cur = reorder(cur, 0, 4)
    h = commit(h, first)
    const r = undo(h, cur)!
    expect(sig(r.pages)).toBe(sig(first))
    const again = redo(r.history, r.pages)!
    expect(sig(again.pages)).toBe(sig(cur))
    expect(undo(emptyHistory(), cur)).toBeNull()
    expect(redo(emptyHistory(), cur)).toBeNull()
    // A new commit clears redo.
    expect(commit(r.history, r.pages).future).toEqual([])
    // Limit.
    let lh = emptyHistory()
    for (let i = 0; i < 30; i++) lh = commit(lh, [{ key: String(i), src: 'a', index: i, rotate: 0 }])
    expect(lh.past.length).toBe(HISTORY_LIMIT)
    expect(lh.past[0][0].key).toBe('10')
  })
})
