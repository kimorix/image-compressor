// Page layout analysis: positioned text runs in, reading-ordered blocks out
// (headings, paragraphs, list items, simple tables, images). Pure and
// DOM-free so it runs in the docx worker and in unit tests.
//
// Pipeline per page:
//   items → rows (same baseline band) → segments (split at wide gaps)
//         → columns (a vertical gutter shared by most lines)
//         → flows in reading order → tables (rows of aligned segments)
//         → paragraphs (gap / indent / size / short-line rules)
//         → headings and list items (size ratio, bold, markers)

import type { PageImage, PageModel, TextItem } from '../types'

export interface Span {
  text: string
  bold: boolean
  italic: boolean
  size: number
}

export interface Line {
  x0: number
  x1: number
  top: number
  bottom: number
  size: number
  spans: Span[]
  text: string
  /** Index of the row this segment came from (same baseline band). */
  row: number
}

export type Align = 'left' | 'center' | 'right'

export interface ListMarker {
  ordered: boolean
  /** Word level format: decimal, lowerLetter, upperLetter, chineseCounting, bullet. */
  format: 'bullet' | 'decimal' | 'lowerLetter' | 'upperLetter' | 'chineseCounting'
  /** Level text pattern with %1 for the number ("%1." "(%1)" "%1、"). */
  pattern: string
  start: number
  /** Length of the marker (with its trailing spaces) in the line text. */
  length: number
  /** The marker as written, trailing spaces included. */
  raw: string
}

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; spans: Span[]; align: Align; size: number }
  | { kind: 'para'; spans: Span[]; align: Align; size: number; indent: boolean }
  | { kind: 'list'; marker: ListMarker; level: number; spans: Span[]; size: number }
  | { kind: 'table'; rows: Span[][][] }
  | { kind: 'image'; image: PageImage }

export interface PageLayout {
  num: number
  blocks: Block[]
  twoColumn: boolean
}

