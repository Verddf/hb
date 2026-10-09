// Checks the page never scrolls sideways and the game picture fits, at many window sizes.
const path = require('path');
const { chromium } = require('playwright');
const PAGE = require('url').pathToFileURL(path.join(__dirname, '../index.html')).href;
(async () => {
  const browser = await chromium.launch();
  let bad = 0;
  const sizes = [[320, 568, 2, true], [360, 740, 3, true], [390, 780, 3, true], [430, 932, 3, true], [740, 360, 3, true], [932, 430, 3, true], [768, 1024, 2, true],
    [600, 500, 1, false], [800, 900, 1, false], [1000, 700, 1, false], [1280, 720, 1, false], [1366, 768, 1.25, false], [1440, 900, 2, false], [1536, 864, 1.25, false], [1920, 1080, 1, false], [2560, 1440, 1.5, false], [3840, 2160, 1, false]];
  for (const [w, h, dpr, touch] of sizes) {
    for (const scheme of ['light']) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch, colorScheme: scheme });
      const page = await ctx.newPage();
      let err = 0;
      page.on('pageerror', e => { console.log('PAGE ERROR', e.message); err++; });
      await page.goto(PAGE);
      await new Promise(r => setTimeout(r, 350));
      const r = await page.evaluate(() => {
        const d = document.documentElement, c = document.getElementById('game').getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect(), v = window.__tobi.view();
        return { sw: d.scrollWidth, iw: window.innerWidth, ih: window.innerHeight, cw: Math.round(c.width), ch: Math.round(c.height), cl: Math.round(c.left), cr: Math.round(c.right), cb: Math.round(c.bottom), sb: Math.round(st.bottom), v, cssPerPx: +(c.width / v.VW).toFixed(2), bw: document.getElementById('game').width };
      });
      const exact = Math.abs(r.bw - r.v.VW * r.v.Z) < 1;
      const fits = r.sw <= r.iw && r.cl >= 0 && r.cr <= r.iw + 0.5;
      const visible = r.sb <= r.ih + 2 || (touch && w > h);     // whole console on screen without scrolling (sideways phones scroll the header away)
      const flag = (!fits ? ' OVERFLOW' : '') + (!exact ? ' SIZE MISMATCH' : '') + (!visible ? ' (console taller than window)' : '') + (err ? ' ERROR' : '');
      if (!fits || !exact || err) bad++;
      console.log((w + 'x' + h + '@' + dpr + (touch ? ' touch' : '')).padEnd(22), 'view', (r.v.VW + 'x' + r.v.VH + ' z' + r.v.Z).padEnd(13), 'picture', (r.cw + 'x' + r.ch + ' css').padEnd(14), 'px size', String(r.cssPerPx).padEnd(5), flag);
      await ctx.close();
    }
  }
  console.log(bad ? bad + ' LAYOUT PROBLEMS' : 'layout fits everywhere');
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
