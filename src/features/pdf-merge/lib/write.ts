// Merge / split writer on @cantoo/pdf-lib (runs in merge.worker.ts). Each
// source is loaded once (owner-password-only files are decrypted natively),
// pages are copied once per occurrence, rotation = the page's own /Rotate +
// the user's edit, and the output is never encrypted.
import { degrees, PageSizes, PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFObjectCopier, PDFRef, PDFString, type PDFPage } from '@cantoo/pdf-lib'
import { normRotation } from '../../../shared/components/page-grid'
import type { PageSizeMode } from '../types'
import { readOutline, remapOutline, writeOutline, type OutlineNode } from './outline'

export interface SourceBytes { id: string; name: string; bytes: ArrayBuffer }
export interface OutPageSpec { src: string; index: number; rotate: number }

export interface MergeJob {
  kind: 'merge'
  sources: SourceBytes[]
  pages: OutPageSpec[]
  name: string
  pageSize: PageSizeMode
  bookmarks: boolean
  keepForms: boolean
  blankBetween: boolean
  /** Top-level bookmark titles by source id (file names without .pdf). */
  titles: Record<string, string>
}

export interface SplitJob {
  kind: 'split'
  sources: SourceBytes[]
  parts: { name: string; pages: OutPageSpec[] }[]
  bookmarks: boolean
  keepForms: boolean
}

export type WriteJob = MergeJob | SplitJob

export interface WriteOutput { name: string; bytes: Uint8Array; pages: number }
/** Machine-readable notes the UI turns into messages. */
export type WriteWarning = 'formsFlattenedBySize' | 'xfaDropped' | 'formRenamed'
export interface WriteResult { outputs: WriteOutput[]; warnings: WriteWarning[] }
export type ProgressFn = (done: number, total: number) => void

export class NeedsPasswordError extends Error {
  constructor(public readonly source: string) {
    super('needs password')
    this.name = 'NeedsPasswordError'
  }
}

interface Loaded {
  doc: PDFDocument
  outline: OutlineNode[] | null
  hasForm: boolean
}

const A4: [number, number] = [PageSizes.A4[0], PageSizes.A4[1]]

async function loadSource(s: SourceBytes, keepForms: boolean, warnings: Set<WriteWarning>): Promise<Loaded> {
  let doc: PDFDocument
  try {
    // An empty password opens owner-password-only files (and is ignored
    // for unencrypted ones); a file with an open password throws.
    doc = await PDFDocument.load(s.bytes, { password: '', updateMetadata: false, throwOnInvalidObject: false })
  } catch (err) {
    const msg = String((err as Error)?.message || err)
    if (/password/i.test(msg)) throw new NeedsPasswordError(s.id)
    throw err
  }
  const acro = doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict)
  if (acro?.has(PDFName.of('XFA'))) warnings.add('xfaDropped')
  let hasForm = !!acro?.lookupMaybe(PDFName.of('Fields'), PDFArray)?.size()
  if (hasForm && !keepForms) {
    try { doc.getForm().flatten() } catch { /* keep the widgets rather than fail */ }
    hasForm = false
  }
  return { doc, outline: null, hasForm }
}

/** Effective (displayed) size of a page after its rotation. */
function cropSize(page: PDFPage): { w: number; h: number } {
  const b = page.getCropBox()
  return { w: b.width, h: b.height }
}
function displayed(page: PDFPage, rot: number): { w: number; h: number } {
  const { w, h } = cropSize(page)
  return rot % 180 === 0 ? { w, h } : { w: h, h: w }
}

/** Target size for a unified page, keeping the page's own orientation. */
function targetFor(mode: PageSizeMode, first: { w: number; h: number } | null, eff: { w: number; h: number }): { w: number; h: number } | null {
  if (mode === 'keep') return null
  const base = mode === 'a4' ? { w: A4[0], h: A4[1] } : first
  if (!base) return null
  const landscape = eff.w > eff.h
  const baseLandscape = base.w > base.h
  return landscape === baseLandscape ? base : { w: base.h, h: base.w }
}

