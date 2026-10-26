// Generate one static shell per non-default language under docs/<lang>/.
// Each shell is a copy of the built docs/index.html with:
//  - <html lang> set to that language
//  - title / description / OG tags translated (for search indexing)
//  - asset paths rewritten ./ -> ../ (the shell lives one level deeper)
//  - a tiny script that pins localStorage ic-lang, so the SPA boots in
//    that language instead of following the browser language.
// Runs after `vite build` (see package.json "build"); the shells are NOT
// part of the PWA precache (they are generated after the build), but the
// runtime navigation cache covers them after the first visit.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = 'https://kimorix.github.io/image-compressor/'
const PAGES = {
  en: {
    lang: 'en',
    title: 'Image Compressor - 100% Local Processing',
    desc: 'Free, open-source image compressor. Everything runs locally in your browser; images are never uploaded to any server.',
  },
  ja: {
    lang: 'ja',
    title: '画像圧縮 - 100% ローカル処理',
    desc: '無料オープンソースの画像圧縮ツール。すべての処理はブラウザ内で行われ、画像がサーバーに送信されることはありません。',
  },
  ko: {
    lang: 'ko',
    title: '이미지 압축 - 100% 로컬 처리',
    desc: '무료 오픈소스 이미지 압축 도구. 모든 처리는 브라우저 안에서 이루어지며 이미지가 서버로 전송되지 않습니다.',
  },
  fr: {
    lang: 'fr',
    title: 'Compresseur d’images - 100% local',
    desc: 'Compresseur d’images gratuit et open source. Tout s’effectue localement dans votre navigateur ; aucune image n’est envoyée à un serveur.',
  },
  de: {
    lang: 'de',
    title: 'Bildkomprimierung - 100% lokal',
    desc: 'Kostenloser Open-Source-Bildkompressor. Alles läuft lokal in Ihrem Browser; Bilder werden an keinen Server gesendet.',
  },
}

const root = readFileSync('docs/index.html', 'utf8')
for (const [dir, p] of Object.entries(PAGES)) {
  let html = root
  html = html.replace('<html lang="zh-CN">', `<html lang="${p.lang}">`)
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${p.title}</title>`)
  html = html.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${p.desc}">`,
  )
  html = html.replace(
    /<meta property="og:title" content="[^"]*">/,
    `<meta property="og:title" content="${p.title}">`,
  )
  html = html.replace(
    /<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${p.desc}">`,
  )
  html = html.replace(
    /<meta property="og:url" content="[^"]*">/,
    `<meta property="og:url" content="${BASE}${dir}/">`,
  )
  html = html.replace(
    /<link rel="canonical" href="[^"]*">/,
    `<link rel="canonical" href="${BASE}${dir}/">`,
  )
  // Asset paths: the shell is one directory deeper than the root page.
  // Every "./..." reference (assets, manifest) moves up one level.
  // Exception: registerSW.js stays "./registerSW.js" — each language shell
  // gets its own registration script (written below) that points back to
  // the root sw.js. The stock script registers "./sw.js" relative to the
  // page, which would 404 as /en/sw.js and scope the worker to /en/.
  html = html.replace(/"\.\//g, '"../')
  html = html.replace('"../registerSW.js"', '"./registerSW.js"')
  // Pin the app language before the theme/lang bootstrap script runs.
  html = html.replace(
    '<script>\n(function () {',
    `<script>try{localStorage.setItem('ic-lang','${p.lang}')}catch(e){}</script>\n<script>\n(function () {`,
  )
  mkdirSync(join('docs', dir), { recursive: true })
  writeFileSync(join('docs', dir, 'index.html'), html)
  // Same registration as the stock script, but from one level deeper:
  // same script URL and same root scope, so the browser keeps a single
  // registration shared with the root page.
  writeFileSync(
    join('docs', dir, 'registerSW.js'),
    `if('serviceWorker' in navigator) {window.addEventListener('load', () => {navigator.serviceWorker.register('../sw.js', { scope: '../' })})}`,
  )
  console.log(`seo page: docs/${dir}/index.html`)
}
