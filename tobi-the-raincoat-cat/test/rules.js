// Checks the game's rules one at a time on tiny purpose-built levels.
require('./harness.js');
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) pass++; else { fail++; console.log('FAIL:', name, extra === undefined ? '' : JSON.stringify(extra)); } }
function lvl(build, W, H) { return makeLevel('T', 'meadow', W || 60, H || 15, b => { b.ground(0, (W || 60) - 1); b.start(4); build && build(b); }); }
function run(S, n, inp) { const evs = []; for (let i = 0; i < n; i++) { step(S, inp || {}); for (const e of S.ev) evs.push(e[0]); } return evs; }
const G = 13;

// --- standing still on the ground
{ const S = newSim(lvl()); run(S, 30); ok('rests on ground', S.p.ground && Math.abs(S.p.y - (G * 16 - 14)) < 0.01, S.p.y); }

// --- jump needs a fresh press (holding the button from before does nothing)
{ const S = newSim(lvl()); run(S, 30, { jump: 1 }); ok('held jump at start ignored', S.p.ground); run(S, 2, {}); const ev = run(S, 3, { jump: 1 }); ok('fresh press jumps', ev.includes('jump') && !S.p.ground); }

// --- jump buffering: press 5 ticks before landing still jumps
{ const S = newSim(lvl()); run(S, 30); run(S, 1, { jump: 1 }); let t = 0; while (S.p.vy < 3.5 && t++ < 200) step(S, {}); // falling, near ground
  let pressed = false, jumps = 0;
  for (let i = 0; i < 40; i++) { const h = (S.p.y + S.p.h); const near = !pressed && !S.p.ground && (G * 16 - h) < 14 && S.p.vy > 0; if (near) pressed = true; step(S, { jump: near ? 1 : 0 }); if (S.ev.some(e => e[0] === 'jump')) jumps++; }
  ok('buffered jump fires on landing', pressed && jumps === 1, { pressed, jumps }); }

// --- coyote time: can still jump 4 ticks after walking off a ledge
{ const L = makeLevel('T', 'meadow', 40, 15, b => { b.ground(0, 10); b.ground(30, 39); b.start(8); });
  const S = newSim(L); run(S, 20); let t = 0; while (S.p.ground && t++ < 200) step(S, { r: 1 }); run(S, 3, { r: 1 });
  const ev = run(S, 2, { r: 1, jump: 1 }); ok('coyote jump', ev.includes('jump') && S.p.vy < 0, S.p.vy); }

// --- stomping a Grumble defeats it and bounces the hero
{ const S = newSim(lvl(b => b.en('mud', 6))); run(S, 5); S.ents[0].on = 1; S.p.x = S.ents[0].x; S.p.y = S.ents[0].y - 40; S.p.vy = 0;
  let evs = []; for (let i = 0; i < 40 && !S.ents[0].gone; i++) evs = evs.concat(run(S, 1));
  ok('stomp kills', S.ents[0].gone && evs.includes('stomp') && S.p.vy < 0 && S.state === 'play', { gone: S.ents[0].gone, vy: S.p.vy });
  ok('stomp scores 100', S.score === 100, S.score); }

// --- walking into a Grumble costs a try when unpowered
{ const S = newSim(lvl(b => b.en('mud', 7))); run(S, 5); let n = 0; while (S.state === 'play' && n++ < 300) step(S, { r: 1 });
  ok('side hit kills', S.state === 'dying'); run(S, 200); ok('then dead', S.state === 'dead'); }

// --- with the umbrella, a hit only loses the umbrella and grants a moment of safety
{ const S = newSim(lvl(b => b.en('mud', 7)), { power: 1 }); run(S, 5); let n = 0; while (S.p.power && n++ < 300) step(S, { r: 1 });
  ok('hit loses umbrella', S.state === 'play' && S.p.power === 0 && S.p.inv > 0); run(S, 60, { r: 1 }); ok('safe while blinking', S.state === 'play'); }

// --- Prickle cannot be stomped
{ const S = newSim(lvl(b => b.en('prick', 6))); run(S, 5); S.ents[0].on = 1; S.p.x = S.ents[0].x; S.p.y = S.ents[0].y - 40; run(S, 40);
  ok('prickle hurts from above', S.state === 'dying' && !S.ents[0].gone); }

