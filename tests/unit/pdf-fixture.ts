// Node-side page models from the fixture PDFs: pdf.js (legacy build, fake
// worker) supplies the text layer and the operator list exactly as in the
// browser; only the canvas crops are replaced by placeholder PNG bytes.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { cleanBoxes, imageBoxes, textItems } from '../../src/features/pdf-to-word/lib/extract'
import type { PageModel } from '../../src/features/pdf-to-word/types'

const PDFJS = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'))
export const FIXTURES = join(dirname(new URL(import.meta.url).pathname), '..', 'fixtures')
// 1×1 white PNG
export const PNG_1PX = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC', 'base64'))

export async function openFixture(name: string, password?: string) {
  const data = new Uint8Array(readFileSync(join(FIXTURES, name)))
  return pdfjs.getDocument({
    data,
    password,
    cMapUrl: join(PDFJS, 'cmaps') + '/',
    cMapPacked: true,
    standardFontDataUrl: join(PDFJS, 'standard_fonts') + '/',
    verbosity: 0,
    fontExtraProperties: true,
  }).promise
}

export async function fixturePages(name: string, password?: string): Promise<PageModel[]> {
  const doc = await openFixture(name, password)
  const out: PageModel[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const vp = page.getViewport({ scale: 1 })
    const ops = await page.getOperatorList()
    const tc = await page.getTextContent()
    const fontOf = (id: string) => { try { return page.commonObjs.has(id) ? page.commonObjs.get(id) : null } catch { return null } }
    const items = textItems(pdfjs, tc.items, tc.styles as never, vp.transform, fontOf)
    const boxes = cleanBoxes(imageBoxes(pdfjs.OPS, ops.fnArray, ops.argsArray as unknown[][], vp.transform), vp.width, vp.height, true)
    out.push({ num: n, width: vp.width, height: vp.height, items, images: boxes.map((b) => ({ ...b, data: PNG_1PX, type: 'png' as const })) })
  }
  await doc.loadingTask.destroy()
  return out
}
