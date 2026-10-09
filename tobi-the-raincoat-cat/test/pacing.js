// Feeds the game loop pictures at different screen refresh rates and checks the game still runs at 60 ticks a second.
const path = require('path');
const { chromium } = require('playwright');
const PAGE = require('url').pathToFileURL(path.join(__dirname, '../index.html')).href;
(async () => {
  const browser = await chromium.launch();
  let bad = 0;
  for (const [name, hz, jitter] of [['60 Hz', 60, 0], ['60 Hz, jittery', 60, 2.5], ['59.94 Hz', 59.94, 0], ['75 Hz', 75, 0], ['120 Hz', 120, 0], ['144 Hz', 144, 0.5], ['240 Hz', 240, 0], ['30 Hz', 30, 0], ['50 Hz', 50, 0]]) {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    let err = 0;
    page.on('pageerror', e => { console.log('PAGE ERROR', e.message); err++; });
    // take over the browser's picture clock
    await page.addInitScript(() => {
      window.__q = [];
      window.requestAnimationFrame = cb => { window.__q.push(cb); return window.__q.length; };
      window.__pump = t => { const q = window.__q; window.__q = []; for (const cb of q) cb(t); };
      let now = 0;
      performance.now = () => now;
      window.__setNow = t => { now = t; };
    });
    await page.goto(PAGE);
    const r = await page.evaluate(([hz, jitter]) => {
      const t = window.__tobi, G = t.G;
      let now = 1000, seed = 7;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const frameMs = 1000 / hz;
      const pump = () => { now += frameMs + (rnd() - 0.5) * 2 * jitter; window.__setNow(now); window.__pump(now); };
      for (let i = 0; i < 90; i++) pump();                    // let the loop settle on the refresh rate
      const S = t.startAt(0); S.god = true;
      t.setInput(() => ({ r: 1, run: 1 }));
      const t0 = now, f0 = S.frame;
      // sample the hero's on-screen movement per picture to see how even it is
      let prevX = null, steps = [], zero = 0, dbl = 0, lastFrame = S.frame;
      const secs = 5, n = Math.round(secs * hz);
      for (let i = 0; i < n; i++) {
        pump();
        const d = S.frame - lastFrame; lastFrame = S.frame;
        if (d === 0) zero++; if (d >= 2) dbl++;
      }
      t.setInput(null);
      return { ticks: S.frame - f0, ms: Math.round(now - t0), zero, dbl, n };
    }, [hz, jitter]);
    const rate = r.ticks / (r.ms / 1000);
    const okRate = Math.abs(rate - 60) < 0.6;
    if (!okRate || err) bad++;
    console.log(name.padEnd(16), 'ticks/s', rate.toFixed(2).padStart(6), ' pictures with no tick', String(r.zero).padStart(4), ' with 2+ ticks', String(r.dbl).padStart(4), 'of', r.n, okRate ? '' : 'WRONG SPEED');
    await page.close();
  }
  console.log(bad ? 'PACING PROBLEMS' : 'pacing ok');
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