const CJK = /[\u2E80-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/
const TERMINAL = /[.!?。！？:：;；…"”’)）\]】]$/

export function isCjk(ch: string | undefined): boolean {
  return !!ch && CJK.test(ch)
}

/** Text joiner: no space between CJK characters, one space otherwise. */
export function joinWords(a: string, b: string): string {
  if (!a) return b
  if (!b) return a
  const last = a[a.length - 1]
  const first = b[0]
  if (/\s/.test(last) || /\s/.test(first)) return a + b
  if (isCjk(last) || isCjk(first)) return a + b
  return `${a} ${b}`
}

/**
 * Join two wrapped lines of one paragraph: drop a soft hyphen at a Latin
 * line break ("exam-" + "ple" → "example"), no space around CJK.
 */
export function joinLines(a: string, b: string): string {
  if (/[A-Za-z]-$/.test(a) && /^[a-z]/.test(b)) return a.slice(0, -1) + b
  return joinWords(a.replace(/\s+$/, ''), b.replace(/^\s+/, ''))
}

function median(values: number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Body text size: the size carrying the most characters (0.5pt buckets). */
export function bodySizeOf(items: TextItem[]): number {
  const weight = new Map<number, number>()
  for (const it of items) {
    const k = Math.round(it.size * 2) / 2
    weight.set(k, (weight.get(k) ?? 0) + it.str.trim().length)
  }
  let best = 0
  let bestW = -1
  for (const [k, w] of weight) {
    if (w > bestW || (w === bestW && k < best)) { best = k; bestW = w }
  }
  return best || 11
}

function pushSpan(spans: Span[], text: string, it: { bold: boolean; italic: boolean; size: number }) {
  const last = spans[spans.length - 1]
  if (last && last.bold === it.bold && last.italic === it.italic && Math.abs(last.size - it.size) < 0.6) {
    last.text += text
  } else {
    spans.push({ text, bold: it.bold, italic: it.italic, size: it.size })
  }
}

function makeLine(items: TextItem[], row: number): Line {
  const spans: Span[] = []
  let text = ''
  let prev: TextItem | null = null
  for (const it of items) {
    const piece = it.str
    if (prev) {
      const gap = it.x - (prev.x + prev.w)
      const needSpace = gap > Math.min(prev.size, it.size) * 0.18
        && !/\s$/.test(text) && !/^\s/.test(piece)
        && !(isCjk(text[text.length - 1]) && isCjk(piece[0]))
      // The space joins the previous run, so a bold word does not start
      // with a bold space.
      if (needSpace) {
        text += ' '
        spans[spans.length - 1].text += ' '
      }
    }
    text += piece
    pushSpan(spans, piece, it)
    prev = it
  }
  // Trim the outer whitespace on the spans too.
  if (spans.length) {
    spans[0].text = spans[0].text.replace(/^\s+/, '')
    spans[spans.length - 1].text = spans[spans.length - 1].text.replace(/\s+$/, '')
  }
  const sizes = items.map((i) => i.size)
  return {
    x0: Math.min(...items.map((i) => i.x)),
    x1: Math.max(...items.map((i) => i.x + i.w)),
    top: Math.min(...items.map((i) => i.y)),
    bottom: Math.max(...items.map((i) => i.y + i.h)),
    size: median(sizes),
    spans: spans.filter((s) => s.text.length > 0),
    text: text.trim(),
    row,
  }
}

/**
 * Group items into rows (vertical centres within half a line) and split
 * each row into segments at gaps wider than ~2 ems (table cells, column
 * gutters, label/value pairs).
 */
export function buildLines(items: TextItem[]): Line[] {
  const usable = items.filter((i) => i.str.trim().length > 0 && i.w >= 0 && i.size > 0)
  if (!usable.length) return []
  const sorted = [...usable].sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2) || a.x - b.x)
  const rows: TextItem[][] = []
  let cur: TextItem[] = []
  let curTop = 0
  let curBottom = 0
  for (const it of sorted) {
    const cy = it.y + it.h / 2
    const curH = curBottom - curTop
    if (cur.length && cy >= curTop - 0.1 * curH && cy <= curBottom + 0.1 * curH && Math.abs(cy - (curTop + curBottom) / 2) <= 0.45 * Math.max(Math.min(it.h, curH), 1)) {
      cur.push(it)
      curTop = Math.min(curTop, it.y)
      curBottom = Math.max(curBottom, it.y + it.h)
    } else {
      if (cur.length) rows.push(cur)
      cur = [it]
      curTop = it.y
      curBottom = it.y + it.h
    }
  }
  if (cur.length) rows.push(cur)

  const lines: Line[] = []
  rows.forEach((row, ri) => {
    row.sort((a, b) => a.x - b.x)
    let seg: TextItem[] = []
    for (const it of row) {
      const prev = seg[seg.length - 1]
      if (prev) {
        const gap = it.x - (prev.x + prev.w)
        const size = Math.max(prev.size, it.size)
        if (gap > Math.max(1.8 * size, 12)) {
          lines.push(makeLine(seg, ri))
          seg = []
        }
      }
      seg.push(it)
    }
    if (seg.length) lines.push(makeLine(seg, ri))
  })
  return lines.filter((l) => l.text.length > 0)
}

const PAGE_NUMBER = /^(?:[-–—]?\s*\d{1,4}\s*[-–—]?|(?:page|seite|página)\s*\d+(?:\s*(?:of|von|\/)\s*\d+)?|第\s*\d+\s*页(?:\s*[\/，,]?\s*共\s*\d+\s*页)?|\d+\s*\/\s*\d+|[ivxlcdm]{1,6})$/i

/** Drop bare page numbers in the top/bottom margin band. */
export function stripPageNumbers(lines: Line[], pageHeight: number): Line[] {
  return lines.filter((l) => {
    const inBand = l.top > pageHeight * 0.9 || l.bottom < pageHeight * 0.08
    return !(inBand && PAGE_NUMBER.test(l.text))
  })
}

export interface ColumnSplit {
  gutter: number
}

/**
 * Two-column detection: a vertical gutter in the middle third that most
 * lines stay clear of, with enough wide lines on both sides. Full-width
 * lines (titles, abstracts) may cross it.
 */
export function detectColumns(lines: Line[], pageWidth: number): ColumnSplit | null {
  if (lines.length < 8) return null
  let best: { g: number; score: number; left: Line[]; right: Line[] } | null = null
  for (let f = 0.35; f <= 0.651; f += 0.01) {
    const g = pageWidth * f
    const left: Line[] = []
    const right: Line[] = []
    let cross = 0
    for (const l of lines) {
      if (l.x1 <= g) left.push(l)
      else if (l.x0 >= g) right.push(l)
      else cross++
    }
    const score = Math.min(left.length, right.length) - cross * 0.5
    if (!best || score > best.score) best = { g, score, left, right }
  }
  if (!best) return null
  const { left, right } = best
  const sideCount = left.length + right.length
  if (left.length < 5 || right.length < 5 || sideCount < lines.length * 0.6) return null
  const wide = (ls: Line[]) => median(ls.map((l) => l.x1 - l.x0))
  if (wide(left) < pageWidth * 0.22 || wide(right) < pageWidth * 0.22) return null
  // Both sides must share vertical extent (text side by side, not a
  // left-only list above a right-only one).
  const span = (ls: Line[]) => [Math.min(...ls.map((l) => l.top)), Math.max(...ls.map((l) => l.bottom))]
  const [lt, lb] = span(left)
  const [rt, rb] = span(right)
  const overlap = Math.min(lb, rb) - Math.max(lt, rt)
  if (overlap < Math.min(lb - lt, rb - rt) * 0.5) return null
  // Rows that have segments on both sides: tables also do this, but their
  // cells are short. Require the side-by-side rows to be wide text.
  return { gutter: Math.round(best.g) }
}

type FlowEl = { t: 'line'; line: Line } | { t: 'image'; image: PageImage }

interface Flow {
  els: FlowEl[]
  x0: number
  x1: number
}

function orderFlows(lines: Line[], images: PageImage[], pageWidth: number, split: ColumnSplit | null): Flow[] {
  const byTop = (a: { top: number; x0: number }, b: { top: number; x0: number }) => a.top - b.top || a.x0 - b.x0
  const imgEls = images.map((image) => ({ image, top: image.y, x0: image.x, cx: image.x + image.w / 2, wide: false as boolean }))
  if (!split) {
    const els: (FlowEl & { top: number; x0: number })[] = [
      ...lines.map((line) => ({ t: 'line' as const, line, top: line.top, x0: line.x0 })),
      ...imgEls.map((i) => ({ t: 'image' as const, image: i.image, top: i.top, x0: i.x0 })),
    ]
    els.sort(byTop)
    const x0 = lines.length ? Math.min(...lines.map((l) => l.x0)) : 0
    const x1 = lines.length ? Math.max(...lines.map((l) => l.x1)) : pageWidth
    return [{ els, x0, x1 }]
  }
  const g = split.gutter
  type Item = { kind: 'L' | 'R' | 'S'; el: FlowEl; top: number; x0: number; x1: number }
  const all: Item[] = []
  for (const line of lines) {
    const kind = line.x1 <= g ? 'L' : line.x0 >= g ? 'R' : 'S'
    all.push({ kind, el: { t: 'line', line }, top: line.top, x0: line.x0, x1: line.x1 })
  }
  for (const i of imgEls) {
    const crosses = i.image.x < g - 4 && i.image.x + i.image.w > g + 4
    all.push({ kind: crosses ? 'S' : i.cx < g ? 'L' : 'R', el: { t: 'image', image: i.image }, top: i.top, x0: i.x0, x1: i.x0 + i.image.w })
  }
  all.sort(byTop)
  const flows: Flow[] = []
  let left: Item[] = []
  let right: Item[] = []
  let spanning: Item[] = []
  const bounds = (items: Item[]) => ({ x0: Math.min(...items.map((i) => i.x0)), x1: Math.max(...items.map((i) => i.x1)) })
  const flushCols = () => {
    if (left.length) flows.push({ els: left.map((i) => i.el), ...bounds(left) })
    if (right.length) flows.push({ els: right.map((i) => i.el), ...bounds(right) })
    left = []
    right = []
  }
  const flushSpan = () => {
    if (spanning.length) flows.push({ els: spanning.map((i) => i.el), ...bounds(spanning) })
    spanning = []
  }
  for (const it of all) {
    if (it.kind === 'S') {
      flushCols()
      spanning.push(it)
    } else {
      flushSpan()
      if (it.kind === 'L') left.push(it)
      else right.push(it)
    }
  }
  flushCols()
  flushSpan()
  return flows
}

const BULLET = /^([•●○◦▪■□◆◇►▶‣⁃∙·✓✔➢➤\u2022\uF0B7\uF0A7])\s*/
const DASH_BULLET = /^([-–—*])\s+/

/** Recognise a list marker at the start of a line. */
export function listMarker(text: string): ListMarker | null {
  let m = text.match(BULLET) || text.match(DASH_BULLET)
  if (m && text.length > m[0].length) return { ordered: false, format: 'bullet', pattern: '•', start: 1, length: m[0].length, raw: m[0] }
  // 1. / 1) / 1、 / (1) / （1）
  m = text.match(/^(\(|（)?(\d{1,3})([.)）、])/)
  if (m) {
    const open = m[1]
    const close = m[3]
    const rest = text.slice(m[0].length)
    const pad = rest.length - rest.replace(/^\s+/, '').length
    const bad = (open && close !== ')' && close !== '）')
      || (close === '.' && /^\d/.test(rest))
      || (close === '.' && !open && pad === 0 && !isCjk(rest[0]))
    if (!bad && rest.trim()) {
      return { ordered: true, format: 'decimal', pattern: open ? `${open}%1${close}` : `%1${close}`, start: parseInt(m[2], 10), length: m[0].length + pad, raw: text.slice(0, m[0].length + pad) }
    }
  }
  m = text.match(/^(\(|（)(\d{1,3})(\)|）)\s*/)
  if (m && text.length > m[0].length) return { ordered: true, format: 'decimal', pattern: `${m[1]}%1${m[3]}`, start: parseInt(m[2], 10), length: m[0].length, raw: m[0] }
  // a. / a) / A.  (needs a following space)
  m = text.match(/^([a-zA-Z])(\.|\))\s+/)
  if (m && text.length > m[0].length) {
    const lower = m[1] === m[1].toLowerCase()
    return { ordered: true, format: lower ? 'lowerLetter' : 'upperLetter', pattern: `%1${m[2]}`, start: m[1].toLowerCase().charCodeAt(0) - 96, length: m[0].length, raw: m[0] }
  }
  // 一、 二、 / （一）
  m = text.match(/^([一二三四五六七八九十]{1,3})、\s*/)
  if (m && text.length > m[0].length) return { ordered: true, format: 'chineseCounting', pattern: '%1、', start: chineseNumber(m[1]), length: m[0].length, raw: m[0] }
  m = text.match(/^(（|\()([一二三四五六七八九十]{1,3})(）|\))\s*/)
  if (m && text.length > m[0].length) return { ordered: true, format: 'chineseCounting', pattern: '（%1）', start: chineseNumber(m[2]), length: m[0].length, raw: m[0] }
  return null
}