function annotsOf(page: PDFPage): PDFArray | undefined {
  return page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)
}

/** Drop every annotation except links (forms off: values were flattened). */
function stripAnnots(page: PDFPage) {
  const annots = annotsOf(page)
  if (!annots) return
  const keep = PDFArray.withContext(page.doc.context)
  for (let i = 0; i < annots.size(); i++) {
    const a = annots.lookup(i)
    if (a instanceof PDFDict && a.lookup(PDFName.of('Subtype')) === PDFName.of('Link')) keep.push(annots.get(i))
  }
  if (keep.size()) page.node.set(PDFName.of('Annots'), keep)
  else page.node.delete(PDFName.of('Annots'))
}

/**
 * Page placer for one output document: copies pages from loaded sources,
 * applies rotation and optional size unification, and remembers which
 * output page came from which source page (for bookmarks and forms).
 */
class Placer {
  /** Output index → { source id, source index } for copied pages. */
  readonly origin: ({ src: string; index: number } | null)[] = []
  /** Output pages drawn scaled into a new size (bookmarks use /Fit there). */
  readonly scaled = new Set<number>()
  private first: { w: number; h: number } | null = null

  constructor(
    readonly out: PDFDocument,
    readonly sources: Map<string, Loaded>,
    readonly opts: { pageSize: PageSizeMode; keepForms: boolean },
    readonly warnings: Set<WriteWarning>,
  ) {}

  /**
   * Copy every page of `specs`, one copyPages call per source, so pages of
   * one file share its fonts and images even when they end up apart.
   */
  async copy(specs: OutPageSpec[]): Promise<PDFPage[]> {
    const bySrc = new Map<string, number[]>()
    specs.forEach((s, i) => {
      const list = bySrc.get(s.src) ?? []
      list.push(i)
      bySrc.set(s.src, list)
    })
    const copied: PDFPage[] = new Array(specs.length)
    for (const [src, positions] of bySrc) {
      const loaded = this.sources.get(src)
      if (!loaded) throw new Error(`missing source ${src}`)
      const pages = await this.out.copyPages(loaded.doc, positions.map((i) => specs[i].index))
      positions.forEach((pos, k) => { copied[pos] = pages[k] })
    }
    return copied
  }

  async add(page: PDFPage, spec: OutPageSpec): Promise<void> {
    const rot = normRotation(page.getRotation().angle + spec.rotate)
    const eff = displayed(page, rot)
    if (!this.first) this.first = eff
    const loaded = this.sources.get(spec.src)!
    if (!this.opts.keepForms) stripAnnots(page)
    const target = targetFor(this.opts.pageSize, this.first, eff)
    const fits = !target || (Math.abs(target.w - eff.w) < 1 && Math.abs(target.h - eff.h) < 1)
    if (fits) {
      page.setRotation(degrees(rot))
      this.out.addPage(page)
      if (loaded.hasForm) this.fixWidgetParents(page)
    } else {
      // Scale the page into the target size, centred, as a form XObject.
      // Annotations (forms, links) do not survive this; the UI says so.
      if (annotsOf(page)?.size()) this.warnings.add('formsFlattenedBySize')
      const box = page.getCropBox()
      const emb = await this.out.embedPage(page, { left: box.x, bottom: box.y, right: box.x + box.width, top: box.y + box.height })
      const s = Math.min(target.w / eff.w, target.h / eff.h)
      const ox = (target.w - eff.w * s) / 2
      const oy = (target.h - eff.h * s) / 2
      const w = box.width * s
      const h = box.height * s
      // drawPage rotates counter-clockwise around (x, y); /Rotate is clockwise.
      const anchor = rot === 0 ? { x: ox, y: oy }
        : rot === 90 ? { x: ox, y: oy + w }
          : rot === 180 ? { x: ox + w, y: oy + h }
            : { x: ox + h, y: oy }
      const np = this.out.addPage([target.w, target.h])
      np.drawPage(emb, { x: anchor.x, y: anchor.y, xScale: s, yScale: s, rotate: degrees(-rot) })
      this.scaled.add(this.out.getPageCount() - 1)
    }
    this.origin.push({ src: spec.src, index: spec.index })
  }

