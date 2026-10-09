// Renders the music and effects silently and measures how loud they are, to catch clipping or silence.
const path = require('path');
const { chromium } = require('playwright');
const PAGE = require('url').pathToFileURL(path.join(__dirname, '../index.html')).href;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load/.test(m.text())) console.log('console.error', m.text()); });
  await page.goto(PAGE);
  await new Promise(r => setTimeout(r, 300));
  const res = await page.evaluate(async () => {
    const t = window.__tobi, AU = t.AU, A = t.audio;
    const out = [];
    const graph = (secs) => {
      const c = new OfflineAudioContext(1, Math.ceil(44100 * secs), 44100);
      AU.ctx = c;
      AU.master = c.createGain(); AU.master.gain.value = 1; AU.master.connect(c.destination);   // measured before the limiter
      AU.mus = c.createGain(); AU.mus.gain.value = t.audio.MUS_GAIN; AU.mus.connect(AU.master);
      AU.sfx = c.createGain(); AU.sfx.gain.value = t.audio.SFX_GAIN; AU.sfx.connect(AU.master);
      const n = c.createBuffer(1, 44100, 44100), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      AU.noise = n;
      return c;
    };
    const measure = async (c) => {
      const buf = await c.startRendering(), d = buf.getChannelData(0);
      let peak = 0, sum = 0, nz = 0;
      for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; if (v > 1e-4) nz++; }
      return { peak: +peak.toFixed(3), rmsDb: +(10 * Math.log10(sum / d.length + 1e-12)).toFixed(1), active: +(nz / d.length).toFixed(2) };
    };
    for (const name of ['meadow', 'cave', 'sky', 'keep', 'sun', 'clear', 'die', 'over']) {
      const s = A.SONGS[name];
      if (!s.len) { s.len = 0; s.tracks.forEach(tr => { A.parseTrack(tr); s.len = Math.max(s.len, tr.len); }); }
      const step = 15 / s.bpm, secs = Math.min(14, s.len * step + 0.5);
      const c = graph(secs);
      let tt = 0.05;
      for (let pos = 0; pos < s.len && tt < secs - 0.3; pos++, tt += step)
        for (const tr of s.tracks) { const evs = tr.by[pos % tr.len]; if (evs) for (const e of evs) A.playNote(tr, e, tt, step); }
      out.push(['song ' + name, await measure(c)]);
    }
    for (const name of Object.keys(A.SFX)) {
      const c = graph(2.2);
      try { A.SFX[name](); out.push(['sfx ' + name, await measure(c)]); } catch (e) { out.push(['sfx ' + name, 'ERROR ' + e.message]); }
    }
    return out;
  });
  let bad = 0;
  for (const [n, r] of res) {
    const flag = typeof r === 'string' ? 'ERROR' : r.peak >= 0.98 ? 'CLIPS' : r.peak < 0.01 ? 'SILENT' : '';
    if (flag) bad++;
    console.log(n.padEnd(14), JSON.stringify(r), flag);
  }
  console.log(bad ? bad + ' problems' : 'levels look sane');
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
