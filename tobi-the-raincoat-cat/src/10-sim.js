/* ============================================================
   SIMULATION  (pure game rules, no drawing, no sound)
   Everything that changes during play lives in one plain object
   `S`, advanced one tick (1/60 s) at a time by step(S, input).
   ============================================================ */

const TS = 16; // tile size in pixels

// Tile ids stored in the level grid
const T = {
  EMPTY: 0, GROUND: 1, BRICK: 2, BONUS: 3, USED: 4, HARD: 5, ONEWAY: 6, SPIKE: 7,
  LAVA: 8, COIN: 9, PIL_TL: 10, PIL_TR: 11, PIL_L: 12, PIL_R: 13, BRIDGE: 14,
};
const SOLID = new Uint8Array(24);
[T.GROUND, T.BRICK, T.BONUS, T.USED, T.HARD, T.PIL_TL, T.PIL_TR, T.PIL_L, T.PIL_R, T.BRIDGE]
  .forEach(function (t) { SOLID[t] = 1; });

// Player physics, in pixels per tick. Tuned for a quick start, a short
// stop, a floaty rise and a snappy fall.
const PH = {
  walkMax: 1.5, runMax: 2.6,
  accWalk: 0.11, accRun: 0.14, dec: 0.15, skid: 0.3,
  accAir: 0.11, airTurn: 0.18, airDrag: 0.02,
  jumpV: 5.4, jumpRun: 0.5,          // take-off speed, plus a bonus at full run
  gUp: 0.2, gCut: 0.7, gDown: 0.42,  // gravity: rising, rising after letting go, falling
  maxFall: 5.2, glide: 1.25, glideX: 2.0,
  coyote: 6, jbuf: 7,                // forgiveness windows, in ticks
  stompLo: 3.4, stompHi: 5.6, springLo: 6.2, springHi: 7.4,
  step: 4,                           // ledges this many pixels high are stepped onto
};

// Hit-box sizes [w, h] for everything that is not a tile
const ESZ = {
  mud: [12, 12], snail: [12, 12], prick: [12, 11], frog: [12, 10], flit: [12, 10],
  ember: [10, 12], crusher: [28, 30], spring: [14, 8], umb: [12, 14], sun: [12, 12],
  heart: [12, 12], gem: [10, 12], cp: [10, 28], goal: [6, 112], plat: [48, 8], chain: [0, 0],
};
const ENEMY = { mud: 1, snail: 1, prick: 1, flit: 1, frog: 1 };   // can be defeated
const WALKER = { mud: 1, snail: 1, prick: 1 };
const ALWAYS_ON = { plat: 1, chain: 1, ember: 1, crusher: 1, spring: 1, gem: 1, cp: 1, goal: 1, flit: 1 };
const COMBO = [100, 200, 400, 800, 1000, 2000, 4000, 8000];
const WAKE = 300;        // creatures stay still until the hero is within this many pixels
const TAU = Math.PI * 2;

function approach(v, target, d) {
  return v < target ? Math.min(target, v + d) : Math.max(target, v - d);
}

/* ---------- creating and copying a run ---------- */

function newSim(L, o) {
  o = o || {};
  const S = {
    L: L, W: L.W, H: L.H, grid: L.grid.slice(), meta: Object.assign({}, L.meta), multi: {},
    ents: [], bumps: [], ev: [], inp: null,
    frame: 0, tick: 0, time: L.time, hurry: false,
    score: o.score || 0, coins: o.coins || 0, lives: o.lives == null ? 3 : o.lives,
    gems: (o.gems || [0, 0, 0]).slice(),
    state: 'play', st: 0, why: '', cpOn: o.fromCp | 0, bonus: 0,     // cpOn: number of the last lamp lit (0 = none)
    vw: o.vw || 320, vh: o.vh || 240, camX: 0, camY: 0, ocx: 0, ocy: 0,
    noItems: !!o.noItems, god: !!o.god, hx: 0, hy: 0, p: null,
  };
  for (let i = 0; i < L.ents.length; i++) {
    const e = Object.assign({}, L.ents[i]);
    e.ox = e.x; e.oy = e.y; e.on = ALWAYS_ON[e.t] ? 1 : 0; e.gone = false;
    if (e.t === 'gem' && S.gems[e.i]) e.gone = true;
    S.ents.push(e);
  }
  const sp = (S.cpOn && L.cps[S.cpOn - 1]) || L.start;
  S.p = {
    x: sp.x, y: sp.y, ox: sp.x, oy: sp.y, w: 10, h: 14, vx: 0, vy: 0, dir: 1,
    ground: false, coy: 0, jbuf: 0, varJ: false, jHeld: true,
    power: o.power ? 1 : 0, sun: 0, inv: 0, kick: 0, ride: -1, combo: 0,
    skid: false, glide: false, dead: false, runD: 0, air: 0,
  };
  snapCamera(S);
  return S;
}

