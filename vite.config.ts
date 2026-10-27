import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, normalize } from 'node:path'

// pdf.js data files the PDF to Word feature loads at run time: CMaps (CJK
// fonts that are not embedded), the 14 standard fonts, and the JPX/JBIG2
// image decoders. Copied to docs/pdfjs/ (served from node_modules in dev).
// They are fetched only when a PDF needs them and never precached.
const PDFJS_DIR = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'))
const PDFJS_DATA = ['cmaps', 'standard_fonts', 'wasm']
function pdfjsData(): Plugin {
  const keep = (dir: string, f: string) => dir !== 'wasm' || /^(openjpeg|jbig2|qcms_bg)\.wasm$|_nowasm_fallback\.js$/.test(f)
  return {
    name: 'pdfjs-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url?.match(/\/pdfjs\/([a-z_]+)\/([^?#]+)/)
        if (!m || !PDFJS_DATA.includes(m[1])) return next()
        const file = normalize(join(PDFJS_DIR, m[1], decodeURIComponent(m[2])))
        if (!file.startsWith(join(PDFJS_DIR, m[1])) || !existsSync(file) || !statSync(file).isFile()) return next()
        createReadStream(file).pipe(res)
      })
    },
    generateBundle() {
      for (const dir of PDFJS_DATA) {
        for (const f of readdirSync(join(PDFJS_DIR, dir)).sort()) {
          if (!keep(dir, f) || /^LICENSE/.test(f)) continue
          this.emitFile({ type: 'asset', fileName: `pdfjs/${dir}/${f}`, source: readFileSync(join(PDFJS_DIR, dir, f)) })
        }
      }
    },
  }
}

// GitHub Pages serves the /docs folder of main, so the build output goes there.
// base './' keeps asset paths relative, so the site works under /image-compressor/.
export default defineConfig({
  plugins: [
    vue(),
    pdfjsData(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectRegister defaults to 'auto': no virtual:pwa-register import in
      // main.ts, so the plugin injects the registration script itself.
      workbox: {
        // avif_enc.wasm used to force this cap up; no encoder binary is
        // precached any more (see below), keep the headroom anyway.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Default patterns omit wasm; encoder binaries must work offline too.
        globPatterns: ['**/*.{js,css,html,png,svg,wasm}'],
        // First-visit weight: the avif/webp encoder payloads (wasm
        // binaries plus their emscripten JS glue) and the heic2any chunk
        // (~1.3MB) are only needed when the user actually picks those
        // paths, so they stay OUT of the precache and are cached on first
        // use instead (CacheFirst below). The same goes for the MozJPEG,
        // lossless PNG and palette-PNG (imagequant + its wasm-bindgen glue)
        // binaries (~780KB): every install used to download all three up
        // front although one compression only ever needs one of them. The worker chunk itself stays
        // precached: every compression needs it, and only its lazy
        // payloads move out. The JS glue must be excluded too: it matches
        // the precache's js pattern, and leaving it in silently defeats
        // the exclusion (suite19 caught exactly that: 3 glue files).
        // PDF to Word: pdf.js (~0.5MB) and its worker (~1.3MB), the docx
        // worker (~0.4MB), the tesseract.js OCR loader and pdf.js's data
        // files (CMaps, fonts, decoder wasm) are fetched only when a PDF is
        // opened, so they are cached on first use too. The PDF view chunk
        // itself stays precached (small) so the page opens offline.
        globIgnores: ['**/mozjpeg_enc*.wasm', '**/squoosh_png*.wasm', '**/imagequant_bg*', '**/avif_enc*.wasm', '**/avif_enc*.js', '**/heic2any*.js', '**/webp_enc*.wasm', '**/webp_enc*.js', '**/pdf.worker*', '**/assets/pdf-*.js', '**/docx.worker*', '**/tesseract*', 'pdfjs/**'],
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
          urlPattern: /\/(avif_enc|webp_enc|mozjpeg_enc|squoosh_png_bg|imagequant_bg)[^/]*\.(wasm|js)$|\/heic2any[^/]*\.js$|\/pdf\.worker[^/]*\.m?js$|\/assets\/pdf-[^/]*\.js$|\/docx\.worker[^/]*\.js$|\/tesseract[^/]*\.js$|\/pdfjs\/(cmaps|standard_fonts|wasm)\//,
          handler: 'CacheFirst',
          options: {
            cacheName: 'lazy-assets',
            expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 },
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
