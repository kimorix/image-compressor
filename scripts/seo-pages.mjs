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

const BASE = 'https://kimorix.github.io/pixdoc/'
const PAGES = {
  en: {
    lang: 'en',
    title: 'Pixdoc - Local Image & PDF Tools',
    desc: 'Free, open-source image and PDF toolkit: compress, convert, resize and watermark images, PDF to Word, merge and split, images to PDF. Everything runs in your browser; files are never uploaded.',
  },
  ja: {
    lang: 'ja',
    title: 'Pixdoc - ローカル画像・PDF ツール',
    desc: '無料オープンソースの画像・PDF ツールキット。圧縮、形式変換、リサイズと透かし、PDF→Word、結合・分割、画像→PDF。すべてブラウザ内で処理され、ファイルはアップロードされません。',
  },
  ko: {
    lang: 'ko',
    title: 'Pixdoc - 로컬 이미지·PDF 도구',
    desc: '무료 오픈소스 이미지·PDF 도구 모음. 압축, 형식 변환, 크기 조절과 워터마크, PDF→Word, 병합·분할, 이미지→PDF. 모든 처리는 브라우저에서 이루어지며 파일이 업로드되지 않습니다.',
  },
  fr: {
    lang: 'fr',
    title: 'Pixdoc - Outils images et PDF en local',
    desc: "Boîte à outils images et PDF, gratuite et open source : compresser, convertir, redimensionner et filigraner, PDF vers Word, fusionner et scinder, images vers PDF. Tout s'exécute dans votre navigateur ; aucun fichier n'est envoyé.",
  },
  de: {
    lang: 'de',
    title: 'Pixdoc - Lokale Bild- und PDF-Tools',
    desc: 'Kostenloses Open-Source-Toolkit für Bilder und PDFs: komprimieren, konvertieren, skalieren und mit Wasserzeichen versehen, PDF zu Word, zusammenführen und teilen, Bilder zu PDF. Alles läuft im Browser; Dateien werden nie hochgeladen.',
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
