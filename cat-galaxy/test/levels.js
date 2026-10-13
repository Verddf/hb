// Checks every level with the game's own rules:
//
//  1. Layout: everything stays inside the galaxy, nothing sits inside a planet,
//     and no moon rock or space dog can ever touch Mochi standing on a planet.
//  2. Proof: the search in solver.js finds "wait, then leap" moves that catch
//     every fish and reach the wormhole without losing a life, using only leaps
//     that work over at least 100 ms. The moves are played again from the start,
//     step by step, to confirm them.
//  3. Fairness: each leap's timing window, the fastest finish against the par
//     time, and whether every yarn ball can be caught on a leap that ends safely.
//
// The leap times it finds are saved in test/out/plans.json for browser.js.
//
//   node test/levels.js       every level (levels run side by side)
//   node test/levels.js 4     level 4 only
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const os = require('os');
const path = require('path');
const G = require('./core');
const { solve, replay, MIN_WINDOW, YARN_WINDOW } = require('./solver');
const { CONFIG, LEVELS } = G;
const STEP = CONFIG.STEP;

// ---------------------------------------------------------------------------
// Layout checks, sampled over 40 seconds of play
// ---------------------------------------------------------------------------
function checkLayout(index, fail) {
  const L = LEVELS[index];
  const w = G.createWorld(index);
  const R = CONFIG.CAT_RADIUS, LIFT = CONFIG.CAT_LIFT;
  if (L.planets[L.start].kind === 'sun') fail('Mochi starts on a sun');
  L.planets.forEach((p, i) => {
    if (p.move && p.move.around != null && p.move.around >= i) fail('planet ' + i + ' circles a planet that comes later in the list');
  });
  const seen = new Set();
  const once = (msg) => { if (!seen.has(msg)) { seen.add(msg); fail(msg); } };
  for (let n = 0; n < 40 / STEP; n += 6) {
    // Move everything to time n * STEP. With Mochi parked in the "lost a life"
    // pause, a step moves the world and does nothing else.
    const probe = G.cloneWorld(w);
    probe.cat.state = 'dead';
    probe.cat.timer = 1e9;
    probe.t = (n - 1) * STEP;
    G.step(probe, false);
    const { planets, fish, yarn, rocks, dogs, holes, portal } = probe;
    const inside = (e, r, what) => {
      if (e.x - r < 0 || e.y - r < 0 || e.x + r > CONFIG.WIDTH || e.y + r > CONFIG.HEIGHT) once(what + ' goes outside the galaxy');
    };
    planets.forEach((p, i) => {
      inside(p, p.r, 'planet ' + i);
      planets.forEach((q, j) => {
        if (j > i && Math.hypot(p.x - q.x, p.y - q.y) < p.r + q.r + 2 * (LIFT + R)) once('planets ' + i + ' and ' + j + ' come too close for Mochi to stand between them');
      });
    });
    const clearOfPlanets = (e, r, what) => {
      planets.forEach((p, i) => {
        if (Math.hypot(p.x - e.x, p.y - e.y) < p.r + r + 4) once(what + ' touches planet ' + i);
      });
    };
    fish.forEach((f, i) => { inside(f, CONFIG.FISH_RADIUS, 'fish ' + i); clearOfPlanets(f, CONFIG.FISH_RADIUS, 'fish ' + i); });
    yarn.forEach((y, i) => { inside(y, CONFIG.YARN_RADIUS, 'yarn ' + i); clearOfPlanets(y, CONFIG.YARN_RADIUS, 'yarn ' + i); });
    inside(portal, CONFIG.PORTAL_RADIUS, 'the wormhole');
    clearOfPlanets(portal, CONFIG.PORTAL_RADIUS, 'the wormhole');
    holes.forEach((h, i) => clearOfPlanets(h, CONFIG.HOLE_CORE + 40, 'black hole ' + i));
    // A standing Mochi can be anywhere on the ring (radius + LIFT) around a planet
    const hazards = rocks.map((r, i) => ({ e: r, r: r.r - 2, what: 'moon rock ' + i }))
      .concat(dogs.map((d, i) => ({ e: d, r: CONFIG.DOG_RADIUS - 2, what: 'space dog ' + i })));
    for (const hz of hazards) {
      planets.forEach((p, i) => {
        if (p.kind === 'sun') return;
        const d = Math.hypot(p.x - hz.e.x, p.y - hz.e.y);
        if (Math.abs(d - (p.r + LIFT)) < hz.r + R + 2) once(hz.what + ' can hit Mochi standing on planet ' + i);
      });
    }
  }
}

