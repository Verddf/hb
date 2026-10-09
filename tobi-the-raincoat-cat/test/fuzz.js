// Mashes random buttons through every stage for a long time and checks nothing ever breaks:
// no errors, no impossible numbers, and the hero is never left stuck inside a wall.
require('./harness.js');
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
let problems = 0, ticks = 0, deaths = 0, clears = 0;
const seen = {};
function boxSolid(S, x, y, w, h) {
  for (let ty = Math.floor(y / TS); ty <= Math.floor((y + h - 0.0001) / TS); ty++) for (let tx = Math.floor(x / TS); tx <= Math.floor((x + w - 0.0001) / TS); tx++) if (solidT(S, tx, ty)) return true;
  return false;
}
const RUNS = +process.argv[2] || 40, LEN = +process.argv[3] || 9000;
for (let run = 0; run < RUNS; run++) {
  const li = run % 4, L = LEVELS[li], r = rng(1000 + run * 77);
  const god = run % 3 === 0, power = run % 2 === 0;
  let S = newSim(L, { power, vw: 256 + Math.floor(r() * 190), vh: 208 + Math.floor(r() * 32), god });
  let inp = {}, hold = 0, stuck = 0;
  // some runs lean right so they get deep into the stage
  const bias = 0.35 + r() * 0.5;
  for (let f = 0; f < LEN; f++) {
    if (--hold <= 0) {
      hold = 2 + Math.floor(r() * 30);
      inp = { r: r() < bias ? 1 : 0, l: r() < 0.12 ? 1 : 0, jump: r() < 0.45 ? 1 : 0, run: r() < 0.6 ? 1 : 0 };
      if (inp.l && inp.r) inp.l = 0;
    }
    try { step(S, inp); } catch (e) { problems++; console.log('EXCEPTION stage', li + 1, 'run', run, 'tick', f, e.stack.split('\n').slice(0, 4).join(' | ')); break; }
    ticks++;
    for (const e of S.ev) seen[e[0]] = (seen[e[0]] || 0) + 1;
    const p = S.p;
    if (!(isFinite(p.x) && isFinite(p.y) && isFinite(p.vx) && isFinite(p.vy))) { problems++; console.log('NaN hero', li + 1, run, f); break; }
    if (S.state === 'play') {
      if (boxSolid(S, p.x, p.y, p.w, p.h)) { if (++stuck === 3) { problems++; console.log('HERO IN WALL stage', li + 1, 'run', run, 'tick', f, 'at', (p.x / 16).toFixed(2), (p.y / 16).toFixed(2), 'riding', p.ride); } } else stuck = 0;
      if (p.x < -0.01 || p.x > S.W * 16 - p.w + 0.01) { problems++; console.log('HERO OUT OF STAGE', li + 1, run, f, p.x); break; }
      if (Math.abs(p.vx) > 4 || p.vy > 6 || p.vy < -8) { problems++; console.log('SPEED', li + 1, run, f, p.vx, p.vy); break; }
    }
    for (const e of S.ents) {
      if (e.gone) continue;
      if (!(isFinite(e.x) && isFinite(e.y))) { problems++; console.log('NaN thing', e.t, li + 1, run, f); e.gone = true; }
    }
    if (S.camX < -0.01 || S.camX > S.W * 16 - S.vw + 0.01 || S.camY < -0.01 || S.camY > Math.max(0, S.H * 16 - S.vh) + 0.01) { problems++; console.log('CAMERA OUT', li + 1, run, f, S.camX, S.camY); break; }
    if (S.state === 'dead') { deaths++; S = newSim(L, { power: r() < 0.5, fromCp: S.cpOn, coins: S.coins, score: S.score, lives: 3, gems: S.gems, vw: S.vw, vh: S.vh, god }); stuck = 0; }
    else if (S.state === 'done') { clears++; S = newSim(L, { power: true, vw: S.vw, vh: S.vh, god }); stuck = 0; }
    if (S.ents.length > 400) { problems++; console.log('TOO MANY THINGS', S.ents.length); break; }
  }
}
console.log(ticks, 'ticks,', deaths, 'deaths,', clears, 'clears; events seen:', Object.keys(seen).sort().map(k => k + ':' + seen[k]).join(' '));
console.log(problems ? problems + ' PROBLEMS' : 'fuzz clean');
process.exit(problems ? 1 : 0);