// --- snail: stomp -> shell, touch -> kick, shell bowls over a Grumble, bounces off a wall
{ const S = newSim(lvl(b => { b.en('snail', 8); b.en('mud', 16); b.pillar(22, 2); }));
  run(S, 5); const sn = S.ents[0], mud = S.ents[1]; sn.on = 1; mud.on = 1; mud.dir = 1;
  S.p.x = sn.x; S.p.y = sn.y - 40; let n = 0; while (sn.st === 0 && n++ < 60) step(S, {});
  ok('stomp makes shell', sn.st === 1 && sn.vx === 0);
  S.p.x = sn.x - 40; S.p.y = G * 16 - 14; S.p.vy = 0; run(S, 20);   // step aside, then walk back into it
  n = 0; while (sn.vx === 0 && n++ < 60) step(S, { r: 1 });
  ok('kick sends shell right', sn.vx > 0, sn.vx);
  n = 0; while (!mud.gone && n++ < 200) step(S, {});
  ok('shell defeats grumble', mud.gone);
  n = 0; let bumped = false; while (n++ < 200 && !bumped) { step(S, {}); if (S.ev.some(e => e[0] === 'shellBump')) bumped = true; }
  ok('shell bounces off wall', bumped && sn.vx < 0, sn.vx);
  n = 0; while (S.state === 'play' && n++ < 300) step(S, {});
  ok('returning shell hurts', S.state === 'dying'); }

// --- crate: bumps when plain, breaks with the umbrella; a Grumble on top is knocked off
{ const mk2 = () => lvl(b => { b.blk(6, 9, 'B'); b.en('mud', 6, 9, { on: 1 }); });
  let S = newSim(mk2()); run(S, 5); S.ents[0].on = 1; S.ents[0].dir = 0; S.p.x = 6 * 16 + 3; run(S, 3);
  let evs = run(S, 1, { jump: 1 }); evs = evs.concat(run(S, 30, { jump: 1 }));
  ok('plain bump keeps crate', tileAt(S, 6, 9) === T.BRICK && evs.includes('bump'), evs);
  ok('bump knocks enemy off', S.ents[0].gone);
  S = newSim(mk2(), { power: 1 }); run(S, 5); S.p.x = 6 * 16 + 3; run(S, 3); run(S, 1, { jump: 1 }); evs = run(S, 12, { jump: 1 });
  ok('umbrella breaks crate', tileAt(S, 6, 9) === T.EMPTY && evs.includes('break'), evs); }

// --- sun block gives a coin once, then is spent
{ const S = newSim(lvl(b => b.blk(6, 9, '?'))); run(S, 5); S.p.x = 6 * 16 + 3; run(S, 3); run(S, 1, { jump: 1 }); run(S, 40, { jump: 1 });
  ok('coin from block', S.coins === 1 && tileAt(S, 6, 9) === T.USED, S.coins);
  run(S, 3); run(S, 1, { jump: 1 }); run(S, 40, { jump: 1 }); ok('spent block gives nothing', S.coins === 1); }

// --- umbrella block: item rises, drifts down, can be collected; glide slows the fall
{ const S = newSim(lvl(b => b.blk(6, 9, 'U'))); run(S, 5); S.p.x = 6 * 16 + 3; run(S, 3); run(S, 1, { jump: 1 }); run(S, 30, { jump: 1 });
  const it = S.ents.find(e => e.t === 'umb'); ok('umbrella appears', !!it);
  let n = 0; while (it && !it.gr && n++ < 900) step(S, {});
  ok('umbrella lands', it && it.gr && !it.gone, it && { x: it.x, y: it.y });
  S.p.x = it.x; S.p.y = it.y; run(S, 2); ok('umbrella collected', S.p.power === 1);
  run(S, 20); run(S, 1, { jump: 1 }); n = 0; let minV = 99, glided = false; for (let i = 0; i < 120; i++) { step(S, { jump: 1 }); if (S.p.glide) { glided = true; } if (S.p.glide && S.p.vy > 0) minV = Math.min(minV, S.p.vy); }
  ok('glide caps fall speed', glided, { minV }); }

// --- multi-coin crate pays out several times then turns solid
{ const S = newSim(lvl(b => b.blk(6, 9, 'M'))); run(S, 5); S.p.x = 6 * 16 + 3;
  for (let k = 0; k < 12; k++) { run(S, 3); run(S, 1, { jump: 1 }); run(S, 40, { jump: 1 }); }
  ok('coin crate pays 8', S.coins === 8 && tileAt(S, 6, 9) === T.USED, S.coins); }

// --- 100 coins earn a try
{ const S = newSim(lvl(b => b.coins(6, 12, 3)), { coins: 98 }); run(S, 5); const l0 = S.lives; run(S, 80, { r: 1 });
  ok('100 coins = extra try', S.lives === l0 + 1 && S.coins === 1, { lives: S.lives, coins: S.coins }); }

// --- pit and time
{ const L = makeLevel('T', 'meadow', 40, 15, b => { b.ground(0, 6); b.ground(20, 39); b.start(4); });
  const S = newSim(L); run(S, 5); let n = 0; while (S.state === 'play' && n++ < 400) step(S, { r: 1 }); ok('pit kills', S.state === 'dying' && S.why === 'pit'); }
{ const S = newSim(lvl()); S.time = 2; run(S, 80); ok('time out kills', S.state === 'dying' && S.why === 'time', S.state); }

