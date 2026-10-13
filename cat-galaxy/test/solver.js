// A search that plays the game with the game's own rules. It finds a list of
// "wait, then leap" moves that catches every fish in a level and reaches the
// wormhole without losing a life, using only leaps that still work when pressed
// a little early or late. Used by levels.js (the proof) and browser.js (which
// plays the same moves in a real browser).
const G = require('./core');
const { CONFIG } = G;
const STEP = CONFIG.STEP;
const SAMPLE = 3;           // try a leap every 3 steps (1/40 s)
const MIN_WINDOW = 0.1;     // a leap only counts if it works over at least 100 ms...
const YARN_WINDOW = 0.05;   // ...but yarn is an optional bonus, so it may need a sharper leap (50 ms)

const fishMask = (w) => w.fish.reduce((m, f, i) => (f.got ? m | (1 << i) : m), 0);

// Leap now and follow the flight to its end
function flightFrom(w0) {
  const w = G.cloneWorld(w0);
  G.step(w, true);
  if (w.cat.state !== 'flying' && w.cat.state !== 'warp') return { kind: 'nojump' };
  for (let i = 0; i < (CONFIG.MAX_FLIGHT + 1) / STEP; i++) {
    const s = w.cat.state;
    if (s === 'warp') return { kind: 'portal', w };
    if (s === 'dead') return { kind: 'dead', cause: w.cat.cause, w };
    if (s === 'planet') return { kind: 'land', planet: w.cat.planet, w };
    G.step(w, false);
  }
  return { kind: 'dead', cause: 'stuck', w };
}

const outcomeKey = (o) => (o.kind === 'land' ? 'land ' + o.planet + ' fish ' + fishMask(o.w) : o.kind);

// How long to wait on a planet before giving up: a full turn of the planet,
// or the longest cycle of anything that moves, whichever is longer.
function waitLimit(w) {
  const p = w.planets[w.cat.planet];
  let longest = (Math.PI * 2) / Math.abs(p.spin);
  for (const list of [w.planets, w.rocks, w.dogs, w.fish, w.yarn]) {
    for (const e of list) {
      const m = e.move;
      if (m) longest = Math.max(longest, m.type === 'line' ? m.period : (Math.PI * 2) / Math.abs(m.speed));
    }
  }
  return Math.min(16, longest * 1.05);
}

// Best-first search over (planet, fish caught), earliest time first, nudged
// towards states with fewer fish left. Neighbouring leap times with the same
// result form a group; only groups at least MIN_WINDOW long are used, from
// their middle. Returns the plan (steps to wait before each leap), the route
// and which yarn balls were caught on safe leaps along the way.
function solve(index) {
  const start = G.createWorld(index, CONFIG.LIVES);
  const total = start.fish.length;
  const best = new Map();
  const frontier = [{ w: start, plan: [], route: [] }];
  const yarnCaught = new Set();
  const need = Math.ceil(MIN_WINDOW / (STEP * SAMPLE) - 1e-9) + 1;   // one extra sample, as groups are measured coarsely
  const needYarn = Math.ceil(YARN_WINDOW / (STEP * SAMPLE) - 1e-9);
  const cost = (n) => n.w.t + 1.0 * (total - n.w.fishGot);
  let expanded = 0;
  while (frontier.length) {
    let pick = 0;
    for (let i = 1; i < frontier.length; i++) if (cost(frontier[i]) < cost(frontier[pick])) pick = i;
    const node = frontier.splice(pick, 1)[0];
    const here = node.w.cat.planet + ':' + fishMask(node.w);
    if (best.has(here) && best.get(here) < node.w.t) continue;   // reached sooner some other way
    expanded++;
    const waiting = G.cloneWorld(node.w);
    const steps = Math.ceil(waitLimit(waiting) / STEP);
    const tries = [];
    for (let k = 0; k <= steps; k++) {
      if (k % SAMPLE === 0) {
        const out = waiting.cat.pause <= 0 ? flightFrom(waiting) : { kind: 'nojump' };
        tries.push({ k, out, key: outcomeKey(out) });
      }
      G.step(waiting, false);
      if (waiting.cat.state !== 'planet') break;     // something hit Mochi while waiting
    }
    const used = new Set();
    for (let a = 0; a < tries.length;) {
      let b = a;
      while (b + 1 < tries.length && tries[b + 1].key === tries[a].key) b++;
      const mid = tries[(a + b) >> 1], out = mid.out;
      const width = b - a + 1;
      a = b + 1;
      if ((out.kind === 'land' || out.kind === 'portal') && width >= needYarn) out.w.yarn.forEach((y, i) => { if (y.got) yarnCaught.add(i); });
      if (width < need || used.has(mid.key)) continue;
      used.add(mid.key);
      const route = node.route.concat(out.kind === 'portal' ? 'wormhole' : String(out.planet));
      if (out.kind === 'portal') {
        return { plan: node.plan.concat(mid.k), route, expanded, yarnCaught };
      }
      if (out.kind === 'land') {
        const key = out.planet + ':' + fishMask(out.w);
        if (!best.has(key) || best.get(key) > out.w.t) {
          best.set(key, out.w.t);
          frontier.push({ w: out.w, plan: node.plan.concat(mid.k), route });
        }
      }
    }
  }
  return { plan: null, expanded, yarnCaught };
}

// Play a plan from the start, one step at a time, exactly as a player would.
// Measures how many steps early or late each leap could have been, and notes
// the clock time of each leap (for the browser check).
function replay(index, plan) {
  const w = G.createWorld(index, CONFIG.LIVES);
  const windows = [], leapTimes = [];
  for (const wait of plan) {
    const before = G.cloneWorld(w);
    for (let k = 0; k < wait; k++) G.step(w, false);
    const expect = outcomeKey(flightFrom(w));
    const works = (k) => {
      if (k < 0) return false;
      const t = G.cloneWorld(before);
      for (let i = 0; i < k; i++) G.step(t, false);
      if (t.cat.state !== 'planet' || t.cat.pause > 0) return false;
      return outcomeKey(flightFrom(t)) === expect;
    };
    let lo = wait, hi = wait;
    while (wait - lo < 120 && works(lo - 1)) lo--;
    while (hi - wait < 120 && works(hi + 1)) hi++;
    windows.push((hi - lo + 1) * STEP);
    G.step(w, true);
    leapTimes.push(w.t);
    while (w.cat.state === 'flying') G.step(w, false);
  }
  if (w.cat.state === 'warp') while (!w.done) G.step(w, false);
  return { done: w.done, deaths: w.deaths, windows, leapTimes, time: w.finishTime, score: G.scoreLevel(w) };
}

module.exports = { solve, replay, MIN_WINDOW, YARN_WINDOW };