// Entities are flat objects, so a shallow copy of each is a full copy.
function cloneSim(S) {
  const C = Object.assign({}, S);
  C.grid = S.grid.slice();
  C.meta = Object.assign({}, S.meta);
  C.multi = Object.assign({}, S.multi);
  C.ents = S.ents.map(function (e) { return Object.assign({}, e); });
  C.bumps = S.bumps.map(function (b) { return Object.assign({}, b); });
  C.gems = S.gems.slice();
  C.p = Object.assign({}, S.p);
  C.ev = [];
  return C;
}

function ev(S, type, x, y, a, b, c) { S.ev.push([type, x, y, a, b, c]); }

/* ---------- tiles and collision ---------- */

function tileAt(S, tx, ty) {
  if (tx < 0 || tx >= S.W) return T.HARD;      // the level's side edges are walls
  if (ty < 0 || ty >= S.H) return T.EMPTY;     // open above, open (a pit) below
  return S.grid[ty * S.W + tx];
}
function solidT(S, tx, ty) { return SOLID[tileAt(S, tx, ty)]; }

function boxSolid(S, x, y, w, h) {
  const x0 = Math.floor(x / TS), x1 = Math.floor((x + w - 0.0001) / TS);
  const y0 = Math.floor(y / TS), y1 = Math.floor((y + h - 0.0001) / TS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidT(S, tx, ty)) return true;
  return false;
}

// Move horizontally; returns true when a wall stopped the move.
function moveX(S, e, dx, isP) {
  if (dx === 0) return false;
  e.x += dx;
  const tx = Math.floor((dx > 0 ? e.x + e.w - 0.0001 : e.x) / TS);
  const ty0 = Math.floor(e.y / TS), ty1 = Math.floor((e.y + e.h - 0.0001) / TS);
  for (let ty = ty0; ty <= ty1; ty++) {
    if (!solidT(S, tx, ty)) continue;
    // Feet only just below a ledge: step onto it instead of stopping dead.
    if (isP && ty === ty1 && e.vy >= 0 && e.y + e.h - ty * TS <= PH.step) {
      const ny = ty * TS - e.h;
      if (!boxSolid(S, e.x, ny, e.w, e.h)) { e.y = ny; return false; }
    }
    e.x = dx > 0 ? tx * TS - e.w : (tx + 1) * TS;
    return true;
  }
  return false;
}

// Move vertically; returns 0 (free), 1 (landed) or 2 (hit a ceiling).
function moveY(S, e, dy, isP) {
  if (dy === 0) return 0;
  const pb = e.y + e.h;
  e.y += dy;
  const tx0 = Math.floor(e.x / TS), tx1 = Math.floor((e.x + e.w - 0.0001) / TS);
  if (dy > 0) {
    const ty = Math.floor((e.y + e.h - 0.0001) / TS);
    for (let tx = tx0; tx <= tx1; tx++) {
      const t = tileAt(S, tx, ty);
      if (SOLID[t] || (t === T.ONEWAY && pb <= ty * TS + 0.001)) { e.y = ty * TS - e.h; return 1; }
    }
    return 0;
  }
  const ty = Math.floor(e.y / TS);
  if (!isP) {
    for (let tx = tx0; tx <= tx1; tx++) if (solidT(S, tx, ty)) { e.y = (ty + 1) * TS; return 2; }
    return 0;
  }
  // The player's head is judged at its centre; a clipped corner slides past.
  const cx = Math.floor((e.x + e.w * 0.5) / TS);
  if (solidT(S, cx, ty)) { e.y = (ty + 1) * TS; S.hx = cx; S.hy = ty; return 2; }
  if (tx0 !== cx && solidT(S, tx0, ty)) {
    const nx = (tx0 + 1) * TS;
    if (!boxSolid(S, nx, e.y, e.w, e.h)) { e.x = nx; return 0; }
    e.y = (ty + 1) * TS; S.hx = tx0; S.hy = ty; return 2;
  }
  if (tx1 !== cx && solidT(S, tx1, ty)) {
    const nx = tx1 * TS - e.w;
    if (!boxSolid(S, nx, e.y, e.w, e.h)) { e.x = nx; return 0; }
    e.y = (ty + 1) * TS; S.hx = tx1; S.hy = ty; return 2;
  }
  return 0;
}

