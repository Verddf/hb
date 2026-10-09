// Plays the whole game in a real browser, start to finish, through the real screens.
// A search-based player works out the inputs for each stage, then they are fed to the game.
// Pictures taken along the way are saved in test/out/.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const PAGE = require('url').pathToFileURL(path.join(__dirname, '../index.html')).href;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const W = +process.argv[2] || 1100, H = +process.argv[3] || 720;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  let errors = 0;
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) { console.log('console.error:', m.text()); errors++; } });
  page.on('pageerror', e => { console.log('PAGE ERROR:', e.message, (e.stack || '').split('\n').slice(0, 5).join(' | ')); errors++; });
  await page.goto(PAGE);
  await page.addScriptTag({ path: path.join(__dirname, 'bot.js') });
  await sleep(700);
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const out = n => path.join(__dirname, 'out', 'e2e_' + n + '.png');
  const mode = () => page.evaluate(() => window.__tobi.G.mode);
  const waitMode = async (m, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await mode() === m) return true; await sleep(100); } return false; };
  console.log('view', JSON.stringify(await page.evaluate(() => window.__tobi.view())));
  await page.keyboard.press('Enter');
  for (let li = 0; li < 4; li++) {
    if (!await waitMode('intro', 8000)) { console.log('FAIL: no intro for stage', li + 1, await mode()); errors++; break; }
    if (li === 1) await page.screenshot({ path: out('intro') });
    if (!await waitMode('play', 8000)) { console.log('FAIL: stage did not start', li + 1); errors++; break; }
    const res = await page.evaluate(() => {
      const t = window.__tobi, G = t.G;
      G.paused = true;
      const r = TobiBot.solve(G.S.L, t.api, { from: G.S, beam: 110 });
      if (!r.ok) return r;
      const f0 = G.S.frame, A = TobiBot.ACTIONS, p = r.path, h = r.hold;
      t.setInput(S => A[p[Math.floor((S.frame - f0) / h)]] || {});
      G.paused = false;
      return { ok: true, frames: r.frames, power: G.S.p.power };
    });
    console.log('stage', li + 1, JSON.stringify(res));
    if (!res.ok) { errors++; break; }
    await sleep(Math.min(9000, res.frames / 60 * 500));
    await page.screenshot({ path: out('stage' + (li + 1)) });
    if (!await waitMode('tally', res.frames / 60 * 1000 + 15000)) {
      console.log('FAIL: stage not cleared', li + 1, JSON.stringify(await page.evaluate(() => { const S = window.__tobi.G.S; return S && { st: S.state, x: S.p.x / 16, y: S.p.y / 16, why: S.why, mode: window.__tobi.G.mode }; })));
      errors++; break;
    }
    await page.evaluate(() => window.__tobi.setInput(null));
    await sleep(1500);
    if (li === 0) await page.screenshot({ path: out('tally') });
    const st = await page.evaluate(() => { const G = window.__tobi.G, S = G.S; return { score: S.score, coins: S.coins, gems: S.gems, lives: S.lives, timeLeft: G.tally.left }; });
    console.log('  cleared', JSON.stringify(st));
    await page.keyboard.press('Enter'); await sleep(700);
    await page.keyboard.press('Enter'); await sleep(900);
  }
  if (!errors) {
    if (!await waitMode('ending', 8000)) { console.log('FAIL: no ending', await mode()); errors++; }
    else {
      await sleep(4500);
      await page.screenshot({ path: out('ending') });
      const sv = await page.evaluate(() => JSON.stringify(window.__tobi.save));
      console.log('save', sv);
      await page.keyboard.press('Enter'); await sleep(600);
      const m = await mode();
      console.log('after ending ->', m);
      if (m !== 'title') errors++;
      await page.screenshot({ path: out('title_after') });
    }
  }
  console.log(errors ? 'E2E FAILED (' + errors + ')' : 'E2E OK');
  await browser.close();
  process.exit(errors ? 1 : 0);
})();
