import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import { pdfLibSlimAlias } from './scripts/pdf-lib-slim'

// Unit tests only; the Playwright suite (tests/suite-vue.js) runs against
// the built docs/ separately. The Vue plugin lets component tests render
// SFCs with vue/server-renderer (no DOM needed).
export default defineConfig({
  plugins: [vue()],
  // Same slimmed pdf-lib as the build (see scripts/pdf-lib-slim.ts). pdf-lib
  // is inlined (run through Vite) so its own imports see the alias too;
  // externalized, Node would resolve the real packages.
  resolve: { alias: pdfLibSlimAlias },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    server: { deps: { inline: ['@cantoo/pdf-lib'] } },
  },
})