/* ---------- scoring ---------- */

function addPts(S, n, x, y) { S.score += n; ev(S, 'pts', x, y, n); }
function oneUp(S, x, y) { S.lives = Math.min(99, S.lives + 1); ev(S, '1up', x, y); }
function comboPts(S, n, x, y) { if (n >= COMBO.length) oneUp(S, x, y); else addPts(S, COMBO[n], x, y); }
function addCoin(S, x, y, fromBlock) {
  S.coins++; S.score += 100;
  if (S.coins >= 100) { S.coins -= 100; oneUp(S, x, y - 8); }
  ev(S, fromBlock ? 'coinpop' : 'coin', x, y);
}

/* ---------- blocks ---------- */

function bump(S, tx, ty) {
  S.bumps.push({ tx: tx, ty: ty, t: 0 });
  // Whatever is standing on a bumped block gets knocked.
  const x0 = tx * TS, x1 = x0 + TS, top = ty * TS;
  for (let i = 0; i < S.ents.length; i++) {
    const e = S.ents[i];
    if (e.gone || !e.on) continue;
    if (e.x < x1 && e.x + e.w > x0 && Math.abs(e.y + e.h - top) < 3) {
      if (ENEMY[e.t]) { killEnemy(S, e, 'flip', e.x + e.w / 2 < x0 + 8 ? -1 : 1); addPts(S, 100, e.x + e.w / 2, e.y); }
      else if (e.t === 'umb' || e.t === 'heart' || e.t === 'sun') { e.vy = -3; e.gr = 0; }
    }
  }
  if (tileAt(S, tx, ty - 1) === T.COIN) {
    S.grid[(ty - 1) * S.W + tx] = T.EMPTY;
    addCoin(S, x0 + 8, top - 8, true);
  }
}

function spawnItem(S, t, tx, ty) {
  const sz = ESZ[t];
  S.ents.push({
    t: t, x: tx * TS + (TS - sz[0]) / 2, y: ty * TS - sz[1] + 16, w: sz[0], h: sz[1],
    ox: 0, oy: 0, vx: 0, vy: 0, dir: 1, st: 0, tm: 0, gr: 0, rise: 16, on: 1, gone: false,
  });
  const e = S.ents[S.ents.length - 1]; e.ox = e.x; e.oy = e.y;
  ev(S, 'sprout', tx * TS + 8, ty * TS);
}

function hitBlock(S, tx, ty) {
  const i = ty * S.W + tx, t = S.grid[i], p = S.p, m = S.meta[i];
  const cx = tx * TS + 8, cy = ty * TS;
  if (t === T.BRICK) {
    if (m === 'm') {                       // a brick with several coins inside
      if (S.multi[i] == null) S.multi[i] = 8;
      addCoin(S, cx, cy, true); bump(S, tx, ty);
      if (--S.multi[i] <= 0) { S.grid[i] = T.USED; delete S.meta[i]; }
      ev(S, 'bump', cx, cy);
    } else if (m === 'h') {
      S.grid[i] = T.USED; delete S.meta[i]; bump(S, tx, ty); spawnItem(S, 'heart', tx, ty);
      ev(S, 'bump', cx, cy);
    } else if (p.power) {
      bump(S, tx, ty); S.bumps.pop();
      S.grid[i] = T.EMPTY; S.score += 50; ev(S, 'break', cx, cy + 8);
    } else { bump(S, tx, ty); ev(S, 'bump', cx, cy); }
  } else if (t === T.BONUS) {
    S.grid[i] = T.USED; delete S.meta[i]; bump(S, tx, ty);
    if (m === 'u' && !S.noItems) {
      if (p.power) { for (let k = 0; k < 5; k++) addCoin(S, cx, cy - k * 3, true); }
      else spawnItem(S, 'umb', tx, ty);
    } else if (m === 's' && !S.noItems) spawnItem(S, 'sun', tx, ty);
    else if (m === 'h') spawnItem(S, 'heart', tx, ty);
    else addCoin(S, cx, cy, true);
    ev(S, 'bump', cx, cy);
  } else ev(S, 'bonk', cx, cy);
}

