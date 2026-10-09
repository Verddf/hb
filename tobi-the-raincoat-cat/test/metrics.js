// Measures how the hero actually moves (jump height, widest gap, stopping distance...), to guide level design.
// Run it again after changing the numbers in PH (src/10-sim.js):  node test/metrics.js
require('./harness.js');

function flat(W, extra) {
  return makeLevel('T', 'meadow', W || 120, 15, b => { b.ground(0, (W || 120) - 1); b.start(4); if (extra) extra(b); });
}
function run(S, n, inp) { for (let i = 0; i < n; i++) step(S, inp); }

// standing jump height, full hold
{
  const S = newSim(flat()); run(S, 20, {});
  const y0 = S.p.y; let top = y0, f = 0, air = 0;
  step(S, { jump: 1 });
  while (!S.p.ground || f < 2) { step(S, { jump: 1 }); top = Math.min(top, S.p.y); f++; if (f > 300) break; }
  console.log('standing jump: height', (y0 - top).toFixed(1), 'px =', ((y0 - top) / 16).toFixed(2), 'tiles; airtime', f);
}
// tap jump
{
  const S = newSim(flat()); run(S, 20, {});
  const y0 = S.p.y; let top = y0, f = 0;
  step(S, { jump: 1 });
  while (!S.p.ground || f < 2) { step(S, {}); top = Math.min(top, S.p.y); f++; if (f > 300) break; }
  console.log('tap jump: height', (y0 - top).toFixed(1), 'px; airtime', f);
}
// walk / run top speed, time to reach, stopping distance
for (const runBtn of [0, 1]) {
  const S = newSim(flat(200)); run(S, 20, {});
  let f = 0; const x0 = S.p.x;
  const max = runBtn ? PH.runMax : PH.walkMax;
  while (S.p.vx < max - 1e-6 && f < 300) { step(S, { r: 1, run: runBtn }); f++; }
  const xa = S.p.x - x0;
  let g = 0; const x1 = S.p.x;
  while (S.p.vx > 0 && g < 300) { step(S, {}); g++; }
  console.log(runBtn ? 'run ' : 'walk', 'top speed in', f, 'ticks /', xa.toFixed(0), 'px; stops in', g, 'ticks /', (S.p.x - x1).toFixed(0), 'px');
}
// jump distance at same height: walking and running, full hold
for (const runBtn of [0, 1]) {
  const S = newSim(flat(200)); run(S, 20, {});
  run(S, 60, { r: 1, run: runBtn });
  const x0 = S.p.x, y0 = S.p.y; let top = y0, f = 0;
  step(S, { r: 1, run: runBtn, jump: 1 });
  while (!S.p.ground || f < 2) { step(S, { r: 1, run: runBtn, jump: 1 }); top = Math.min(top, S.p.y); f++; }
  console.log(runBtn ? 'run ' : 'walk', 'jump: distance', (S.p.x - x0).toFixed(0), 'px =', ((S.p.x - x0) / 16).toFixed(2), 'tiles; height', (y0 - top).toFixed(1), '; airtime', f);
}
// widest gap that can be cleared, by landing height difference (rows up = positive)
function gapTest(gap, rise, runBtn, runway) {
  const L = makeLevel('T', 'meadow', 80, 15, b => {
    b.ground(0, 20); b.ground(21 + gap, 79, 13 - rise); b.start(20 - runway);
  });
  // try every take-off tick
  for (let wait = 0; wait < runway * 16 / 1.2 + 30; wait++) {
    const S = newSim(L); run(S, 20, {});
    run(S, wait, { r: 1, run: runBtn });
    for (let i = 0; i < 150; i++) {
      step(S, { r: 1, run: runBtn, jump: 1 });
      if (S.state !== 'play') break;
      if (S.p.ground && S.p.x > (21 + gap) * 16 - 10) return true;
    }
  }
  return false;
}
for (const runBtn of [0, 1]) {
  for (const runway of [3, 8]) {
    const row = [];
    for (const rise of [-3, -1, 0, 1, 2, 3, 4]) {
      let best = 0;
      for (let gap = 1; gap <= 12; gap++) if (gapTest(gap, rise, runBtn, runway)) best = gap; else break;
      row.push((rise >= 0 ? '+' : '') + rise + ':' + best);
    }
    console.log(runBtn ? 'run ' : 'walk', 'runway', runway, 'max gap by rise ->', row.join('  '));
  }
}
// highest ledge reachable from standing next to it
for (let h = 3; h <= 6; h++) {
  const L = makeLevel('T', 'meadow', 40, 15, b => { b.ground(0, 39); b.ground(12, 39, 13 - h); b.start(8); });
  let ok = false;
  for (let wait = 0; wait < 60 && !ok; wait++) {
    const S = newSim(L); run(S, 20, {}); run(S, wait, { r: 1 });
    for (let i = 0; i < 120; i++) { step(S, { r: 1, jump: 1 }); if (S.p.ground && S.p.y < (13 - h) * 16) { ok = true; break; } }
  }
  console.log('ledge', h, 'tiles up:', ok ? 'reachable' : 'no');
}
// stomp bounce and spring heights
{
  const L = flat(60, b => { b.spring(10); });
  for (const hold of [0, 1]) {
    const S = newSim(L); S.p.x = 10 * 16 + 3; S.p.y = 150; let top = 999;
    for (let i = 0; i < 200; i++) { step(S, { jump: hold }); top = Math.min(top, S.p.y + S.p.h); }
    console.log('spring', hold ? 'held' : 'free', 'feet rise', (208 - top).toFixed(0), 'px =', ((208 - top) / 16).toFixed(1), 'tiles');
  }
}
// glide: distance of a running jump with the umbrella
{
  const S = newSim(flat(300), { power: 1 }); run(S, 20, {}); run(S, 60, { r: 1, run: 1 });
  const x0 = S.p.x; let f = 0;
  step(S, { r: 1, run: 1, jump: 1 });
  while (!S.p.ground || f < 2) { step(S, { r: 1, run: 1, jump: 1 }); f++; }
  console.log('glide jump distance', ((S.p.x - x0) / 16).toFixed(1), 'tiles, airtime', f);
}