  /** Widgets copied with a page point /P at the copied page. */
  private fixWidgetParents(page: PDFPage) {
    const annots = annotsOf(page)
    if (!annots) return
    for (let i = 0; i < annots.size(); i++) {
      const a = annots.lookup(i)
      if (a instanceof PDFDict && a.has(PDFName.of('P'))) a.set(PDFName.of('P'), page.ref)
    }
  }

  addBlank(): void {
    const last = this.out.getPageCount() ? this.out.getPage(this.out.getPageCount() - 1) : null
    const size = last ? displayed(last, normRotation(last.getRotation().angle)) : { w: A4[0], h: A4[1] }
    this.out.addPage([size.w, size.h])
    this.origin.push(null)
  }

  /** Output index of the first copy of a source page, if any. */
  firstOutput(src: string): (index: number) => number | undefined {
    const map = new Map<number, number>()
    this.origin.forEach((o, i) => { if (o && o.src === src && !map.has(o.index)) map.set(o.index, i) })
    return (index) => map.get(index)
  }

  /**
   * Rebuild /AcroForm from the widgets on the output pages: one entry per
   * top-level field; a field name already used by an earlier source gets a
   * "f2_" style prefix so fields from different files do not mirror each other.
   */
  buildAcroForm(order: string[]): void {
    if (!this.opts.keepForms) return
    const out = this.out
    const fields: PDFRef[] = []
    const seenRefs = new Set<string>()
    const usedNames = new Map<string, string>() // name → source id that owns it
    let template: { src: Loaded } | null = null
    const pages = out.getPages()
    for (let i = 0; i < pages.length; i++) {
      const o = this.origin[i]
      if (!o || this.scaled.has(i)) continue
      const loaded = this.sources.get(o.src)
      if (!loaded?.hasForm) continue
      template ??= { src: loaded }
      const annots = annotsOf(pages[i])
      if (!annots) continue
      for (let k = 0; k < annots.size(); k++) {
        const first = annots.get(k)
        const firstDict = annots.lookup(k)
        if (!(first instanceof PDFRef) || !(firstDict instanceof PDFDict)) continue
        if (firstDict.lookup(PDFName.of('Subtype')) !== PDFName.of('Widget')) continue
        let ref: PDFRef = first
        let dict: PDFDict = firstDict
        // Walk up to the top-level field.
        for (let guard = 0; guard < 32; guard++) {
          const parent = dict.get(PDFName.of('Parent'))
          if (!(parent instanceof PDFRef)) break
          const pd = out.context.lookup(parent)
          if (!(pd instanceof PDFDict)) break
          ref = parent
          dict = pd
        }
        const key = ref.toString()
        if (seenRefs.has(key)) continue
        seenRefs.add(key)
        const t = dict.lookup(PDFName.of('T'))
        const name = t instanceof PDFString || t instanceof PDFHexString ? t.decodeText() : ''
        if (name) {
          const owner = usedNames.get(name)
          if (owner && owner !== o.src) {
            const n = order.indexOf(o.src) + 1
            dict.set(PDFName.of('T'), PDFHexString.fromText(`f${n}_${name}`))
            this.warnings.add('formRenamed')
          } else {
            usedNames.set(name, o.src)
          }
        }
        fields.push(ref)
      }
    }
    if (!fields.length || !template) return
    const acro = out.context.obj({}) as PDFDict
    acro.set(PDFName.of('Fields'), out.context.obj(fields))
    const srcAcro = template.src.doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict)
    if (srcAcro) {
      const copier = PDFObjectCopier.for(template.src.doc.context, out.context)
      for (const k of ['DA', 'DR', 'Q']) {
        const v = srcAcro.get(PDFName.of(k))
        if (v) acro.set(PDFName.of(k), copier.copy(v))
      }
    }
    acro.set(PDFName.of('NeedAppearances'), out.context.obj(true))
    out.catalog.set(PDFName.of('AcroForm'), out.context.register(acro))
  }
}