/* ---------- getting hurt, winning ---------- */

function killEnemy(S, e, how, dir) {
  e.gone = true;
  ev(S, 'kill', e.x + e.w / 2, e.y + e.h, e.t === 'snail' && e.st ? 'shell' : e.t, how, dir || 0);
}

function die(S, why) {
  if (S.state !== 'play' || S.god) return;
  const p = S.p;
  S.state = 'dying'; S.st = why === 'pit' ? 40 : 0; S.why = why;
  p.dead = true; p.vx = 0; p.vy = 0; p.power = 0; p.sun = 0; p.glide = false; p.ride = -1;
  ev(S, 'die', p.x + p.w / 2, p.y + p.h, why);
}

function hurt(S) {
  const p = S.p;
  if (p.inv > 0 || p.sun > 0 || S.state !== 'play' || S.god) return;
  if (p.power) { p.power = 0; p.inv = 110; p.glide = false; ev(S, 'hurt', p.x + p.w / 2, p.y); }
  else die(S, 'hit');
}

function win(S, e) {
  if (S.state !== 'play') return;
  const p = S.p;
  const up = (e.y + e.h) - (p.y + p.h);       // how high on the post the bell was reached
  const b = up > 92 ? 5000 : up > 64 ? 2000 : up > 40 ? 800 : up > 16 ? 400 : 100;
  S.state = 'clear'; S.st = 0; S.bonus = b;
  p.vx = 0; p.sun = 0; p.inv = 0; p.glide = false; p.ride = -1;
  p.x = Math.min(p.x, e.x - p.w + 2);
  addPts(S, b, e.x + 3, p.y - 4);
  ev(S, 'goal', e.x + 3, e.y, b);
}

/* ---------- the player ---------- */

function bounce(S, top, lo, hi) {
  const p = S.p;
  p.y = top - p.h;
  p.vy = -(S.inp.jump ? hi : lo);
  p.varJ = false; p.ground = false; p.ride = -1; p.coy = 0;
}

