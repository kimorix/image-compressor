// Rasterize public/icons/icon.svg to PNGs with the headless browser.
const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell';
const svg = fs.readFileSync('/home/hatch/workspace/image-compressor/public/icons/icon.svg', 'utf8');
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage();
  for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-maskable-512.png', 512, 64]]) {
    const inner = pad ? `<div style="width:${size}px;height:${size}px;background:#5e6ad2;display:flex;align-items:center;justify-content:center"><div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${svg}</div></div>` : svg;
    await page.setContent(`<body style="margin:0">${inner}</body>`);
    await page.setViewportSize({ width: size, height: size });
    const buf = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } });
    fs.writeFileSync('/home/hatch/workspace/image-compressor/public/icons/' + name, buf);
    console.log(name, buf.length, 'bytes');
  }
  await browser.close();
})().catch((e) => { console.log('CRASH', e.message); process.exit(1); });
