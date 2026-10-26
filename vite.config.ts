import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages serves the /docs folder of main, so the build output goes there.
// base './' keeps asset paths relative, so the site works under /image-compressor/.
export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
})