function updatePlayer(S, inp) {
  const p = S.p, ents = S.ents;
  const jp = inp.jump && !p.jHeld;
  p.jHeld = !!inp.jump;
  if (p.inv > 0) p.inv--;
  if (p.kick > 0) p.kick--;
  if (p.sun > 0) { p.sun--; if (p.sun === 0) ev(S, 'sunEnd', 0, 0); }

  // carried along by the platform underfoot
  if (p.ride >= 0) {
    const pl = ents[p.ride];
    if (pl && !pl.gone) { moveX(S, p, pl.x - pl.ox, true); p.y = pl.y - p.h; }
    else p.ride = -1;
  }

  // run
  const want = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  const max = inp.run ? PH.runMax : PH.walkMax;
  const sp = Math.abs(p.vx);
  p.skid = false;
  if (p.ground) {
    if (want !== 0) {
      if (p.vx * want < 0) { p.vx += want * PH.skid; p.skid = sp > 0.8; }
      else if (sp < max) p.vx = want * Math.min(max, sp + (inp.run ? PH.accRun : PH.accWalk));
      else if (sp > max) p.vx = want * Math.max(max, sp - PH.dec);
      p.dir = want;
    } else p.vx = approach(p.vx, 0, PH.dec);
    p.runD += sp;
  } else {
    // (p.glide still holds last tick's value here: an open umbrella drifts, it does not sprint)
    const amax = p.glide ? Math.min(max, PH.glideX) : max;
    if (want !== 0) {
      if (p.vx * want < 0) p.vx += want * PH.airTurn;
      else if (sp < amax) p.vx = want * Math.min(amax, sp + PH.accAir);
      p.dir = want;
    } else p.vx = approach(p.vx, 0, PH.airDrag);
    if (p.glide && Math.abs(p.vx) > PH.glideX) p.vx = approach(p.vx, p.vx > 0 ? PH.glideX : -PH.glideX, 0.06);
  }

  // jump: a press just before landing, or just after leaving a ledge, still counts
  if (jp) p.jbuf = PH.jbuf; else if (p.jbuf > 0) p.jbuf--;
  if (p.ground) p.coy = PH.coyote; else if (p.coy > 0) p.coy--;
  if (p.jbuf > 0 && p.coy > 0) {
    p.vy = -(PH.jumpV + PH.jumpRun * Math.min(1, Math.abs(p.vx) / PH.runMax));
    p.varJ = true; p.ground = false; p.coy = 0; p.jbuf = 0; p.ride = -1;
    ev(S, 'jump', p.x + p.w / 2, p.y + p.h);
  }

  // gravity, and the umbrella glide
  const wasGlide = p.glide;
  p.glide = false;
  if (p.vy < 0) p.vy += (p.varJ && !inp.jump) ? PH.gCut : PH.gUp;
  else p.vy += PH.gDown;
  let cap = PH.maxFall;
  if (p.power && inp.jump && !p.ground && p.vy > 0.4) { cap = PH.glide; p.glide = true; }
  if (p.vy > cap) p.vy = Math.max(cap, p.vy - 0.5);
  if (p.glide && !wasGlide) ev(S, 'glide', p.x, p.y);

  // move and collide
  const wasGround = p.ground, fallV = p.vy;
  if (moveX(S, p, p.vx, true)) p.vx = 0;
  p.ground = false;
  const pb = p.y + p.h;
  const r = moveY(S, p, p.vy, true);
  if (r === 1) { p.vy = 0; p.ground = true; p.ride = -1; }
  else if (r === 2) { p.vy = 0.5; hitBlock(S, S.hx, S.hy); }

  // platforms and springs act as floors when landed on from above
  if (p.vy >= 0) {
    let ride = -1;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (e.gone || (e.t !== 'plat' && e.t !== 'spring')) continue;
      if (p.x + p.w <= e.x || p.x >= e.x + e.w) continue;
      if (e.t === 'plat') {
        if (pb <= Math.max(e.oy, e.y) + 1.5 && p.y + p.h >= e.y) {
          p.y = e.y - p.h; p.vy = 0; p.ground = true; ride = i; e.stood = 1;
        }
      } else if (!p.ground && pb <= e.y + 3 && p.y + p.h >= e.y) {
        bounce(S, e.y, PH.springLo, PH.springHi); e.tm = 14;
        ev(S, 'spring', e.x + e.w / 2, e.y);
      }
    }
    if (ride >= 0) p.ride = ride; else if (!p.ground) p.ride = -1;
  }
  if (p.ground) {
    if (!wasGround && fallV > 2.2) ev(S, 'land', p.x + p.w / 2, p.y + p.h);
    p.combo = 0; p.air = 0;
  } else p.air++;

  // coins and hazards among the tiles being touched
  const x0 = Math.floor(p.x / TS), x1 = Math.floor((p.x + p.w - 0.0001) / TS);
  const y0 = Math.floor(p.y / TS), y1 = Math.floor((p.y + p.h - 0.0001) / TS);
  for (let ty = y0; ty <= y1; ty++) {
    if (ty < 0 || ty >= S.H) continue;
    for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || tx >= S.W) continue;
      const i = ty * S.W + tx, t = S.grid[i];
      if (t === T.COIN) { S.grid[i] = T.EMPTY; addCoin(S, tx * TS + 8, ty * TS + 8, false); }
      else if (t === T.SPIKE) {
        if (p.x + p.w > tx * TS + 3 && p.x < tx * TS + 13 && p.y + p.h > ty * TS + 7) hurt(S);
      } else if (t === T.LAVA) {
        if (p.y + p.h > ty * TS + 6) die(S, 'lava');
      }
    }
  }
  if (p.y > S.H * TS + 20) die(S, 'pit');
}

/* ---------- enemies, items, moving things ---------- */

function walk(S, e, sp, ledge) {
  e.vy = Math.min(e.vy + 0.35, 5);
  if (moveX(S, e, e.dir * sp, false)) e.dir = -e.dir;
  const r = moveY(S, e, e.vy, false);
  if (r === 1) { e.vy = 0; e.gr = 1; } else { e.gr = 0; if (r === 2) e.vy = 0; }
  if (ledge && e.gr) {
    const fx = e.dir > 0 ? e.x + e.w : e.x - 1;
    const t = tileAt(S, Math.floor(fx / TS), Math.floor((e.y + e.h + 1) / TS));
    if (!SOLID[t] && t !== T.ONEWAY) e.dir = -e.dir;
  }
  if (e.y > S.H * TS + 32) e.gone = true;
}