export function chineseNumber(s: string): number {
  const d: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
  if (s === '十') return 10
  if (s.length === 1) return d[s] ?? 1
  if (s[0] === '十') return 10 + (d[s[1]] ?? 0)
  if (s.length === 2 && s[1] === '十') return (d[s[0]] ?? 1) * 10
  if (s.length === 3 && s[1] === '十') return (d[s[0]] ?? 1) * 10 + (d[s[2]] ?? 0)
  return 1
}

/** Remove the first `n` characters from a span list. */
function dropChars(spans: Span[], n: number): Span[] {
  const out: Span[] = []
  let left = n
  for (const s of spans) {
    if (left <= 0) { out.push({ ...s }); continue }
    if (s.text.length <= left) { left -= s.text.length; continue }
    out.push({ ...s, text: s.text.slice(left) })
    left = 0
  }
  if (out.length) out[0].text = out[0].text.replace(/^\s+/, '')
  return out.filter((s) => s.text.length)
}

function appendSpans(into: Span[], add: Span[]) {
  if (!add.length) return
  add = add.map((s) => ({ ...s }))
  const last = into[into.length - 1]
  if (last) {
    const a = last.text
    const b = add[0].text
    if (/[A-Za-z]-$/.test(a) && /^[a-z]/.test(b)) {
      last.text = a.slice(0, -1)
    } else {
      last.text = a.replace(/\s+$/, '')
      add[0].text = joinWords(last.text, b.replace(/^\s+/, '')).slice(last.text.length)
    }
  }
  for (const s of add) if (s.text) pushSpan(into, s.text, s)
}

