// End-to-end checks for the tablet list layout, the collapsible side nav,
// the History side-card fix, "clear all local data" and the per-image
// progress text. Runs against a built docs/ (served here) in WebKit or
// Chromium with touch, like the iPad report.
//
//   node tests/e2e/tablet-nav-data.mjs [docsDir=docs] [shotsDir]
//   IC_ENGINE=webkit|chromium  IC_CHROME=/path/to/chrome  IC_IMAGES=dir
//
// Needs playwright (or playwright-core with installed browsers) resolvable
// from the working directory. Exit code 1 on any failed check.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(path.join(process.cwd(), 'noop.js'))
let pw
try { pw = require('playwright') } catch { pw = require('playwright-core') }
const [docs = 'docs', shots = ''] = process.argv.slice(2)
const ENGINE = process.env.IC_ENGINE || 'webkit'
const IMG_DIR = process.env.IC_IMAGES || path.join(path.dirname(new URL(import.meta.url).pathname), 'images')
if (shots) fs.mkdirSync(shots, { recursive: true })

let passed = 0
let failed = 0
function check(name, ok, info = '') {
  if (ok) { passed++; console.log('PASS', name) } else { failed++; console.log('FAIL', name, info) }
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0])
  if (p.endsWith('/')) p += 'index.html'
  const f = path.join(docs, p)
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' })
    res.end(d)
  })
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${server.address().port}/`
const NOPROXY = { ...process.env, HTTP_PROXY: '', HTTPS_PROXY: '', http_proxy: '', https_proxy: '', ALL_PROXY: '', all_proxy: '' }
const browserType = ENGINE === 'chromium' ? pw.chromium : pw.webkit
const browser = await browserType.launch({ env: NOPROXY, ...(ENGINE === 'chromium' && process.env.IC_CHROME ? { executablePath: process.env.IC_CHROME } : {}) })

const IMAGES = fs.existsSync(IMG_DIR) ? fs.readdirSync(IMG_DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort().map((f) => path.join(IMG_DIR, f)) : []
if (IMAGES.length < 3) { console.error(`need ≥3 images in ${IMG_DIR}`); process.exit(2) }
const HASH = { compress: '#/', convert: '#/convert', resize: '#/resize', history: '#/history', pdf: '#/pdf-to-word', img2pdf: '#/img-to-pdf', merge: '#/pdf-merge' }

async function newPage({ w, h, touch = true, reduced = false, sw = 'block' }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, serviceWorkers: sw, locale: 'zh-CN', colorScheme: 'dark', reducedMotion: reduced ? 'reduce' : 'no-preference' })
  // Language and theme come from the context (zh-CN, dark), not from
  // seeded storage, so storage checks after "clear data" see only what the
  // app itself writes.
  // Record every text any live status region shows (progress checks).
  await ctx.addInitScript(() => {
    window.__seen = new Set()
    const grab = () => {
      for (const el of document.querySelectorAll('[role="status"], .status-pill, .m-badge, .cv-tag, .rw-tag, .i2p-tag, .pg-tag')) {
        const s = (el.textContent || '').trim()
        if (s) window.__seen.add(s)
      }
    }
    new MutationObserver(grab).observe(document, { subtree: true, childList: true, characterData: true })
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => { failed++; console.log('FAIL pageerror', e.message) })
  return { ctx, page }
}
const seen = (page) => page.evaluate(() => [...window.__seen])

async function loadImages(page, route) {
  const input = route === 'compress' ? '#fileInput' : route === 'convert' ? '#cvFileInput' : 'main input[type=file]'
  await page.waitForSelector(input, { state: 'attached', timeout: 20000 })
  await page.locator(input).first().setInputFiles(IMAGES)
  if (route === 'compress') await page.waitForFunction(() => document.querySelectorAll('#list .item, .masonry-card').length >= 3 && !document.querySelector('.status-pill.processing, .m-progress, .global-loading.show'), null, { timeout: 90000 })
  else if (route === 'convert') await page.waitForFunction(() => document.querySelectorAll('.cv-item.st-done').length >= 3, null, { timeout: 90000 })
  else await page.waitForFunction(() => document.querySelectorAll('.rw-item').length >= 3 && !document.querySelector('.rw-item.st-probing'), null, { timeout: 90000 })
  await page.waitForTimeout(500)
}

const layoutMetrics = (page) => page.evaluate(() => {
  const vis = (el) => !!el && el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden'
  const rows = [...document.querySelectorAll('#list .item, .cv-list .cv-item')].filter(vis).map((r) => {
    const acts = [...r.querySelectorAll('.item-actions > *, .cv-actions.desk > *')].filter(vis)
    const tops = acts.map((a) => Math.round(a.getBoundingClientRect().top))
    const name = r.querySelector('.name, .cv-name')
    const nr = name?.getBoundingClientRect()
    const rr = r.getBoundingClientRect()
    return {
      h: Math.round(rr.height),
      inline: tops.length ? Math.max(...tops) - Math.min(...tops) <= 2 : true,
      nameOneLine: nr ? nr.height < 26 : true,
      inside: [...r.querySelectorAll('*')].filter(vis).every((c) => { const b = c.getBoundingClientRect(); return b.width === 0 || (b.left >= rr.left - 1 && b.right <= rr.right + 1) }),
    }
  })
  return { hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, rows }
})

// IC_ONLY=A,C runs some sections; IC_VP=820x1180,1180x820 narrows section A.
const ONLY = (k) => !process.env.IC_ONLY || process.env.IC_ONLY.split(',').includes(k)
const VP_OK = (w, h) => !process.env.IC_VP || process.env.IC_VP.split(',').includes(`${w}x${h}`)
const IPAD = [[768, 1024], [810, 1080], [820, 1180], [834, 1194], [1024, 1366], [1024, 768], [1080, 810], [1180, 820], [1194, 834], [1366, 1024]]
const OTHER = [[320, 640], [390, 844], [1280, 900], [1440, 900]]

try {
  // ---- A. list layout: compact rows, no overflow ----
  for (const [w, h] of [...IPAD, ...OTHER].filter(([w, h]) => ONLY('A') && VP_OK(w, h))) {
    const tag = `${w}x${h}`
    const { ctx, page } = await newPage({ w, h, touch: w < 1280 || w === 1366 })
    for (const route of ['compress', 'convert']) {
      await page.goto(BASE + HASH[route])
      await loadImages(page, route)
      const m = await layoutMetrics(page)
      check(`${tag} ${route}: no horizontal overflow`, !m.hOverflow)
      if (w >= 720) {
        check(`${tag} ${route}: rows rendered`, m.rows.length >= 3, JSON.stringify(m.rows))
        check(`${tag} ${route}: actions inline`, m.rows.every((r) => r.inline), JSON.stringify(m.rows))
        check(`${tag} ${route}: names on one line`, m.rows.every((r) => r.nameOneLine), JSON.stringify(m.rows))
        check(`${tag} ${route}: nothing spills out of a row`, m.rows.every((r) => r.inside), JSON.stringify(m.rows))
        const limit = route === 'compress' ? 140 : 175
        check(`${tag} ${route}: compact rows (≤${limit}px)`, m.rows.every((r) => r.h <= limit), JSON.stringify(m.rows.map((r) => r.h)))
      }
      if (shots) await page.screenshot({ path: `${shots}/${route}-${tag}.png`, fullPage: true })
    }
    await ctx.close()
  }

  // ---- B. side nav rail ----
  if (ONLY('B')) {
    const { ctx, page } = await newPage({ w: 1180, h: 820 })
    await page.goto(BASE + HASH.compress)
    await page.waitForSelector('#sideNav')
    const navW = () => page.evaluate(() => Math.round(document.querySelector('#sideNav').getBoundingClientRect().width))
    check('1180 touch: rail by default', await page.evaluate(() => document.querySelector('#sideNav').classList.contains('rail')) && (await navW()) <= 72, String(await navW()))
    const labelled = await page.evaluate(() => [...document.querySelectorAll('#sideNav .side-links button')].every((b) => b.getAttribute('aria-label') && b.dataset.tip))
    check('rail: every icon has aria-label + tooltip', labelled)
    await page.locator('#sideNav .side-links button').nth(1).focus()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
    await page.waitForTimeout(300)
    const tipOpacity = await page.evaluate(() => getComputedStyle(document.activeElement, '::after').opacity)
    check('rail: tooltip shows on keyboard focus', tipOpacity === '1', tipOpacity)
    await page.locator('.side-toggle').focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(350)
    check('toggle (keyboard) expands to the full sidebar', (await navW()) >= 200, String(await navW()))
    check('choice stored', (await page.evaluate(() => localStorage.getItem('ic-sidenav'))) === 'full')
    check('expanded: aria-expanded=true', (await page.getAttribute('.side-toggle', 'aria-expanded')) === 'true')
    await page.reload()
    await page.waitForSelector('#sideNav')
    check('choice remembered after reload', (await navW()) >= 200, String(await navW()))
    check('full sidebar shows the tool card', await page.locator('.side-card').isVisible())
    await page.click('.side-toggle')
    check('collapse again stores rail', (await page.evaluate(() => localStorage.getItem('ic-sidenav'))) === 'rail')
    await page.mouse.move(600, 700)
    await page.waitForTimeout(400)
    check('collapsed again to the rail track', (await navW()) <= 72, String(await navW()))
    if (shots) await page.screenshot({ path: `${shots}/rail-1180x820.png` })
    await ctx.close()
  }
  if (ONLY('B')) {
    const { ctx, page } = await newPage({ w: 1440, h: 900, touch: false })
    await page.goto(BASE + HASH.compress)
    await page.waitForSelector('#sideNav')
    const w = await page.evaluate(() => Math.round(document.querySelector('#sideNav').getBoundingClientRect().width))
    check('desktop 1440: expanded by default', w >= 200, String(w))
    check('desktop: no stored choice until the user toggles', (await page.evaluate(() => localStorage.getItem('ic-sidenav'))) === null)
    await ctx.close()
  }
  if (ONLY('B')) {
    const { ctx, page } = await newPage({ w: 820, h: 1180, reduced: true })
    await page.goto(BASE + HASH.compress)
    await page.waitForSelector('#sideNav')
    check('iPad portrait: nav rail present (was hidden)', await page.locator('#sideNav').isVisible())
    check('reduced motion: no layout transition', (await page.evaluate(() => getComputedStyle(document.querySelector('.layout')).transitionDuration)) === '0s')
    await page.click('.side-toggle')
    await page.waitForTimeout(100)
    const ov = await page.evaluate(() => ({ pos: getComputedStyle(document.querySelector('#sideNav .side-inner')).position, w: Math.round(document.querySelector('#sideNav .side-inner').getBoundingClientRect().width), main: Math.round(document.querySelector('.layout > main').getBoundingClientRect().width) }))
    check('portrait expand opens an overlay, not a squeezed column', ov.pos === 'fixed' && ov.w >= 240 && ov.main > 300, JSON.stringify(ov))
    if (shots) await page.screenshot({ path: `${shots}/rail-overlay-820x1180.png` })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(100)
    check('Esc closes the overlay', !(await page.evaluate(() => document.querySelector('#sideNav').classList.contains('overlay'))))
    check('focus returns to the toggle', await page.evaluate(() => document.activeElement?.classList.contains('side-toggle')))
    check('overlay is not persisted', (await page.evaluate(() => localStorage.getItem('ic-sidenav'))) === null)
    await ctx.close()
  }

  // ---- C. tool card only on tool routes ----
  for (const [w, h, touch] of [[1440, 900, false], [1180, 820, true], [820, 1180, true], [390, 844, true]].filter(() => ONLY('C'))) {
    const { ctx, page } = await newPage({ w, h, touch })
    if (w === 1180) await ctx.addInitScript(() => { try { localStorage.setItem('ic-sidenav', 'full') } catch (e) {} })
    for (const route of ['compress', 'convert', 'resize', 'pdf', 'img2pdf', 'merge', 'history']) {
      await page.goto(BASE + HASH[route])
      await page.waitForTimeout(900)
      const cards = await page.evaluate(() => [...document.querySelectorAll('.side-card')].filter((c) => c.getBoundingClientRect().height > 0).length)
      const expect = (w >= 1080 && route !== 'history') ? 1 : 0
      check(`${w}x${h} ${route}: tool card ${expect ? 'shown' : 'hidden'}`, cards === expect, String(cards))
      if (shots && route === 'history') await page.screenshot({ path: `${shots}/history-${w}x${h}.png`, fullPage: true })
    }
    // Going back to a tool after History brings the card back (KeepAlive view).
    await page.goto(BASE + HASH.compress)
    await page.waitForTimeout(500)
    const back = await page.evaluate(() => [...document.querySelectorAll('.side-card')].filter((c) => c.getBoundingClientRect().height > 0).length)
    check(`${w}x${h}: card back on compress after History`, back === (w >= 1080 ? 1 : 0), String(back))
    await ctx.close()
  }

  // ---- D. progress text names the image ----
  if (ONLY('D')) {
    const { ctx, page } = await newPage({ w: 1180, h: 820 })
    await page.goto(BASE + HASH.compress)
    await loadImages(page, 'compress')
    await page.click('#downloadAll')
    await page.waitForTimeout(1500)
    let s = await seen(page)
    const n = IMAGES.length
    check('compress: batch status "正在压缩 第 i/n 张"', s.some((x) => new RegExp(`正在压缩 第 \\d+/${n} 张`).test(x)), s.join(' | '))
    check('compress: row status with index', s.some((x) => new RegExp(`(压缩中|排队中) \\d+/${n}`).test(x)), s.join(' | '))
    check('compress: zip status "打包中 i/n"', s.some((x) => new RegExp(`打包中 \\d+/${n}`).test(x)), s.join(' | '))
    check('compress: no bare spinner text left', !s.some((x) => x === '处理中' || x === '处理中…'), s.join(' | '))
    await page.goto(BASE + HASH.convert)
    await loadImages(page, 'convert')
    s = await seen(page)
    check('convert: batch status "正在转换 第 i/n 张"', s.some((x) => new RegExp(`正在转换 第 \\d+/${n} 张`).test(x)), s.join(' | '))
    check('convert: row status with index', s.some((x) => new RegExp(`(转换中|排队中) \\d+/${n}`).test(x)), s.join(' | '))
    await page.goto(BASE + HASH.resize)
    await loadImages(page, 'resize')
    s = await seen(page)
    check('resize: reading status "读取中 i/n"', s.some((x) => new RegExp(`读取中 \\d+/${n}`).test(x)), s.join(' | '))
    await page.click('.rw-process')
    await page.waitForFunction(() => document.querySelectorAll('.rw-item.st-done').length >= 3, null, { timeout: 90000 })
    s = await seen(page)
    check('resize: batch status "正在处理 第 i/n 张"', s.some((x) => new RegExp(`正在处理 第 \\d+/${n} 张`).test(x)), s.join(' | '))
    check('resize: row status with index', s.some((x) => new RegExp(`(处理中|排队中) \\d+/${n}`).test(x)), s.join(' | '))
    const live = await page.evaluate(() => [...document.querySelectorAll('.batch-status')].every((e) => e.getAttribute('aria-live') === 'polite'))
    check('batch status lines are polite live regions', live)
    await ctx.close()
  }

  // ---- E. clear all local data ----
  for (const variant of ['sidebar', 'history', 'rail'].filter(() => ONLY('E'))) {
    const dims = variant === 'rail' ? { w: 1180, h: 820 } : variant === 'history' ? { w: 390, h: 844 } : { w: 1440, h: 900, touch: false }
    const { ctx, page } = await newPage(dims)
    await page.goto(BASE + HASH.compress)
    await page.waitForSelector('#dropzone')
    // Seed every kind of storage the app (or a library) may use.
    await page.evaluate(async () => {
      localStorage.setItem('ic-history', JSON.stringify([{ n: 'a.jpg', o: 10, c: 5, p: 50, f: 'JPEG', t: Date.now() }]))
      localStorage.setItem('ic-sidenav', 'rail')
      sessionStorage.setItem('scroll:compress', '120')
      await new Promise((res, rej) => {
        const r = indexedDB.open('ic-resize', 1)
        r.onupgradeneeded = () => r.result.createObjectStore('logo')
        r.onsuccess = () => { const db = r.result; const tx = db.transaction('logo', 'readwrite'); tx.objectStore('logo').put({ name: 'logo.png' }, 'current'); tx.oncomplete = () => { db.close(); res() } }
        r.onerror = () => rej(r.error)
      })
      await new Promise((res) => { const r = indexedDB.open('keyval-store', 1); r.onupgradeneeded = () => r.result.createObjectStore('keyval'); r.onsuccess = () => { r.result.close(); res() } })
      if (self.caches) { const c = await caches.open('ic-e2e-cache'); await c.put('/e2e', new Response('x')) }
    })
    if (variant === 'history') {
      await page.goto(BASE + HASH.history)
      await page.waitForSelector('.hist-data button')
      await page.click('.hist-data button')
    } else {
      await page.click('#sideNav .side-clear')
    }
    await page.waitForSelector('.cd-dialog')
    const dlg = await page.evaluate(() => ({ items: document.querySelectorAll('.cd-list li').length, role: document.querySelector('.cd-dialog').getAttribute('role'), focus: document.activeElement?.textContent?.trim() }))
    check(`clear (${variant}): dialog lists what is removed`, dlg.items === 5 && dlg.role === 'alertdialog', JSON.stringify(dlg))
    check(`clear (${variant}): Cancel is focused first`, dlg.focus === '取消', JSON.stringify(dlg))
    if (variant === 'sidebar') {
      await page.keyboard.press('Escape')
      check('clear: Esc cancels without clearing', !(await page.$('.cd-dialog')) && (await page.evaluate(() => localStorage.getItem('ic-history'))) !== null)
      await page.click('#sideNav .side-clear')
      await page.waitForSelector('.cd-dialog')
    }
    if (shots) await page.screenshot({ path: `${shots}/clear-dialog-${variant}.png` })
    await Promise.all([page.waitForEvent('load', { timeout: 30000 }), page.click('.cd-dialog .danger-solid')])
    await page.waitForSelector('.cd-toast', { timeout: 10000 })
    const toast = await page.textContent('.cd-toast')
    check(`clear (${variant}): success toast after reload`, toast.includes('本地数据已全部清除'), toast)
    if (shots) await page.screenshot({ path: `${shots}/clear-toast-${variant}.png` })
    const after = await page.evaluate(async () => ({
      idb: indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : ['(no databases())'],
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
      caches: self.caches ? await caches.keys() : [],
      history: document.querySelectorAll('.hist-list li').length,
    }))
    check(`clear (${variant}): IndexedDB empty`, after.idb.length === 0, JSON.stringify(after))
    check(`clear (${variant}): localStorage empty`, after.local.length === 0, JSON.stringify(after))
    check(`clear (${variant}): sessionStorage empty (toast flag consumed)`, after.session.length === 0, JSON.stringify(after))
    check(`clear (${variant}): Cache Storage empty`, after.caches.length === 0, JSON.stringify(after))
    await ctx.close()
  }
  // With the real service worker: it is unregistered, and the reloaded page
  // registers a fresh one.
  if (ONLY('F')) {
    const { ctx, page } = await newPage({ w: 1440, h: 900, touch: false, sw: 'allow' })
    await page.goto(BASE)
    await page.waitForSelector('#dropzone')
    const ready = await page.evaluate(async () => { if (!('serviceWorker' in navigator)) return 'unsupported'; await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 15000))]); return (await navigator.serviceWorker.getRegistrations()).length })
    if (ready === 'unsupported' || ready === 0) console.log('SKIP service worker check (no SW in this browser/context):', ready)
    else {
      const cachesBefore = await page.evaluate(() => caches.keys())
      await page.click('#sideNav .side-clear')
      await page.waitForSelector('.cd-dialog')
      await Promise.all([page.waitForEvent('load', { timeout: 30000 }), page.click('.cd-dialog .danger-solid')])
      await page.waitForSelector('.cd-toast', { timeout: 10000 })
      check('clear with SW: toast after reload', true)
      const regs = await page.evaluate(async () => { await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 15000))]); return (await navigator.serviceWorker.getRegistrations()).length })
      check('clear with SW: a fresh worker registers again', regs >= 1, `${regs} (caches before: ${cachesBefore.length})`)
    }
    await ctx.close()
  }
} finally {
  await browser.close()
  server.close()
}
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