function updateEnts(S) {
  const p = S.p, ents = S.ents, HPX = S.H * TS;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.gone) continue;
    if (!e.on) {
      // creatures wake up when the hero comes near (the same distance on every screen size)
      if (e.x < p.x + WAKE && e.x + e.w > p.x - WAKE) e.on = 1; else continue;
    }
    switch (e.t) {
      case 'mud': walk(S, e, 0.45, e.lg !== 0); break;
      case 'prick': walk(S, e, 0.4, true); break;
      case 'snail':
        if (e.st === 0) { walk(S, e, 0.35, true); break; }
        e.vy = Math.min(e.vy + 0.35, 5);
        if (e.vx !== 0) {
          if (moveX(S, e, e.vx, false)) { e.vx = -e.vx; ev(S, 'shellBump', e.x + e.w / 2, e.y); }
          for (let j = 0; j < ents.length; j++) {     // a sliding shell bowls others over
            const f = ents[j];
            if (j === i || f.gone || !f.on || !ENEMY[f.t]) continue;
            if (e.x < f.x + f.w && e.x + e.w > f.x && e.y < f.y + f.h && e.y + e.h > f.y) {
              killEnemy(S, f, 'flip', e.vx > 0 ? 1 : -1);
              comboPts(S, e.combo++, f.x + f.w / 2, f.y);
            }
          }
        } else if (++e.tm > 480) { e.st = 0; e.tm = 0; e.dir = p.x < e.x ? -1 : 1; }  // comes back out
        if (moveY(S, e, e.vy, false)) e.vy = 0;
        if (e.y > HPX + 32) e.gone = true;
        break;
      case 'flit': {
        const a = (S.frame + e.ph) * TAU / e.per;
        const nx = e.bx + e.ax * Math.sin(a);
        e.dir = nx < e.x ? -1 : nx > e.x ? 1 : e.dir;
        e.x = nx;
        e.y = e.by + e.ay * Math.cos(a) + 2 * Math.sin(a * 3 + 1);
        break;
      }
      case 'frog':
        e.vy = Math.min(e.vy + 0.3, 5);
        if (e.gr) {
          e.vx = 0;
          const dx = p.x - e.x;
          e.dir = dx < 0 ? -1 : 1;
          if (--e.tm <= 0 && Math.abs(dx) < 150) { e.vy = -4.4; e.vx = e.dir * 1.25; e.gr = 0; e.tm = 64; }
        }
        if (e.vx !== 0 && moveX(S, e, e.vx, false)) e.vx = 0;
        { const r = moveY(S, e, e.vy, false); if (r === 1) { e.vy = 0; e.gr = 1; } else { e.gr = 0; if (r === 2) e.vy = 0; } }
        if (e.y > HPX + 32) e.gone = true;
        break;
      case 'ember':
        if (e.st === 0) { if (--e.tm <= 0) { e.st = 1; e.vy = -e.v0; ev(S, 'ember', e.x, e.y); } }
        else { e.vy += 0.16; e.y += e.vy; if (e.y >= e.by) { e.y = e.by; e.st = 0; e.tm = e.wait; e.vy = 0; } }
        break;
      case 'crusher':
        if (e.st === 0) {
          if (e.tm > 0) e.tm--;
          else if (Math.abs(p.x + p.w / 2 - (e.x + e.w / 2)) < 36 && p.y > e.y) { e.st = 1; e.vy = 0; }
        } else if (e.st === 1) {
          e.vy = Math.min(e.vy + 0.55, 6.5);
          if (moveY(S, e, e.vy, false) === 1) { e.st = 2; e.tm = 50; e.vy = 0; ev(S, 'crush', e.x + e.w / 2, e.y + e.h); }
        } else if (e.st === 2) { if (--e.tm <= 0) e.st = 3; }
        else { e.y -= 0.8; if (e.y <= e.by) { e.y = e.by; e.st = 0; e.tm = 25; } }
        break;
      case 'plat':
        if (e.fall) {
          if (e.drop) {
            if (e.drop === 1) {
              e.vy = Math.min(e.vy + 0.2, 4.5); e.y += e.vy;
              if (e.y > HPX + 48) { e.drop = 2; e.tm = 150; }
            } else if (--e.tm <= 0) { e.drop = 0; e.y = e.by; e.oy = e.by; e.vy = 0; e.tm = 0; ev(S, 'platBack', e.x, e.y); }
          } else if (e.stood) { if (++e.tm > 26) { e.drop = 1; e.vy = 0; ev(S, 'platDrop', e.x, e.y); } }
          else if (e.tm > 0) e.tm--;
          e.stood = 0;
        } else {
          const k = 0.5 - 0.5 * Math.cos((S.frame + e.ph) * TAU / e.per);
          e.x = e.bx + e.ax * k; e.y = e.by + e.ay * k;
        }
        break;
      case 'spring': if (e.tm > 0) e.tm--; break;
      case 'umb':
        if (e.rise > 0) { e.rise -= 0.5; e.y -= 0.5; if (e.rise <= 0) e.vy = -1.5; break; }
        e.tm++;
        if (!e.gr) {
          e.vy = Math.min(e.vy + 0.04, 0.5);
          moveX(S, e, Math.cos(e.tm / 16) * 0.5, false);
          if (moveY(S, e, e.vy, false) === 1) { e.gr = 1; e.vy = 0; }
        }
        if (e.y > HPX + 32) e.gone = true;
        break;
      case 'sun':
        if (e.rise > 0) { e.rise -= 0.5; e.y -= 0.5; if (e.rise <= 0) e.vy = -3; break; }
        e.vy = Math.min(e.vy + 0.22, 5);
        if (moveX(S, e, e.dir * 1.1, false)) e.dir = -e.dir;
        { const r = moveY(S, e, e.vy, false); if (r === 1) e.vy = -3.8; else if (r === 2) e.vy = 0; }
        if (e.y > HPX + 32) e.gone = true;
        break;
      case 'heart':
        if (e.rise > 0) { e.rise -= 0.5; e.y -= 0.5; break; }
        walk(S, e, 0.7, true);          // a heart will not wander off a ledge
        break;
    }
  }
  // walkers that meet turn around
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.gone || !e.on || !WALKER[e.t] || e.st) continue;
    for (let j = i + 1; j < ents.length; j++) {
      const f = ents[j];
      if (f.gone || !f.on || !WALKER[f.t] || f.st) continue;
      if (e.x < f.x + f.w && e.x + e.w > f.x && e.y < f.y + f.h && e.y + e.h > f.y) {
        if (e.x < f.x) { e.dir = -1; f.dir = 1; } else { e.dir = 1; f.dir = -1; }
      }
    }
  }
}