async function loadAll(sources: SourceBytes[], keepForms: boolean, needed: Set<string>, warnings: Set<WriteWarning>): Promise<Map<string, Loaded>> {
  const map = new Map<string, Loaded>()
  for (const s of sources) {
    if (!needed.has(s.id)) continue
    map.set(s.id, await loadSource(s, keepForms, warnings))
  }
  return map
}

function outlineOf(l: Loaded): OutlineNode[] {
  if (!l.outline) l.outline = readOutline(l.doc)
  return l.outline
}

async function save(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save({ useObjectStreams: true, updateFieldAppearances: false })
}

export async function runMerge(job: MergeJob, progress: ProgressFn = () => {}): Promise<WriteResult> {
  const warnings = new Set<WriteWarning>()
  const needed = new Set(job.pages.map((p) => p.src))
  const sources = await loadAll(job.sources, job.keepForms, needed, warnings)
  const out = await PDFDocument.create()
  const placer = new Placer(out, sources, { pageSize: job.pageSize, keepForms: job.keepForms }, warnings)
  const total = job.pages.length + 1
  let done = 0
  const tick = () => progress(++done, total)

  // Runs of consecutive pages from one source; blank padding goes between runs.
  const runs: OutPageSpec[][] = []
  for (const p of job.pages) {
    const last = runs[runs.length - 1]
    if (last && last[0].src === p.src) last.push(p)
    else runs.push([p])
  }
  const copied = await placer.copy(job.pages)
  let at = 0
  for (let r = 0; r < runs.length; r++) {
    for (const spec of runs[r]) {
      await placer.add(copied[at++], spec)
      tick()
    }
    if (job.blankBetween && r < runs.length - 1 && runs[r].length % 2 === 1) placer.addBlank()
  }

  const order = runs.map((r) => r[0].src).filter((s, i, a) => a.indexOf(s) === i)
  placer.buildAcroForm(order)
  if (job.bookmarks) {
    const nodes: OutlineNode<number>[] = []
    for (const src of order) {
      const at = placer.firstOutput(src)
      const firstOut = placer.origin.findIndex((o) => o?.src === src)
      if (firstOut < 0) continue
      nodes.push({
        title: job.titles[src] || src,
        page: firstOut,
        view: undefined,
        children: remapOutline(outlineOf(sources.get(src)!), at),
      })
    }
    writeOutline(out, nodes, { fitOnly: (i) => placer.scaled.has(i) })
  }
  const bytes = await save(out)
  tick()
  return { outputs: [{ name: job.name, bytes, pages: out.getPageCount() }], warnings: [...warnings] }
}

export async function runSplit(job: SplitJob, progress: ProgressFn = () => {}): Promise<WriteResult> {
  const warnings = new Set<WriteWarning>()
  const needed = new Set(job.parts.flatMap((p) => p.pages.map((x) => x.src)))
  const sources = await loadAll(job.sources, job.keepForms, needed, warnings)
  const total = job.parts.reduce((s, p) => s + p.pages.length + 1, 0)
  let done = 0
  const tick = () => progress(++done, total)
  const outputs: WriteOutput[] = []
  for (const part of job.parts) {
    const out = await PDFDocument.create()
    const placer = new Placer(out, sources, { pageSize: 'keep', keepForms: job.keepForms }, warnings)
    const copied = await placer.copy(part.pages)
    for (let i = 0; i < copied.length; i++) {
      await placer.add(copied[i], part.pages[i])
      tick()
    }
    const order = part.pages.map((p) => p.src).filter((s, i, a) => a.indexOf(s) === i)
    placer.buildAcroForm(order)
    if (job.bookmarks) {
      const nodes = order.flatMap((src) => remapOutline(outlineOf(sources.get(src)!), placer.firstOutput(src)))
      writeOutline(out, nodes)
    }
    outputs.push({ name: part.name, bytes: await save(out), pages: out.getPageCount() })
    tick()
  }
  return { outputs, warnings: [...warnings] }
}

export function runJob(job: WriteJob, progress?: ProgressFn): Promise<WriteResult> {
  return job.kind === 'merge' ? runMerge(job, progress) : runSplit(job, progress)
}
