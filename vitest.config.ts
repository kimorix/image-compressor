import { defineConfig } from 'vitest/config'

// Unit tests only; the Playwright suite (tests/suite-vue.js) runs against
// the built docs/ separately.
export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
})
