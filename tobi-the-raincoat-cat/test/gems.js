// Checks that every sun shard can actually be collected (with the umbrella where a stage asks for it),
// and that the stage can still be finished afterwards. The code calls the shards gems.
//
//   node test/gems.js          every stage
//   node test/gems.js 1        only the second stage (stages are numbered from 0 here)
//   node test/gems.js 1 2      only its third shard
require('./harness.js');
require('./bot.js');
const api = { TS, SOLID, newSim, cloneSim, step };
const which = process.argv[2] != null ? [+process.argv[2]] : [0, 1, 2, 3];
let failed = 0;
for (const li of which) {
  const L = LEVELS[li];
  const only = process.argv[3] != null ? +process.argv[3] : -1;
  const gems = L.ents.filter(e => e.t === 'gem' && (only < 0 || e.i === only));
  for (const g of gems) {
    const target = { x: Math.floor((g.x + 5) / TS), y: Math.floor((g.y + 6) / TS), through: true };
    let res = null, how = '';
    // a shard that sits off the main road needs a stop on the way, or the search heads straight for it through thin air
    const via = ({ '2:2': { x: 163, y: 8 }, '0:2': { x: 160, y: 12 }, '1:2': { x: 180, y: 12 } })[li + ':' + g.i];
    for (const power of [false, true]) {
      const t0 = Date.now();
      let from = null, pre = 0;
      if (via) {
        const r1 = TobiBot.solve(L, api, { target: via, power, beam: 150, maxIter: 1600,
          done: S => S.p.ground && Math.abs(S.p.x / TS - via.x) < 1.5 && Math.abs((S.p.y + 14) / TS - (via.y + 1)) < 0.2 });
        if (!r1.ok) { res = r1; continue; }
        from = TobiBot.replay(L, api, r1, { power, noItems: true }); pre = r1.frames;
      }
      // collected, and back on something solid (grabbing it on the way into a pit does not count)
      // and stays safely on its feet for a moment afterwards
      const done = S => { if (S.gems[g.i] === 1 && S.p.ground) S._safe = (S._safe || 0) + 1; else S._safe = 0; return S._safe >= 40; };
      res = TobiBot.solve(L, api, { target, power, from, done, beam: 150, maxIter: 1400 });
      how = power ? 'with umbrella' : 'bare';
      if (res.ok) {
        res.frames += pre; res.sec = ((Date.now() - t0) / 1000).toFixed(0);
        // and from there the stage can still be finished (no dead end)
        const r2 = TobiBot.solve(L, api, { from: res.S, beam: 150 });
        res.after = r2.ok ? 'then clears the stage' : 'BUT CANNOT FINISH: ' + JSON.stringify({ why: r2.why, at: r2.at });
        break;
      }
    }
    if (!res.ok || !/^then clears/.test(res.after)) failed++;
    console.log('stage', li + 1, 'shard', g.i + 1, 'at', target.x + ',' + target.y, res.ok ? 'OK ' + how + ' in ' + res.frames + ' ticks (' + res.sec + 's), ' + res.after : 'NOT REACHED ' + JSON.stringify({ why: res.why, at: res.at, y: res.y }));
  }
}
process.exit(failed ? 1 : 0);
