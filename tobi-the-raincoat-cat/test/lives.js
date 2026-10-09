// Falls three times on purpose and checks the game handles tries, lamps and game over correctly.
const path = require('path');
const { chromium } = require('playwright');
const PAGE = require('url').pathToFileURL(path.join(__dirname, '../index.html')).href;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  let errors = 0;
  page.on('pageerror', e => { console.log('PAGE ERROR:', e.message); errors++; });
  await page.goto(PAGE);
  await new Promise(r => setTimeout(r, 400));
  const log = await page.evaluate(() => {
    const t = window.__tobi, G = t.G, out = [];
    const st = (label) => out.push(label + ': mode=' + G.mode + ' lives=' + G.lives + ' fromLamp=' + G.fromCp + (G.S ? ' x=' + (G.S.p.x / 16).toFixed(1) + ' shards=' + G.S.gems.join('') + ' coins=' + G.S.coins + ' score=' + G.S.score : '') + ' shardsKept=' + G.gems.join(''));
    t.freeze(true);
    t.save.max = 0; t.save.hi = 0;
    t.advance(30); t.uiAction('ok'); t.advance(30); st('after start');
    t.uiAction('ok'); t.advance(5); st('playing');
    // grab the first shard by teleporting next to it, then light the lamp, then fall into the pond
    let S = G.S; S.p.x = 72 * 16; S.p.y = 5 * 16; S.p.vy = 0; t.advance(20); st('got a shard');
    S.p.x = 102 * 16; S.p.y = 13 * 16 - 14; S.p.vy = 0; t.advance(10); st('lamp lit (cpOn=' + S.cpOn + ')');
    S.p.x = 108.5 * 16; S.p.y = 13 * 16; t.advance(140); st('fell in the pond');
    t.advance(160); st('restarted');
    S = G.S; const atLamp = Math.abs(S.p.x / 16 - 102.2) < 0.5;
    // second fall
    S.p.x = 108.5 * 16; S.p.y = 13 * 16; t.advance(140); st('fell again');
    t.advance(160); st('restarted again');
    // third fall: game over
    S = G.S; S.p.x = 108.5 * 16; S.p.y = 13 * 16; t.advance(140); st('fell a third time');
    t.advance(60); t.uiAction('ok'); t.advance(5); st('after game over');
    out.push('RESULT atLamp=' + atLamp + ' sel=' + G.sel + ' hi=' + t.save.hi);
    return out;
  });
  console.log(log.join('\n'));
  const txt = log.join('\n');
  const ok = /fell in the pond: mode=intro lives=2 fromLamp=1/.test(txt) && /restarted: mode=play lives=2 fromLamp=1 x=102\.2 shards=100/.test(txt) && /fell again: mode=intro lives=1/.test(txt) && /fell a third time: mode=over lives=0/.test(txt) && /after game over: mode=title/.test(txt) && /atLamp=true/.test(txt) && !errors;
  console.log(ok ? 'LIVES OK' : 'LIVES FAILED');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
