import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PDFDocument, PDFDict, PDFName } from '@cantoo/pdf-lib'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { FIXTURES } from './pdf-fixture'
import { NeedsPasswordError, runMerge, runSplit, type MergeJob, type OutPageSpec, type SourceBytes } from '../../src/features/pdf-merge/lib/write'
import { readOutline } from '../../src/features/pdf-merge/lib/outline'

function src(id: string, file: string): SourceBytes {
  const b = readFileSync(join(FIXTURES, file))
  return { id, name: file, bytes: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer }
}
const pages = (s: string, idx: number[], rotate = 0): OutPageSpec[] => idx.map((index) => ({ src: s, index, rotate }))

function mergeJob(over: Partial<MergeJob>): MergeJob {
  return {
    kind: 'merge', sources: [], pages: [], name: 'out.pdf', pageSize: 'keep', bookmarks: true, keepForms: true, blankBetween: false,
    titles: {}, ...over,
  }
}

async function texts(bytes: Uint8Array): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise
  const out: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent()
    out.push(tc.items.map((it) => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' ').trim())
  }
  await doc.loadingTask.destroy()
  return out
}

function flat(nodes: ReturnType<typeof readOutline>, depth = 0): string[] {
  return nodes.flatMap((n) => [`${'  '.repeat(depth)}${n.title}@${n.page}`, ...flat(n.children, depth + 1)])
}

