// Static checks on every stage: nothing floating, buried or out of bounds.
require('./harness.js');
let bad = 0;
const say = (li, msg) => { bad++; console.log('stage ' + (li + 1) + ': ' + msg); };
LEVELS.forEach((L, li) => {
  const W = L.W, H = L.H, g = L.grid;
  const t = (x, y) => (x < 0 || x >= W) ? T.HARD : (y < 0 || y >= H) ? 0 : g[y * W + x];
  const solid = (x, y) => !!SOLID[t(x, y)];
  const floor = (x, y) => solid(x, y) || t(x, y) === T.ONEWAY;
  const boxFree = (x, y, w, h) => { for (let ty = Math.floor(y / TS); ty <= Math.floor((y + h - 0.01) / TS); ty++) for (let tx = Math.floor(x / TS); tx <= Math.floor((x + w - 0.01) / TS); tx++) if (solid(tx, ty)) return false; return true; };
  const stands = (x, y, w, h) => { const ty = Math.floor((y + h + 0.5) / TS); if ((y + h) % TS !== 0) return false; for (let tx = Math.floor(x / TS); tx <= Math.floor((x + w - 0.01) / TS); tx++) if (floor(tx, ty)) return true; return false; };
  // start and lamps
  [['start', L.start]].concat(L.cps.map((c, i) => ['lamp ' + (i + 1), c])).forEach(([n, p]) => {
    if (!boxFree(p.x, p.y, 10, 14)) say(li, n + ' is inside a wall');
    if (!stands(p.x, p.y, 10, 14)) say(li, n + ' is not on the floor');
  });
  if (!L.cps.length) say(li, 'has no lamp');
  if (L.gemN !== 3) say(li, 'has ' + L.gemN + ' shards, expected 3');
  if (L.goalX == null) say(li, 'has no bell');
  const counts = {};
  L.ents.forEach((e, i) => {
    counts[e.t] = (counts[e.t] || 0) + 1;
    const at = e.t + ' at ' + (e.x / TS).toFixed(1) + ',' + (e.y / TS).toFixed(1);
    if (e.x < 0 || e.x > W * TS) say(li, at + ' is outside the stage');
    if (['mud', 'snail', 'prick', 'frog', 'spring', 'cp'].includes(e.t)) {
      if (!boxFree(e.x, e.y, e.w, e.h)) say(li, at + ' is inside a wall');
      if (!stands(e.x, e.y, e.w, e.h)) say(li, at + ' is not standing on anything');
    }
    if (e.t === 'goal') { if (!stands(e.x, e.y, e.w, e.h)) say(li, 'bell post is not on the floor'); if (!boxFree(e.x, e.y, e.w, e.h)) say(li, 'bell post is inside a wall'); }
    if (e.t === 'gem' && !boxFree(e.x, e.y, e.w, e.h)) say(li, at + ' is inside a wall');
    if (e.t === 'flit') {
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = e.bx + e.ax * Math.sin(a), y = e.by + e.ay * Math.cos(a); if (!boxFree(x, y, e.w, e.h)) { say(li, at + ' flies through a wall'); break; } if (y < 16) { say(li, at + ' flies off the top'); break; } }
    }
    if (e.t === 'chain' && t(Math.floor(e.x / TS), Math.floor(e.y / TS)) !== T.HARD) say(li, at + ' has no anchor block');
    if (e.t === 'crusher') {
      if (!boxFree(e.x, e.y, e.w, e.h)) say(li, at + ' starts inside a wall');
      let y = e.y, hit = false; for (let k = 0; k < 40 && !hit; k++) { y += 8; if (!boxFree(e.x, y, e.w, e.h)) hit = true; }
      if (!hit) say(li, at + ' has no floor to land on');
      if (!solid(Math.floor((e.x + 14) / TS), Math.floor(e.y / TS) - 1)) say(li, at + ' does not hang from a ceiling');
    }
    if (e.t === 'plat' && !e.fall) {
      for (let k = 0; k <= 8; k++) { const q = k / 8, x = e.bx + e.ax * q, y = e.by + e.ay * q; if (!boxFree(x, y, e.w, e.h)) { say(li, at + ' moves through a wall'); break; } }
    }
    if (e.t === 'plat' && e.fall && !boxFree(e.x, e.y, e.w, e.h)) say(li, at + ' is inside a wall');
  });
  // tiles
  let coins = 0, items = { u: 0, s: 0, h: 0, c: 0, m: 0 };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = g[y * W + x], m = L.meta[y * W + x];
    if (v === T.COIN) coins++;
    if (m) items[m]++;
    if ((v === T.BONUS || v === T.BRICK) && m && m !== 'c' && m !== 'm' && solid(x, y - 1)) say(li, 'item block at ' + x + ',' + y + ' has no room above for its item');
    if (v === T.BONUS && y > 0 && solid(x, y + 1) && solid(x, y - 1)) say(li, 'sun block at ' + x + ',' + y + ' cannot be hit');
    if ((v === T.PIL_L || v === T.PIL_R || v === T.PIL_TL || v === T.PIL_TR) && !solid(x, y + 1)) say(li, 'stump at ' + x + ',' + y + ' floats');
    if (v === T.PIL_L && !(t(x, y - 1) === T.PIL_L || t(x, y - 1) === T.PIL_TL)) say(li, 'stump at ' + x + ',' + y + ' has no top');
    if (v === T.SPIKE && !solid(x, y + 1)) say(li, 'spikes at ' + x + ',' + y + ' float');
    if (v === T.LAVA && y !== H - 1) say(li, 'lava at ' + x + ',' + y + ' is not on the bottom row');
  }
  // the bell must stand clear: nothing solid in its column above the floor
  console.log('stage', li + 1, L.name.padEnd(15), W + 'x' + H, 'coins', coins, 'blocks', JSON.stringify(items), 'things', JSON.stringify(counts), 'lamps', L.cps.length);
});
console.log(bad ? bad + ' problems' : 'all stages pass the static checks');
process.exit(bad ? 1 : 0);
