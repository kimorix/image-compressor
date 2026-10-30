// Shared by vite.config.ts and vitest.config.ts, so the unit tests run
// against the same slimmed pdf-lib that ships.
//
// @cantoo/pdf-lib depends on culori, node-html-better-parser and html-entities
// only for SVG drawing, XFA scripts, CSS colour strings and PDF/A XMP, none of
// which this app uses. Their bare imports resolve to a small local stub (see
// src/shared/pdf/svg-stub.ts for why each one is safe), which keeps ~110KB of
// minified code out of the pdf-lib bundle. tslib stays: pdf-lib really uses
// its async helpers. Exact-match pattern, so only these three bare specifiers
// are affected. tests/unit/pdf-lib-slim.test.ts guards the result.
import { fileURLToPath } from 'node:url'

export const pdfLibSlimAlias = [{
  find: /^(culori|node-html-better-parser|html-entities)$/,
  replacement: fileURLToPath(new URL('../src/shared/pdf/svg-stub.ts', import.meta.url)),
}]