describe('pdf-merge writer (@cantoo/pdf-lib)', () => {
  it('merges in the given order with rotation = original + edit', async () => {
    const r = await runMerge(mergeJob({
      sources: [src('a', 'outline.pdf'), src('b', 'report.pdf')],
      pages: [...pages('b', [0]), ...pages('a', [0, 1], 90), ...pages('a', [4])],
      titles: { a: 'outline', b: 'report' },
    }))
    const out = await PDFDocument.load(r.outputs[0].bytes)
    expect(out.getPageCount()).toBe(4)
    // outline.pdf page 2 already carries /Rotate 90: 90 + 90 = 180.
    expect(out.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90, 180, 0])
    const t = await texts(r.outputs[0].bytes)
    expect(t[0]).toContain('2026 Product Plan')
    expect(t[1]).toContain('outline.pdf page 1')
    expect(t[2]).toContain('outline.pdf page 2')
    expect(t[3]).toContain('outline.pdf page 5')
  })

  it('writes one top-level bookmark per file with the original outline remapped', async () => {
    const r = await runMerge(mergeJob({
      sources: [src('b', 'report.pdf'), src('a', 'outline.pdf')],
      // outline.pdf page 3 (Section 1.2) deleted; Chapter 2 (page 4) moved first.
      pages: [...pages('b', [0, 1]), ...pages('a', [3, 0, 1, 4])],
      titles: { a: 'outline', b: 'report' },
    }))
    const out = await PDFDocument.load(r.outputs[0].bytes)
    expect(flat(readOutline(out))).toEqual([
      'report@0',
      'outline@2',
      '  Chapter 1@3',
      '    Section 1.1@4',
      '  Chapter 2@2',
      '  Appendix@5',
    ])
  })

  it('reads owner-password-only files (RC4, AES-256, AES-128 + object streams) with readable text', async () => {
    const r = await runMerge(mergeJob({
      sources: [src('r', 'owner-rc4.pdf'), src('s', 'owner-aes.pdf'), src('t', 'owner-aes128-objstm.pdf')],
      pages: [...pages('r', [0]), ...pages('s', [2]), ...pages('t', [0, 4])],
      bookmarks: true,
      titles: { r: 'rc4', s: 'aes', t: 'aes128' },
    }))
    const bytes = r.outputs[0].bytes
    const out = await PDFDocument.load(bytes)
    expect(out.isEncrypted).toBe(false)
    const t = await texts(bytes)
    expect(t[0]).toContain('2026 Product Plan')
    expect(t[1].length).toBeGreaterThan(20)
    expect(t[2]).toContain('outline.pdf page 1')
    expect(t[3]).toContain('outline.pdf page 5')
    // The AES-128 file's own outline (encrypted strings) survives decrypted.
    expect(flat(readOutline(out))).toContain('  Appendix@3')
  })

  it('rejects files that need an open password', async () => {
    await expect(runMerge(mergeJob({ sources: [src('x', 'locked.pdf')], pages: pages('x', [0]) })))
      .rejects.toBeInstanceOf(NeedsPasswordError)
  })

  it('duplicates pages and pads odd files with a blank page', async () => {
    const r = await runMerge(mergeJob({
      sources: [src('a', 'outline.pdf'), src('b', 'report.pdf')],
      pages: [...pages('a', [0, 0, 2]), ...pages('b', [0, 1])],
      blankBetween: true,
    }))
    const t = await texts(r.outputs[0].bytes)
    expect(t.length).toBe(6)
    expect(t[0]).toContain('outline.pdf page 1')
    expect(t[1]).toContain('outline.pdf page 1')
    expect(t[3]).toBe('')
    expect(t[4]).toContain('2026 Product Plan')
  })

  it('unifies page sizes to A4 keeping orientation', async () => {
    const r = await runMerge(mergeJob({
      sources: [src('a', 'outline.pdf')],
      pages: pages('a', [0, 1, 3]),
      pageSize: 'a4',
    }))
    const out = await PDFDocument.load(r.outputs[0].bytes)
    const sizes = out.getPages().map((p) => {
      const { width, height } = p.getSize()
      const rot = p.getRotation().angle
      return rot % 180 ? [Math.round(height), Math.round(width)] : [Math.round(width), Math.round(height)]
    })
    // Page 2 (/Rotate 90) is displayed landscape; page 4 is A4 landscape.
    expect(sizes).toEqual([[595, 842], [842, 595], [842, 595]])
    const t = await texts(r.outputs[0].bytes)
    expect(t[1]).toContain('outline.pdf page 2')
  })

  it('keeps form fields and prefixes clashing names from a second file', async () => {
    const r = await runMerge(mergeJob({
      sources: [src('f', 'form.pdf'), src('g', 'form.pdf')],
      pages: [...pages('f', [0]), ...pages('g', [0])],
    }))
    const out = await PDFDocument.load(r.outputs[0].bytes)
    const names = out.getForm().getFields().map((f) => f.getName()).sort()
    expect(names).toEqual(['f2_name', 'name'])
    expect(r.warnings).toContain('formRenamed')
  })

  it('flattens forms when forms are off', async () => {
    const r = await runMerge(mergeJob({ sources: [src('f', 'form.pdf')], pages: pages('f', [0]), keepForms: false }))
    const out = await PDFDocument.load(r.outputs[0].bytes)
    expect(out.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict)).toBeUndefined()
    expect(out.getPage(0).node.lookup(PDFName.of('Annots'))).toBeUndefined()
    const t = await texts(r.outputs[0].bytes)
    expect(t[0]).toContain('Ada')
  })

  it('splits into parts with the outline kept per part', async () => {
    const r = await runSplit({
      kind: 'split',
      sources: [src('a', 'outline.pdf')],
      parts: [
        { name: 'a_1-3.pdf', pages: pages('a', [0, 1, 2]) },
        { name: 'a_4-5.pdf', pages: pages('a', [3, 4]) },
      ],
      bookmarks: true,
      keepForms: true,
    })
    expect(r.outputs.map((o) => [o.name, o.pages])).toEqual([['a_1-3.pdf', 3], ['a_4-5.pdf', 2]])
    const p1 = await PDFDocument.load(r.outputs[0].bytes)
    const p2 = await PDFDocument.load(r.outputs[1].bytes)
    expect(flat(readOutline(p1))).toEqual(['Chapter 1@0', '  Section 1.1@1', '  Section 1.2@2'])
    expect(flat(readOutline(p2))).toEqual(['Chapter 2@0', 'Appendix@1'])
    expect(p1.getPage(1).getRotation().angle).toBe(90)
  })

  it('reports progress up to the total', async () => {
    const seen: [number, number][] = []
    await runMerge(mergeJob({ sources: [src('a', 'outline.pdf')], pages: pages('a', [0, 1]) }), (d, t) => seen.push([d, t]))
    expect(seen[seen.length - 1]).toEqual([3, 3])
  })
})
