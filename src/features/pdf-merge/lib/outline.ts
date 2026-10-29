// Bookmarks (document outline). pdf-lib has no outline API, so this reads a
// source's /Outlines tree into plain nodes, remaps them onto output pages
// (pure, unit tested), and writes a new tree: one top-level item per source
// file with that file's original outline nested under it.
import {
  PDFArray, PDFDict, PDFHexString, PDFName, PDFNull, PDFNumber, PDFRef, PDFString,
  type PDFContext, type PDFDocument, type PDFObject,
} from '@cantoo/pdf-lib'

/** A destination's view after the page: ['XYZ', left, top, zoom], ['Fit'], … */
export type DestView = [string, ...(number | null)[]]

export interface OutlineNode<P = number | null> {
  title: string
  /** Page index (source index when read, output index once remapped). */
  page: P
  view?: DestView
  children: OutlineNode<P>[]
}

const MAX_ITEMS = 5000
const MAX_DEPTH = 32

// ---- reading ----

function decodeText(o: PDFObject | undefined): string {
  if (o instanceof PDFString || o instanceof PDFHexString) return o.decodeText()
  return ''
}

/** Look up a key in a name tree (/Names, /Kids). */
function nameTreeLookup(node: PDFDict | undefined, key: string, depth = 0): PDFObject | undefined {
  if (!node || depth > MAX_DEPTH) return undefined
  const names = node.lookupMaybe(PDFName.of('Names'), PDFArray)
  if (names) {
    for (let i = 0; i + 1 < names.size(); i += 2) {
      if (decodeText(names.lookup(i)) === key) return names.lookup(i + 1)
    }
  }
  const kids = node.lookupMaybe(PDFName.of('Kids'), PDFArray)
  if (kids) {
    for (let i = 0; i < kids.size(); i++) {
      const kid = kids.lookup(i)
      if (!(kid instanceof PDFDict)) continue
      const limits = kid.lookupMaybe(PDFName.of('Limits'), PDFArray)
      if (limits && limits.size() === 2) {
        const lo = decodeText(limits.lookup(0))
        const hi = decodeText(limits.lookup(1))
        if (key < lo || key > hi) continue
      }
      const hit = nameTreeLookup(kid, key, depth + 1)
      if (hit) return hit
    }
  }
  return undefined
}

function resolveDest(doc: PDFDocument, dest: PDFObject | undefined): PDFArray | undefined {
  if (dest instanceof PDFRef) dest = doc.context.lookup(dest)
  if (dest instanceof PDFArray) return dest
  let name: string | null = null
  if (dest instanceof PDFName) name = dest.decodeText()
  else if (dest instanceof PDFString || dest instanceof PDFHexString) name = dest.decodeText()
  if (name === null) return undefined
  const cat = doc.catalog
  let hit: PDFObject | undefined
  const dests = cat.lookupMaybe(PDFName.of('Dests'), PDFDict)
  if (dests) hit = dests.lookup(PDFName.of(name))
  if (!hit) {
    const names = cat.lookupMaybe(PDFName.of('Names'), PDFDict)
    hit = nameTreeLookup(names?.lookupMaybe(PDFName.of('Dests'), PDFDict), name)
  }
  if (hit instanceof PDFRef) hit = doc.context.lookup(hit)
  if (hit instanceof PDFDict) hit = hit.lookup(PDFName.of('D'))
  if (hit instanceof PDFRef) hit = doc.context.lookup(hit)
  return hit instanceof PDFArray ? hit : undefined
}

function destOf(doc: PDFDocument, item: PDFDict, pageIndex: Map<string, number>): { page: number | null; view?: DestView } {
  let dest: PDFObject | undefined = item.lookup(PDFName.of('Dest'))
  if (!dest) {
    const action = item.lookupMaybe(PDFName.of('A'), PDFDict)
    if (action && action.lookup(PDFName.of('S')) === PDFName.of('GoTo')) dest = action.lookup(PDFName.of('D'))
  }
  const arr = resolveDest(doc, dest)
  if (!arr || arr.size() < 1) return { page: null }
  const target = arr.get(0)
  let page: number | null = null
  if (target instanceof PDFRef) page = pageIndex.get(target.toString()) ?? null
  const kind = arr.lookup(1)
  if (!(kind instanceof PDFName)) return { page }
  const view: DestView = [kind.decodeText()]
  for (let i = 2; i < arr.size(); i++) {
    const v = arr.lookup(i)
    view.push(v instanceof PDFNumber ? v.asNumber() : null)
  }
  return { page, view }
}

