// Page models → .docx. Two outputs:
//  - editable: the layout analysis reflows the text into real Word
//    structure (heading styles, list numbering, tables, inline pictures),
//    one continuous section, no page-by-page positioning.
//  - layout: one section per PDF page at the page's own size, every text
//    line in an absolutely positioned frame and every picture floating at
//    its spot. The text stays editable; the look follows the PDF.
// Runs in the docx worker (no DOM needed) and in unit tests under Node.

import {
  AlignmentType,
  Document,
  FrameAnchorType,
  HeadingLevel,
  HeightRule,
  HorizontalPositionRelativeFrom,
  ImageRun,
  LevelFormat,
  LineRuleType,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  TextWrappingType,
  VerticalPositionRelativeFrom,
  WidthType,
  type ILevelsOptions,
  type ISectionOptions,
} from 'docx'
import type { ConvertMode, ConvertStats, PageImage, PageModel } from '../types'
import { BodySizeTally, buildLines, finishPage, joinPageBreaks, preparePage, readingOrder, type Align, type Block, type ListMarker, type PreparedPage, type Span } from './layout'

const TWIP = 20 // twips per point
const EMU = 12700 // EMUs per point
const PX = 96 / 72 // docx image sizes are pixels at 96 dpi

export interface BuildOptions {
  mode: ConvertMode
  keepImages: boolean
  title?: string
}

export interface BuildResult {
  blob: Blob
  stats: ConvertStats
}

function emptyStats(): ConvertStats {
  return {
    pages: 0,
    headings: 0,
    images: 0,
    tables: 0,
    lists: 0,
    twoColumnPages: 0,
    ocrPages: 0,
    imagePages: 0,
  }
}

/** Half-points for a font size, clamped to Word's range. */
function halfPoints(size: number): number {
  return Math.max(2, Math.min(3276, Math.round(size * 2)))
}

function runs(spans: Span[], body: number | null): TextRun[] {
  return spans.map((s) => new TextRun({
    text: s.text,
    bold: s.bold || undefined,
    italics: s.italic || undefined,
    // Reflowed text keeps the document's body size; only clearly
    // different runs (footnotes, emphasis in a larger size) carry their own.
    size: body === null || Math.abs(s.size - body) > 1.2 ? halfPoints(s.size) : undefined,
  }))
}

function alignment(a: Align) {
  return a === 'center' ? AlignmentType.CENTER : a === 'right' ? AlignmentType.RIGHT : undefined
}

function imageRun(img: PageImage, maxWidthPt: number) {
  let w = img.w
  let h = img.h
  if (w > maxWidthPt) {
    h = h * (maxWidthPt / w)
    w = maxWidthPt
  }
  return new ImageRun({ type: img.type, data: img.data, transformation: { width: Math.max(1, Math.round(w * PX)), height: Math.max(1, Math.round(h * PX)) } })
}

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3] as const

function levelFormat(f: ListMarker['format']) {
  switch (f) {
    case 'bullet': return LevelFormat.BULLET
    case 'lowerLetter': return LevelFormat.LOWER_LETTER
    case 'upperLetter': return LevelFormat.UPPER_LETTER
    case 'chineseCounting': return LevelFormat.CHINESE_COUNTING
    default: return LevelFormat.DECIMAL
  }
}

/** Numbering definitions, one per distinct marker style + start number. */
class Numbering {
  private refs = new Map<string, { marker: ListMarker }>()
  instance = 0

  ref(m: ListMarker): string {
    const key = m.ordered ? `n-${m.format}-${m.pattern}-${m.start}` : 'bullet'
    if (!this.refs.has(key)) this.refs.set(key, { marker: m })
    return key
  }

  config() {
    return [...this.refs.entries()].map(([reference, { marker }]) => ({
      reference,
      levels: [0, 1, 2].map((level): ILevelsOptions => ({
        level,
        format: levelFormat(marker.format),
        text: marker.ordered ? marker.pattern.replace('%1', `%${level + 1}`) : ['•', '◦', '▪'][level],
        start: marker.ordered && level === 0 ? marker.start : 1,
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 420 * (level + 1), hanging: 420 } } },
      })),
    }))
  }
}

