// Drives the on-screen buttons with real touch events on a phone-sized screen.
// Upright by default; add the word land for a phone held sideways:  node test/touch.js land
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const PAGE = require('url').pathToFileURL(path.join(__dirname, '../index.html')).href;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const land = process.argv[2] === 'land';
  const vp = land ? { width: 780, height: 360 } : { width: 390, height: 780 };
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  let errors = 0;
  page.on('pageerror', e => { console.log('PAGE ERROR:', e.message); errors++; });
  await page.goto(PAGE);
  await sleep(500);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: p[2] == null ? i : p[2] })) });
  const rect = id => page.evaluate(id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, id);
  const st = () => page.evaluate(() => { const t = window.__tobi, G = t.G, S = G.S; return { mode: G.mode, touchUI: G.touchUI, x: S ? +(S.p.x / 16).toFixed(1) : null, ground: S ? S.p.ground : null, vx: S ? +S.p.vx.toFixed(2) : null, view: t.view(), overlay: document.getElementById('stage').classList.contains('overlay'), padHidden: document.getElementById('pad').hidden }; });
  console.log('start', JSON.stringify(await st()));
  const g = await rect('game');
  // tap the screen to start, tap again to skip the stage card
  await touch('touchStart', [[g.x + g.w / 2, g.y + g.h * 0.8]]); await touch('touchEnd', []); await sleep(700);
  console.log('after tap', JSON.stringify(await st()));
  await touch('touchStart', [[g.x + g.w / 2, g.y + g.h * 0.8]]); await touch('touchEnd', []); await sleep(1200);
  const s0 = await st(); console.log('playing', JSON.stringify(s0));
  await page.evaluate(() => { window.__tobi.G.S.god = true; });
  const d = await rect('dpad'), ab = await rect('ab');
  // hold right
  await touch('touchStart', [[d.x + d.w * 0.75, d.y + d.h / 2, 1]]); await sleep(700);
  const s1 = await st(); console.log('held right', JSON.stringify({ x: s1.x, vx: s1.vx }));
  // add a second finger on A (jump) while still holding right
  await touch('touchStart', [[d.x + d.w * 0.75, d.y + d.h / 2, 1], [ab.x + ab.w * 0.8, ab.y + ab.h * 0.3, 2]]); await sleep(150);
  const s2 = await st(); console.log('right + jump', JSON.stringify({ x: s2.x, ground: s2.ground }));
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  await page.screenshot({ path: path.join(__dirname, 'out', 'touch_' + (land ? 'land' : 'port') + '.png') });
  // slide the jump thumb to the middle (run + jump), then release everything
  await touch('touchMove', [[d.x + d.w * 0.75, d.y + d.h / 2, 1], [ab.x + ab.w * 0.5, ab.y + ab.h * 0.5, 2]]); await sleep(100);
  const both = await page.evaluate(() => document.getElementById('ab').dataset.on);
  await touch('touchEnd', []); await sleep(400);
  // slide across the d-pad: right to left
  await touch('touchStart', [[d.x + d.w * 0.75, d.y + d.h / 2, 3]]); await sleep(60);
  await touch('touchMove', [[d.x + d.w * 0.2, d.y + d.h / 2, 3]]); await sleep(500);
  const s3 = await st(); await touch('touchEnd', []); await sleep(300);
  const s4 = await st();
  console.log('slid to left', JSON.stringify({ vx: s3.vx }), 'released', JSON.stringify({ vx: s4.vx }), 'run+jump zone:', both);
  const ok = s0.mode === 'play' && s0.touchUI && s1.x > s0.x + 2 && s2.ground === false && s3.vx < 0 && Math.abs(s4.vx) < 0.01 && both === 'ba' && !errors;
  console.log(ok ? 'TOUCH OK' : 'TOUCH FAILED');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