/** Detect simple tables: ≥2 consecutive rows of ≥2 segments whose x-ranges line up into ≥2 columns. */
function findTables(els: FlowEl[]): { start: number; end: number; rows: Line[][] }[] {
  // Group consecutive line elements by row index.
  const groups: { idx: number[]; lines: Line[] }[] = []
  els.forEach((el, i) => {
    if (el.t !== 'line') { groups.push({ idx: [i], lines: [] }); return }
    const g = groups[groups.length - 1]
    if (g && g.lines.length && g.lines[0].row === el.line.row) { g.idx.push(i); g.lines.push(el.line) } else groups.push({ idx: [i], lines: [el.line] })
  })
  const out: { start: number; end: number; rows: Line[][] }[] = []
  let run: typeof groups = []
  const flush = () => {
    if (run.length >= 2) {
      const rows = run.map((g) => [...g.lines].sort((a, b) => a.x0 - b.x0))
      if (isTable(rows)) out.push({ start: run[0].idx[0], end: run[run.length - 1].idx[run[run.length - 1].idx.length - 1], rows })
    }
    run = []
  }
  for (const g of groups) {
    if (g.lines.length >= 2) run.push(g)
    else flush()
  }
  flush()
  return out
}

/** Column intervals of a candidate table, or null when segments do not line up. */
export function tableColumns(rows: Line[][]): [number, number][] | null {
  const ivs = rows.flat().map((l) => [l.x0, l.x1] as [number, number]).sort((a, b) => a[0] - b[0])
  const cols: [number, number][] = []
  for (const [a, b] of ivs) {
    const last = cols[cols.length - 1]
    if (last && a <= last[1] + 2) last[1] = Math.max(last[1], b)
    else cols.push([a, b])
  }
  if (cols.length < 2 || cols.length > 12) return null
  // Every row: each segment in its own column.
  for (const row of rows) {
    const used = new Set<number>()
    for (const l of row) {
      const ci = cols.findIndex(([a, b]) => l.x0 >= a - 0.5 && l.x1 <= b + 0.5)
      if (ci < 0 || used.has(ci)) return null
      used.add(ci)
    }
  }
  return cols
}