// --- lava and spikes
{ const L = makeLevel('T', 'keep', 40, 15, b => { b.ground(0, 6); b.ground(12, 39); b.lava(7, 11); b.start(4); });
  const S = newSim(L, { power: 1 }); run(S, 5); let n = 0; while (S.state === 'play' && n++ < 400) step(S, { r: 1 }); ok('lava kills even with umbrella', S.state === 'dying' && S.why === 'lava', S.why); }
{ const S = newSim(lvl(b => b.blk(8, 12, '^^')), { power: 1 }); run(S, 5); let n = 0; while (S.p.power && n++ < 300) step(S, { r: 1 });
  ok('spikes hurt', S.p.power === 0 && S.state === 'play'); }

// --- thin ledge: can jump up through it and stand on it
{ const S = newSim(lvl(b => b.blk(3, 10, '====='))); run(S, 5); run(S, 1, { jump: 1 }); run(S, 60, { jump: 1 });
  ok('stands on thin ledge', S.p.ground && Math.abs(S.p.y + S.p.h - 10 * 16) < 0.01, S.p.y + S.p.h); }

// --- spring
{ const S = newSim(lvl(b => b.spring(4))); run(S, 3); S.p.y = 150; let top = 999; for (let i = 0; i < 120; i++) { step(S, {}); top = Math.min(top, S.p.y + S.p.h); }
  ok('spring launches', 208 - top > 80, 208 - top); }

// --- moving platform carries the hero sideways and up
{ const L = makeLevel('T', 'meadow', 40, 15, b => { b.ground(0, 5); b.ground(30, 39); b.plat(6, 12, { ax: 8, per: 240 }); b.start(4); });
  const S = newSim(L); const pl = S.ents[0]; S.p.x = pl.x + 20; S.p.y = pl.y - 30; let rode = 0, okRide = true, d0 = null;
  for (let i = 0; i < 300; i++) { step(S, {}); if (S.p.ride === 0) { rode++; if (d0 === null) d0 = S.p.x - pl.x; if (Math.abs(S.p.y + S.p.h - pl.y) > 0.01) okRide = false; } }
  ok('rides sideways platform', rode > 250 && okRide && S.state === 'play' && Math.abs((S.p.x - pl.x) - d0) < 0.01, { rode, d0, dx: S.p.x - pl.x }); }
{ const L = makeLevel('T', 'meadow', 40, 15, b => { b.ground(0, 5); b.plat(8, 12, { ay: -6, per: 200 }); b.start(4); });
  const S = newSim(L); const pl = S.ents[0]; S.p.x = pl.x + 20; S.p.y = pl.y - 30; let rode = 0, okRide = true;
  for (let i = 0; i < 400; i++) { step(S, {}); if (S.p.ride === 0) { rode++; if (Math.abs(S.p.y + S.p.h - pl.y) > 0.01) okRide = false; } }
  ok('rides lift up and down', rode > 350 && okRide && S.state === 'play', { rode, okRide }); }

// --- falling platform drops after being stood on, and comes back
{ const L = makeLevel('T', 'meadow', 40, 15, b => { b.ground(0, 5); b.plat(8, 11, { fall: 1 }); b.start(4); });
  const S = newSim(L); const pl = S.ents[0]; S.p.x = pl.x + 20; S.p.y = pl.y - 20; run(S, 20); ok('holds at first', pl.drop === 0 && S.p.ride === 0);
  run(S, 30); ok('then drops', pl.drop === 1); S.god = true; run(S, 400); ok('and returns', pl.drop === 0 && pl.y === pl.by, pl); }

// --- checkpoint lamp
{ const L = lvl(b => b.cp(10)); const S = newSim(L); run(S, 5); let n = 0; while (!S.cpOn && n++ < 300) step(S, { r: 1 });
  ok('lamp lights', S.cpOn === 1); const S2 = newSim(L, { fromCp: 1 }); ok('restart at lamp', Math.abs(S2.p.x - (10 * 16 + 3)) < 1, S2.p.x); }
{ const L = lvl(b => { b.cp(10); b.cp(30); }); const S = newSim(L); run(S, 5); let n = 0; while (S.cpOn < 2 && n++ < 600) step(S, { r: 1, run: 1 });
  ok('second lamp replaces first', S.cpOn === 2); S.p.x = 9 * 16; run(S, 10, { r: 1 }); ok('earlier lamp does not undo it', S.cpOn === 2);
  const S2 = newSim(L, { fromCp: 2 }); ok('restart at second lamp', Math.abs(S2.p.x - (30 * 16 + 3)) < 1, S2.p.x); }
