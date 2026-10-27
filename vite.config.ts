import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// The Pages workflow publishes main's docs/ at the root and dev's docs/ under
// /staging/, so the build output goes to docs/ and is committed.
// base './' keeps asset paths relative, so it works under either path.
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectRegister defaults to 'auto': no virtual:pwa-register import in
      // main.ts, so the plugin injects the registration script itself.
      workbox: {
        // avif_enc.wasm used to force this cap up; it no longer precaches
        // (see below), but mozjpeg stays precached, so keep headroom.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Default patterns omit wasm; encoder binaries must work offline too.
        globPatterns: ['**/*.{js,css,html,png,svg,wasm}'],
        // First-visit weight: the avif/webp encoder payloads (wasm
        // binaries plus their emscripten JS glue) and the heic2any chunk
        // (~1.3MB) are only needed when the user actually picks those
        // paths, so they stay OUT of the precache and are cached on first
        // use instead (CacheFirst below). The worker chunk itself stays
        // precached: every compression needs it, and only its lazy
        // payloads move out. The JS glue must be excluded too: it matches
        // the precache's js pattern, and leaving it in silently defeats
        // the exclusion (suite19 caught exactly that: 3 glue files).
        globIgnores: ['**/avif_enc*.wasm', '**/avif_enc*.js', '**/heic2any*.js', '**/webp_enc*.wasm', '**/webp_enc*.js'],
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
        // Lazy heavy assets excluded from the precache above: cache them
        // on first use so they still work offline afterwards. Hashed
        // filenames make old entries harmless orphans, bounded by maxEntries.
        runtimeCaching: [{
          urlPattern: /\/(avif_enc|webp_enc)[^/]*\.(wasm|js)$|\/heic2any[^/]*\.js$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'lazy-assets',
            expiration: { maxEntries: 20, maxAgeSeconds: 30 * 24 * 60 * 60 },
          },
        }, {
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
  // Module workers with dynamic imports (lazy encoders, heic2any, piexifjs)
  // need code-splitting, which the default iife worker format forbids.
  worker: {
    format: 'es',
  },
})