function isTable(rows: Line[][]): boolean {
  const cols = tableColumns(rows)
  if (!cols) return false
  // Most rows should fill most columns (label/value pairs scattered on a
  // form are not a table).
  const filled = rows.filter((r) => r.length >= Math.max(2, cols.length - 1)).length
  return filled >= Math.ceil(rows.length * 0.6)
}

function tableBlock(rows: Line[][]): Block {
  const cols = tableColumns(rows)!
  return {
    kind: 'table',
    rows: rows.map((row) => cols.map(([a, b]) => {
      const l = row.find((x) => x.x0 >= a - 0.5 && x.x1 <= b + 0.5)
      return l ? l.spans.map((s) => ({ ...s })) : []
    })),
  }
}

export interface LayoutOptions {
  bodySize: number
  /** Drop bare page numbers (editable output). */
  stripPageNumbers?: boolean
}

interface ParaDraft {
  lines: Line[]
  marker: ListMarker | null
  flow: Flow
}

function classifyAlign(lines: Line[], flow: Flow): Align {
  const w = flow.x1 - flow.x0
  if (w <= 0) return 'left'
  const cx = (flow.x0 + flow.x1) / 2
  const narrow = lines.every((l) => l.x1 - l.x0 < w * 0.85)
  if (!narrow) return 'left'
  if (lines.every((l) => Math.abs((l.x0 + l.x1) / 2 - cx) < w * 0.04)) return 'center'
  if (lines.every((l) => Math.abs(l.x1 - flow.x1) < w * 0.02) && lines.some((l) => l.x0 > flow.x0 + w * 0.3)) return 'right'
  return 'left'
}