/** What the editable build keeps of a page once its first analysis pass ran. */
interface EditablePage {
  prep: PreparedPage
  background?: PageImage
}

function buildEditable(pages: EditablePage[], size: { width: number; height: number } | null, bodySize: number, opts: BuildOptions, stats: ConvertStats) {
  const layouts = joinPageBreaks(pages.map((p) => finishPage(p.prep, bodySize)))
  const pageW = size?.width ?? 595
  const pageH = size?.height ?? 842
  const margin = Math.min(72, pageW * 0.12)
  const contentW = pageW - margin * 2
  const numbering = new Numbering()
  const children: (Paragraph | Table)[] = []
  const headingSizes: number[][] = [[], [], []]
  let prevListRef: string | null = null

  const pushBlock = (b: Block) => {
    if (b.kind !== 'list') prevListRef = null
    switch (b.kind) {
      case 'heading':
        stats.headings++
        headingSizes[b.level - 1].push(b.size)
        children.push(new Paragraph({ heading: HEADINGS[b.level - 1], alignment: alignment(b.align), children: runs(b.spans.map((s) => ({ ...s, size: b.size })), b.size) }))
        break
      case 'para':
        children.push(new Paragraph({ alignment: alignment(b.align), indent: b.indent ? { firstLine: Math.round(bodySize * 2 * TWIP) } : undefined, children: runs(b.spans, bodySize) }))
        break
      case 'list': {
        stats.lists++
        const reference = numbering.ref(b.marker)
        if (reference !== prevListRef) numbering.instance++
        prevListRef = reference
        children.push(new Paragraph({ numbering: { reference, level: b.level, instance: numbering.instance }, children: runs(b.spans, bodySize) }))
        break
      }
      case 'table':
        stats.tables++
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: b.rows.map((row) => new TableRow({
            children: row.map((cell) => new TableCell({ children: [new Paragraph({ children: runs(cell, bodySize) })] })),
          })),
        }))
        // Word needs a paragraph between two adjacent tables.
        children.push(new Paragraph({ children: [] }))
        break
      case 'image':
        stats.images++
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [imageRun(b.image, contentW)] }))
        break
    }
  }

  layouts.forEach((pl, i) => {
    if (pl.twoColumn) stats.twoColumnPages++
    const bg = pages[i].background
    if (bg && !pl.blocks.length) {
      stats.images++
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [imageRun(bg, contentW)] }))
    }
    pl.blocks.forEach(pushBlock)
  })
  if (!children.length) children.push(new Paragraph({ children: [] }))

  const avg = (xs: number[], fb: number) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : fb)
  const body = Math.max(8, Math.min(16, bodySize))
  const hSize = (lvl: number) => halfPoints(Math.max(body + 1, avg(headingSizes[lvl], body * [1.8, 1.45, 1.2][lvl])))
  return new Document({
    title: opts.title,
    creator: 'image-compressor PDF to Word',
    styles: {
      default: {
        document: { run: { size: halfPoints(body) }, paragraph: { spacing: { after: Math.round(body * 0.5 * TWIP), line: 276 } } },
        heading1: { run: { size: hSize(0), bold: true, color: '000000' }, paragraph: { spacing: { before: 240, after: 120 } } },
        heading2: { run: { size: hSize(1), bold: true, color: '000000' }, paragraph: { spacing: { before: 200, after: 100 } } },
        heading3: { run: { size: hSize(2), bold: true, color: '000000' }, paragraph: { spacing: { before: 160, after: 80 } } },
      },
    },
    numbering: { config: numbering.config() },
    sections: [{
      properties: {
        page: {
          size: { width: Math.round(pageW * TWIP), height: Math.round(pageH * TWIP) },
          margin: { top: Math.round(margin * TWIP), bottom: Math.round(margin * TWIP), left: Math.round(margin * TWIP), right: Math.round(margin * TWIP) },
        },
      },
      children,
    }],
  })
}

