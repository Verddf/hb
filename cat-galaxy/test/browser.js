// Checks the game in a real browser (Chromium, through Playwright):
//
//  1. Layout at 13 window sizes, small phones to large desktops: the page never
//     scrolls sideways, the main buttons show without scrolling, the HUD fits,
//     and the galaxy fits below the HUD (turned on its side on tall screens).
//  2. Input: a key press and a tap both make Mochi leap, and pausing stops the clock.
//  3. The whole game: all eight levels played through the real page, from the
//     title screen to the ending, with the leap times found by levels.js.
//     Every level must end with three stars and the progress must be saved.
//
//   node test/browser.js           run the checks
//   node test/browser.js --shots   also save the pictures in screenshots/
//
// Needs Playwright and its Chromium (npm install, then npx playwright install chromium).
// Runs levels.js first when test/out/plans.json is missing or older than index.html.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const PAGE = pathToFileURL(path.join(ROOT, 'index.html')).href;
const PLANS = path.join(__dirname, 'out', 'plans.json');
const SHOTS = process.argv.includes('--shots');

let problems = 0;
const fail = (msg) => { problems++; console.log('  PROBLEM: ' + msg); };

function loadPlans() {
  const html = path.join(ROOT, 'index.html');
  if (!fs.existsSync(PLANS) || fs.statSync(PLANS).mtimeMs < fs.statSync(html).mtimeMs) {
    console.log('Finding leap times with levels.js first...');
    execFileSync(process.execPath, [path.join(__dirname, 'levels.js')], { stdio: 'inherit' });
  }
  return JSON.parse(fs.readFileSync(PLANS, 'utf8'));
}

// Report script errors from the page (but not a missing web font when offline)
function watch(page, where) {
  page.on('pageerror', (e) => fail(where + ': script error: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|net::|fonts\.g/.test(m.text())) fail(where + ': console error: ' + m.text());
  });
}

const state = (page) => page.evaluate(() => {
  const { game, view } = window.__catGalaxy;
  const w = game.world;
  return { mode: game.mode, t: w.t, cat: w.cat.state, planet: w.cat.planet, lives: w.lives, fish: w.fishGot, view: Object.assign({}, view) };
});

// Is the element fully on screen, without scrolling?
const onScreen = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5;
}, sel);

async function shot(page, name) {
  if (!SHOTS) return;
  await page.screenshot({ path: path.join(ROOT, 'screenshots', name + '.jpg'), type: 'jpeg', quality: 86 });
  console.log('  saved screenshots/' + name + '.jpg');
}

