// Stand-in for three dependencies of @cantoo/pdf-lib that this app never
// needs: culori (CSS colour strings), node-html-better-parser (SVG and XFA
// XML parsing) and html-entities (XML escaping). vite.config.ts aliases the
// bare imports `culori`, `node-html-better-parser` and `html-entities` to this
// file, which keeps ~110KB of minified code out of the pdf-lib bundle.
//
// What pdf-lib uses them for, and why that is safe to drop here:
// - culori `converter('rgb')` runs once at module load (api/colors.js) and the
//   resulting function is only called by colorString(), which only svg.js
//   uses (drawSvg / embedSvg). We never draw SVG.
// - node-html-better-parser `parse` / `NodeType` back embedSvg, drawSvg and
//   the XFA script / signature helpers (getXFAJavaScripts, setXFAJavaScript,
//   getXFASignatures, getSignatureFields). We call none of them; merge only
//   detects an /XFA entry by name and drops it.
// - html-entities `encode` escapes text written into XMP (PDF/A metadata,
//   Factur-X) and XFA scripts. We never opt in to PDF/A metadata, but encode()
//   below is a complete implementation of the call pdf-lib makes (default
//   options: escape & < > " ' only), so even that path keeps working.
//
// Anything that would need the real parser throws a clear error instead of
// failing somewhere deep inside pdf-lib. tests/unit/pdf-lib-slim.test.ts
// guards both the stubs and the built chunk.

export const SVG_UNSUPPORTED = 'SVG / XFA / CSS colour strings are not supported in this build (pdf-lib SVG dependencies are stubbed out)'

function unsupported(): never {
  throw new Error(SVG_UNSUPPORTED)
}

// culori: `converter(mode)` returns a colour converter. Called at import time,
// so it must not throw itself; the converter it returns does.
export function converter(_mode?: string): (color: unknown) => never {
  return unsupported
}

// node-html-better-parser
export const NodeType = { ELEMENT_NODE: 1, TEXT_NODE: 3, COMMENT_NODE: 8 } as const
export function parse(_html?: string, _options?: unknown): never {
  return unsupported()
}

// html-entities: encode(text) with its default options ({ mode: 'specialChars',
// level: 'all' }), which escapes exactly these five characters.
const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
export function encode(text: string | null | undefined, options?: unknown): string {
  if (options !== undefined) unsupported()
  if (!text) return ''
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c])
}