function checkLevel(i) {
  const L = LEVELS[i];
  const lines = ['Level ' + (i + 1) + ': ' + L.name + ' (' + L.fish.length + ' fish, par ' + L.par + ' s)'];
  let problems = 0;
  const fail = (msg) => { problems++; lines.push('  PROBLEM: ' + msg); };
  const t0 = Date.now();
  checkLayout(i, fail);
  const found = solve(i);
  if (!found.plan) {
    fail('no way to finish without losing a life was found (' + found.expanded + ' planet visits searched)');
    return { lines, problems };
  }
  const r = replay(i, found.plan);
  if (!r.done || r.deaths) fail('the plan did not work when played again');
  const narrow = Math.min(...r.windows);
  lines.push('  fastest safe finish ' + r.time.toFixed(1) + ' s, ' + found.plan.length + ' leaps (' + found.expanded + ' planet visits, ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
  lines.push('  route: planet ' + L.start + ' > ' + found.route.join(' > '));
  lines.push('  timing windows (ms): ' + r.windows.map((x) => Math.round(x * 1000)).join(' '));
  if (narrow < MIN_WINDOW - 1e-9) fail('a leap needs timing within ' + Math.round(narrow * 1000) + ' ms');
  if (L.par < r.time * 1.3) fail('par ' + L.par + ' s is too tight for a fastest finish of ' + r.time.toFixed(1) + ' s');
  if (L.par > r.time * 2.5 + 10) fail('par ' + L.par + ' s is too loose for a fastest finish of ' + r.time.toFixed(1) + ' s');
  (L.yarn || []).forEach((_, y) => {
    if (!found.yarnCaught.has(y)) fail('yarn ' + y + ' was never caught on a safe leap (with ' + YARN_WINDOW * 1000 + ' ms to spare) during the search');
  });
  lines.push('  three-star score on this route: ' + r.score.total);
  return { lines, problems, leapTimes: r.leapTimes };
}

// ---------------------------------------------------------------------------
if (!isMainThread) {
  parentPort.postMessage(checkLevel(workerData));
} else {
  const only = process.argv[2] ? [Number(process.argv[2]) - 1] : LEVELS.map((_, i) => i);
  const t0 = Date.now();
  const results = new Array(LEVELS.length);
  let next = 0, running = 0, problems = 0;
  const launch = () => {
    while (running < Math.max(1, os.cpus().length) && next < only.length) {
      const i = only[next++];
      running++;
      new Worker(__filename, { workerData: i }).on('message', (res) => {
        results[i] = res;
        problems += res.problems;
        running--;
        if (next < only.length) launch();
        else if (!running) finish();
      }).on('error', (e) => { console.error(e); process.exit(2); });
    }
  };
  const finish = () => {
    for (const i of only) console.log(results[i].lines.join('\n'));
    if (only.length === LEVELS.length && !problems) {
      const out = path.join(__dirname, 'out');
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(path.join(out, 'plans.json'), JSON.stringify(results.map((r) => r.leapTimes)));
    }
    console.log('\n' + (problems ? problems + ' PROBLEM(S)' : 'Every level can be finished without losing a life.') + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
    process.exit(problems ? 1 : 0);
  };
  launch();
}