// ---------------------------------------------------------------------------
// 1. Layout
// ---------------------------------------------------------------------------
async function checkLayouts(browser) {
  console.log('Layout');
  const sizes = [
    [320, 568, true], [360, 740, true], [390, 844, true], [430, 932, true], [768, 1024, true], [1024, 1366, true],
    [568, 320, true], [844, 390, true], [932, 430, true],
    [1024, 768, false], [1280, 720, false], [1440, 900, false], [2560, 1440, false]
  ];
  for (const [w, h, touch] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
    const page = await ctx.newPage();
    const where = w + 'x' + h;
    watch(page, where);
    await page.goto(PAGE);
    await page.waitForTimeout(400);
    const notes = [];
    const scroll = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight }));
    if (scroll.sw > scroll.iw || scroll.sh > scroll.ih) fail(where + ': the page scrolls (' + scroll.sw + 'x' + scroll.sh + ')');
    if (!(await onScreen(page, '#btn-play'))) fail(where + ': the Play button is off screen on the title');

    await page.click('#btn-play');
    await page.waitForTimeout(450);
    if (!(await onScreen(page, '#btn-go'))) fail(where + ': the Launch button is off screen on the level card');
    await page.click('#btn-go');
    await page.waitForTimeout(300);

    // The galaxy, its edge included, must sit inside the window and below the HUD
    const g = await page.evaluate(() => {
      const { view } = window.__catGalaxy;
      const { WIDTH, HEIGHT, EDGE } = window.CatGalaxy.CONFIG;
      const fw = (view.turned ? HEIGHT : WIDTH) + EDGE * 2, fh = (view.turned ? WIDTH : HEIGHT) + EDGE * 2;
      const left = view.ox - EDGE * view.s, top = view.oy - EDGE * view.s;
      const hud = document.getElementById('hud');
      return {
        left, top, right: left + fw * view.s, bottom: top + fh * view.s, s: view.s, turned: view.turned,
        hudBottom: hud.getBoundingClientRect().bottom, hudOverflow: hud.scrollWidth > hud.clientWidth + 1
      };
    });
    if (g.left < -0.5 || g.right > w + 0.5 || g.bottom > h + 0.5) fail(where + ': the galaxy does not fit the window');
    if (g.top < g.hudBottom - 0.5) fail(where + ': the galaxy is under the HUD');
    if (g.hudOverflow) fail(where + ': the HUD is too wide');
    const mochi = 39 * 1.3 * g.s;   // Mochi's drawn height in CSS pixels
    if (mochi < 13) fail(where + ': Mochi is only ' + mochi.toFixed(1) + ' px tall');
    notes.push((g.turned ? 'turned, ' : '') + 'scale ' + g.s.toFixed(2) + ', Mochi ' + Math.round(mochi) + ' px');

    // The pause card and the level-complete card show their main button without scrolling
    await page.keyboard.press('p');
    await page.waitForTimeout(100);
    if (!(await onScreen(page, '#btn-resume'))) fail(where + ': the Resume button is off screen');
    await page.evaluate(() => {
      const { game } = window.__catGalaxy;
      const w = game.world;
      w.fish.forEach((f) => (f.got = true));
      w.fishGot = w.fish.length;
      w.portal.open = true;
      w.cat.state = 'warp';
      w.cat.timer = 0.01;
      w.finishTime = 9;
      game.mode = 'play';
    });
    await page.waitForTimeout(700);
    if ((await state(page)).mode !== 'clear') fail(where + ': the level did not end');
    if (!(await onScreen(page, '#btn-next'))) fail(where + ': the Next level button is off screen');
    console.log('  ' + where.padEnd(10) + (touch ? ' touch  ' : '        ') + notes.join(', '));
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------
// 2. Input
// ---------------------------------------------------------------------------
async function checkInput(browser) {
  console.log('Input');
  // A tap on a phone
  let ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  let page = await ctx.newPage();
  watch(page, 'tap');
  await page.goto(PAGE);
  await page.tap('#btn-play');
  await page.waitForTimeout(450);
  await page.tap('#btn-go');
  await page.waitForTimeout(500);
  await page.touchscreen.tap(195, 600);
  await page.waitForTimeout(80);
  let s = await state(page);
  if (s.cat !== 'flying') fail('a tap did not make Mochi leap (Mochi is ' + s.cat + ')');
  else console.log('  a tap makes Mochi leap');
  await ctx.close();

  // Space on a keyboard, then pause and resume
  ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  page = await ctx.newPage();
  watch(page, 'keys');
  await page.goto(PAGE);
  await page.click('#btn-play');
  await page.waitForTimeout(450);
  await page.keyboard.press('Enter');          // Launch has the focus
  await page.waitForTimeout(500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(80);
  s = await state(page);
  if (s.cat !== 'flying') fail('Space did not make Mochi leap (Mochi is ' + s.cat + ')');
  else console.log('  Space makes Mochi leap');
  await page.keyboard.press('p');
  const t1 = (await state(page)).t;
  await page.waitForTimeout(400);
  s = await state(page);
  if (s.mode !== 'paused' || s.t !== t1) fail('pausing did not stop the game');
  await page.keyboard.press('p');
  await page.waitForTimeout(300);
  s = await state(page);
  if (s.mode !== 'play' || s.t <= t1) fail('the game did not resume');
  else console.log('  P pauses and resumes');
  await page.keyboard.press('m');
  if ((await page.getAttribute('#btn-sound', 'aria-pressed')) !== 'false') fail('M did not turn the sound off');
  else console.log('  M turns the sound off');
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 3. The whole game, with a fast-forwarded clock
// ---------------------------------------------------------------------------
async function playThrough(browser, plans) {
  console.log('The whole game');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  watch(page, 'play-through');
  await page.clock.install();
  await page.goto(PAGE);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
  await page.reload();
  // Leap on exactly the steps the search chose. G.step is looked up on every
  // call, so wrapping it here reaches the real game loop.
  await page.evaluate((plans) => {
    const G = window.CatGalaxy, real = G.step, STEP = G.CONFIG.STEP;
    G.step = (w, jump) => {
      const playing = window.__catGalaxy.game.mode === 'play';
      const planned = playing && plans[w.index].some((t) => Math.abs(w.t + STEP - t) < STEP / 2);
      return real(w, jump || planned);
    };
  }, plans);
  const click = (sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel);
  const run = (ms) => page.clock.runFor(ms);

  await run(1500);
  await shot(page, 'title');
  await click('[data-go="help"]');
  await run(500);
  await shot(page, 'how-to-play');
  await click('#btn-help-back');
  await click('#btn-play');
  // Pictures: level 1 just before the first leap (the guide line shows), the others mid-flight
  const pictures = {
    0: { name: 'level-1-first-hop', at: (leaps) => leaps[0] - 0.1 },
    3: { name: 'level-4-moon-rocks', at: (leaps) => leaps[3] + 0.35 },
    5: { name: 'level-6-event-horizon', at: (leaps) => leaps[3] + 0.35 },
    6: { name: 'level-7-dog-patrol', at: (leaps) => leaps[3] + 0.35 },
    7: { name: 'level-8-home-galaxy', at: (leaps) => leaps[3] + 0.35 }
  };
  for (let i = 0; i < plans.length; i++) {
    await run(500);
    let s = await state(page);
    if (s.mode !== 'intro') { fail('level ' + (i + 1) + ' did not open (screen: ' + s.mode + ')'); break; }
    await click('#btn-go');
    // Run until the level ends, stopping once for a picture
    const picture = pictures[i];
    let pictured = !picture;
    for (let k = 0; k < 2400; k++) {
      const left = pictured ? 250 : (picture.at(plans[i]) - s.t) * 1000;
      await run(Math.max(8, Math.min(250, left)));
      s = await state(page);
      if (!pictured && s.t >= picture.at(plans[i]) - 0.01) { pictured = true; await shot(page, picture.name); }
      if (s.mode !== 'play') break;
    }
    const result = await page.evaluate(() => ({ r: window.__catGalaxy.game.lastResult, lives: window.__catGalaxy.game.world.lives }));
    if (s.mode !== 'clear' && !(i === plans.length - 1 && s.mode === 'clear')) { fail('level ' + (i + 1) + ' did not finish (screen: ' + s.mode + ', ' + s.fish + ' fish)'); break; }
    const r = result.r;
    console.log('  level ' + (i + 1) + ': ' + r.stars + ' stars, ' + r.time.toFixed(1) + ' s, ' + r.total + ' points, ' + result.lives + ' lives left');
    if (r.stars !== 3) fail('level ' + (i + 1) + ' ended with ' + r.stars + ' stars instead of 3');
    if (i === 0) { await run(900); await shot(page, 'level-complete'); }
    await run(600);
    await click('#btn-next');
  }
  await run(500);
  const end = await page.evaluate(() => ({
    mode: window.__catGalaxy.game.mode,
    score: document.getElementById('win-score').textContent,
    stars: document.getElementById('win-stars').textContent,
    saved: JSON.parse(localStorage.getItem('cat-galaxy-save-v1') || 'null')
  }));
  if (end.mode !== 'win') fail('the ending did not show (screen: ' + end.mode + ')');
  else console.log('  the ending shows: score ' + end.score + ', stars ' + end.stars);
  if (!end.saved || end.saved.unlocked !== plans.length || end.saved.stars.some((n) => n !== 3)) fail('progress was not saved: ' + JSON.stringify(end.saved));
  else console.log('  progress saved: all levels open, 3 stars each');
  await ctx.close();
}

// A picture of a phone held upright, mid-level
async function phonePicture(browser, plans) {
  if (!SHOTS) return;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.clock.install();
  await page.goto(PAGE);
  await page.evaluate(() => localStorage.setItem('cat-galaxy-save-v1', JSON.stringify({ unlocked: 8, stars: [3, 3, 3, 2, 0, 0, 0, 0], best: 0, muted: false })));
  await page.reload();
  await page.evaluate((plans) => {
    const G = window.CatGalaxy, real = G.step, STEP = G.CONFIG.STEP;
    G.step = (w, jump) => real(w, jump || (window.__catGalaxy.game.mode === 'play' && plans[w.index].some((t) => Math.abs(w.t + STEP - t) < STEP / 2)));
  }, plans);
  await page.clock.runFor(500);
  await page.evaluate(() => document.querySelector('[data-go="levels"]').click());
  await page.clock.runFor(500);
  await page.evaluate(() => document.querySelectorAll('.level-card')[4].click());
  await page.clock.runFor(500);
  await page.evaluate(() => document.getElementById('btn-go').click());
  const at = plans[4][2] + 0.3;
  for (let k = 0; k < 200; k++) {
    await page.clock.runFor(100);
    if ((await state(page)).t >= at) break;
  }
  await shot(page, 'phone');
  await ctx.close();
}

(async () => {
  const plans = loadPlans();
  if (SHOTS) fs.mkdirSync(path.join(ROOT, 'screenshots'), { recursive: true });
  const browser = await chromium.launch();
  try {
    await checkLayouts(browser);
    await checkInput(browser);
    await playThrough(browser, plans);
    await phonePicture(browser, plans);
  } finally {
    await browser.close();
  }
  console.log('\n' + (problems ? problems + ' PROBLEM(S)' : 'The game works in the browser.'));
  process.exit(problems ? 1 : 0);
})();