function interact(S) {
  const p = S.p, ents = S.ents;
  for (let i = 0; i < ents.length && S.state === 'play'; i++) {
    const e = ents[i];
    if (e.gone || !e.on) continue;
    const t = e.t;
    if (t === 'plat' || t === 'spring') continue;
    if (t === 'goal') { if (p.x + p.w > e.x) win(S, e); continue; }
    if (t === 'chain') {
      const a = e.a0 + S.frame * e.w0, c = Math.cos(a), s = Math.sin(a);
      for (let k = 1; k <= e.n; k++) {
        const bx = e.x + c * k * 8, by = e.y + s * k * 8;
        const qx = Math.max(p.x, Math.min(bx, p.x + p.w)), qy = Math.max(p.y, Math.min(by, p.y + p.h));
        if ((bx - qx) * (bx - qx) + (by - qy) * (by - qy) < 9) { hurt(S); break; }
      }
      continue;
    }
    if (!(p.x < e.x + e.w && p.x + p.w > e.x && p.y < e.y + e.h && p.y + p.h > e.y)) continue;
    const ex = e.x + e.w / 2;
    if (t === 'gem') { e.gone = true; S.gems[e.i] = 1; addPts(S, 2000, ex, e.y); ev(S, 'gem', ex, e.y + 6, e.i); continue; }
    if (t === 'cp') { if (S.cpOn < e.ci) { S.cpOn = e.ci; ev(S, 'cp', ex, e.y); } continue; }
    if (t === 'umb' || t === 'sun' || t === 'heart') {
      if (e.rise > 6) continue;
      e.gone = true;
      if (t === 'umb') { p.power = 1; addPts(S, 1000, ex, e.y); ev(S, 'power', ex, e.y); }
      else if (t === 'sun') { p.sun = 600; p.combo = 0; addPts(S, 1000, ex, e.y); ev(S, 'sunStart', ex, e.y); }
      else oneUp(S, ex, e.y);
      continue;
    }
    if (t === 'ember' || t === 'crusher') { hurt(S); continue; }
    if (p.sun > 0) { killEnemy(S, e, 'flip', p.dir); comboPts(S, p.combo++, ex, e.y); continue; }
    const above = p.vy > 0 && p.oy + p.h <= e.oy + 7;
    if (t === 'snail' && e.st === 1) {
      if (e.vx === 0) {                       // a resting shell: kick it away
        if (p.kick > 0) continue;
        e.vx = (p.x + p.w / 2 < ex ? 1 : -1) * 3.2; e.combo = 0; e.tm = 0; p.kick = 16;
        if (above) bounce(S, e.y, PH.stompLo, PH.stompHi);
        addPts(S, 400, ex, e.y); ev(S, 'kick', ex, e.y);
      } else if (above) {                     // a sliding shell: stop it
        e.vx = 0; e.tm = 0; p.kick = 12;
        bounce(S, e.y, PH.stompLo, PH.stompHi);
        comboPts(S, p.combo++, ex, e.y); ev(S, 'stomp', ex, e.y);
      } else if (p.kick === 0) hurt(S);
      continue;
    }
    if (t === 'prick') { hurt(S); continue; }
    if (above) {
      bounce(S, e.y, PH.stompLo, PH.stompHi);
      comboPts(S, p.combo++, ex, e.y);
      ev(S, 'stomp', ex, e.y);
      if (t === 'snail') { e.st = 1; e.vx = 0; e.tm = 0; p.kick = 12; }
      else killEnemy(S, e, t === 'flit' ? 'flip' : 'flat', 0);
    } else hurt(S);
  }
}