function headingLevel(size: number, body: number, bold: boolean, text: string, lineCount: number): 1 | 2 | 3 | null {
  const len = text.length
  if (len === 0 || len > 160) return null
  if (!/[\p{L}\p{N}]/u.test(text)) return null
  const r = size / body
  if (r >= 1.7) return 1
  if (r >= 1.35) return 2
  if (r >= 1.15) return 3
  if (bold && lineCount === 1 && len <= 60 && r >= 0.95 && !/[,，;；。.]$/.test(text)) return 3
  return null
}

function buildParagraphs(flow: Flow, body: number): (Block | null)[] {
  const out: (Block | null)[] = []
  const lineEls = flow.els.filter((e): e is { t: 'line'; line: Line } => e.t === 'line')
  // Typical gap between consecutive same-size lines in this flow.
  const gaps: number[] = []
  for (let i = 1; i < lineEls.length; i++) {
    const a = lineEls[i - 1].line
    const b = lineEls[i].line
    if (Math.abs(a.size - b.size) < 0.6 && b.top >= a.top) gaps.push(b.top - a.bottom)
  }
  const typicalGap = gaps.length ? median(gaps.filter((g) => g > -body)) : body * 0.3
  const w = flow.x1 - flow.x0
  let draft: ParaDraft | null = null

  const emit = () => {
    if (!draft) return
    const d = draft
    draft = null
    let spans: Span[] = []
    // A centred line ("A. Author and B. Writer") or a large one ("1. Intro"
    // as a heading) keeps its marker text and is not a list item.
    const centeredMarker = !!d.marker && d.lines.length === 1 && classifyAlign(d.lines, flow) === 'center'
    const keepMarker = !!d.marker && (median(d.lines.map((l) => l.size)) >= body * 1.15 || centeredMarker)
    d.lines.forEach((l, i) => {
      const s = i === 0 && d.marker && !keepMarker ? dropChars(l.spans, d.marker.length) : l.spans.map((x) => ({ ...x }))
      appendSpans(spans, s)
    })
    spans = spans.filter((s) => s.text.length)
    if (!spans.length) return
    const text = spans.map((s) => s.text).join('')
    const size = median(d.lines.map((l) => l.size))
    const bold = spans.every((s) => s.bold || !s.text.trim())
    const size0 = median(d.lines.map((l) => l.size))
    if (d.marker && size0 < body * 1.15 && !centeredMarker) {
      const level = d.lines[0].x0 > flow.x0 + body * 2 ? 1 : 0
      out.push({ kind: 'list', marker: d.marker, level, spans, size })
      return
    }
    const level = headingLevel(size, body, bold, text, d.lines.length)
    const align = classifyAlign(d.lines, flow)
    if (level) out.push({ kind: 'heading', level, spans, align, size })
    else out.push({ kind: 'para', spans, align, size, indent: d.lines.length > 1 && d.lines[0].x0 > d.lines[1].x0 + body * 0.8 })
  }

  for (const el of flow.els) {
    if (el.t === 'image') {
      emit()
      out.push({ kind: 'image', image: el.image })
      continue
    }
    const l = el.line
    const marker = listMarker(l.text)
    if (!draft) { draft = { lines: [l], marker, flow }; continue }
    const p = draft.lines[draft.lines.length - 1]
    const gap = l.top - p.bottom
    const sizeJump = Math.abs(l.size - p.size) > Math.max(0.15 * p.size, 0.8)
    const bigGap = gap > Math.max(typicalGap * 1.7, typicalGap + 0.45 * p.size)
    const wentUp = l.top < p.top - 1
    const pShort = p.x1 < flow.x1 - w * 0.12
    const pEnds = TERMINAL.test(p.text)
    const indentStart = l.x0 > flow.x0 + p.size * 1.2 && Math.abs(p.x0 - flow.x0) < p.size * 0.8 && !draft.marker
    const listCont = draft.marker && l.x0 > draft.lines[0].x0 + p.size * 0.4 && !marker
    const xJump = Math.abs(l.x0 - p.x0) > p.size * 2.5 && !listCont && !(draft.lines.length === 1 && p.x0 > l.x0)
    const boldBreak = p.spans.every((s) => s.bold) && !l.spans.every((s) => s.bold)
    const centered = classifyAlign([p], flow) === 'center' && classifyAlign([l], flow) !== 'center'
    const breakHere = !!marker || sizeJump || bigGap || wentUp || (pShort && (pEnds || draft.lines.length === 1 && !draft.marker)) || indentStart || xJump || boldBreak || centered
    if (breakHere) {
      emit()
      draft = { lines: [l], marker, flow }
    } else {
      draft.lines.push(l)
    }
  }
  emit()
  return out
}