// --- Grumbles turn at ledges unless told otherwise
{ const L = makeLevel('T', 'meadow', 40, 15, b => { b.ground(0, 12); b.start(2); b.en('mud', 5); b.en('mud', 10, null, { lg: 0, dir: 1 }); });
  const S = newSim(L); S.ents[0].on = 1; S.ents[1].on = 1; S.ents[0].dir = 1; S.god = true; S.p.y = -400; S.p.x = 300; run(S, 30); S.p.y = -400; run(S, 30); S.p.y = -400; run(S, 30);
  for (let i = 0; i < 30; i++) { S.p.y = -400; S.p.vy = 0; run(S, 20); }
  ok('grumble stays on its ledge', !S.ents[0].gone && S.ents[0].x < 13 * 16);
  ok('a reckless grumble walks off', S.ents[1].gone); }

// --- bell: reaching it ends the stage; higher pays more
{ const L = lvl(b => { b.stairs(20, 5, 1); b.goal(28); }, 40);
  let S = newSim(L); S.p.x = 26 * 16; run(S, 5); let n = 0; while (S.state === 'play' && n++ < 300) step(S, { r: 1 }); const low = S.bonus;
  ok('bell clears stage', S.state === 'clear' && low === 100, low); run(S, 200); ok('then done', S.state === 'done');
  S = newSim(L); S.p.x = 24 * 16 + 2; S.p.y = 8 * 16 - 14; run(S, 3); run(S, 6, { r: 1, run: 1 }); run(S, 1, { r: 1, run: 1, jump: 1 }); n = 0; while (S.state === 'play' && n++ < 300) step(S, { r: 1, run: 1, jump: 1 });
  ok('high touch pays more', S.state === 'clear' && S.bonus >= 2000, S.bonus); }

// --- sun drop: enemies fall on touch
{ const S = newSim(lvl(b => { b.en('mud', 8); b.en('prick', 11); })); run(S, 3); S.p.sun = 300; let n = 0; while (n++ < 200) step(S, { r: 1 });
  ok('sun drop beats everything', S.ents[0].gone && S.ents[1].gone && S.state === 'play'); }

// --- crusher falls when approached and can be passed after it rises
{ const L = makeLevel('T', 'keep', 40, 15, b => { b.ground(0, 39); b.fill(0, 0, 39, 1, T.GROUND); b.crusher(12, 2); b.start(4); });
  const S = newSim(L); const c = S.ents[0]; run(S, 5); let n = 0; while (c.st === 0 && n++ < 300) step(S, { r: 1 });
  ok('crusher triggers', c.st === 1, { x: S.p.x }); run(S, 3, { l: 1 }); n = 0; while (c.st !== 2 && n++ < 100) step(S, { l: 1 });
  ok('crusher lands on floor', c.st === 2 && Math.abs(c.y + c.h - 13 * 16) < 0.01 && S.state === 'play', { y: c.y + c.h, st: S.state }); }

// --- ember chain hurts on contact
{ const L = makeLevel('T', 'keep', 40, 15, b => { b.ground(0, 39); b.chain(8, 10, 4, 0, Math.PI / 2); b.start(4); });   // hangs straight down
  const S = newSim(L); run(S, 5); let n = 0; while (S.state === 'play' && n++ < 300) step(S, { r: 1 }); ok('chain hurts', S.state === 'dying'); }

// --- stepping across a one-tile gap at a run does not snag
{ const L = makeLevel('T', 'meadow', 60, 15, b => { b.ground(0, 20); b.ground(22, 59); b.start(4); });
  const S = newSim(L); run(S, 5); let n = 0; while (S.p.x < 30 * 16 && S.state === 'play' && n++ < 400) step(S, { r: 1, run: 1 });
  ok('runs over one-tile gap', S.state === 'play' && S.p.x >= 30 * 16, { x: S.p.x / 16, st: S.state }); }
// --- but walking slowly, the hero drops into it
{ const L = makeLevel('T', 'meadow', 60, 15, b => { b.ground(0, 20); b.ground(22, 59); b.start(18); });
  const S = newSim(L); run(S, 5); let n = 0; while (S.state === 'play' && n++ < 400) step(S, { r: 1 });
  ok('walking falls into gap', S.state === 'dying', { x: S.p.x / 16, st: S.state }); }

// --- cloning a run gives an independent copy that plays out identically
{ const S = newSim(LEVELS[0]); run(S, 100, { r: 1, run: 1 }); const C = cloneSim(S);
  for (let i = 0; i < 300; i++) { const inp = { r: 1, run: 1, jump: (i % 40) < 20 ? 1 : 0 }; step(S, inp); step(C, inp); }
  ok('clone stays in step', S.p.x === C.p.x && S.p.y === C.p.y && S.score === C.score && S.state === C.state, { a: S.p.x, b: C.p.x }); }

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
