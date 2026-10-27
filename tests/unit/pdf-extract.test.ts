import { describe, expect, it } from 'vitest'
import { cleanBoxes, fontStyle, imageBoxes, isScannedPage, renderScale, textChars, textItems } from '../../src/features/pdf-to-word/lib/extract'
import { ocrItems } from '../../src/features/pdf-to-word/lib/ocr'

const OPS = { save: 10, restore: 11, transform: 12, paintFormXObjectBegin: 74, paintFormXObjectEnd: 75, paintImageXObject: 85, paintInlineImageXObject: 86, paintImageMaskXObject: 83, paintImageXObjectRepeat: 88 } as never
// A4 viewport at scale 1: flips y (PDF bottom-left → top-left).
const VT = [1, 0, 0, -1, 0, 842]

describe('picture boxes from the operator list', () => {
  it('follows save/transform/restore', () => {
    const fn = [10, 12, 85, 11, 85]
    const args = [[], [200, 0, 0, 100, 50, 600], ['img1'], [], ['img2']]
    const boxes = imageBoxes(OPS, fn, args, VT)
    expect(boxes[0]).toEqual({ x: 50, y: 142, w: 200, h: 100 })
    // after restore the CTM is identity again: a 1pt image at the origin
    expect(boxes[1]).toEqual({ x: 0, y: 841, w: 1, h: 1 })
  })
  it('applies form XObject matrices', () => {
    const fn = [74, 12, 85, 75]
    const args = [[[2, 0, 0, 2, 0, 0], null], [50, 0, 0, 50, 10, 10], ['img'], []]
    expect(imageBoxes(OPS, fn, args, VT)[0]).toEqual({ x: 20, y: 722, w: 100, h: 100 })
  })
  it('cleans: clip, drop tiny / nested / background', () => {
    const boxes = [
      { x: -10, y: 100, w: 200, h: 100 },
      { x: 20, y: 120, w: 50, h: 40 },
      { x: 300, y: 300, w: 5, h: 5 },
      { x: 0, y: 0, w: 595, h: 842 },
    ]
    expect(cleanBoxes(boxes, 595, 842, true)).toEqual([{ x: 0, y: 100, w: 190, h: 100 }])
    expect(cleanBoxes(boxes, 595, 842, false)).toEqual([{ x: 0, y: 0, w: 595, h: 842 }])
  })
})

describe('fonts and text items', () => {
  it('reads bold/italic from flags or names', () => {
    expect(fontStyle({ name: 'ABCDEF+Helvetica-Bold' })).toEqual({ bold: true, italic: false })
    expect(fontStyle({ name: 'Times-Italic' })).toEqual({ bold: false, italic: true })
    expect(fontStyle({ name: 'NotoSansSC-SemiBold' }).bold).toBe(true)
    expect(fontStyle({ name: 'Plain', bold: true, italic: true })).toEqual({ bold: true, italic: true })
    expect(fontStyle(null)).toEqual({ bold: false, italic: false })
  })
  it('converts pdf.js items to top-left points', () => {
    const util = { Util: { transform: (m1: number[], m2: number[]) => [m1[0] * m2[0] + m1[2] * m2[1], m1[1] * m2[0] + m1[3] * m2[1], m1[0] * m2[2] + m1[2] * m2[3], m1[1] * m2[2] + m1[3] * m2[3], m1[0] * m2[4] + m1[2] * m2[5] + m1[4], m1[1] * m2[4] + m1[3] * m2[5] + m1[5]] } }
    const items = [
      { str: 'Hello', transform: [12, 0, 0, 12, 72, 742], width: 30, height: 12, fontName: 'f1' },
      { str: '  ', transform: [12, 0, 0, 12, 110, 742], width: 6, height: 12, fontName: 'f1' },
      { str: 'rotated', transform: [0, 12, -12, 0, 300, 300], width: 40, height: 12, fontName: 'f1' },
    ]
    const out = textItems(util as never, items, { f1: { ascent: 0.8, descent: -0.2 } }, VT, () => ({ name: 'Arial-BoldMT' }))
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ str: 'Hello', x: 72, size: 12, w: 30, bold: true })
    expect(out[0].y).toBeCloseTo(842 - 742 - 12 * 0.8)
    expect(textChars(out)).toBe(5)
  })
})

describe('scanned pages and OCR', () => {
  it('scanned = no text + a big picture', () => {
    expect(isScannedPage(0, [{ x: 0, y: 0, w: 595, h: 842 }], 595, 842)).toBe(true)
    expect(isScannedPage(400, [{ x: 0, y: 0, w: 595, h: 842 }], 595, 842)).toBe(false)
    expect(isScannedPage(0, [{ x: 0, y: 0, w: 100, h: 100 }], 595, 842)).toBe(false)
  })
  it('caps the render scale', () => {
    expect(renderScale(595, 842)).toBe(2)
    expect(renderScale(5000, 5000)).toBeLessThan(1)
  })
  it('turns tesseract words into point items', () => {
    const blocks = [{ paragraphs: [{ lines: [{ bbox: { x0: 100, y0: 200, x1: 600, y1: 240 }, words: [
      { text: 'Rent', confidence: 90, bbox: { x0: 100, y0: 202, x1: 180, y1: 238 } },
      { text: '~', confidence: 5, bbox: { x0: 190, y0: 202, x1: 200, y1: 238 } },
    ] }] }] }]
    const items = ocrItems(blocks, 2)
    expect(items).toEqual([{ str: 'Rent', x: 50, y: 100, w: 40, h: 20, size: 20 * 0.82, bold: false, italic: false }])
  })
})