/* ---------- camera ---------- */

function clampCamera(S) {
  S.camX = Math.max(0, Math.min(S.camX, S.W * TS - S.vw));
  S.camY = Math.max(0, Math.min(S.camY, S.H * TS - S.vh));
}
function snapCamera(S) {
  const p = S.p;
  S.camX = p.x + p.w / 2 - S.vw * 0.36;
  S.camY = p.y + p.h - S.vh * 0.72;
  clampCamera(S);
  S.ocx = S.camX; S.ocy = S.camY;
}
function updateCamera(S) {
  const p = S.p, cx = p.x + p.w / 2;
  // the hero is kept left of centre, so more of what is ahead is visible
  const lo = S.camX + S.vw * 0.3, hi = S.camX + S.vw * 0.42;
  if (cx > hi) S.camX += cx - hi; else if (cx < lo) S.camX += cx - lo;
  if (S.H * TS > S.vh && !p.dead) {
    const top = S.camY + S.vh * 0.3, bot = S.camY + S.vh * 0.72, fy = p.y + p.h;
    if (p.y < top) S.camY += Math.max(-5, (p.y - top) * 0.2);
    else if (fy > bot) S.camY += Math.min(7, (fy - bot) * 0.35);
  }
  clampCamera(S);
}

/* ---------- one tick ---------- */

const NO_INPUT = { l: 0, r: 0, jump: 0, run: 0 };

function step(S, inp) {
  const p = S.p, ents = S.ents;
  S.ev.length = 0;
  S.inp = inp;
  S.frame++;
  p.ox = p.x; p.oy = p.y; S.ocx = S.camX; S.ocy = S.camY;
  for (let i = 0; i < ents.length; i++) { const e = ents[i]; e.ox = e.x; e.oy = e.y; }

  if (S.state === 'play') {
    if (++S.tick >= 36) {
      S.tick = 0;
      if (S.time > 0) {
        S.time--;
        if (S.time === 60) { S.hurry = true; ev(S, 'hurry', 0, 0); }
        if (S.time === 0) die(S, 'time');
      }
    }
    updateEnts(S);
    if (S.state === 'play') updatePlayer(S, inp);
    if (S.state === 'play') interact(S);
  } else if (S.state === 'dying') {
    S.st++;
    if (S.st === 26) p.vy = -5.2;
    if (S.st > 26) { p.vy = Math.min(p.vy + 0.25, 5.5); p.y += p.vy; }
    if (S.st > 150) S.state = 'dead';
  } else if (S.state === 'clear') {
    S.st++;
    S.inp = NO_INPUT;
    updateEnts(S);
    p.vy = Math.min(p.vy + PH.gDown, PH.maxFall);
    p.ground = false;
    if (moveY(S, p, p.vy, false) === 1) { p.vy = 0; p.ground = true; }
    if (S.st > 170) S.state = 'done';
  }
  updateCamera(S);
  if (S.bumps.length) {
    let n = 0;
    for (let i = 0; i < S.bumps.length; i++) { const b = S.bumps[i]; if (++b.t < 12) S.bumps[n++] = b; }
    S.bumps.length = n;
  }
}
