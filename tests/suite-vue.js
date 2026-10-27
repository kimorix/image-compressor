// Full self-test suite for the Vue 3 build (served from docs/).
const { chromium } = require('playwright-core');
const fs = require('fs');
const { execSync } = require('child_process');
// Paths are overridable so the suite runs outside the original machine:
// IC_CHROME (browser binary), IC_BASE (served docs/), IC_FIXTURES (dir with
// test.jpg etc., trailing slash). Defaults keep the original setup working.
const EXE = process.env.IC_CHROME || '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = process.env.IC_BASE || 'http://127.0.0.1:8901/';
const T = process.env.IC_FIXTURES || '/home/hatch/workspace/image-compressor/tests/';
let errors = [];
let passed = 0, failed = 0;
function check(name, ok, info = '') {
  if (ok) { passed++; console.log('PASS', name); }
  else { failed++; console.log('FAIL', name, info); }
}
async function newPage(browser, opts = {}) {
  const { presetLang = 'zh', locale = 'zh-CN', colorScheme, viewport } = opts;
  const ctx = await browser.newContext({ locale, colorScheme, viewport });
  if (presetLang) {
    await ctx.addInitScript((l) => { try { localStorage.setItem('ic-lang', l); } catch (e) {} }, presetLang);
  }
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForSelector('#dropzone');
  return page;
}
async function waitDone(page, n, timeout = 30000) {
  // 1.0.4 stat strip: the done cell reads "n/total" and rows carry a
  // processing pill while a run is in flight (same intent as the old
  // "已完成 N 张" summary line: count reached, nothing still running).
  await page.waitForFunction((n) => {
    const doneCell = document.querySelector('#summary .stat-strip .stat .stat-value');
    return !!doneCell && doneCell.textContent.trim().startsWith(n + '/') && !document.querySelector('.status-pill.processing');
  }, n, { timeout });
}
function parseSize(str) {
  const m = str.match(/([\d.]+)\s*(B|KB|MB)/);
  if (!m) return -1;
  const v = parseFloat(m[1]);
  return m[2] === 'B' ? v : m[2] === 'KB' ? v * 1024 : v * 1024 * 1024;
}
async function outSize(page, idx = 0) {
  const txts = await page.$$eval('#list .item .comp-size', (els) => els.map((el) => el.textContent));
  return txts[idx] ? parseSize(txts[idx].trim()) : -1;
}
// Download hrefs change on every successful recompress (fresh blob URL),
// so waiting for them to differ proves the NEW result landed, not the old one.
async function itemHrefs(page) {
  return page.$$eval('.item .item-actions a', (els) => els.map((a) => a.href));
}
async function waitUpdated(page, prev, timeout = 30000) {
  // Wait for SETTLED output, not just the first href change: one trigger
  // can queue two runs (e.g. format change, then keepExif toggle while the
  // first run is still going — the second fires from pendingRecompress).
  // The first run's href is observable mid-sequence now that the Worker
  // leaves the main thread free; resolving on it downloads the stale run.
  // While a recompress is in flight over finished items, the centered
  // "processing" pill is shown, so requiring its absence waits out the
  // trailing run too.
  await page.waitForFunction((prev) => {
    const as = [...document.querySelectorAll('.item .item-actions a')];
    return prev.length > 0 && as.length === prev.length && as.every((a, i) => a.href !== prev[i]) && !document.querySelector('.global-loading.show');
  }, prev, { timeout });
}
async function change(page, fn, timeout = 30000) {
  const prev = await itemHrefs(page);
  await fn();
  await waitUpdated(page, prev, timeout);
}
async function setQuality(page, q) {
  await page.$eval('#quality', (el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, q);
}
async function upload(page, files) {
  await page.setInputFiles('#fileInput', files);
}
// 2.1 settings: scene / format / size are selects, the custom size inputs
// and the advanced checkboxes live behind a dropdown choice / fold.
// pickPreset keeps the old chip semantics: picking the active scene again
// cancels it (back to "Custom").
async function pickPreset(page, id) {
  const cur = await page.$eval('#presetSelect', (el) => el.value);
  await page.selectOption('#presetSelect', cur === id ? '' : id);
}
async function customSize(page) {
  if ((await page.$eval('#sizeSelect', (el) => el.value)) !== 'custom') await page.selectOption('#sizeSelect', 'custom');
}
async function fillMax(page, v) {
  await customSize(page);
  await page.fill('#maxSize', v);
}
async function clickResize(page, mode) {
  await customSize(page);
  await page.click(`#resizeSeg [data-resize="${mode}"]`);
}
async function openAdv(page) {
  if ((await page.getAttribute('.adv-head', 'aria-expanded')) !== 'true') await page.click('.adv-head');
}
async function checkAdv(page, sel, on) {
  await openAdv(page);
  if (on) await page.check(sel); else await page.uncheck(sel);
}
// Switch a page with items to quality mode, waiting out the recompress.
// Fixed WebP too: the old quality mode ran on the WebP default, while the
// 2.1 default format is smart.
async function toQuality(page) {
  await change(page, async () => { await page.selectOption('#formatSelect', 'image/webp'); await page.click('#modeSeg [data-mode=\"quality\"]'); });
}
// Switch before any upload: nothing to recompress, no wait needed.
async function toQualityEmpty(page) {
  await page.selectOption('#formatSelect', 'image/webp');
  await page.click('#modeSeg [data-mode=\"quality\"]');
}
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });

  // 1. 默认 WebP 80% 压缩并可下载
  let page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  const [dl1] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.click('.item .item-actions a'),
  ]);
  check('默认 WebP 80% 压缩并可下载', dl1.suggestedFilename().endsWith('.webp'), dl1.suggestedFilename());
  const tag1 = await page.$eval('.save-pct', (el) => el.textContent.trim()).catch(() => null);
  const best1 = await page.$eval('.best-tag', (el) => el.textContent).catch(() => null);
  check('正常压缩行内有绿色节省百分比、无已是最优徽章', tag1 && tag1.startsWith('−') && best1 === null, `${tag1}/${best1}`);
  await page.close();

  // 2. 全部下载打成一个 zip
  page = await newPage(browser);
  await upload(page, [T + 'test.jpg', T + 'test.png']);
  await waitDone(page, 2);
  const [dlAll] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.click('#downloadAll'),
  ]);
  const zipPath = await dlAll.path();
  const magic = fs.readFileSync(zipPath).subarray(0, 4).toString('latin1');
  check('全部下载打成一个 zip', dlAll.suggestedFilename().endsWith('.zip') && magic === 'PK\x03\x04', dlAll.suggestedFilename() + ' ' + magic);
  await page.close();

  // 3. 滑杆 90/80/60 体积各不相同
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  await toQuality(page);
  const sizes = [];
  for (const q of [90, 80, 60]) {
    await change(page, () => setQuality(page, q));
    sizes.push(await outSize(page));
  }
  check('滑杆 90/80/60 体积各不相同', new Set(sizes).size === 3, sizes.join(','));
  // 4. 滑杆 40% 比 60% 更小
  await change(page, () => setQuality(page, 40));
  const s40 = await outSize(page);
  check('滑杆 40% 比 60% 更小', s40 < sizes[2], `${s40} vs ${sizes[2]}`);
  await page.close();

  // 5. 切 JPEG 后下载后缀为 .jpg
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  await toQuality(page);
  await change(page, () => page.selectOption('#formatSelect', 'image/jpeg'));
  const [dlJ] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.click('.item .item-actions a'),
  ]);
  check('切 JPEG 后下载后缀为 .jpg', dlJ.suggestedFilename().endsWith('.jpg'), dlJ.suggestedFilename());
  await page.close();

  // 6. 切 PNG 后下载后缀为 .png（缩小尺寸后 PNG 一定比原图小，不触发已是最优）
  page = await newPage(browser);
  await upload(page, T + 'test.png');
  await waitDone(page, 1);
  await toQuality(page);
  await change(page, () => fillMax(page, '800'));
  await change(page, () => page.selectOption('#formatSelect', 'image/png'));
  const [dlP] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.click('.item .item-actions a'),
  ]);
  check('切 PNG 后下载后缀为 .png', dlP.suggestedFilename().endsWith('.png'), dlP.suggestedFilename());
  await page.close();

  // 7. 最长边 800 缩放尺寸正确（尺寸详情在预览里，不在行上）
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  await change(page, () => fillMax(page, '800'));
  await page.click('.item .thumb');
  await page.waitForSelector('.lb-overlay', { timeout: 10000 });
  const dims = await page.$eval('.lb-info', (el) => el.textContent);
  check('最长边 800 缩放尺寸正确', dims.includes('1600×1200 → 800×600'), dims);
  await page.close();

  // 8. 目标 200KB 达标且有自动质量提示（提示在灯箱详情里，不在行上）
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  await change(page, () => page.click('#modeSeg [data-mode=\"target\"]'));
  const t200 = await outSize(page);
  await page.click('.item .thumb');
  await page.waitForSelector('.lb-overlay', { timeout: 10000 });
  const note200 = await page.$eval('.lb-info', (el) => el.textContent);
  check('目标 200KB 达标且有自动提示', t200 <= 200 * 1024 && /自动|已是/.test(note200), `${t200}`);
  await page.close();

  // 9. 目标输入框打字即重压（无需 blur）
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  await change(page, () => page.click('#modeSeg [data-mode=\"target\"]'));
  const before = await outSize(page);
  await change(page, () => page.fill('#targetSize', '100'));
  const after = await outSize(page);
  check('目标输入框打字即重压（无需 blur）', after <= 100 * 1024 && after !== before, `${before} -> ${after}`);
  await page.close();

  // 10. 目标过大时提示已是最高画质（提示在灯箱详情里）
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  await change(page, () => page.click('#modeSeg [data-mode=\"target\"]'));
  await change(page, () => page.fill('#targetSize', '51200'));
  await page.click('.item .thumb');
  await page.waitForSelector('.lb-overlay', { timeout: 10000 });
  const noteBig = await page.$eval('.lb-info', (el) => el.textContent);
  check('目标过大时提示已是最高画质', noteBig.includes('已是最高画质') || noteBig.includes('已是最优') || noteBig.includes('无需压缩'), noteBig.slice(0, 60));
  await page.close();

  // 11. 目标 10KB 有尺寸回退或最小提示（提示在灯箱详情里）
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  await change(page, () => page.click('#modeSeg [data-mode=\"target\"]'));
  await change(page, () => page.fill('#targetSize', '10'));
  await page.click('.item .thumb');
  await page.waitForSelector('.lb-overlay', { timeout: 10000 });
  const note10 = await page.$eval('.lb-info', (el) => el.textContent);
  check('目标 10KB 有尺寸回退或最小提示', /自动尺寸|已缩到最小/.test(note10), note10.slice(0, 60));
  await page.close();

  // 12. PNG 输出目标模式尺寸回退且达标（提示在灯箱详情里）
  page = await newPage(browser);
  await upload(page, T + 'test.png');
  await waitDone(page, 1);
  await toQuality(page);
  await change(page, () => page.selectOption('#formatSelect', 'image/png'));
  await change(page, () => page.click('#modeSeg [data-mode=\"target\"]'), 120000);
  await change(page, () => page.fill('#targetSize', '50'), 120000);
  const pngT = await outSize(page);
  await page.click('.item .thumb');
  await page.waitForSelector('.lb-overlay', { timeout: 10000 });
  const notePng = await page.$eval('.lb-info', (el) => el.textContent);
  check('PNG 输出目标模式尺寸回退且达标', /自动尺寸/.test(notePng) && pngT <= 50 * 1024, `${pngT}`);
  await page.close();

  // 13. 批量 2 张全部完成
  page = await newPage(browser);
  await upload(page, [T + 'test.jpg', T + 'test.png']);
  await waitDone(page, 2);
  const count2 = await page.$$eval('.item', (els) => els.length);
  check('批量 2 张全部完成', count2 === 2, String(count2));
  // 14. 移除单张后剩 1 张
  await page.click('.item:nth-child(2) .remove-btn');
  await page.waitForTimeout(500);
  const count1 = await page.$$eval('.item', (els) => els.length);
  check('移除单张后剩 1 张', count1 === 1, String(count1));
  // 15. 清空需二次确认：第一次只变确认态，第二次才清空
  await page.click('#clearAll');
  const clearText1 = await page.$eval('#clearAll', (el) => el.textContent);
  const stillVis = await page.isVisible('#resultCard');
  await page.click('#clearAll');
  await page.waitForTimeout(500);
  const vis = await page.isVisible('#resultCard');
  const dlDis = await page.$eval('#downloadAll', (b) => b.disabled);
  check('清空二次确认后列表隐藏且下载按钮禁用', clearText1.includes('确认清空') && stillVis && !vis && dlDis, `${clearText1} visible=${vis} disabled=${dlDis}`);
  await page.close();

  // 16. 点缩略图开预览：灯箱默认显示压缩图、带 50% 分界，拖动改 clip，
  // 关闭后行顶层图不变、角标仍无、其他行未重建（清单第 9 条：原图/压缩图
  // 切换按钮已由对比滑块取代，灯箱不再翻转行的视图）
  // clip 百分比解析：拖动落点有亚像素浮点 dust，不能按字符串精确匹配。
  const clipPct = (s) => { const m = /inset\([^ ]+ ([0-9.]+)%/.exec(s || ''); return m ? parseFloat(m[1]) : -1; };
  page = await newPage(browser);
  await upload(page, [T + 'test.jpg', T + 'test.png']);
  await waitDone(page, 2);
  await page.evaluate(() => { window.__row2 = document.querySelectorAll('.item')[1]; });
  const topBefore = await page.$eval('.item:nth-child(1) .layer.top', (el) => el.currentSrc);
  const tagBefore = await page.$eval('.item:nth-child(1) .tag', (el) => el.textContent).catch(() => null);
  await page.click('.item:nth-child(1) .thumb');
  await page.waitForSelector('.lb-overlay', { timeout: 10000 });
  await page.waitForFunction(() => {
    const img = document.querySelector('.lb-compare > .lb-img');
    return img && img.currentSrc.startsWith('blob:');
  }, { timeout: 10000 });
  const lbComp = await page.$eval('.lb-compare > .lb-img', (el) => el.currentSrc);
  const clipBefore = await page.$eval('.lb-orig-clip', (el) => el.style.clipPath);
  const hasDivider = (await page.$('.lb-divider')) !== null;
  const cmp = await page.$eval('.lb-compare', (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.mouse.move(cmp.x + cmp.w * 0.5, cmp.y + cmp.h / 2);
  await page.mouse.down();
  await page.mouse.move(cmp.x + cmp.w * 0.75, cmp.y + cmp.h / 2, { steps: 5 });
  await page.mouse.up();
  await page.waitForFunction((prev) => document.querySelector('.lb-orig-clip').style.clipPath !== prev, clipBefore, { timeout: 5000 });
  const clipAfter = await page.$eval('.lb-orig-clip', (el) => el.style.clipPath);
  await page.click('.lb-close');
  await page.waitForTimeout(300);
  const topAfter = await page.$eval('.item:nth-child(1) .layer.top', (el) => el.currentSrc);
  const tagAfter = await page.$eval('.item:nth-child(1) .tag', (el) => el.textContent).catch(() => null);
  const row2Same = await page.evaluate(() => document.querySelectorAll('.item')[1] === window.__row2);
  check('灯箱对比滑块：默认压缩图、分界 50%、拖动改 clip、关闭后行未变', lbComp.startsWith('blob:') && hasDivider && clipPct(clipBefore) === 50 && clipPct(clipAfter) >= 20 && clipPct(clipAfter) <= 30 && topBefore === topAfter && tagBefore === null && tagAfter === null && row2Same, `${clipBefore}->${clipAfter} topSame=${topBefore === topAfter} tag=${tagBefore}/${tagAfter} row2Same=${row2Same}`);
  // 17. 行顶层图在压缩完成后不透明（crossfade 已完成）
  await page.waitForTimeout(700);
  const op = await page.$eval('.item:nth-child(1) .layer.top', (el) => getComputedStyle(el).opacity);
  check('行顶层图不透明', op === '1', op);
  // 18. 灯箱内快速拖动分界后图片仍正常显示
  await page.click('.item:nth-child(1) .thumb');
  await page.waitForSelector('.lb-overlay', { timeout: 10000 });
  const cmp2 = await page.$eval('.lb-compare', (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  // Each drag must start on the divider's CURRENT position, not 50%.
  let curPos = 0.5;
  for (const frac of [0.25, 0.75, 0.5]) {
    await page.mouse.move(cmp2.x + cmp2.w * curPos, cmp2.y + cmp2.h / 2);
    await page.mouse.down();
    await page.mouse.move(cmp2.x + cmp2.w * frac, cmp2.y + cmp2.h / 2, { steps: 3 });
    await page.mouse.up();
    curPos = frac;
  }
  await page.waitForTimeout(300);
  const src2 = await page.$eval('.lb-compare > .lb-img', (el) => el.currentSrc);
  const clipFinal = await page.$eval('.lb-orig-clip', (el) => el.style.clipPath);
  check('灯箱快速拖动分界后图片仍正常显示', src2.startsWith('blob:') && Math.abs(clipPct(clipFinal) - 50) < 2, `${src2.slice(0, 20)} ${clipFinal}`);
  await page.click('.lb-close');
  await page.waitForTimeout(300);
  const lbGone = await page.$eval('.lb-overlay', () => false).catch(() => true);
  check('点关闭后灯箱消失', lbGone, '');
  await page.close();

  // 19-23. 行操作：下载图标 + 移除图标、无预览按钮、角标只在原图时出现、提示只在汇总下出现一次、图标可移除
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  const acts = await page.$$eval('.item-actions > *', (els) => els.map((e) => ({
    tag: e.tagName,
    text: (e.textContent || '').trim(),
    svg: !!e.querySelector('svg'),
  })));
  check('行按钮：复制图标 + 下载图标 + 移除图标，无文字按钮', acts.length === 3 && acts[0].tag === 'BUTTON' && acts[0].svg && acts[0].text === '' && acts[1].tag === 'A' && acts[1].svg && acts[1].text === '' && acts[2].tag === 'BUTTON' && acts[2].svg && acts[2].text === '', JSON.stringify(acts));
  const tagDefault = await page.$eval('.item .tag', (el) => el.textContent).catch(() => null);
  check('默认压缩后视图无角标', tagDefault === null, String(tagDefault));
  const hintInItems = await page.$$eval('.item .hint', (els) => els.length);
  const hintOnce = await page.$$eval('#summary .list-hint', (els) => els.length);
  check('预览提示只在汇总下方出现一次', hintInItems === 0 && hintOnce === 1, `${hintInItems}/${hintOnce}`);
  await page.$eval('.item .thumb', (el) => el.click());
  await page.waitForSelector('.lb-overlay', { timeout: 10000 });
  const hasSlider = (await page.$('.lb-divider')) !== null;
  const sideTags = await page.$$eval('.lb-side-tag', (els) => els.map((e) => e.textContent));
  await page.click('.lb-close');
  await page.waitForTimeout(300);
  const tagAfterLb = await page.$eval('.item .tag', (el) => el.textContent).catch(() => null);
  check('灯箱对比滑块带原图/压缩后侧标、行上无角标', hasSlider && sideTags.includes('原图') && sideTags.includes('压缩后') && tagAfterLb === null, `${sideTags.join('/')} tag=${tagAfterLb}`);
  await page.waitForTimeout(300);
  await page.click('.item .remove-btn');
  await page.waitForTimeout(500);
  const rowCount = await page.$$eval('.item', (els) => els.length);
  check('移除图标按钮可移除单张', rowCount === 0, String(rowCount));
  await page.close();

  // 24-25. 进度条
  page = await newPage(browser);
  const files8 = Array(8).fill(T + 'test.jpg');
  await upload(page, files8);
  let seenProgress = false;
  for (let i = 0; i < 100 && !seenProgress; i++) {
    seenProgress = await page.evaluate(() => {
      const el = document.querySelector('#progress');
      return !!el && getComputedStyle(el).display !== 'none' && /正在处理 \d+\/8 张/.test(el.textContent || '');
    });
    if (!seenProgress) await page.waitForTimeout(50);
  }
  check('处理中进度条出现并显示张数', seenProgress, '');
  await waitDone(page, 8);
  const progHidden = await page.evaluate(() => {
    const el = document.querySelector('#progress');
    return !el || getComputedStyle(el).display === 'none';
  });
  check('全部完成后进度条隐藏', progHidden, '');
  await page.close();

  // 26-27. 长文件名截短
  page = await newPage(browser);
  await upload(page, T + 'dji_20251026143022_grassland_photo.jpg');
  await waitDone(page, 1);
  const shownName = await page.$eval('.item .name', (el) => el.textContent);
  const fullTitle = await page.$eval('.item .name', (el) => el.title);
  check('长文件名截短显示且保留扩展名', shownName.includes('…') && shownName.endsWith('.jpg') && shownName.length < fullTitle.length, shownName);
  check('完整文件名在 title 里', fullTitle === 'dji_20251026143022_grassland_photo.jpg', fullTitle);
  await page.close();

  // 28. 移动端移除按钮保持 44px 触摸区
  page = await newPage(browser, { viewport: { width: 390, height: 844 } });
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  const rmBox = await page.$eval('.item .remove-btn', (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  check('移动端移除按钮 44px 触摸区', rmBox[0] >= 44 && rmBox[1] >= 44, JSON.stringify(rmBox));
  await page.close();

  // 29-32. 主题
  page = await newPage(browser, { colorScheme: 'dark' });
  const theme0 = await page.evaluate(() => document.documentElement.dataset.theme);
  check('跟随系统深色时默认黑夜', theme0 === 'dark', theme0);
  const themeBtnText = await page.$eval('#themeBtn', (el) => el.textContent.trim());
  check('主题按钮只有图标无文字', themeBtnText === '', themeBtnText);
  await page.click('#themeBtn');
  const theme1 = await page.evaluate(() => document.documentElement.dataset.theme);
  const stored1 = await page.evaluate(() => localStorage.getItem('ic-theme'));
  check('点切换后变白天并记住选择', theme1 === 'light' && stored1 === 'light', `${theme1}/${stored1}`);
  await page.reload();
  await page.waitForSelector('#dropzone');
  const theme2 = await page.evaluate(() => document.documentElement.dataset.theme);
  check('刷新后记住上次的白天模式', theme2 === 'light', theme2);
  await page.click('#themeBtn');
  const theme3 = await page.evaluate(() => document.documentElement.dataset.theme);
  check('再点切回黑夜', theme3 === 'dark', theme3);
  await page.close();

  // 33. 语言下拉：6 个选项
  page = await newPage(browser);
  const opts = await page.$$eval('#langSelect option', (els) => els.map((o) => o.value + '=' + o.textContent));
  check('语言下拉有 6 个选项', JSON.stringify(opts) === JSON.stringify(['zh=中文', 'en=English', 'ja=日本語', 'ko=한국어', 'fr=Français', 'de=Deutsch']), opts.join(','));
  // 34. 下拉切日语并记住
  await page.selectOption('#langSelect', 'ja');
  await page.waitForTimeout(300);
  const jaTitle = await page.title();
  const jaStored = await page.evaluate(() => localStorage.getItem('ic-lang'));
  check('下拉切日语并记住', jaTitle.includes('画像圧縮') && jaStored === 'ja', `${jaTitle}/${jaStored}`);
  await page.close();
  // 35. 保存的日语偏好下次打开仍生效
  page = await newPage(browser, { presetLang: 'ja' });
  const jaTitle2 = await page.title();
  check('保存的日语偏好下次打开仍生效', jaTitle2.includes('画像圧縮'), jaTitle2);
  await page.close();
  // 36. 浏览器语言决定默认语言（日/德/英/中）
  for (const [locale, expect] of [['ja-JP', '画像圧縮'], ['de-DE', 'Bildkomprimierung'], ['en-US', 'Image Compressor'], ['zh-CN', '图片压缩']]) {
    page = await newPage(browser, { presetLang: null, locale });
    const t = await page.title();
    check(`浏览器 ${locale} 时默认 ${expect}`, t.includes(expect), t);
    await page.close();
  }

  // 37. 模块顺序：主列上传 → 结果，右侧栏设置 → 预览；操作按钮在结果卡片最底部
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  const mainOrder = await page.$$eval('main > .card', (els) => els.map((el) => el.id));
  const panelOrder = await page.$$eval('#rightPanel > .card', (els) => els.map((el) => el.id));
  check('模块顺序：主列上传 → 结果，右侧栏设置 → 预览', JSON.stringify(mainOrder) === JSON.stringify(['uploadCard', 'resultCard']) && JSON.stringify(panelOrder) === JSON.stringify(['settingsCard', 'previewCard']), mainOrder.join(',') + ' / ' + panelOrder.join(','));
  const rcOrder = await page.evaluate(() => [...document.querySelector('#resultCard').children].map((c) => c.id || c.className));
  check('结果标题与操作在汇总上方', JSON.stringify(rcOrder) === JSON.stringify(['progress', 'result-head', 'summary', 'list']), rcOrder.join(','));
  // 38. GitHub 按钮只显示 GitHub；39. 页脚无开源项目行
  const ghText = await page.$eval('a[href="https://github.com/kimorix/image-compressor"]', (el) => el.textContent);
  check('GitHub 按钮只显示 GitHub', ghText === 'GitHub ↗', ghText);
  const footerText = await page.$eval('footer', (el) => el.textContent);
  check('页脚已删开源项目一行', !footerText.includes('开源项目') && !footerText.includes('github.com/kimorix'), footerText.slice(0, 40));
  // 40. 目标模式隐藏质量行；PNG 量化开时滑杆可用、关时锁定
  await page.click('#modeSeg [data-mode=\"target\"]');
  const qHidden = await page.evaluate(() => getComputedStyle(document.querySelector('#qualityField')).display === 'none');
  check('目标模式隐藏质量行', qHidden, '');
  await page.click('#modeSeg [data-mode=\"quality\"]');
  await page.selectOption('#formatSelect', 'image/png');
  const qEnabled = await page.$eval('#quality', (el) => !el.disabled);
  check('PNG 量化开时滑杆可用', qEnabled, `enabled=${qEnabled}`);
  await page.$eval('#quantize', (el) => el.click());
  const qDisabled = await page.$eval('#quality', (el) => el.disabled);
  const hintVis = await page.evaluate(() => (document.querySelector('#settingsNote')?.textContent || '').includes('无损'));
  check('PNG 量化关时滑杆锁定且有无损提示', qDisabled && hintVis, `disabled=${qDisabled} hint=${hintVis}`);
  await page.close();

  // 40b. 输出永不大于原图：小图要么正常压小、要么走已是最优（分支随编码器而定，
  // 不硬编码）；已是最优分支由 40g（PNG 无损）显式覆盖。
  page = await newPage(browser);
  await upload(page, T + 'tiny.jpg');
  await waitDone(page, 1);
  const bestOrig = await page.$eval('.item .orig-size', (el) => el.textContent);
  const bestComp = await page.$eval('.item .comp-size', (el) => el.textContent);
  const so = parseSize(bestOrig.trim());
  const sc = parseSize(bestComp.trim());
  const [dlBest] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.click('.item .item-actions a'),
  ]);
  check('小图输出不大于原图且可下载', sc <= so && /\.(jpg|webp)$/.test(dlBest.suggestedFilename()), bestOrig + ' → ' + bestComp + ' ' + dlBest.suggestedFilename());
  await page.close();

  // 40c. 不放大开关是真的：勾选不放大，取消则放大到最长边（尺寸在预览里读）
  page = await newPage(browser);
  await upload(page, T + 'small.jpg');
  await waitDone(page, 1);
  await change(page, () => fillMax(page, '800'));
  await page.click('.item .thumb');
  await page.waitForSelector('.lb-overlay', { timeout: 10000 });
  const dimsChecked = await page.$eval('.lb-info', (el) => el.textContent);
  await change(page, () => page.$eval('#noUpscale', (el) => el.click()));
  const dimsUnchecked = await page.$eval('.lb-info', (el) => el.textContent);
  check('不放大开关是真的', dimsChecked.includes('400×300') && !dimsChecked.includes('→') && dimsUnchecked.includes('400×300 → 800×600'), `${dimsChecked} / ${dimsUnchecked}`);
  await page.close();

  // 40d. 质量滑块防抖：快速连拖只按最后的值重压一次
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  await change(page, async () => {
    await setQuality(page, 90);
    await setQuality(page, 80);
    await setQuality(page, 60);
  });
  const rapidSize = await outSize(page);
  await page.close();
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  await change(page, () => setQuality(page, 60));
  const refSize = await outSize(page);
  check('质量滑块防抖：连拖后结果等于直接设 60%', rapidSize === refSize, `${rapidSize} vs ${refSize}`);
  await page.close();

  // 40e. 20 张批量全部完成（并发池不死锁）
  page = await newPage(browser);
  await upload(page, Array(20).fill(T + 'test.jpg'));
  await waitDone(page, 20, 90000);
  const count20 = await page.$$eval('.item', (els) => els.length);
  check('20 张批量全部完成', count20 === 20, String(count20));
  await page.close();

  // 40f. AVIF 输出：后缀 .avif 且为真 AVIF（ftypavif）
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  await toQuality(page);
  await change(page, () => page.selectOption('#formatSelect', 'image/avif'));
  const [dlAvif] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.click('.item .item-actions a'),
  ]);
  const avifBuf = fs.readFileSync(await dlAvif.path());
  check('AVIF 输出为真 AVIF', dlAvif.suggestedFilename().endsWith('.avif') && avifBuf.subarray(4, 12).toString('latin1') === 'ftypavif', dlAvif.suggestedFilename() + ' ' + avifBuf.length);
  await page.close();

  // 40g. PNG 量化：截图类图片量化后更小；关掉量化则回到无损（已是最优）
  page = await newPage(browser);
  await upload(page, T + 'screenshot.png');
  await waitDone(page, 1);
  await toQuality(page);
  await change(page, () => page.selectOption('#formatSelect', 'image/png'));
  const [dlQ] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.click('.item .item-actions a'),
  ]);
  const qSize = fs.statSync(await dlQ.path()).size;
  check('PNG 量化后比原图小', dlQ.suggestedFilename() === 'screenshot-compressed.png' && qSize < 9310, dlQ.suggestedFilename() + ' ' + qSize);
  await change(page, () => page.$eval('#quantize', (el) => el.click()));
  const qText = await page.$eval('.item', (el) => el.textContent);
  check('关掉量化后 PNG 回到无损（已是最优）', qText.includes('无需压缩'), qText.slice(0, 60));
  const bestTag = await page.$eval('.best-tag', (el) => el.textContent).catch(() => null);
  const bestColor = await page.$eval('.best-tag', (el) => getComputedStyle(el).color).catch(() => '');
  check('已是最优显示为灰色徽章（0% 不用绿色）', bestTag === '无需压缩' && bestColor === 'rgb(107, 114, 128)', `${bestTag}/${bestColor}`);
  const dlNote = await page.$eval('.dl-note', (el) => el.textContent).catch(() => null);
  check('全部未压缩时提示将保留原图', dlNote === '1 张未压缩，将保留原图', String(dlNote));
  await page.close();

  // 40h. HEIC 输入：iPhone 照片能解码并转 WebP
  page = await newPage(browser);
  await upload(page, T + 'sample.heic');
  await waitDone(page, 1);
  const [dlH] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.click('.item .item-actions a'),
  ]);
  const hBuf = fs.readFileSync(await dlH.path());
  check('HEIC 转 WebP 成功', dlH.suggestedFilename() === 'sample-compressed.webp' && hBuf.subarray(0, 4).toString('latin1') === 'RIFF' && hBuf.subarray(8, 12).toString('latin1') === 'WEBP', dlH.suggestedFilename() + ' ' + hBuf.length);
  await page.close();

  // 41. 移动端结果卡片布局
  page = await newPage(browser, { viewport: { width: 390, height: 844 } });
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  const itemDisplay = await page.$eval('.item', (el) => getComputedStyle(el).display);
  const thumbW = await page.$eval('.thumb', (el) => getComputedStyle(el).width);
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth <= 390);
  check('移动端结果卡片为 grid 布局、缩略图 84px、无横向溢出', itemDisplay === 'grid' && thumbW === '84px' && overflowX, `${itemDisplay}/${thumbW}/${overflowX}`);
  await page.close();

  // 42a. 模拟 Safari（canvas 禁 WebP）：WASM 照样出 WebP，不再回退 JPEG
  {
    const ctx = await browser.newContext({ locale: 'zh-CN' });
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (cb, type, q) {
        if (type === 'image/webp') return orig.call(this, cb, 'image/png');
        return orig.call(this, cb, type, q);
      };
    });
    await ctx.addInitScript(() => { try { localStorage.setItem('ic-lang', 'zh'); } catch (e) {} });
    page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(BASE);
    await page.waitForSelector('#dropzone');
    await upload(page, T + 'test.jpg');
    await waitDone(page, 1);
    const [dlS] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      page.click('.item .item-actions a'),
    ]);
    const itemText = await page.$eval('.item', (el) => el.textContent);
    check('模拟 Safari：canvas 禁 WebP 时 WASM 照样出 WebP', dlS.suggestedFilename().endsWith('.webp') && !itemText.includes('已自动改用 JPEG'), dlS.suggestedFilename());
    await toQuality(page);
    const sSizes = [];
    for (const q of [90, 80, 60]) {
      await change(page, () => setQuality(page, q));
      sSizes.push(await outSize(page));
    }
    check('模拟 Safari：滑杆 90/80/60 体积各不相同', new Set(sSizes).size === 3, sSizes.join(','));
    await change(page, () => page.click('#modeSeg [data-mode=\"target\"]'));
      const sT = await outSize(page);
    check('模拟 Safari：目标 200KB 达标', sT <= 200 * 1024, String(sT));
    await page.close();
    await ctx.close();
  }

  // 42b. canvas 和 WASM 双禁时才回退 JPEG 并提示
  // SW 的 lazy-assets CacheFirst 会接管 wasm 请求（SW 自己发网络请求，
  // 页面的 route 拦不住），接管时序一变结果就变：这个上下文直接屏蔽 SW，
  // 让 wasm 每次都直走网络被 route 拦住，回退才是确定性的。
  {
    const ctx = await browser.newContext({ locale: 'zh-CN', serviceWorkers: 'block' });
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (cb, type, q) {
        if (type === 'image/webp') return orig.call(this, cb, 'image/png');
        return orig.call(this, cb, type, q);
      };
    });
    await ctx.addInitScript(() => { try { localStorage.setItem('ic-lang', 'zh'); } catch (e) {} });
    page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*.wasm', (route) => route.abort());
    await page.goto(BASE);
    await page.waitForSelector('#dropzone');
    await upload(page, T + 'test.jpg');
    await waitDone(page, 1);
    const [dlS] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      page.click('.item .item-actions a'),
    ]);
    await page.click('.item .thumb');
    await page.waitForSelector('.lb-overlay', { timeout: 10000 });
    const lbNote = await page.$eval('.lb-info', (el) => el.textContent);
    check('双禁时 WebP 回退 JPEG 并提示', dlS.suggestedFilename().endsWith('.jpg') && lbNote.includes('已自动改用 JPEG'), dlS.suggestedFilename());
    await page.close();
    await ctx.close();
  }

  // 43a. 桌面端：第三块右侧栏固定在主列右侧，设置在上、预览在下
  page = await newPage(browser, { viewport: { width: 1100, height: 900 } });
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  const boxes = await page.$$eval('#uploadCard, #resultCard, #rightPanel, #settingsCard, #previewCard', (els) => {
    const r = {};
    for (const el of els) { const b = el.getBoundingClientRect(); r[el.id] = [Math.round(b.top), Math.round(b.left)]; }
    return r;
  });
  const mOrder43 = await page.$$eval('main > .card', (els) => els.map((el) => el.id));
  const pOrder43 = await page.$$eval('#rightPanel > .card', (els) => els.map((el) => el.id));
  check('桌面端第三块右侧栏：设置＋预览在主列右侧、预览在设置下方', boxes.rightPanel[1] > boxes.resultCard[1] && boxes.settingsCard[1] === boxes.rightPanel[1] && boxes.previewCard[0] > boxes.settingsCard[0] && boxes.previewCard[1] === boxes.rightPanel[1] && JSON.stringify(mOrder43) === JSON.stringify(['uploadCard', 'resultCard']) && JSON.stringify(pOrder43) === JSON.stringify(['settingsCard', 'previewCard']), JSON.stringify(boxes));
  const panelPos = await page.$eval('#rightPanel', (el) => getComputedStyle(el).position);
  check('右侧栏 position fixed', panelPos === 'fixed', panelPos);
  // 43b. 总计大数字 + 每项行内绿色百分比
  const bigText = await page.$eval('#summary .sum-big', (el) => el.textContent).catch(() => null);
  const saveTag = await page.$eval('.save-pct', (el) => el.textContent.trim()).catch(() => null);
  check('总计大数字为纯百分比与每项行内绿色百分比', bigText && /^−\d+%$/.test(bigText) && saveTag && saveTag.startsWith('−'), `${bigText}/${saveTag}`);
  await page.close();
  // 43c. 移动端粘贴提示不提 Ctrl+V
  {
    const ctxM = await browser.newContext({ locale: 'zh-CN', viewport: { width: 390, height: 844 } });
    await ctxM.addInitScript(() => { try { localStorage.setItem('ic-lang', 'zh'); } catch (e) {} });
    await ctxM.addInitScript(() => {
      const orig = window.matchMedia;
      window.matchMedia = (q) => (q === '(pointer: coarse)' ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : orig(q));
    });
    const pm = await ctxM.newPage();
    pm.on('pageerror', (e) => errors.push(e.message));
    await pm.goto(BASE);
    await pm.waitForSelector('#dropzone');
    const dropSubM = await pm.$eval('#dropzone p', (el) => el.textContent);
    check('移动端粘贴提示不提 Ctrl+V', !dropSubM.includes('Ctrl+V') && dropSubM.includes('粘贴图片'), dropSubM);
    await pm.close();
    await ctxM.close();
  }
  // 43d. 桌面端粘贴提示保留 Ctrl+V
  page = await newPage(browser);
  const dropSubD = await page.$eval('#dropzone p', (el) => el.textContent);
  check('桌面端粘贴提示保留 Ctrl+V', dropSubD.includes('Ctrl+V'), dropSubD);
  await page.close();

  // 44a. 不放大：默认勾选、小图不放大；取消勾选后放大且预览尺寸行变警示色
  page = await newPage(browser);
  const noUpDefault = await page.$eval('#noUpscale', (el) => el.checked);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  await page.click('.item .thumb');
  await page.waitForSelector('.lb-overlay', { timeout: 10000 });
  const dimsDefault = await page.$eval('.lb-info', (el) => el.textContent);
  await change(page, () => page.$eval('#noUpscale', (el) => el.click()));
  const dimsUp = await page.$eval('.lb-info', (el) => el.textContent);
  const dimsWarn = await page.$eval('.lb-info span', (el) => el.className);
  check('不放大默认勾选且小图不放大，取消后放大并警示', noUpDefault === true && dimsDefault.includes('尺寸未变') && dimsUp.includes('1920×1440') && dimsWarn.includes('warn'), `${noUpDefault}/${dimsDefault}/${dimsUp}/${dimsWarn}`);
  await page.close();
  // 44b. 开关量化不顶动最长边输入框
  page = await newPage(browser);
  await upload(page, T + 'screenshot.png');
  await waitDone(page, 1);
  await toQuality(page);
  await change(page, () => page.selectOption('#formatSelect', 'image/png'));
  const maxTop0 = await page.$eval('#maxSize', (el) => el.getBoundingClientRect().top);
  await page.$eval('#quantize', (el) => el.click());
  await page.waitForTimeout(800);
  const maxTop1 = await page.$eval('#maxSize', (el) => el.getBoundingClientRect().top);
  check('开关量化不顶动最长边输入框', maxTop0 === maxTop1, `${maxTop0}/${maxTop1}`);
  await page.close();
  // 44c. 质量标签：名称在左、数值在右（统一样式）
  page = await newPage(browser);
  const qLabelStyle = await page.$eval('.field label.qlabel', (el) => { const cs = getComputedStyle(el); return cs.display + '/' + cs.justifyContent; });
  const qVal = await page.$eval('#qualityValue', (el) => el.textContent);
  check('质量标签左右分栏、数值在右', qLabelStyle === 'flex/space-between' && qVal === '80%', `${qLabelStyle}/${qVal}`);
  await page.close();

  // 44d. 预设一键场景：证件照 / 微信发图 / 公众号配图
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  await change(page, () => pickPreset(page, 'idphoto'));
  const idMode = await page.$eval('#modeSeg .seg-btn.active', (el) => el.dataset.mode);
  const idTarget = await page.$eval('#targetSize', (el) => el.value);
  const idFmt = await page.$eval('#formatSelect', (el) => el.value);
  const idActive = await page.$eval('#presetSelect', (el) => (el.value === 'idphoto' ? 'active' : ''));
  check('证件照预设：目标模式 200KB JPEG 且高亮', idMode === 'target' && idTarget === '200' && idFmt === 'image/jpeg' && idActive.includes('active'), `${idMode}/${idTarget}/${idFmt}/${idActive}`);
  await change(page, () => pickPreset(page, 'wechat'));
  const wcQ = await page.$eval('#quality', (el) => el.value);
  const wcMax = await page.$eval('#maxSize', (el) => el.value);
  check('微信发图预设：质量 85 最长边 1920', wcQ === '85' && wcMax === '1920', `${wcQ}/${wcMax}`);
  await change(page, () => pickPreset(page, 'article'));
  const arMax = await page.$eval('#maxSize', (el) => el.value);
  check('公众号配图预设：最长边 900', arMax === '900', arMax);
  await page.close();
  // 44e. 再点已选预设取消还原：回到应用前的设置并重压；手动改参数后高亮自动消失
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  await change(page, () => pickPreset(page, 'wechat'));
  const wcActive = await page.$eval('#presetSelect', (el) => (el.value === 'wechat' ? 'active' : ''));
  const wcHref = await itemHrefs(page);
  await change(page, () => pickPreset(page, 'wechat'));
  const cancelActive = await page.$eval('#presetSelect', (el) => (el.value === 'wechat' ? 'active' : ''));
  const cancelFmt = await page.$eval('#formatSelect', (el) => el.value);
  const cancelQ = await page.$eval('#quality', (el) => el.value);
  const cancelHref = await itemHrefs(page);
  check('再点已选预设取消：高亮消失、回到默认 WebP 质量 80 并重压', wcActive.includes('active') && !cancelActive.includes('active') && cancelFmt === 'image/webp' && cancelQ === '80' && JSON.stringify(cancelHref) !== JSON.stringify(wcHref), `${wcActive}/${cancelActive}/${cancelFmt}/${cancelQ}`);
  await change(page, () => pickPreset(page, 'wechat'));
  await change(page, () => setQuality(page, 90));
  const clearedActive = await page.$eval('#presetSelect', (el) => (el.value === 'wechat' ? 'active' : ''));
  check('手动改参数后预设高亮自动消失', !clearedActive.includes('active'), clearedActive);
  await page.close();
  // 48a. 桌面端 GitHub 图标 18px；小屏桌面端（720/1180）无横向溢出、设置栏不被顶出右边缘
  page = await newPage(browser, { viewport: { width: 1180, height: 820 } });
  const ghBox = await page.$eval('a.gh-btn svg', (el) => { const r = el.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); });
  check('桌面端 GitHub 图标 18px', ghBox === '18x18', ghBox);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  const ov1180 = await page.evaluate(() => {
    const s = document.querySelector('#settingsCard').getBoundingClientRect();
    return document.documentElement.scrollWidth <= window.innerWidth && s.right <= window.innerWidth;
  });
  await page.setViewportSize({ width: 720, height: 900 });
  await page.waitForTimeout(500);
  const ov720 = await page.evaluate(() => {
    const s = document.querySelector('#settingsCard').getBoundingClientRect();
    return document.documentElement.scrollWidth <= window.innerWidth && s.right <= window.innerWidth;
  });
  check('1180 与 720 宽均无横向溢出、设置栏在视口内', ov1180 && ov720, `${ov1180}/${ov720}`);
  await page.close();
  // 44f. 无变化不重压：质量滑杆设回当前值，下载链接不变、也不出现转圈
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  const hNoChange = await itemHrefs(page);
  await setQuality(page, 80);
  await page.waitForTimeout(1500);
  const hNoChange2 = await itemHrefs(page);
  const pillAfterNoChange = await page.$eval('.global-loading.show', () => true).catch(() => false);
  check('无变化的设置不触发重压', JSON.stringify(hNoChange) === JSON.stringify(hNoChange2) && !pillAfterNoChange, `${hNoChange}/${hNoChange2}/${pillAfterNoChange}`);
  await page.close();
  // 44g. 行图标对齐：复制、下载与移除同高、垂直居中差不超过 1px
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  const actBoxes = await page.$$eval('.item-actions > *', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { h: r.height, cy: r.top + r.height / 2 }; }));
  check('行图标对齐', actBoxes.length === 3 && actBoxes.every((b) => Math.abs(b.h - actBoxes[0].h) <= 1 && Math.abs(b.cy - actBoxes[0].cy) <= 1), JSON.stringify(actBoxes));
  await page.close();
  // 44h. 移动端重压：汇总无转圈、处理中 pill 居中出现且结束后消失、
  // 预设行纵坐标在重压前后不变（处理中是唯一 loading 指示）
  // 有图后设置默认折叠成摘要，先展开才能点到预设。
  page = await newPage(browser, { viewport: { width: 390, height: 844 } });
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  await page.click('.settings-summary');
  const presetsY0 = await page.$eval('.presets', (el) => el.getBoundingClientRect().top + window.scrollY);
  const noSumSpin0 = (await page.$('#summary .sum-spin')) === null;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await pickPreset(page, 'wechat');
  await page.waitForFunction(() => document.querySelector('.global-loading')?.classList.contains('show'), null, { timeout: 10000 });
  const presetsY1 = await page.$eval('.presets', (el) => el.getBoundingClientRect().top + window.scrollY);
  const pillCenter = await page.$eval('.global-loading', (el) => { const r = el.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; });
  const vp = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const centered = Math.abs(pillCenter.cx - vp.w / 2) <= 2 && Math.abs(pillCenter.cy - vp.h / 2) <= 2;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.waitForFunction(() => !document.querySelector('.global-loading.show'), null, { timeout: 30000 });
  const pillGone = !(await page.$eval('.global-loading', (el) => el.classList.contains('show')).catch(() => false));
  const noSumSpin1 = (await page.$('#summary .sum-spin')) === null;
  check('重压时无汇总转圈、处理中 pill 居中出现且结束后消失、预设行不移位', Math.abs(presetsY0 - presetsY1) <= 1 && noSumSpin0 && noSumSpin1 && centered && pillGone, `${presetsY0}/${presetsY1}/${noSumSpin0}/${noSumSpin1}/${JSON.stringify(pillCenter)}/${JSON.stringify(vp)}/${pillGone}`);
  await page.close();
  // 44j. 全局 loading：重压时出现、不拦截点击，结束后消失
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  const pillIdle = await page.$eval('.global-loading', (el) => el.className);
  const pillPe = await page.$eval('.global-loading', (el) => getComputedStyle(el).pointerEvents);
  const cdp2 = await page.context().newCDPSession(page);
  await cdp2.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await pickPreset(page, 'wechat');
  // Wait for the pill itself: it shares the recompressing flag, so
  // waiting on it directly is both the assertion and the wait; a missed
  // window here fails loud (timeout) instead of silently reading a
  // stale state.
  await page.waitForFunction(() => document.querySelector('.global-loading')?.classList.contains('show'), null, { timeout: 10000 });
  const pillBusy = await page.$eval('.global-loading', (el) => el.className);
  await cdp2.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.waitForFunction(() => !document.querySelector('.global-loading.show'), null, { timeout: 30000 });
  const pillDone = await page.$eval('.global-loading', (el) => el.className);
  check('全局 loading 重压时显示、不拦截点击、结束后消失', !pillIdle.includes('show') && pillPe === 'none' && pillBusy.includes('show') && !pillDone.includes('show'), `${pillIdle}/${pillPe}/${pillBusy}/${pillDone}`);
  await page.close();
  // 44k. 手机端禁止双击放大
  page = await newPage(browser, { viewport: { width: 390, height: 844 } });
  const ta = await page.evaluate(() => getComputedStyle(document.documentElement).touchAction);
  check('根元素 touch-action 为 manipulation', ta === 'manipulation', ta);
  await page.close();

  // 44l. 目标体积清空后不立刻回填，失焦才补回默认 200
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  await pickPreset(page, 'email');
  const emailTarget = await page.$eval('#targetSize', (el) => el.value);
  await page.focus('#targetSize');
  await page.fill('#targetSize', '');
  await page.waitForTimeout(1200);
  const clearedVal = await page.$eval('#targetSize', (el) => el.value);
  await page.$eval('#targetSize', (el) => el.blur());
  await page.waitForTimeout(300);
  const refilledVal = await page.$eval('#targetSize', (el) => el.value);
  check('目标体积清空后不回填、失焦补回 200', emailTarget === '1000' && clearedVal === '' && refilledVal === '200', `${emailTarget}/${clearedVal}/${refilledVal}`);
  // 再测敲数字后立刻清空又停手：待发送的旧补丁必须被取消，不能在
  // 防抖时间到后把刚删的数字又填回来；失焦后仍补回 200。
  await page.focus('#targetSize');
  await page.fill('#targetSize', '150');
  await page.fill('#targetSize', '');
  await page.waitForTimeout(1200);
  const clearedAfterType = await page.$eval('#targetSize', (el) => el.value);
  await page.$eval('#targetSize', (el) => el.blur());
  await page.waitForTimeout(300);
  const refilledAfterType = await page.$eval('#targetSize', (el) => el.value);
  check('目标体积敲后清空停手不回填旧值、失焦补回 200', clearedAfterType === '' && refilledAfterType === '200', `${clearedAfterType}/${refilledAfterType}`);
  await page.close();

  // 44m. 目标体积贴近：JPEG 目标 200KB 时输出不超目标且不低于 85%
  page = await newPage(browser);
  await upload(page, [T + 'test.jpg', T + 'test.png']);
  await waitDone(page, 2);
  let prevM = await itemHrefs(page);
  await pickPreset(page, 'email');
  await waitUpdated(page, prevM);
  prevM = await itemHrefs(page);
  await page.fill('#targetSize', '200');
  await waitUpdated(page, prevM);
  const outs = await page.$$eval('.item .comp-size', (els) => els.map((el) => {
    const m = (el.textContent || '').match(/([\d.]+)\s*(KB|MB)/);
    if (!m) return -1;
    return m[2] === 'MB' ? parseFloat(m[1]) * 1024 : parseFloat(m[1]);
  }));
  check('目标体积 JPEG 200KB 输出贴近目标', outs.length === 2 && outs.every((v) => v <= 200 && v >= 170), JSON.stringify(outs));
  await page.close();

  // 46. PWA：SW 注册 + manifest + 离线重载 + 离线压缩（wasm 走预缓存）
  {
    const ctxP = await browser.newContext({ locale: 'zh-CN', acceptDownloads: true });
    const p = await ctxP.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);
    const swOk = await p.evaluate(async () => {
      try { await Promise.race([navigator.serviceWorker.ready, new Promise((_, r) => setTimeout(r, 20000))]); return !!navigator.serviceWorker.controller; } catch { return false; }
    });
    const mf = await p.evaluate(async () => { const r = await fetch('manifest.webmanifest'); return r.ok ? await r.json() : null; });
    await ctxP.setOffline(true);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#dropzone', { timeout: 15000 });
    await p.setInputFiles('#fileInput', T + 'test.jpg');
    await p.waitForSelector('.item', { timeout: 15000 });
    await p.waitForFunction(() => {
      const a = document.querySelector('.item .item-actions a');
      const h = a && a.getAttribute('href');
      return h && h !== '#';
    }, { timeout: 60000 });
    check('PWA：SW 注册+manifest+离线重载+离线压缩', swOk && !!mf && mf.name === '图片压缩' && mf.icons.length === 3, `sw=${swOk} icons=${mf && mf.icons.length}`);
    await ctxP.setOffline(false);
    await ctxP.close();
  }

  // 47. keepExif：开则去 GPS、留拍摄信息，关则全去掉（清单第 3 条：默认去 GPS）
  {
    const p = await newPage(browser);
    await upload(p, [T + 'gps.jpg']);
    await waitDone(p, 1);
    await toQuality(p);
    const hrefs = () => p.$$eval('.item .item-actions a', (els) => els.map((a) => a.href));
    const hasGps = (f) => {
      try {
        return execSync(`python3 -c "from PIL import Image; r = Image.open('${f}').getexif(); print('Y' if r.get_ifd(0x8825) else 'N')"`, { encoding: 'utf8' }).trim() === 'Y';
      } catch { return false; }
    };
    const hasMake = (f) => {
      try {
        return execSync(`python3 -c "from PIL import Image; r = Image.open('${f}').getexif(); print('Y' if r.get(271) == 'TestCamera' else 'N')"`, { encoding: 'utf8' }).trim() === 'Y';
      } catch { return false; }
    };
    const dl = async (trigger) => {
      const prev = await hrefs();
      await trigger();
      await waitUpdated(p, prev);
      const [d] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('.item .item-actions a')]);
      return d.path();
    };
    const pathOn = await dl(async () => { await p.selectOption('#formatSelect', 'image/jpeg'); await checkAdv(p, '#keepExif', true); });
    const pathOff = await dl(() => checkAdv(p, '#keepExif', false));
    check('keepExif 开去 GPS、留拍摄信息，关全去掉', !hasGps(pathOn) && !hasGps(pathOff) && hasMake(pathOn) && !hasMake(pathOff), `gpsOn=${hasGps(pathOn)} gpsOff=${hasGps(pathOff)} makeOn=${hasMake(pathOn)} makeOff=${hasMake(pathOff)}`);
    await p.close();
  }

  // 47b. keepExif + Orientation：写回前置 1、删缩略图、默认去 GPS（清单第 1、3 条）
  {
    const p = await newPage(browser);
    await upload(p, [T + 'orient6-thumb.jpg']);
    await waitDone(p, 1);
    await toQuality(p);
    const hrefs = () => p.$$eval('.item .item-actions a', (els) => els.map((a) => a.href));
    const orientInfo = (f) => {
      try {
        const out = execSync(
          `node -e 'const px=require("${T}../node_modules/piexifjs");const fs=require("fs");const e=px.load(fs.readFileSync("${f}","binary"));console.log(JSON.stringify({ori:e["0th"]&&e["0th"][px.ImageIFD.Orientation],n1st:Object.keys(e["1st"]||{}).length,thumb:(e.thumbnail||"").length,gps:Object.keys(e.GPS||{}).length}))'`,
          { encoding: 'utf8' },
        );
        return JSON.parse(out);
      } catch { return null; }
    };
    const prev = await hrefs();
    await p.selectOption('#formatSelect', 'image/jpeg');
    await checkAdv(p, '#keepExif', true);
    await waitUpdated(p, prev);
    const [d] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('.item .item-actions a')]);
    const info = orientInfo(await d.path());
    await p.click('.item .thumb');
    await p.waitForSelector('.lb-overlay', { timeout: 10000 });
    const dims = await p.$eval('.lb-info', (el) => el.textContent);
    check('keepExif Orientation 置 1、缩略图已删、GPS 已去、方向已转正', info && info.ori === 1 && info.n1st === 0 && info.thumb === 0 && info.gps === 0 && dims.includes('1200×1600'), `${JSON.stringify(info)} / ${dims.slice(0, 80)}`);
    await p.close();
  }

  // 47c. 拖拽：type 为空的 .heic 照收，非图片给提示且不进列表（清单第 2 条）
  // 粘贴走同一个 addFiles 漏斗（仅去掉各自的 .filter），故只测拖拽为代表。
  {
    const p = await newPage(browser);
    const heicBytes = [...fs.readFileSync(T + 'sample.heic')];
    await p.evaluate(async (bytes) => {
      const f = new File([new Uint8Array(bytes)], 'drop.heic', { type: '' });
      const dt = new DataTransfer();
      dt.items.add(f);
      document.querySelector('#dropzone').dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
    }, heicBytes);
    await waitDone(p, 1);
    const hintShown = await p.evaluate(async () => {
      const f = new File(['hello'], 'note.txt', { type: 'text/plain' });
      const dt = new DataTransfer();
      dt.items.add(f);
      document.querySelector('#dropzone').dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
      await new Promise((r) => setTimeout(r, 300));
      return !!document.querySelector('.file-hint');
    });
    const count = await p.$$eval('.item', (els) => els.length);
    check('拖拽：空 type 的 .heic 照收、非图片给提示且不进列表', count === 1 && hintShown, `${count}/${hintShown}`);
    await p.close();
  }

  // 47d. PWA：avif/heic2any/webp 重型资产不在 precache 里，Worker 块仍在（清单第 4 条）
  // hasWorker 守门：若 precache 缓存根本没建出来，heavy=0 会是假通过。
  {
    const ctxS = await browser.newContext({ locale: 'zh-CN' });
    const p = await ctxS.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await p.evaluate(async () => { try { await navigator.serviceWorker.ready; } catch {} });
    await p.reload({ waitUntil: 'networkidle' });
    const precached = await p.evaluate(async () => {
      const names = await caches.keys();
      const out = [];
      for (const n of names) {
        if (!n.includes('precache')) continue;
        const c = await caches.open(n);
        for (const req of await c.keys()) out.push(req.url);
      }
      return out;
    });
    const heavy = precached.filter((u) => /avif_enc|heic2any|webp_enc/.test(u));
    const hasWorker = precached.some((u) => /compress\.worker/.test(u));
    check('PWA：重型懒加载资产不在 precache，Worker 块仍在', heavy.length === 0 && hasWorker, `heavy=${heavy.length} worker=${hasWorker} total=${precached.length}`);
    await ctxS.close();
  }

  // 47e. 设置放宽时已最优项跳过重压，格式变更必重压（清单第 7 条）
  // 已最优用确定性组合：截图 PNG + 无损（关掉量化）一定大于原图，不依赖
  // 噪声图转 PNG 的体积（实测 855.9KB，比原图小，已最优前提不成立）。
  // 注意：waitUpdated 要求 href 必变，跳过步骤不能用它（会超时），
  // 故放宽步骤手动等防抖（数字输入 500ms）+ 不在更新中再比 href。
  {
    const p = await newPage(browser);
    await upload(p, [T + 'screenshot.png']);
    await waitDone(p, 1);
    await toQuality(p);
    await change(p, () => p.selectOption('#formatSelect', 'image/png'));
    await change(p, () => p.$eval('#quantize', (el) => el.click()));
    const badge = await p.$('.item .best-tag');
    check('47e 前置：无损 PNG 已是最优', !!badge, `badge=${!!badge}`);
    const hrefBefore = await itemHrefs(p);
    await fillMax(p, '20000');
    await p.waitForFunction(() => !document.querySelector('.global-loading.show'), null, { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1000));
    await p.waitForFunction(() => !document.querySelector('.global-loading.show'), null, { timeout: 30000 });
    const hrefAfterRelax = await itemHrefs(p);
    const badgeAfterRelax = await p.$('.item .best-tag');
    await change(p, () => p.selectOption('#formatSelect', 'image/jpeg'));
    const hrefAfterFormat = await itemHrefs(p);
    check('设置放宽时已最优项跳过重压、格式变更必重压', !!badge && hrefAfterRelax[0] === hrefBefore[0] && !!badgeAfterRelax && hrefAfterFormat[0] !== hrefAfterRelax[0], `badge=${!!badge}/${!!badgeAfterRelax} relaxSame=${hrefAfterRelax[0] === hrefBefore[0]} formatChanged=${hrefAfterFormat[0] !== hrefAfterRelax[0]}`);
    await p.close();
  }

  // 47f. 手机端有图后结果在设置上方，桌面端仍在右侧（feature-1.0.1：
  // 旧清单第 8 条"设置在结果上方"被推翻——结果卡在 1.5 屏以下，用户
  // 以为没反应；现在有图后结果提到上传区下方，设置折叠成一行摘要）
  {
    const p = await newPage(browser, { viewport: { width: 390, height: 844 } });
    await upload(p, [T + 'test.jpg']);
    await waitDone(p, 1);
    const mob = await p.evaluate(() => {
      const s = document.querySelector('#settingsCard').getBoundingClientRect();
      const r = document.querySelector('#resultCard').getBoundingClientRect();
      return { settingsTop: s.top, resultTop: r.top };
    });
    check('手机端有图后结果在设置上方', mob.resultTop < mob.settingsTop, `${mob.resultTop}/${mob.settingsTop}`);
    await p.close();
    const d = await newPage(browser, { viewport: { width: 1200, height: 900 } });
    await upload(d, [T + 'test.jpg']);
    await waitDone(d, 1);
    const desk = await d.evaluate(() => {
      const s = document.querySelector('#settingsCard').getBoundingClientRect();
      const u = document.querySelector('#uploadCard').getBoundingClientRect();
      return { settingsLeft: s.left, uploadRight: u.right };
    });
    check('桌面端设置仍在右侧', desk.settingsLeft >= desk.uploadRight - 1, `${desk.settingsLeft}/${desk.uploadRight}`);
    await d.close();
  }

  // 47f2. 手机端吸底栏＋设置折叠摘要（feature-1.0.1 先改 1）
  {
    const p = await newPage(browser, { viewport: { width: 390, height: 844 } });
    await upload(p, [T + 'test.jpg']);
    await waitDone(p, 1);
    const sumText = await p.$eval('.settings-summary', (el) => el.textContent);
    const panelHidden = await p.$eval('.settings-body-collapsed', () => true).catch(() => false);
    const bar = await p.$eval('.sticky-bar', (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { vis: r.height > 0, fixed: cs.position === 'fixed', bottom: Math.round(r.bottom), vpH: window.innerHeight }; });
    // 1.0.4: the mobile tab bar sits at the very bottom, so the sticky bar
    // now rests on top of it instead of on the viewport edge. ±1px for the
    // tab bar's 1px top border, which the sticky bar overlaps.
    const tabH = await p.$eval('.tab-bar', (el) => Math.round(el.getBoundingClientRect().height));
    const spacerH = await p.$eval('.sticky-spacer', (el) => el.getBoundingClientRect().height);
    const topActions = await p.$eval('#resultCard .actions', (el) => getComputedStyle(el).display);
    check('手机端设置折叠摘要＋吸底栏', sumText.includes('智能（默认） · 1920px') && panelHidden && bar.vis && bar.fixed && Math.abs(bar.bottom + tabH - bar.vpH) <= 1 && spacerH > 0 && topActions === 'none', `${sumText}/${panelHidden}/${JSON.stringify(bar)}/${tabH}/${spacerH}/${topActions}`);
    await p.click('.settings-summary');
    const panelShown = await p.$eval('.settings-body-collapsed', () => true).catch(() => false);
    check('点摘要展开设置面板', !panelShown, String(panelShown));
    const [chooser] = await Promise.all([
      p.waitForEvent('filechooser', { timeout: 10000 }),
      p.click('.sticky-add'),
    ]);
    check('吸底栏 + 添加 打开文件选择器', !!chooser, String(!!chooser));
    const dlDis = await p.$eval('.sticky-download', (b) => b.disabled);
    await p.click('.sticky-clear');
    const clearText = await p.$eval('.sticky-clear', (el) => el.textContent);
    await p.click('.sticky-clear');
    await p.waitForTimeout(500);
    const barGone = await p.$eval('.sticky-bar', (el) => el.getBoundingClientRect().height === 0).catch(() => true);
    check('吸底栏下载可用、清空二次确认', !dlDis && clearText.includes('确认清空') && barGone, `${dlDis}/${clearText}/${barGone}`);
    await p.close();
    const d = await newPage(browser, { viewport: { width: 1200, height: 900 } });
    await upload(d, [T + 'test.jpg']);
    await waitDone(d, 1);
    const deskBar = await d.$eval('.sticky-bar', (el) => el.getBoundingClientRect().height);
    const deskSum = await d.$eval('.settings-summary', (el) => getComputedStyle(el).display);
    const deskPanelVis = await d.$eval('#settingsCard > div', (el) => getComputedStyle(el).display !== 'none');
    check('桌面端无吸底栏无摘要、设置常显', deskBar === 0 && deskSum === 'none' && deskPanelVis, `${deskBar}/${deskSum}/${deskPanelVis}`);
    await d.close();
  }

  // 47f3. 行内尺寸变化（1.0.5 按模板改）：每行都显示尺寸行，未缩放时
  // 显示原尺寸 ↓ 原尺寸
  {
    const p = await newPage(browser);
    await upload(p, [T + 'test.jpg']); // 1600×1200，默认最长边 1920 不缩放
    await waitDone(p, 1);
    const dims0 = await p.$eval('.item .dims', (el) => el.textContent);
    check('未缩放时行里尺寸行显示原尺寸', dims0 === '1600×1200↓1600×1200', dims0);
    await change(p, () => fillMax(p, '800'));
    const dims = await p.$eval('.item .dims', (el) => el.textContent);
    check('缩放后行里显示尺寸变化', dims === '1600×1200↓800×600', dims);
    await p.close();
  }

  // 47f3b. 中间块按模板（1.0.5）：缩略图条 + 结果标题头 + 顶部操作
  {
    const p = await newPage(browser, { viewport: { width: 1280, height: 900 } });
    await upload(p, [T + 'test.jpg', T + 'test.png']);
    await waitDone(p, 2);
    const stripCount = await p.$$eval('.thumb-strip .strip-thumb', (els) => els.length);
    const stripAdd = await p.$('.thumb-strip .strip-add');
    const dzCompact = await p.$eval('#dropzone', (el) => el.classList.contains('compact'));
    const headTitle = await p.$eval('.result-head h3', (el) => el.textContent);
    const dlInHead = await p.$eval('#downloadAll', (el) => !!el.closest('.result-head'));
    const clearInHead = await p.$eval('#clearAll', (el) => !!el.closest('.result-head'));
    check('桌面端缩略图条与结果标题头、加图入口二合一（条里无＋号、只留虚线框）', stripCount === 2 && !stripAdd && dzCompact && headTitle === '压缩结果' && dlInHead && clearInHead, `${stripCount}/${!!stripAdd}/${dzCompact}/${headTitle}/${dlInHead}/${clearInHead}`);
    await p.close();
  }

  // 47f3c. 第三块对比预览卡：默认第一张，点缩略图条切换，
  // 100% 放大生效，卡片钉在右侧栏底部；侧栏设置入口已删
  {
    const p = await newPage(browser, { viewport: { width: 1280, height: 900 } });
    await upload(p, [T + 'test.jpg', T + 'test.png']);
    await waitDone(p, 2);
    const pvDefault = await p.$eval('#previewCard .pv-name', (el) => el.textContent);
    const pvDivider = await p.$('#previewCard .pv-divider');
    const pvZooms = await p.$$eval('#previewCard .pv-zoom-btn', (els) => els.map((e) => e.textContent));
    const pvDl = await p.$('#previewCard .pv-actions button.primary');
    const navCount = await p.$$eval('#sideNav .side-links button', (els) => els.length);
    const boxes = await p.$eval('#previewCard', (el) => {
      const r = el.getBoundingClientRect();
      const rc = document.querySelector('#resultCard').getBoundingClientRect();
      const st = document.querySelector('#settingsCard').getBoundingClientRect();
      return { pvLeft: r.left, pvTop: r.top, rcLeft: rc.left, rcTop: rc.top, stTop: st.top };
    });
    check('预览卡默认第一张、带分界与缩放下载', pvDefault === 'test.jpg' && !!pvDivider && pvZooms.join('/') === '适合/100%/200%' && !!pvDl, `${pvDefault}/${!!pvDivider}/${pvZooms.join('/')}/${!!pvDl}`);
    check('预览卡在第三块右侧栏内、设置下方，侧栏无设置入口', boxes.pvLeft > boxes.rcLeft && boxes.pvTop > boxes.stTop && navCount === 2, `${boxes.pvLeft}/${boxes.rcLeft}/${boxes.pvTop}/${boxes.stTop}/${navCount}`);
    await p.click('.thumb-strip .strip-tile:nth-child(2)');
    await p.waitForFunction(() => document.querySelector('#previewCard .pv-name').textContent === 'test.png');
    const pvSecond = await p.$eval('#previewCard .pv-name', (el) => el.textContent);
    const selSecond = await p.$eval('.thumb-strip .strip-tile:nth-child(2)', (el) => el.classList.contains('selected'));
    check('点缩略图条切换预览图并高亮', pvSecond === 'test.png' && selSecond, `${pvSecond}/${selSecond}`);
    await p.click('#previewCard .pv-zoom-btn:nth-child(2)');
    const zoomed = await p.$eval('#previewCard .pv-compare', (el) => el.classList.contains('zoomed') && !!el.style.width && el.style.width.endsWith('px'));
    check('预览卡 100% 放大生效', zoomed, '');
    await p.close();
  }


  // 47f3d. 表格列对齐 + 设置折叠放大预览 + 滚动时面板不动（1.0.5 后续）
  {
    const p = await newPage(browser, { viewport: { width: 1400, height: 700 } });
    await upload(p, [T + 'test.jpg', T + 'test.png']);
    await waitDone(p, 2);
    const cols = await p.$$eval('#list .item', (rows) => {
      const pick = (sel) => rows.map((r) => Math.round(r.querySelector(sel).getBoundingClientRect().left));
      return {
        name: pick('.cell-name'), orig: pick('.orig-size'), comp: pick('.comp-size'),
        save: pick('.save-cell'), dims: pick('.dims'), status: pick('.cell-status'),
        thumb: rows.map((r) => !!r.querySelector('.thumb img')),
      };
    });
    const aligned = ['name', 'orig', 'comp', 'save', 'dims', 'status'].every((k) => cols[k].every((v) => v === cols[k][0]));
    check('表格列跨行对齐、每行带缩略图', aligned && cols.thumb.every(Boolean), JSON.stringify(cols));
    const pvBefore = await p.$eval('#previewCard', (el) => el.getBoundingClientRect().height);
    const stBefore = await p.$eval('#previewCard .pv-stage', (el) => el.getBoundingClientRect().height);
    await p.click('.settings-collapse-btn');
    await p.waitForFunction(() => {
      const b = document.querySelector('#settingsCard .settings-body-collapsed');
      return b && getComputedStyle(b).display === 'none';
    });
    const pvAfter = await p.$eval('#previewCard', (el) => el.getBoundingClientRect().height);
    const stAfter = await p.$eval('#previewCard .pv-stage', (el) => el.getBoundingClientRect().height);
    check('折叠设置后预览卡撑满面板、图片区随之变大（后续 4 #7）', pvAfter > pvBefore && stAfter > stBefore, `${pvBefore}/${pvAfter}/${stBefore}/${stAfter}`);
    await p.click('.settings-collapse-btn');
    await p.waitForFunction(() => !document.querySelector('#settingsCard .settings-body-collapsed'));
    const y0 = await p.evaluate(() => { window.scrollTo(0, 300); return window.scrollY; });
    const panelTop = await p.$eval('#rightPanel', (el) => Math.round(el.getBoundingClientRect().top));
    check('滚动页面时右侧栏钉在顶部不动', y0 > 0 && panelTop === 20, `${y0}/${panelTop}`);
    await p.close();
  }

  // 105g1. 缩略图条手动轮播：图多时单行+箭头翻页，不自动播（1.0.5 后续 2）
  {
    const p = await newPage(browser, { viewport: { width: 1280, height: 720 } });
    await upload(p, [T + 'test.jpg', T + 'test.png', T + 'p3-test.jpg']);
    await upload(p, [T + 'test.jpg', T + 'test.png', T + 'p3-test.jpg']);
    await p.waitForFunction(() => document.querySelectorAll('.thumb-strip .strip-thumb').length === 6);
    const nav = await p.$$eval('.thumb-strip .strip-nav', (els) => els.map((e) => ({ vis: e.offsetParent !== null, dis: e.disabled })));
    check('图多时轮播箭头出现、下一张可用', nav.length === 2 && nav[0].vis && nav[1].vis && nav[0].dis && !nav[1].dis, JSON.stringify(nav));
    await p.click('.thumb-strip .strip-nav:last-child');
    // Smooth scroll animates: wait for it to settle before measuring, or
    // the first read lands mid-animation and the stability check fails.
    let sc1 = 0;
    for (let i = 0; i < 20; i++) {
      await p.waitForTimeout(300);
      const cur = await p.$eval('.strip-viewport', (el) => el.scrollLeft);
      if (Math.abs(cur - sc1) < 2 && cur > 50) { sc1 = cur; break; }
      sc1 = cur;
    }
    await p.waitForTimeout(1200);
    const sc2 = await p.$eval('.strip-viewport', (el) => el.scrollLeft);
    check('点箭头翻页、不自动播（1.2 秒后位置不动）', sc1 > 50 && Math.abs(sc2 - sc1) < 3, `${sc1}/${sc2}`);
    await p.close();
  }

  // 105g2. 预览点击放大：点预览区（避开中线分隔条）打开灯箱（1.0.5 后续 2）
  {
    const p = await newPage(browser, { viewport: { width: 1280, height: 720 } });
    await upload(p, [T + 'test.jpg']);
    await waitDone(p, 1);
    // Settings expanded pushes the preview below the fold on 720px-high
    // viewports; mouse.click uses raw coordinates, so scroll the card into
    // the fixed panel's view first, then measure and click.
    await p.$eval('#previewCard', (el) => el.scrollIntoView({ block: 'nearest' }));
    const box = await p.$eval('#previewCard .pv-stage', (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width * 0.25, y: r.top + r.height * 0.5 }; });
    await p.mouse.click(box.x, box.y);
    await p.waitForFunction(() => !!document.querySelector('.lb-overlay'), null, { timeout: 5000 });
    const lb = await p.$('.lb-overlay');
    check('点预览图打开灯箱', !!lb, '');
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('.lb-overlay'), null, { timeout: 5000 });
    await p.close();
  }

  // 105g3. iPad 竖屏统计条两列、特性条已删（1.0.5 后续 2）
  {
    const p = await newPage(browser, { viewport: { width: 768, height: 1024 } });
    await upload(p, [T + 'test.jpg']);
    await waitDone(p, 1);
    const cols = await p.$eval('.stat-strip', (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    const feat = await p.$('.feature-strip');
    const statOverlap = await p.$$eval('.stat', (els) => els.every((el) => {
      const r = el.getBoundingClientRect();
      return els.every((o) => o === el || r.right <= o.getBoundingClientRect().left + 1 || o.getBoundingClientRect().right <= r.left + 1 || r.bottom <= o.getBoundingClientRect().top + 1 || o.getBoundingClientRect().bottom <= r.top + 1);
    }));
    check('iPad 竖屏统计条两列、无重叠、特性条已删', cols === 2 && !feat && statOverlap, `${cols}/${!!feat}/${statOverlap}`);
    await p.close();
  }

  // 47f4. 灯箱打开时背景不滚动、关闭后位置恢复（feature-1.0.1：蒙层滚动穿透）
  {
    const p = await newPage(browser, { viewport: { width: 390, height: 844 } });
    await upload(p, [T + 'test.jpg', T + 'test.png']);
    await waitDone(p, 2);
    const y0 = await p.evaluate(() => { const max = document.documentElement.scrollHeight - window.innerHeight; const y = Math.min(150, Math.max(0, max)); window.scrollTo(0, y); return window.scrollY; });
    await p.click('.item:nth-child(1) .thumb');
    await p.waitForSelector('.lb-overlay', { timeout: 10000 });
    const locked = await p.evaluate(() => ({ pos: document.body.style.position, top: document.body.style.top }));
    await p.mouse.wheel(0, 600);
    await p.waitForTimeout(300);
    const lockedY = await p.evaluate(() => window.scrollY);
    const lockedTop = await p.evaluate(() => document.body.style.top);
    await p.click('.lb-close');
    await p.waitForTimeout(300);
    const restored = await p.evaluate(() => ({ pos: document.body.style.position, y: window.scrollY }));
    check('灯箱打开锁住背景滚动、关闭恢复位置', y0 > 0 && locked.pos === 'fixed' && locked.top === `-${y0}px` && lockedY === 0 && lockedTop === `-${y0}px` && restored.pos === '' && restored.y === y0, `${y0}/${JSON.stringify(locked)}/${lockedY}/${lockedTop}/${JSON.stringify(restored)}`);
    await p.close();
  }

  // 47f5. Display P3 保留（feature-1.0.1 先改 3）：P3 源输出带原 ICC（逐字节一致），sRGB 源不带
  {
    const p3mark = Buffer.from('Display P3'.split('').map((c) => '\0' + c).join(''), 'latin1'); // UTF-16BE 'Display P3'
    const p = await newPage(browser);
    await upload(p, [T + 'p3-test.jpg']);
    await waitDone(p, 1);
    const [dlW] = await Promise.all([
      p.waitForEvent('download', { timeout: 20000 }),
      p.click('.item .item-actions a'),
    ]);
    const webpBuf = fs.readFileSync(await dlW.path());
    const wName = dlW.suggestedFilename();
    check('P3 源 WebP 输出带原 ICC', wName.endsWith('.webp') && webpBuf.includes(Buffer.from('ICCP')) && webpBuf.includes(p3mark), `${wName}/${webpBuf.length}`);
    await toQuality(p);
    await change(p, () => p.selectOption('#formatSelect', 'image/jpeg'));
    const [dlJ] = await Promise.all([
      p.waitForEvent('download', { timeout: 20000 }),
      p.click('.item .item-actions a'),
    ]);
    const jpegBuf = fs.readFileSync(await dlJ.path());
    const jName = dlJ.suggestedFilename();
    check('P3 源 JPEG 输出带原 ICC', jName.endsWith('.jpg') && jpegBuf.includes(Buffer.from('ICC_PROFILE')) && jpegBuf.includes(p3mark), `${jName}/${jpegBuf.length}`);
    await p.close();
    const q = await newPage(browser);
    await upload(q, [T + 'test.jpg']);
    await waitDone(q, 1);
    const [dlS] = await Promise.all([
      q.waitForEvent('download', { timeout: 20000 }),
      q.click('.item .item-actions a'),
    ]);
    const srgbBuf = fs.readFileSync(await dlS.path());
    check('sRGB 源 WebP 输出不带 ICC', !srgbBuf.includes(Buffer.from('ICCP')), `${dlS.suggestedFilename()}/${srgbBuf.length}`);
    await q.close();
  }

  // 47f6. UI 批（feature-1.0.1 UI1–UI7）
  {
    // UI6: 桌面空状态，上传区高 dropzone、右侧栏撑满视口高
    const p = await newPage(browser);
    const r = await p.evaluate(() => {
      const d = document.querySelector('#dropzone').getBoundingClientRect();
      const panel = document.querySelector('#rightPanel').getBoundingClientRect();
      const cs = getComputedStyle(document.querySelector('#rightPanel'));
      return { dHeight: d.height, panelH: panel.height, vpH: window.innerHeight, panelPos: cs.position };
    });
    check('桌面空状态上传区高、右侧栏视口高 fixed', r.dHeight > 300 && Math.abs(r.panelH - (r.vpH - 40)) <= 2 && r.panelPos === 'fixed', JSON.stringify(r));
    // UI3: 本地徽章绿底 + 锁图标
    const badge = await p.evaluate(() => {
      const b = document.querySelector('.badge');
      const cs = getComputedStyle(b);
      return { bg: cs.backgroundColor, hasSvg: !!b.querySelector('svg'), text: b.textContent };
    });
    check('100% 本地处理徽章绿底带锁', (badge.bg === 'rgb(39, 166, 68)' || badge.bg === 'rgb(21, 128, 61)') && badge.hasSvg && badge.text.includes('100%'), JSON.stringify(badge));
    // UI4 (2.1): one contextual note line under the rows; page footer is
    // privacy only. AVIF warns about the encoder download, target mode
    // explains the search.
    await p.selectOption('#formatSelect', 'image/avif');
    const avifNote = await p.evaluate(() => (document.querySelector('#settingsNote')?.textContent || '').includes('3.5MB'));
    await p.selectOption('#formatSelect', 'image/webp');
    await p.click('#modeSeg [data-mode=\"target\"]');
    const targetNote = await p.evaluate(() => (document.querySelector('#settingsNote')?.textContent || '').includes('先按质量'));
    const noteCount = await p.$$eval('.settings-note', (els) => els.length);
    const footerText = await p.evaluate(() => document.querySelector('footer').textContent);
    check('设置只有一行说明、页脚只剩隐私一行', avifNote && targetNote && noteCount === 1 && footerText.includes('隐私') && !footerText.includes('GIF') && !footerText.includes('先按质量'), `${avifNote}/${targetNote}/${noteCount}/${footerText}`);
    await p.close();
    // UI5: 手机顶栏同一行、GitHub 只剩图标
    const m = await newPage(browser, { viewport: { width: 390, height: 844 } });
    const row = await m.evaluate(() => {
      const h = document.querySelector('header');
      const [t, a] = [...h.children];
      const tr = t.getBoundingClientRect(), ar = a.getBoundingClientRect();
      const ghText = getComputedStyle(document.querySelector('.gh-btn .gh-text')).display;
      const sub = getComputedStyle(document.querySelector('header p')).display;
      return { overlap: tr.top < ar.bottom && ar.top < tr.bottom, side: ar.left >= tr.right - 2, ghText, sub };
    });
    check('手机顶栏按钮与标题同行、GitHub 只剩图标', row.overlap && row.side && row.ghText === 'none' && row.sub === 'none', JSON.stringify(row));
    await m.close();
    // UI5: 触屏标题不用“拖拽”
    const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('ic-lang', 'zh'); } catch (e) {} });
    const tp = await ctx.newPage();
    await tp.goto(BASE, { waitUntil: 'networkidle' });
    const dropTitle = await tp.evaluate(() => document.querySelector('#dropzone strong').textContent);
    check('触屏上传标题为点击选择', dropTitle === '点击选择图片' && !dropTitle.includes('拖拽'), dropTitle);
    await ctx.close();
    // UI1 + UI2: 灯箱遮罩不透明、标签胶囊底、三档缩放同步
    const q = await newPage(browser);
    await upload(q, [T + 'test.jpg']);
    await waitDone(q, 1);
    await q.click('.item:nth-child(1) .thumb');
    await q.waitForSelector('.lb-overlay', { timeout: 10000 });
    const lb = await q.evaluate(() => {
      const ov = getComputedStyle(document.querySelector('.lb-overlay')).backgroundColor;
      const tag = getComputedStyle(document.querySelector('.lb-side-tag')).backgroundColor;
      const btns = document.querySelectorAll('.lb-zoom-btn').length;
      return { ov, tag, btns };
    });
    check('灯箱遮罩不透明、标签有胶囊底、三档按钮在', lb.ov === 'rgb(0, 0, 0)' && lb.tag === 'rgba(0, 0, 0, 0.75)' && lb.btns === 3, JSON.stringify(lb));
    await q.click('.lb-zoom-btn:nth-child(2)');
    const w100 = await q.evaluate(() => document.querySelector('.lb-compare').style.width);
    await q.click('.lb-zoom-btn:nth-child(3)');
    const w200 = await q.evaluate(() => document.querySelector('.lb-compare').style.width);
    const pan = await q.evaluate(() => {
      const st = document.querySelector('.lb-stage');
      return { scrollW: st.scrollWidth, clientW: st.clientWidth, scrollLeft: st.scrollLeft };
    });
    await q.click('.lb-zoom-btn:nth-child(1)');
    const wFit = await q.evaluate(() => document.querySelector('.lb-compare').style.width);
    // Cycle via a click on the right (compressed) side: the image center
    // sits under the divider's grab strip, so a center click would drag.
    await q.evaluate(() => {
      const r = document.querySelector('.lb-compare').getBoundingClientRect();
      return { x: r.left + r.width * 0.75, y: r.top + r.height * 0.5 };
    }).then((pt) => q.mouse.click(pt.x, pt.y));
    const wCycle = await q.evaluate(() => document.querySelector('.lb-compare').style.width);
    check('灯箱 100%/200%/适合/点图循环宽度同步', w100 === '1600px' && w200 === '3200px' && wFit === '' && wCycle === '1600px' && pan.scrollW > pan.clientW && pan.scrollLeft === 0, `${w100}/${w200}/${wFit}/${wCycle}/${JSON.stringify(pan)}`);
    await q.close();
  }

  // 47f7. 功能批（feature-1.0.1 功能1–功能6）
  {
    // 功能2: 省不到 10% 给小提示（WebP 路径：同画质重压只省 7%）
    let p = await newPage(browser);
    await upload(p, T + 'noise-q80.webp');
    await waitDone(p, 1);
    const smallRow = await p.$eval('.item', (el) => el.textContent);
    check('省不到 10% 提示已经很小', smallRow.includes('已经很小，可不压') && !smallRow.includes('试试 PNG 量化'), smallRow.replace(/\s+/g, ' '));
    await p.close();
    // 功能2: PNG 不开量化 + 目标模式 → 量化提示
    p = await newPage(browser);
    await toQualityEmpty(p);
    await p.selectOption('#formatSelect', 'image/png');
    await p.evaluate(() => { const q = document.querySelector('#quantize'); if (q && q.checked) q.click(); });
    await p.click('#modeSeg [data-mode=\"target\"]');
    await p.$eval('#targetSize', (el) => { el.value = '750'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.waitForTimeout(600);
    await upload(p, T + 'noise.png');
    await waitDone(p, 1);
    const quantRow = await p.$eval('.item', (el) => el.textContent);
    check('PNG 不开量化省不到 10% 提示试试量化', quantRow.includes('已经很小，试试 PNG 量化'), quantRow.replace(/\s+/g, ' '));
    await p.close();
    // 功能3: 透明图 + JPEG 提示 + 改用 WebP
    p = await newPage(browser);
    await toQualityEmpty(p);
    await p.selectOption('#formatSelect', 'image/jpeg');
    await upload(p, T + 'alpha.png');
    await waitDone(p, 1);
    const alphaRow = await p.$eval('.item', (el) => el.textContent);
    const hasWebpBtn = await p.$eval('.item', (el) => !!el.querySelector('.link-btn'));
    check('透明图转 JPEG 提示填白并给改用 WebP', alphaRow.includes('透明部分会填充白色') && hasWebpBtn, alphaRow.replace(/\s+/g, ' '));
    await change(p, () => p.click('.item .link-btn'));
    const fmtAfter = await p.$eval('#formatSelect', (el) => el.value);
    const alphaRow2 = await p.$eval('.item', (el) => el.textContent);
    check('点改用 WebP 后格式切 WebP 且提示消失', fmtAfter === 'image/webp' && !alphaRow2.includes('透明部分会填充白色'), fmtAfter);
    await p.close();
    // 功能3: JPEG 填充色生效（透明区变红）
    p = await newPage(browser);
    await toQualityEmpty(p);
    await p.selectOption('#formatSelect', 'image/jpeg');
    await p.$eval('#jpegFill', (el) => { el.value = '#ff0000'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await upload(p, T + 'alpha.png');
    await waitDone(p, 1);
    const px = await p.evaluate(async () => {
      const a = document.querySelector('.item .item-actions a');
      const blob = await (await fetch(a.href)).blob();
      const bmp = await createImageBitmap(blob);
      const c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      c.getContext('2d').drawImage(bmp, 0, 0);
      const d = c.getContext('2d').getImageData(Math.floor(bmp.width * 0.1), Math.floor(bmp.height * 0.5), 1, 1).data;
      return [d[0], d[1], d[2]];
    });
    check('JPEG 填充色生效（透明区变红）', px[0] > 200 && px[1] < 100 && px[2] < 100, px.join(','));
    await p.close();
    // 功能4: GIF 标签只打在动图上
    p = await newPage(browser);
    await upload(p, T + 'anim.gif');
    await waitDone(p, 1);
    const animTag = await p.$eval('.item', (el) => el.textContent.includes('仅保留首帧'));
    await p.click('.item .remove-btn');
    await p.waitForTimeout(300);
    await upload(p, T + 'static.gif');
    await waitDone(p, 1);
    const staticTag = await p.$eval('.item', (el) => el.textContent.includes('仅保留首帧'));
    check('动图打仅保留首帧标签、静图不打', animTag && !staticTag, `${animTag}/${staticTag}`);
    await p.close();
    // 功能5: 原文件名开关只改名不重压；zip 带日期张数
    p = await newPage(browser);
    await upload(p, [T + 'test.jpg', T + 'test.png']);
    await waitDone(p, 2);
    const dlBefore = await p.$eval('.item:nth-child(1) .item-actions a', (a) => a.getAttribute('download'));
    const hrefsBefore = await itemHrefs(p);
    await p.evaluate(() => { document.querySelector('#keepOriginalName').click(); });
    await p.waitForTimeout(500);
    const dlAfter = await p.$eval('.item:nth-child(1) .item-actions a', (a) => a.getAttribute('download'));
    const hrefsAfter = await itemHrefs(p);
    const dlZip = await Promise.all([
      p.waitForEvent('download'),
      p.click('#downloadAll'),
    ]).then(([dl]) => dl);
    const zipName = dlZip.suggestedFilename();
    check('原文件名开关只改名不重压、zip 带日期张数', dlBefore === 'test-compressed.webp' && dlAfter === 'test.webp' && JSON.stringify(hrefsBefore) === JSON.stringify(hrefsAfter) && /^images-compressed-\d{8}-2\.zip$/.test(zipName), `${dlBefore}/${dlAfter}/${zipName}`);
    await p.close();
    // 功能6: 缩放方式（宽/高/百分比）+ 切百分比重置数值
    p = await newPage(browser);
    await clickResize(p, 'width');
    await p.$eval('#maxSize', (el) => { el.value = '800'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.waitForTimeout(600);
    await upload(p, T + 'test.jpg');
    await waitDone(p, 1);
    const dimsW = await p.$eval('.item .dims', (el) => el.textContent);
    await p.click('.item .remove-btn');
    await p.waitForTimeout(300);
    await clickResize(p, 'height');
    await p.$eval('#maxSize', (el) => { el.value = '600'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.waitForTimeout(600);
    await upload(p, T + 'test.jpg');
    await waitDone(p, 1);
    const dimsH = await p.$eval('.item .dims', (el) => el.textContent);
    await p.click('.item .remove-btn');
    await p.waitForTimeout(300);
    await clickResize(p, 'percent');
    const pctVal = await p.$eval('#maxSize', (el) => el.value);
    await p.$eval('#maxSize', (el) => { el.value = '50'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.waitForTimeout(600);
    await upload(p, T + 'test.jpg');
    await waitDone(p, 1);
    const dimsP = await p.$eval('.item .dims', (el) => el.textContent);
    check('缩放按宽/高/百分比都出 800×600、切百分比重置为 100', dimsW === '1600×1200↓800×600' && dimsH === '1600×1200↓800×600' && dimsP === '1600×1200↓800×600' && pctVal === '100', `${dimsW}/${dimsH}/${dimsP}/${pctVal}`);
    await p.close();
    // 功能6: 复制按钮（桩 clipboard）；桌面无分享按钮
    p = await newPage(browser);
    await upload(p, T + 'test.jpg');
    await waitDone(p, 1);
    const noShare = await p.$eval('.item', (el) => !el.querySelector('.share-btn') && !!el.querySelector('.copy-btn'));
    await p.evaluate(() => {
      navigator.clipboard.write = async (items) => { window.__copiedTypes = items.map((i) => i.types); };
    });
    await p.click('.item .copy-btn');
    await p.waitForFunction(() => !!window.__copiedTypes, null, { timeout: 10000 });
    const copiedTypes = await p.evaluate(() => window.__copiedTypes);
    const copyOk = await p.$eval('.item .copy-btn', (el) => el.textContent.includes('✓'));
    check('桌面无分享按钮、有复制按钮；复制走 image/png', noShare && JSON.stringify(copiedTypes) === '[["image/png"]]' && copyOk, `${noShare}/${JSON.stringify(copiedTypes)}/${copyOk}`);
    await p.close();
    // 功能1: 触屏可分享时下载变分享按钮、share 拿到输出文件
    const sctx = await browser.newContext({ locale: 'zh-CN', hasTouch: true, viewport: { width: 390, height: 844 } });
    await sctx.addInitScript(() => {
      try { localStorage.setItem('ic-lang', 'zh'); } catch (e) {}
      Object.defineProperty(navigator, 'canShare', { value: () => true });
      Object.defineProperty(navigator, 'share', { value: async (data) => { window.__shared = data.files.map((f) => f.name); } });
    });
    const sp = await sctx.newPage();
    sp.on('pageerror', (e) => errors.push(e.message));
    await sp.goto(BASE);
    await sp.waitForSelector('#dropzone');
    await upload(sp, T + 'test.jpg');
    await waitDone(sp, 1);
    const hasShareBtn = await sp.$eval('.item', (el) => !!el.querySelector('.share-btn') && !el.querySelector('.item-actions a'));
    await sp.click('.item .share-btn');
    await sp.waitForFunction(() => !!window.__shared, null, { timeout: 10000 });
    const sharedName = await sp.evaluate(() => window.__shared);
    check('触屏可分享时下载变分享按钮、share 拿到输出文件', hasShareBtn && JSON.stringify(sharedName) === '["test-compressed.webp"]', `${hasShareBtn}/${JSON.stringify(sharedName)}`);
    await sctx.close();
  }

  // 47g. 对比滑块：两边同几何、放大后仍同步、键盘可调（清单第 9 条）
  {
    const p = await newPage(browser);
    await upload(p, [T + 'test.jpg']);
    await waitDone(p, 1);
    await p.click('.item .thumb');
    await p.waitForSelector('.lb-divider', { timeout: 10000 });
    const geo = () => p.evaluate(() => {
      const cmp = document.querySelector('.lb-compare').getBoundingClientRect();
      const base = document.querySelector('.lb-compare > .lb-img').getBoundingClientRect();
      const clip = document.querySelector('.lb-orig-clip').getBoundingClientRect();
      const same = (a, b) => Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
      return { wrapEqBase: same(cmp, base), clipEqWrap: same(clip, cmp) };
    });
    const g0 = await geo();
    const r = await p.$eval('.lb-compare', (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
    await p.mouse.click(r.x + r.w * 0.75, r.y + r.h / 2);
    const zoomed = await p.$eval('.lb-stage', (el) => el.className.includes('zoomed'));
    const g1 = await geo();
    await p.focus('.lb-divider');
    await p.keyboard.press('ArrowRight');
    const posAfterKey = await p.$eval('.lb-divider', (el) => el.getAttribute('aria-valuenow'));
    check('对比滑块：两边同几何、放大后仍同步、键盘可调', g0.wrapEqBase && g0.clipEqWrap && zoomed && g1.wrapEqBase && g1.clipEqWrap && posAfterKey === '55', `${JSON.stringify(g0)}/${zoomed}/${JSON.stringify(g1)}/${posAfterKey}`);
    await p.close();
  }

  // 47g2. 分割线手机拖动：抓取区加宽、禁触摸滚动劫持，偏离细线首拖即动
  {
    const p = await newPage(browser, { viewport: { width: 390, height: 844 } });
    await upload(p, [T + 'test.jpg']);
    await waitDone(p, 1);
    await p.click('.item .thumb');
    await p.waitForSelector('.lb-divider', { timeout: 10000 });
    const ta = await p.$eval('.lb-divider', (el) => getComputedStyle(el).touchAction);
    const grabW = await p.$eval('.lb-divider', (el) => getComputedStyle(el, '::before').width);
    const r = await p.$eval('.lb-compare', (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
    const divX0 = await p.$eval('.lb-divider', (el) => el.getBoundingClientRect().left);
    // Start 15px off the visible 2px line: inside the 44px grab strip,
    // outside the old 2px hit area. The divider must move on this very
    // first attempt, not after the browser gives up a scroll gesture.
    await p.mouse.move(divX0 + 15, r.y + r.h / 2);
    await p.mouse.down();
    await p.mouse.move(r.x + r.w * 0.75, r.y + r.h / 2, { steps: 5 });
    await p.mouse.up();
    const posAfter = await p.$eval('.lb-divider', (el) => el.getAttribute('aria-valuenow'));
    check('分割线手机拖动：touch-action none、44px 抓取区、偏离 15px 首拖即动', ta === 'none' && grabW === '44px' && posAfter === '75', `${ta}/${grabW}/${posAfter}`);
    await p.close();
  }

  // 47h. 整页拖放：有结果后上传区缩成一行，拖到页面任意处都能进（清单第 10 条）
  {
    const p = await newPage(browser);
    const compact0 = await p.$eval('#dropzone', (el) => el.classList.contains('compact'));
    await upload(p, [T + 'test.jpg']);
    await waitDone(p, 1);
    const compact1 = await p.$eval('#dropzone', (el) => el.classList.contains('compact'));
    const compactText = await p.$eval('#dropzone', (el) => el.textContent);
    const pngBytes = [...fs.readFileSync(T + 'test.png')];
    const hintShown = await p.evaluate(async (bytes) => {
      const f = new File([new Uint8Array(bytes)], 'drag.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(f);
      document.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: dt }));
      await new Promise((r) => setTimeout(r, 100));
      return !!document.querySelector('.page-drop-hint');
    }, pngBytes);
    await p.evaluate(async (bytes) => {
      const f = new File([new Uint8Array(bytes)], 'page.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(f);
      document.body.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
    }, pngBytes);
    await waitDone(p, 2);
    const count = await p.$$eval('.item', (els) => els.length);
    check('整页拖放：有结果后上传区缩行、任意处拖放进列表', !compact0 && compact1 && compactText.includes('添加更多') && hintShown && count === 2, `${compact0}/${compact1}/${hintShown}/${count}`);
    await p.close();
  }

  // 47i. 行尺寸常显（1.0.5 按模板改）：行里有尺寸行（未缩放时显示原尺寸 →
  // 原尺寸），详情仍在预览里
  {
    const p = await newPage(browser);
    await upload(p, [T + 'test.png']);
    await waitDone(p, 1);
    const rowText = await p.$eval('.item', (el) => el.textContent);
    const dimsText = await p.$eval('.item .dims', (el) => el.textContent);
    await p.click('.item .thumb');
    await p.waitForSelector('.lb-overlay', { timeout: 10000 });
    const lbInfo = await p.$eval('.lb-info', (el) => el.textContent).catch(() => null);
    check('行尺寸常显、详情仍在预览', /↓/.test(rowText) && /−\d+%/.test(rowText) && dimsText === '1600×1200↓1600×1200' && !!lbInfo && lbInfo.includes('×'), `${rowText.trim().slice(0, 60)} / ${dimsText} / ${lbInfo}`);
    await p.close();
  }

  // 47j. 新预设 + 记住设置：网站/博客、邮件附件可点，改动刷新后仍在（清单第 12 条）
  {
    const p = await newPage(browser);
    await pickPreset(p, 'website');
    await p.waitForTimeout(300);
    const maxWeb = await p.$eval('#maxSize', (el) => el.value);
    const fmtWeb = await p.$eval('#formatSelect', (el) => el.value);
    const webActive = await p.$eval('#presetSelect', (el) => (el.value === 'website' ? 'active' : ''));
    await pickPreset(p, 'email');
    await p.waitForTimeout(300);
    const modeEmail = await p.$eval('#modeSeg .seg-btn.active', (el) => el.dataset.mode);
    const tgtEmail = await p.$eval('#targetSize', (el) => el.value);
    const fmtEmail = await p.$eval('#formatSelect', (el) => el.value);
    const emailActive = await p.$eval('#presetSelect', (el) => (el.value === 'email' ? 'active' : ''));
    await fillMax(p, '1234');
    await p.waitForTimeout(900);
    await p.reload();
    await p.waitForSelector('#dropzone', { timeout: 15000 });
    const maxAfterReload = await p.$eval('#maxSize', (el) => el.value);
    check('新预设 + 记住设置', maxWeb === '1600' && fmtWeb === 'image/webp' && webActive.includes('active') && modeEmail === 'target' && tgtEmail === '1000' && fmtEmail === 'image/jpeg' && emailActive.includes('active') && maxAfterReload === '1234', `${maxWeb}/${fmtWeb}/${modeEmail}/${tgtEmail}/${maxAfterReload}`);
    await p.close();
  }

  // 48. SEO /en/ 壳：SW 接管后导航仍是英文壳（导航兜底已收窄到根路径）
  {
    const ctxS = await browser.newContext({ locale: 'en-US' });
    const p = await ctxS.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await p.evaluate(async () => {
      try { await Promise.race([navigator.serviceWorker.ready, new Promise((_, r) => setTimeout(r, 20000))]); } catch {}
    });
    await p.goto(BASE + 'en/', { waitUntil: 'networkidle' });
    const lang = await p.evaluate(() => document.documentElement.lang);
    const title = await p.title();
    const stored = await p.evaluate(() => localStorage.getItem('ic-lang'));
    check('SEO /en/：SW 接管下仍是英文壳', lang === 'en' && title.includes('Image Compressor') && stored === 'en', `${lang} | ${title} | ${stored}`);
    await ctxS.close();
  }

  // 49. 灯箱：点图三档循环（适合→100%→200%→适合）、Esc 关闭
  // 真实点击必须避开分界线（居中）：点压缩侧 75% 处；$eval 点击会绕过
  // 命中测试，测不到分界线挡点击的问题，故这里用真实鼠标坐标。
  {
    const p = await newPage(browser);
    await upload(p, [T + 'test.jpg']);
    await waitDone(p, 1);
    await p.click('.item .thumb');
    await p.waitForSelector('.lb-overlay', { timeout: 10000 });
    const r = await p.$eval('.lb-compare', (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
    await p.mouse.click(r.x + r.w * 0.75, r.y + r.h / 2);
    const zoomed = await p.$eval('.lb-stage', (el) => el.className.includes('zoomed'));
    // 放大后图片是原尺寸，须先滚回视口内再点 75% 处。
    await p.$eval('.lb-compare', (el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
    const r2 = await p.$eval('.lb-compare', (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
    await p.mouse.click(r2.x + r2.w * 0.75, r2.y + r2.h / 2);
    const stillZoomed = await p.$eval('.lb-stage', (el) => el.className.includes('zoomed'));
    // 200% 时图片宽于视口：把舞台滚到最右，点右缘（压缩侧）回到适合。
    await p.$eval('.lb-stage', (el) => { el.scrollLeft = el.scrollWidth; });
    const st = await p.$eval('.lb-stage', (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
    await p.mouse.click(st.x + st.w - 50, st.y + st.h / 2);
    const unzoomed = await p.$eval('.lb-stage', (el) => !el.className.includes('zoomed'));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    const gone = await p.$eval('.lb-overlay', () => false).catch(() => true);
    check('灯箱：点图三档循环、Esc 关闭', zoomed && stillZoomed && unzoomed && gone, `${zoomed}/${stillZoomed}/${unzoomed}/${gone}`);
    await p.close();
  }

  // 49. 智能（默认）：格式和画质都是智能。照片出 WebP 并显示所选画质；
  // 透明图标/logo 与色彩少的图形出 PNG 调色板；点场景切出智能
  page = await newPage(browser);
  const smartMode = await page.$eval('#modeSeg .seg-btn.active', (el) => el.dataset.mode);
  const smartFmt = await page.$eval('#formatSelect', (el) => el.value);
  const smartQVis = await page.$eval('#qualityField', (el) => getComputedStyle(el).display);
  const smartNote = await page.$eval('#settingsNote', (el) => el.textContent);
  check('智能是默认：格式智能、画质智能、质量滑杆隐藏、有说明', smartMode === 'auto' && smartFmt === 'auto' && smartQVis === 'none' && smartNote.includes('智能'), `${smartMode}/${smartFmt}/${smartQVis}/${smartNote}`);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  const smartPhoto = await page.$eval('.item .item-actions a', (a) => a.getAttribute('download'));
  check('智能：照片出 WebP', smartPhoto.endsWith('.webp'), smartPhoto);
  await page.click('.item .thumb');
  await page.waitForSelector('.lb-overlay', { timeout: 10000 });
  const smartQInfo = await page.$eval('.lb-info', (el) => el.textContent);
  const smartQ = parseInt((smartQInfo.match(/智能画质 (\d+)/) || [])[1], 10);
  check('智能画质：预览显示所选画质且在 50–90', smartQ >= 50 && smartQ <= 90, smartQInfo);
  await page.close();
  page = await newPage(browser);
  await upload(page, T + 'alpha.png');
  await waitDone(page, 1);
  const smartAlpha = await page.$eval('.item .item-actions a', (a) => a.getAttribute('download'));
  const smartAlphaRow = await page.$eval('.item', (el) => el.textContent);
  check('智能：透明图标出 PNG 且不提示填白', smartAlpha.endsWith('.png') && !smartAlphaRow.includes('填充白色'), `${smartAlpha}/${smartAlphaRow.replace(/\s+/g, ' ')}`);
  await page.close();
  page = await newPage(browser);
  await upload(page, T + 'flat.png');
  await waitDone(page, 1);
  const smartFlat = await page.$eval('.item .item-actions a', (a) => a.getAttribute('download'));
  const smartFlatSize = await outSize(page);
  const flatOrig = fs.statSync(T + 'flat.png').size;
  check('智能：色彩少的图形出 PNG 且不大于原图', smartFlat.endsWith('.png') && smartFlatSize <= flatOrig, `${smartFlat}/${smartFlatSize}/${flatOrig}`);
  await page.close();
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  await change(page, () => pickPreset(page, 'wechat'));
  const smartExit = await page.$eval('#modeSeg .seg-btn.active', (el) => el.dataset.mode);
  check('智能：点场景切出智能进手动画质', smartExit === 'quality', smartExit);
  await page.close();
  // 保持原格式：照片留 JPG、透明图留 PNG（替代旧的“智能 + 按原格式”勾选）
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  const keepBefore = await page.$eval('.item .item-actions a', (a) => a.getAttribute('download'));
  await change(page, () => page.selectOption('#formatSelect', 'original'));
  const keepJpg = await page.$eval('.item .item-actions a', (a) => a.getAttribute('download'));
  check('保持原格式：照片不转 WebP、留 JPG', keepBefore.endsWith('.webp') && keepJpg.endsWith('.jpg'), `${keepBefore}/${keepJpg}`);
  await page.close();
  page = await newPage(browser);
  await upload(page, T + 'alpha.png');
  await waitDone(page, 1);
  await change(page, () => page.selectOption('#formatSelect', 'original'));
  const keepPng = await page.$eval('.item .item-actions a', (a) => a.getAttribute('download'));
  check('保持原格式：透明图留 PNG', keepPng.endsWith('.png'), keepPng);
  await page.close();
  // 旧版保存的设置迁移：smartKeepOriginal → 保持原格式
  {
    const ctx = await browser.newContext({ locale: 'zh-CN' });
    await ctx.addInitScript(() => { if (!sessionStorage.getItem('m')) { sessionStorage.setItem('m', '1'); localStorage.setItem('ic-lang', 'zh'); localStorage.setItem('ic-settings', JSON.stringify({ format: 'image/jpeg', smartKeepOriginal: true })); } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(BASE);
    await p.waitForSelector('#dropzone');
    const migrated = await p.$eval('#formatSelect', (el) => el.value);
    check('旧设置迁移：按原格式输出 → 保持原格式', migrated === 'original', migrated);
    await ctx.close();
  }

  // 50. 进站默认智能：模式不保存、其他设置仍记住
  page = await newPage(browser);
  await toQualityEmpty(page);
  await fillMax(page, '1234');
  await page.waitForTimeout(900);
  await page.reload();
  await page.waitForSelector('#dropzone', { timeout: 15000 });
  const modeAfterReload = await page.$eval('#modeSeg .seg-btn.active', (el) => el.dataset.mode);
  const maxAfterReload2 = await page.$eval('#maxSize', (el) => el.value);
  check('进站默认智能：模式不保存、其他设置仍记住', modeAfterReload === 'auto' && maxAfterReload2 === '1234', `${modeAfterReload}/${maxAfterReload2}`);
  await page.close();

  // 51. 分段按钮：格式/模式/尺寸切换与 active 状态、高级组按格式显隐
  page = await newPage(browser);
  await upload(page, T + 'test.jpg');
  await waitDone(page, 1);
  await toQuality(page);
  await change(page, () => page.selectOption('#formatSelect', 'image/png'));
  const fmtActive = await page.$eval('#formatSelect', (el) => el.value);
  const quantVis = await page.$eval('#quantize', (el) => getComputedStyle(el.closest('.check')).display);
  await change(page, () => clickResize(page, 'percent'));
  const resizeActive = await page.$eval('#resizeSeg .seg-btn.active', (el) => el.dataset.resize);
  const maxMax = await page.$eval('#maxSize', (el) => el.max);
  check('格式下拉/尺寸分段切换、active 状态与量化显隐', fmtActive === 'image/png' && quantVis !== 'none' && resizeActive === 'percent' && maxMax === '100', `${fmtActive}/${quantVis}/${resizeActive}/${maxMax}`);
  await page.close();

  // 52. 失败重试：损坏图片出错后点重试（错误先消失再重现＝重新执行过）
  page = await newPage(browser);
  await upload(page, T + 'corrupt.jpg');
  await page.waitForSelector('.item .error', { timeout: 15000 });
  const retryBtn = await page.$('.item .retry-btn');
  await page.click('.item .retry-btn');
  await page.waitForFunction(() => !document.querySelector('.item .error'), null, { timeout: 5000 });
  await page.waitForSelector('.item .error', { timeout: 15000 });
  const errAgain = await page.$eval('.item .error', (el) => el.textContent);
  check('失败行有重试按钮、点重试后重新执行仍报错', !!retryBtn && !!errAgain, `${!!retryBtn}/${errAgain}`);
  await page.close();

  // 53. 移动端空态设置默认折叠、点摘要可展开
  page = await newPage(browser, { viewport: { width: 390, height: 844 } });
  const sumVis = await page.$eval('.settings-summary', (el) => getComputedStyle(el).display);
  const bodyBefore = await page.$eval('#settingsCard .settings-body', (el) => getComputedStyle(el).display);
  await page.click('.settings-summary');
  const bodyAfter = await page.$eval('#settingsCard .settings-body', (el) => getComputedStyle(el).display);
  check('移动端空态设置默认折叠、点摘要展开', sumVis !== 'none' && bodyBefore === 'none' && bodyAfter !== 'none', `${sumVis}/${bodyBefore}/${bodyAfter}`);
  await page.close();

  // 54. 上传区本地处理说明
  page = await newPage(browser);
  const localNote = await page.$eval('.drop-local', (el) => el.textContent);
  check('上传区说明本地处理、不上传', localNote.includes('不会上传'), localNote);
  await page.close();

  // 105i1. 轮播按整张翻页、到头贴边无留白（后续 4 #1）
  {
    const p = await newPage(browser, { viewport: { width: 1280, height: 720 } });
    await upload(p, [T + 'test.jpg', T + 'test.jpg', T + 'test.jpg', T + 'test.jpg', T + 'test.jpg', T + 'test.jpg']);
    await waitDone(p, 6);
    const landings = await p.evaluate(async () => {
      const vp = document.querySelector('.strip-viewport');
      const navs = [...document.querySelectorAll('.strip-nav')];
      const next = navs[navs.length - 1];
      const out = [];
      for (let i = 0; i < 5 && next && !next.disabled; i++) {
        next.click(); await new Promise(r => setTimeout(r, 900));
        const tl = [...document.querySelectorAll('.strip-tile')];
        const vpr = vp.getBoundingClientRect();
        out.push({ sl: vp.scrollLeft, max: vp.scrollWidth - vp.clientWidth,
          aligned: vp.scrollLeft % 108 === 0 || vp.scrollLeft === vp.scrollWidth - vp.clientWidth,
          tailBlank: Math.round(vpr.right - tl[tl.length - 1].getBoundingClientRect().right) });
      }
      return out;
    });
    const last = landings[landings.length - 1];
    check('轮播翻页落在整张对齐位、到头尾张贴边', landings.length > 0 && landings.every(l => l.aligned) && last.sl === last.max && last.tailBlank === 0, JSON.stringify(landings));
    await p.close();
  }

  // 105i2. 上传卡与结果卡间距收紧（后续 4 #2）
  {
    const p = await newPage(browser, { viewport: { width: 1180, height: 820 }, colorScheme: 'dark' });
    await upload(p, [T + 'test.jpg']);
    await waitDone(p, 1);
    const gap = await p.evaluate(() => {
      const up = document.querySelector('#uploadCard'), res = document.querySelector('#resultCard');
      return { edge: Math.round(res.getBoundingClientRect().top - up.getBoundingClientRect().bottom),
        upPadB: getComputedStyle(up).paddingBottom, resPadT: getComputedStyle(res).paddingTop };
    });
    check('卡片间距 16+12+16（原 24+20+24）', gap.edge === 12 && gap.upPadB === '16px' && gap.resPadT === '16px', JSON.stringify(gap));
    await p.close();
  }

  // 105i3. 行尺寸上下布局、名字格不再压到 54px（后续 4 #3/#5）
  {
    const p = await newPage(browser, { viewport: { width: 1180, height: 820 }, colorScheme: 'dark' });
    await upload(p, [T + 'long-45C5DC1A-A4B5-489C-A4FA-147AF98EE7E.png']);
    await waitDone(p, 1);
    const row = await p.evaluate(() => {
      const r = document.querySelector('#list .item');
      const d = r.querySelector('.dims');
      const nm = r.querySelector('.cell-name');
      return { kids: [...d.children].map(c => c.textContent), arrow: !!d.querySelector('.dims-arrow'),
        overflow: d.scrollWidth > d.clientWidth + 1, nameW: Math.round(nm.getBoundingClientRect().width) };
    });
    check('尺寸纵向三段（原/↓/压后）、不溢出、名字格≥90', row.kids.length === 3 && row.kids[1] === '↓' && row.arrow && !row.overflow && row.nameW >= 90, JSON.stringify(row));
    await p.close();
  }

  // 105i4. 设置四行（2.1）
  {
    const p = await newPage(browser, { viewport: { width: 1180, height: 820 } });
    await upload(p, [T + 'test.jpg']);
    await waitDone(p, 1);
    const rows = await p.evaluate(() => [...document.querySelectorAll('.settings .srow-label')].map((el) => el.textContent.trim()));
    check('设置四行：场景 / 格式 / 压缩 / 尺寸', rows.join('|') === '一键场景|输出格式|压缩|尺寸', rows.join('|'));
    await p.close();
  }

  // 105i5. 预览卡节省头条醒目（后续 4 #4）
  {
    const p = await newPage(browser, { viewport: { width: 1180, height: 820 } });
    await upload(p, [T + 'test.jpg']);
    await waitDone(p, 1);
    await p.click('.strip-tile');
    await p.waitForTimeout(800);
    const save = await p.evaluate(() => {
      const el = document.querySelector('#previewCard .pv-save');
      return el ? { text: el.textContent, size: getComputedStyle(el).fontSize } : null;
    });
    check('预览卡有大号节省头条（−% · 已节省）', !!save && /−\d+%/.test(save.text) && save.size === '20px', JSON.stringify(save));
    await p.close();
  }

  // 105i6. 表格超 20 条分页（后续 4 #8）
  {
    const p = await newPage(browser, { viewport: { width: 1180, height: 820 } });
    for (let i = 0; i < 21; i++) await upload(p, [T + 'test.png']);
    await waitDone(p, 21, 120000);
    const pg1 = await p.evaluate(() => ({ rows: document.querySelectorAll('#list .item').length, label: document.querySelector('.pager-label')?.textContent }));
    await p.click('.pager button:last-child');
    await p.waitForTimeout(500);
    const pg2 = await p.evaluate(() => ({ rows: document.querySelectorAll('#list .item').length, label: document.querySelector('.pager-label')?.textContent }));
    await p.click('.pager button:first-child');
    await p.waitForTimeout(500);
    const pgBack = await p.evaluate(() => ({ rows: document.querySelectorAll('#list .item').length, label: document.querySelector('.pager-label')?.textContent }));
    check('21 条分页：第 1 页 20 条、第 2 页 1 条、可返回', pg1.rows === 20 && pg1.label === '第 1 / 2 页' && pg2.rows === 1 && pg2.label === '第 2 / 2 页' && pgBack.rows === 20, JSON.stringify({ pg1, pg2, pgBack }));
    await p.close();
  }

  // 45. 全程无页面 JS 报错
  check('全程无页面 JS 报错', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  console.log(`\n==== ${passed} passed, ${failed} failed ====`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('SUITE CRASH', e); process.exit(2); });
