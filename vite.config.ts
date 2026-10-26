import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the /docs folder of main, so the build output goes there.
// base './' keeps asset paths relative, so the site works under /image-compressor/.
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectRegister defaults to 'auto': no virtual:pwa-register import in
      // main.ts, so the plugin injects the registration script itself.
      workbox: {
        // avif_enc.wasm is ~3.5MB, above workbox's 2MB default precache cap.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Default patterns omit wasm; encoder binaries must work offline too.
        globPatterns: ['**/*.{js,css,html,png,svg,wasm}'],
        // The plugin defaults every navigation to the precached index.html
        // (SPA fallback). This app has no client routing, and the language
        // shells are real files: restrict the fallback to the root page only,
        // or /en/ etc. would be served the root shell (whose relative asset
        // paths 404 under /en/) whenever the worker is in control.
        // Matches both local (http://localhost:8901/) and Pages
        // (https://kimorix.github.io/image-compressor/) roots, whether the
        // check runs against the full URL or just the pathname.
        navigateFallbackAllowlist: [/^(https?:\/\/[^/]+)?(\/image-compressor)?\/$/],
        // Language shells (docs/en/ etc.) are generated after the build, so
        // they are not precached; cache them on first visit for offline use.
        runtimeCaching: [{
          urlPattern: ({ request }) => request.mode === 'navigate',
          handler: 'NetworkFirst',
          options: { cacheName: 'pages', networkTimeoutSeconds: 3 },
        }],
      },
      manifest: {
        name: '图片压缩',
        short_name: '图片压缩',
        description: '免费开源的图片压缩工具，所有处理均在浏览器本地完成，图片不会上传到任何服务器。',
        lang: 'zh',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#010102',
        theme_color: '#010102',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  base: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
})