/** The document's outline as plain nodes (page = 0-based source index, or null). */
export function readOutline(doc: PDFDocument): OutlineNode[] {
  const root = doc.catalog.lookupMaybe(PDFName.of('Outlines'), PDFDict)
  if (!root) return []
  const pageIndex = new Map<string, number>()
  doc.getPages().forEach((p, i) => pageIndex.set(p.ref.toString(), i))
  const seen = new Set<PDFDict>()
  let count = 0
  const walk = (first: PDFDict | undefined, depth: number): OutlineNode[] => {
    const out: OutlineNode[] = []
    let item = first
    while (item && !seen.has(item) && count < MAX_ITEMS) {
      seen.add(item)
      count++
      const { page, view } = destOf(doc, item, pageIndex)
      const children = depth < MAX_DEPTH ? walk(item.lookupMaybe(PDFName.of('First'), PDFDict), depth + 1) : []
      out.push({ title: decodeText(item.lookup(PDFName.of('Title'))), page, view, children })
      item = item.lookupMaybe(PDFName.of('Next'), PDFDict)
    }
    return out
  }
  try {
    return walk(root.lookupMaybe(PDFName.of('First'), PDFDict), 0)
  } catch {
    return [] // a broken outline must never break the merge
  }
}

// ---- remapping (pure) ----

/**
 * Map source page indices to output indices. A node whose page is gone
 * (deleted, or not in this part) is kept when a descendant survives, and
 * then points at that descendant's page; otherwise it is dropped.
 */
export function remapOutline(nodes: readonly OutlineNode[], map: (srcIndex: number) => number | undefined): OutlineNode<number>[] {
  const out: OutlineNode<number>[] = []
  for (const n of nodes) {
    const children = remapOutline(n.children, map)
    const mapped = n.page === null ? undefined : map(n.page)
    if (mapped !== undefined) out.push({ title: n.title, page: mapped, view: n.view, children })
    else if (children.length) out.push({ title: n.title, page: children[0].page, children })
  }
  return out
}

/** Count of nodes in a tree. */
export function outlineSize(nodes: readonly OutlineNode<unknown>[]): number {
  return nodes.reduce((s, n) => s + 1 + outlineSize(n.children), 0)
}

// ---- writing ----

export interface WriteOutlineOptions {
  /** Output pages whose coordinates changed (scaled to a new size): link them with /Fit. */
  fitOnly?: (page: number) => boolean
}

function destArray(ctx: PDFContext, pageRef: PDFRef, view: DestView | undefined, fit: boolean): PDFArray {
  const arr = PDFArray.withContext(ctx)
  arr.push(pageRef)
  if (!view || fit) {
    arr.push(PDFName.of(fit ? 'Fit' : 'XYZ'))
    if (!fit) { arr.push(PDFNull); arr.push(PDFNull); arr.push(PDFNull) }
    return arr
  }
  arr.push(PDFName.of(view[0]))
  for (let i = 1; i < view.length; i++) {
    const v = view[i]
    arr.push(typeof v === 'number' ? PDFNumber.of(v) : PDFNull)
  }
  return arr
}

/** Replace the document's outline with `nodes` (page = output page index). */
export function writeOutline(doc: PDFDocument, nodes: readonly OutlineNode<number>[], opts: WriteOutlineOptions = {}): void {
  if (!nodes.length) return
  const ctx = doc.context
  const pageRefs = doc.getPages().map((p) => p.ref)
  const rootRef = ctx.nextRef()

  // Returns [first, last, visible count] for a list of siblings.
  const build = (parent: PDFRef, list: readonly OutlineNode<number>[], open: boolean): [PDFRef, PDFRef, number] => {
    const refs = list.map(() => ctx.nextRef())
    let visible = 0
    list.forEach((n, i) => {
      const ref = pageRefs[Math.max(0, Math.min(pageRefs.length - 1, n.page))]
      const dict = ctx.obj({}) as PDFDict
      dict.set(PDFName.of('Title'), PDFHexString.fromText(n.title || ' '))
      dict.set(PDFName.of('Parent'), parent)
      dict.set(PDFName.of('Dest'), destArray(ctx, ref, n.view, !!opts.fitOnly?.(n.page)))
      if (i > 0) dict.set(PDFName.of('Prev'), refs[i - 1])
      if (i < list.length - 1) dict.set(PDFName.of('Next'), refs[i + 1])
      if (n.children.length) {
        // Top level (one per file) open, original nested items closed.
        const [f, l, c] = build(refs[i], n.children, false)
        dict.set(PDFName.of('First'), f)
        dict.set(PDFName.of('Last'), l)
        dict.set(PDFName.of('Count'), PDFNumber.of(open ? c : -c))
        if (open) visible += c
      }
      ctx.assign(refs[i], dict)
      visible++
    })
    return [refs[0], refs[refs.length - 1], visible]
  }

  const [first, last, count] = build(rootRef, nodes, true)
  const root = ctx.obj({}) as PDFDict
  root.set(PDFName.of('Type'), PDFName.of('Outlines'))
  root.set(PDFName.of('First'), first)
  root.set(PDFName.of('Last'), last)
  root.set(PDFName.of('Count'), PDFNumber.of(count))
  ctx.assign(rootRef, root)
  doc.catalog.set(PDFName.of('Outlines'), rootRef)
  doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))
}