function floatingImage(img: PageImage, behind = false) {
  return new ImageRun({
    type: img.type,
    data: img.data,
    transformation: { width: Math.max(1, Math.round(img.w * PX)), height: Math.max(1, Math.round(img.h * PX)) },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: Math.round(img.x * EMU) },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: Math.round(img.y * EMU) },
      allowOverlap: true,
      behindDocument: behind,
      wrap: { type: TextWrappingType.NONE },
    },
  })
}

/** One keep-layout section: the page at its own size, text in frames, pictures floating. */
function layoutSection(p: PageModel, opts: BuildOptions, stats: ConvertStats): ISectionOptions {
  const children: Paragraph[] = []
  const pics: ImageRun[] = []
  if (p.background) {
    stats.images++
    pics.push(floatingImage(p.background, true))
  }
  if (opts.keepImages) {
    for (const img of p.images) {
      stats.images++
      pics.push(floatingImage(img))
    }
  }
  // The pictures anchor to one empty paragraph at the top of the page.
  children.push(new Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT }, children: pics }))
  // Frames in reading order: copy/paste and screen readers follow the
  // columns, while each frame still sits at its PDF position.
  for (const l of readingOrder(buildLines(p.items), p.width)) {
    const width = (l.x1 - l.x0) * 1.12 + l.size * 1.5
    children.push(new Paragraph({
      frame: {
        type: 'absolute',
        position: { x: Math.round(l.x0 * TWIP), y: Math.round(l.top * TWIP) },
        width: Math.round(Math.min(width, p.width - l.x0) * TWIP),
        height: Math.round((l.bottom - l.top) * TWIP),
        anchor: { horizontal: FrameAnchorType.PAGE, vertical: FrameAnchorType.PAGE },
        rule: HeightRule.ATLEAST,
      },
      spacing: { before: 0, after: 0, line: Math.round(l.size * 1.15 * TWIP), lineRule: LineRuleType.AT_LEAST },
      children: runs(l.spans, null),
    }))
  }
  return {
    properties: {
      page: {
        size: { width: Math.round(p.width * TWIP), height: Math.round(p.height * TWIP) },
        margin: { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0, gutter: 0 },
      },
    },
    children,
  }
}

function buildLayout(sections: ISectionOptions[], opts: BuildOptions) {
  return new Document({
    title: opts.title,
    creator: 'image-compressor PDF to Word',
    sections: sections.length ? sections : [{ children: [new Paragraph({ children: [] })] }],
  })
}

/**
 * Incremental Word build, fed one page at a time as the PDF is read (the
 * docx worker keeps one per conversion). Each page gets its size-independent
 * work done on arrival: keep-layout pages become their finished section,
 * editable pages their lines, columns and reading-order flows, plus their
 * share of the body-size tally. The raw text items are not kept, and
 * `finish()` only has the document-wide pass left (paragraphs and headings
 * need the final body size) before packing.
 */
export class DocxSession {
  private stats = emptyStats()
  private tally = new BodySizeTally()
  private editable: EditablePage[] = []
  private sections: ISectionOptions[] = []
  private size: { width: number; height: number } | null = null

  constructor(private readonly opts: BuildOptions) {}

  addPage(p: PageModel): void {
    this.stats.pages++
    if (p.ocr) this.stats.ocrPages++
    if (p.background) this.stats.imagePages++
    if (this.opts.mode === 'layout') {
      this.sections.push(layoutSection(p, this.opts, this.stats))
      return
    }
    if (!this.size) this.size = { width: p.width, height: p.height }
    this.tally.add(p.items)
    this.editable.push({
      prep: preparePage({ ...p, images: this.opts.keepImages ? p.images : [] }, { stripPageNumbers: true }),
      background: p.background,
    })
  }

  async finish(): Promise<BuildResult> {
    const doc = this.opts.mode === 'layout'
      ? buildLayout(this.sections, this.opts)
      : buildEditable(this.editable, this.size, this.tally.size, this.opts, this.stats)
    const blob = await Packer.toBlob(doc)
    this.editable = []
    this.sections = []
    return { blob, stats: this.stats }
  }
}

/** Build the Word document for the page models in one go. */
export async function buildDocx(pages: PageModel[], opts: BuildOptions): Promise<BuildResult> {
  const session = new DocxSession(opts)
  for (const p of pages) session.addPage(p)
  return session.finish()
}
