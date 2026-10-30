import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// Unit tests only; the Playwright suite (tests/suite-vue.js) runs against
// the built docs/ separately. The Vue plugin lets component tests render
// SFCs with vue/server-renderer (no DOM needed).
export default defineConfig({
  plugins: [vue()],
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
})