/** Analyse one page into reading-ordered blocks. */
export function layoutPage(page: PageModel, opts: LayoutOptions): PageLayout {
  let lines = buildLines(page.items)
  if (opts.stripPageNumbers) lines = stripPageNumbers(lines, page.height)
  const split = detectColumns(lines, page.width)
  const flows = orderFlows(lines, page.images, page.width, split)
  const blocks: Block[] = []
  for (const flow of flows) {
    const tables = findTables(flow.els)
    let i = 0
    for (const t of tables) {
      if (t.start > i) blocks.push(...buildParagraphs({ ...flow, els: flow.els.slice(i, t.start) }, opts.bodySize).filter((b): b is Block => !!b))
      blocks.push(tableBlock(t.rows))
      i = t.end + 1
    }
    if (i < flow.els.length) blocks.push(...buildParagraphs({ ...flow, els: flow.els.slice(i) }, opts.bodySize).filter((b): b is Block => !!b))
  }
  return { num: page.num, blocks: demoteLoneLetterItems(blocks), twoColumn: !!split }
}

/**
 * "A. Smith" or "a) note" on its own is not a list: a letter-marked item
 * with no list item next to it goes back to a paragraph, marker included.
 */
function demoteLoneLetterItems(blocks: Block[]): Block[] {
  return blocks.map((b, i) => {
    if (b.kind !== 'list' || (b.marker.format !== 'lowerLetter' && b.marker.format !== 'upperLetter')) return b
    const near = [blocks[i - 1], blocks[i + 1]].some((x) => x?.kind === 'list' && x.marker.format === b.marker.format)
    if (near) return b
    const first = b.spans[0]
    const spans = [{ ...first, text: b.marker.raw + first.text }, ...b.spans.slice(1)]
    return { kind: 'para', spans, align: 'left', size: b.size, indent: false } as Block
  })
}

/**
 * Whole-document pass: one body size for every page, then a paragraph cut
 * by a page break (no terminal punctuation, same size) is joined back.
 */
export function layoutDocument(pages: PageModel[], opts: { stripPageNumbers?: boolean } = {}): { pages: PageLayout[]; bodySize: number } {
  const bodySize = bodySizeOf(pages.flatMap((p) => p.items))
  const out = pages.map((p) => layoutPage(p, { bodySize, stripPageNumbers: opts.stripPageNumbers }))
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1].blocks
    const cur = out[i].blocks
    const a = prev[prev.length - 1]
    const b = cur[0]
    if (a && b && a.kind === 'para' && b.kind === 'para' && Math.abs(a.size - b.size) < 0.6 && !b.indent) {
      const text = a.spans.map((s) => s.text).join('')
      if (!TERMINAL.test(text.trim())) {
        appendSpans(a.spans, b.spans)
        cur.shift()
      }
    }
  }
  return { pages: out, bodySize }
}

/** Plain text of a block list (tests, previews). */
export function blocksText(blocks: Block[]): string {
  return blocks.map((b) => {
    if (b.kind === 'table') return b.rows.map((r) => r.map((c) => c.map((s) => s.text).join('')).join(' | ')).join('\n')
    if (b.kind === 'image') return '[image]'
    return b.spans.map((s) => s.text).join('')
  }).join('\n')
}
