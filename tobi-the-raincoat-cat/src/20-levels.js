/* ============================================================
   LEVELS
   Each stage is written as a short list of building steps
   (ground from here to there, a row of blocks, a creature...).
   Columns and rows count in tiles; row 0 is the top.
   ============================================================ */

function makeLevel(name, theme, W, H, build) {
  const grid = new Uint8Array(W * H);
  const L = { name: name, theme: theme, W: W, H: H, grid: grid, meta: {}, ents: [], decor: [],
    start: null, cps: [], time: 300, rain: 0, gemN: 0 };
  const G = H - 2;                       // row of the main floor
  const ent = function (t, x, y, o) {
    const s = ESZ[t];
    const e = Object.assign({ t: t, x: x, y: y, w: s[0], h: s[1], vx: 0, vy: 0, dir: -1, st: 0, tm: 0, gr: 0 }, o || {});
    L.ents.push(e);
    return e;
  };
  const b = {
    G: G, W: W, H: H, L: L,
    set: function (x, y, t) { if (x >= 0 && x < W && y >= 0 && y < H) grid[y * W + x] = t; },
    get: function (x, y) { return (x >= 0 && x < W && y >= 0 && y < H) ? grid[y * W + x] : 0; },
    fill: function (x0, y0, x1, y1, t) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) b.set(x, y, t); },
    clear: function (x0, y0, x1, y1) { b.fill(x0, y0, x1, y1, T.EMPTY); },
    ground: function (x0, x1, top) { b.fill(x0, top == null ? G : top, x1, H - 1, T.GROUND); },
    // a row of blocks:  B brick  ? coin block  U umbrella  S sun drop  H heart
    //                   M brick full of coins  h brick hiding a heart
    //                   # hard block  = thin ledge  o coin  ^ spikes  b bridge
    blk: function (x, y, s) {
      for (let i = 0; i < s.length; i++) {
        const X = x + i, k = y * W + X, c = s[i];
        if (c === 'B') b.set(X, y, T.BRICK);
        else if (c === '?') { b.set(X, y, T.BONUS); L.meta[k] = 'c'; }
        else if (c === 'U') { b.set(X, y, T.BONUS); L.meta[k] = 'u'; }
        else if (c === 'S') { b.set(X, y, T.BONUS); L.meta[k] = 's'; }
        else if (c === 'H') { b.set(X, y, T.BONUS); L.meta[k] = 'h'; }
        else if (c === 'M') { b.set(X, y, T.BRICK); L.meta[k] = 'm'; }
        else if (c === 'h') { b.set(X, y, T.BRICK); L.meta[k] = 'h'; }
        else if (c === '#') b.set(X, y, T.HARD);
        else if (c === '=') b.set(X, y, T.ONEWAY);
        else if (c === 'o') b.set(X, y, T.COIN);
        else if (c === '^') b.set(X, y, T.SPIKE);
        else if (c === 'b') b.set(X, y, T.BRIDGE);
      }
    },
    pillar: function (x, h, base) {          // two tiles wide, h tiles tall
      base = base == null ? G : base;
      for (let i = 0; i < h; i++) {
        const y = base - 1 - i, top = i === h - 1;
        b.set(x, y, top ? T.PIL_TL : T.PIL_L); b.set(x + 1, y, top ? T.PIL_TR : T.PIL_R);
      }
    },
    stairs: function (x, n, dir, base) {      // dir 1 climbs to the right, -1 descends
      base = base == null ? G : base;
      for (let i = 0; i < n; i++) {
        const h = dir > 0 ? i + 1 : n - i;
        for (let j = 0; j < h; j++) b.set(x + i, base - 1 - j, T.HARD);
      }
    },
    coins: function (x, y, n, dx, dy) {
      for (let i = 0; i < (n || 1); i++) b.set(x + i * (dx == null ? 1 : dx), y + i * (dy || 0), T.COIN);
    },
    arc: function (x, y, n, h) {
      for (let i = 0; i < n; i++) b.set(x + i, y - Math.round((h || 1) * Math.sin(Math.PI * (i + 0.5) / n)), T.COIN);
    },
    lava: function (x0, x1) { for (let x = x0; x <= x1; x++) b.set(x, H - 1, T.LAVA); },
    start: function (x, fy) { L.start = { x: x * TS + 3, y: (fy == null ? G : fy) * TS - 14 }; },
    // a creature standing on the floor whose top is row fy
    en: function (t, x, fy, o) {
      const s = ESZ[t];
      return ent(t, x * TS + (TS - s[0]) / 2, (fy == null ? G : fy) * TS - s[1], o);
    },
    fly: function (x, y, o) {                 // a flier circling around tile (x, y)
      o = o || {};
      const px = x * TS + 2, py = y * TS + 3;
      return ent('flit', px, py, { bx: px, by: py, ax: (o.ax || 0) * TS, ay: (o.ay || 0) * TS, per: o.per || 200, ph: o.ph || 0, dir: 1 });
    },
    plat: function (x, y, o) {                // a platform that travels (ax, ay) tiles and back, or falls
      o = o || {};
      return ent('plat', x * TS, y * TS, { w: (o.w || 3) * TS, bx: x * TS, by: y * TS, ax: (o.ax || 0) * TS, ay: (o.ay || 0) * TS,
        per: o.per || 240, ph: o.ph || 0, fall: o.fall ? 1 : 0, stood: 0, drop: 0 });
    },
    spring: function (x, fy) { return b.en('spring', x, fy); },
    gem: function (x, y) { return ent('gem', x * TS + 3, y * TS + 2, { i: L.gemN++ }); },
    cp: function (x, fy) {                    // a halfway lamp; a stage may have more than one
      fy = fy == null ? G : fy;
      L.cps.push({ x: x * TS + 3, y: fy * TS - 14 });
      return b.en('cp', x, fy, { ci: L.cps.length });
    },
    goal: function (x, fy) { fy = fy == null ? G : fy; L.goalX = x; L.goalY = fy; return ent('goal', x * TS + 5, fy * TS - 112, {}); },
    chain: function (x, y, n, w0, a0) {       // a turning chain of embers around a block
      b.set(x, y, T.HARD);
      return ent('chain', x * TS + 8, y * TS + 8, { n: n, w0: w0, a0: a0 || 0 });
    },
    crusher: function (x, y) { return ent('crusher', x * TS + 2, y * TS, { by: y * TS }); },
    ember: function (x, v0, ph, wait) {       // leaps out of the lava at column x (may be fractional)
      const by = H * TS + 6;
      return ent('ember', x * TS + 3, by, { by: by, v0: v0 || 6.3, wait: wait || 80, tm: ph || 30 });
    },
    // scenery; never touches play. Anchored at the bottom-left on floor row fy.
    deco: function (k, x, fy, o) { L.decor.push(Object.assign({ k: k, x: x * TS, y: (fy == null ? G : fy) * TS }, o || {})); },
  };
  build(b);
  if (!L.start) b.start(2);
  return L;
}

const LEVELS = [

  /* ---------------- 1: DRIZZLE MEADOW ---------------- */
  makeLevel('DRIZZLE MEADOW', 'meadow', 212, 15, function (b) {
    b.L.rain = 1;
    // tips shown the first time the hero passes each column
    b.L.hints = [[6, 'JUMP UP UNDER A SUN BLOCK'], [14, 'LAND ON A GRUMBLE TO SQUASH IT'], [26, 'HOLD JUMP LONGER TO GO HIGHER'],
      [38, 'SQUASH A SNAIL, THEN KICK ITS SHELL'], [105, 'NEVER LAND ON A PRICKLE'], [138, 'WAIT FOR THE RAFT']];
    b.start(2);
    b.ground(0, 34); b.ground(37, 59); b.ground(63, 107); b.ground(110, 127);
    b.ground(131, 134); b.ground(138, 140); b.ground(147, 211);

    // warm-up: first blocks, first Grumble, first stump
    b.coins(7, 12, 3);
    b.blk(11, 9, '?');
    b.blk(17, 9, 'BUB?B'); b.coins(17, 8, 5);
    b.blk(19, 5, '?');
    b.en('mud', 24);
    b.pillar(28, 2); b.coins(28, 10, 2);
    b.en('mud', 33);
    b.arc(34, 10, 4, 1);

    // a snail and a line of Grumbles to bowl over
    b.pillar(41, 3);
    b.en('snail', 46);
    b.coins(49, 12, 8);
    b.en('mud', 51); b.en('mud', 53); b.en('mud', 55);
    b.arc(59, 10, 5, 1);

    // climbing blocks, first sun shard
    b.pillar(65, 2);
    b.blk(68, 9, 'B?B?B');
    b.blk(71, 6, 'BBB');
    b.gem(72, 5);
    b.fly(77, 8, { ax: 2.5, per: 210 });
    b.en('mud', 81); b.en('mud', 83);
    b.blk(85, 10, '==='); b.coins(85, 9, 3);
    b.blk(89, 7, '==='); b.coins(89, 6, 3);
    b.pillar(94, 3);

    // halfway lamp, the split staircase, first Prickle
    b.cp(102);
    b.stairs(104, 4, 1); b.stairs(110, 4, -1);
    b.coins(104, 11, 4, 1, -1); b.coins(110, 8, 4, 1, 1);
    b.arc(116, 10, 5, 1);
    b.en('prick', 118);
    b.pillar(122, 2);

    // pond hopping and the first moving raft
    b.arc(128, 10, 3, 1);
    b.en('snail', 133);
    b.arc(135, 10, 3, 1);
    b.plat(141, 12, { ax: 3, per: 220 });
    b.gem(144, 8);
    b.coins(142, 10, 1); b.coins(146, 10, 1);

    // brick vault (needs the umbrella), coin brick, hidden heart
    b.blk(150, 9, '?U?');
    b.en('mud', 154); b.en('mud', 156);
    b.blk(158, 7, 'BBBBB'); b.blk(158, 8, 'B   B'); b.blk(158, 9, 'BBBBB');
    b.gem(160, 8);
    b.coins(158, 6, 5);
    b.pillar(165, 2);
    b.blk(168, 9, 'BBMBB');
    b.blk(170, 5, 'h');
    b.en('snail', 175); b.en('snail', 181);
    b.coins(177, 12, 3);
    b.pillar(185, 2);

    // last steps and the bell
    b.stairs(191, 5, 1);
    b.coins(197, 6, 1); b.coins(198, 7, 1); b.coins(199, 8, 1);
    b.goal(201);

    // scenery
    [['sign', 3.6], ['fence', 5], ['fence', 6], ['bush', 13], ['flower', 15.3], ['grass', 16.5], ['bush2', 22], ['flower2', 25],
      ['grass', 38], ['flower', 39.5], ['bush', 44], ['bush2', 48.5], ['flower2', 57], ['bush', 74], ['grass', 78], ['flower', 79],
      ['bush2', 90], ['flower2', 97], ['fence', 100], ['grass', 114], ['flower', 116], ['bush', 124], ['flower2', 132], ['grass', 139],
      ['bush', 148], ['flower', 152], ['grass', 157], ['bush2', 173], ['flower', 178], ['flower2', 179.5], ['bush', 187],
      ['fence', 204], ['fence', 205], ['bush', 207], ['flower', 209.4]].forEach(function (d) { b.deco(d[0], d[1]); });
    [30.5, 86, 163].forEach(function (x) { b.deco('puddle', x, null, { dy: 2 }); });
  }),

  /* ---------------- 2: SNAIL HOLLOW ---------------- */
  makeLevel('SNAIL HOLLOW', 'cave', 206, 15, function (b) {
    b.start(2);
    b.fill(0, 0, 205, 1, T.GROUND);                 // cave roof
    b.ground(0, 44); b.ground(47, 62); b.ground(77, 112); b.ground(150, 205);

    // way in
    b.blk(7, 9, 'h??');
    b.en('frog', 14, null, { tm: 50 });
    b.fill(17, 2, 23, 4, T.GROUND);
    b.blk(19, 9, 'BUB');
    b.en('mud', 27);

    // a raised bank with a snail on patrol, then a dip and a small pit
    b.ground(30, 37, 11);
    b.coins(32, 9, 4);
    b.en('snail', 34, 11);
    b.en('mud', 42);
    b.arc(44, 10, 4, 1);
    b.fill(50, 2, 51, 7, T.BRICK);
    b.fly(53, 8.5, { ay: 2, per: 180 });
    b.blk(55, 12, '#');
    b.coins(57, 12, 5);
    b.en('prick', 59);

    // two lifts over the deep pit
    b.plat(64, 12, { ay: -5, per: 280 });
    b.blk(69, 8, '##');
    b.coins(69, 6, 2);
    b.plat(72, 7, { ay: 5, per: 280 });
    b.gem(73, 4);

    // halfway lamp; the brick mass, with a tunnel below and a walk on top
    b.cp(79);
    b.pillar(82, 3);
    b.fill(86, 7, 99, 10, T.BRICK);
    b.clear(92, 8, 93, 9);
    b.gem(93, 9);
    b.blk(89, 10, 'M');
    b.coins(87, 12, 12);
    b.en('snail', 96);
    b.coins(88, 5, 3); b.coins(95, 5, 3);
    b.en('prick', 91, 7);
    b.en('frog', 104, null, { tm: 40 });
    b.blk(106, 9, 'UB?');                  // a second umbrella, for the shard walled up in the brick mass

    // the spike trench
    b.fill(113, 14, 149, 14, T.GROUND);
    b.fill(113, 13, 149, 13, T.SPIKE);
    b.blk(115, 11, '==='); b.coins(115, 10, 3);
    b.plat(120, 10, { fall: 1 });
    b.blk(125, 9, '###'); b.coins(125, 7, 3);
    b.plat(130, 9, { fall: 1 });
    b.plat(135, 10, { fall: 1 });
    b.blk(140, 10, '==='); b.coins(140, 9, 3);
    b.plat(144, 11, { ax: 2, per: 200 });
    b.fly(128, 5, { ax: 2, per: 210 });
    b.fly(137, 6, { ax: 2, per: 210, ph: 105 });

    // the low corridor
    b.cp(151);
    b.fill(153, 2, 186, 5, T.GROUND);
    b.blk(157, 9, '?S?');
    b.blk(162, 12, '#'); b.blk(170, 12, '#'); b.blk(178, 12, '#');
    b.en('prick', 166); b.en('prick', 174);
    b.coins(164, 10, 5); b.coins(172, 10, 5);
    b.clear(182, 4, 184, 5);
    b.blk(182, 9, '#');
    b.gem(182, 4);
    b.en('frog', 185, null, { tm: 30 });

    // way out
    b.stairs(192, 3, 1);
    b.goal(199);

    // scenery
    [['crystal', 5], ['shroom', 11], ['shroom2', 12], ['crystal2', 25], ['shroom', 40], ['crystal', 48], ['shroom2', 53.5], ['shroom', 61],
      ['crystal2', 78], ['crystal', 101], ['shroom', 108], ['shroom2', 110], ['crystal2', 151], ['shroom', 155], ['crystal', 188],
      ['shroom', 196], ['crystal2', 202]].forEach(function (d) { b.deco(d[0], d[1]); });
    b.deco('crystal2', 36, 11); b.deco('shroom', 31, 11);
  }),

  /* ---------------- 3: NIMBUS HEIGHTS ---------------- */
  makeLevel('NIMBUS HEIGHTS', 'sky', 216, 22, function (b) {
    b.start(3);
    b.ground(0, 24);
    b.coins(7, 19, 4);

    // the climb
    b.blk(16, 18, '==='); b.coins(16, 17, 3);
    b.blk(21, 16, '===');
    b.gem(22, 12);
    b.fill(26, 14, 35, 15, T.GROUND);
    b.blk(29, 10, '?U?');
    b.en('snail', 32, 14);
    b.arc(36, 12, 3, 1);
    b.fill(39, 14, 47, 15, T.GROUND);
    b.en('prick', 43, 14);
    b.spring(46, 14);
    b.coins(47, 11, 1); b.coins(48, 9, 1); b.coins(49, 7, 1);

    // the high road
    b.fill(50, 9, 58, 10, T.GROUND);
    b.blk(53, 5, '?h?');
    b.plat(60, 9, { ax: 5, per: 300 });
    b.coins(62, 7, 4, 2);
    b.fill(70, 9, 76, 10, T.GROUND);
    b.coins(71, 8, 3);
    b.en('snail', 73, 9);
    b.fly(78, 8, { ay: 2, per: 190 });
    b.blk(79, 11, '==='); b.blk(84, 13, '===');
    b.coins(84, 12, 3);

    // the long bank and the halfway lamp
    b.fill(89, 15, 105, 16, T.GROUND);
    b.cp(91, 15);
    b.blk(93, 14, '#');                    // keeps the bank's creatures away from the lamp
    b.blk(95, 11, 'B?MB');
    b.en('snail', 98, 15);
    b.en('prick', 103, 15);

    // falling rafts below, Flits to bounce on above
    b.plat(108, 15, { fall: 1 });
    b.plat(113, 14, { fall: 1 });
    b.fly(109, 11, { ay: 0.4, per: 160 });
    b.fly(113, 10, { ay: 0.4, per: 160, ph: 80 });
    b.fly(117, 11, { ay: 0.4, per: 160, ph: 40 });
    b.gem(113, 7);
    b.coins(109, 9, 1); b.coins(117, 9, 1);
    b.fill(118, 15, 127, 16, T.GROUND);
    b.coins(119, 14, 3);
    b.en('snail', 123, 15);

    // the lift up to the rainbow bridge
    b.plat(129, 15, { ay: -8, per: 380 });
    b.coins(130, 9, 3, 0, 2);
    b.blk(133, 7, '========================');
    b.en('prick', 140, 7); b.en('prick', 151, 7);
    b.blk(144, 3, '?S?');
    b.arc(136, 5, 5, 1); b.arc(148, 5, 5, 1);

    // the way down, with a hidden ledge underneath
    b.fill(159, 9, 165, 10, T.GROUND);
    b.cp(161, 9);
    b.coins(166, 12, 1); b.coins(167, 14, 1);
    b.blk(168, 11, '===');
    b.blk(169, 17, '===');
    b.gem(169, 16);
    b.spring(171, 17);
    b.blk(173, 13, '===');
    b.blk(178, 15, '==='); b.coins(178, 14, 3);
    b.fill(183, 17, 215, 21, T.GROUND);
    b.en('snail', 188, 17);
    b.coins(190, 16, 3);
    b.stairs(194, 4, 1, 17);
    b.goal(204, 17);
    b.deco('sign', 1);
  }),

  /* ---------------- 4: THUNDER KEEP ---------------- */
  makeLevel('THUNDER KEEP', 'keep', 214, 15, function (b) {
    b.L.rain = 2;
    b.L.wall0 = 19; b.L.wall1 = 193;      // the hall's back wall runs between these columns
    b.start(2);
    b.ground(0, 9); b.ground(18, 50); b.ground(54, 60); b.ground(71, 111); b.ground(148, 170); b.ground(187, 213);
    b.blk(10, 13, 'bbbbbbbb'); b.lava(10, 17);
    b.coins(11, 12, 6);
    b.fill(20, 0, 192, 1, T.GROUND);                // the keep's ceiling
    b.fill(18, 0, 19, 8, T.GROUND);                 // gatehouse over the way in
    b.fill(192, 0, 193, 8, T.GROUND);               // and over the way out

    // the first hall: turning ember chains
    b.blk(23, 9, '?U?');
    b.en('prick', 29);
    b.chain(35, 9, 5, 0.035, 0);
    b.gem(35, 7);
    b.chain(43, 9, 5, -0.035, Math.PI);
    b.coins(38, 12, 4);

    // lava pits
    b.lava(51, 53); b.ember(52, 6.3, 20);
    b.arc(51, 10, 3, 1);
    b.lava(61, 70);
    b.plat(62, 12, { fall: 1 }); b.plat(67, 12, { fall: 1 });
    b.coins(63, 10, 1); b.coins(68, 10, 1);
    b.ember(65.5, 6.3, 60);

    // crushers
    b.crusher(75, 2); b.crusher(82, 2);
    b.coins(78, 12, 3);

    // halfway lamp and the stepped hall
    b.cp(88);
    b.fill(92, 11, 95, 12, T.GROUND);
    b.fill(96, 9, 102, 12, T.GROUND);
    b.fill(103, 11, 105, 12, T.GROUND);
    b.coins(92, 10, 4); b.coins(101, 8, 2);
    b.blk(98, 5, 'HU?');
    b.en('prick', 99, 9);
    b.en('frog', 109, null, { tm: 40 });

    // two rafts across the lava lake
    b.lava(112, 147);
    b.plat(113, 12, { ax: 11, per: 420 });
    b.coins(115, 11, 5, 2);
    b.chain(120, 7, 6, 0.03, 0);
    b.ember(118.5, 6.0, 40, 100); b.ember(123.5, 6.0, 110, 100);
    b.fill(129, 12, 131, 14, T.HARD);
    b.chain(130, 6, 4, -0.04, 0);
    b.gem(130, 8);
    b.plat(133, 12, { ax: 11, per: 420, ph: 210 });
    b.ember(139.5, 6.0, 70, 100);
    b.coins(136, 11, 4, 2);

    // second lamp, then the crusher gauntlet
    b.cp(150);
    b.crusher(153, 2); b.crusher(158, 2); b.crusher(163, 2);
    b.coins(156, 12, 1); b.coins(161, 12, 1);
    b.coins(153, 12, 2); b.coins(158, 12, 2); b.coins(163, 12, 2);

    // the broken bridge
    b.lava(171, 186);
    b.blk(171, 13, 'bbbb'); b.blk(176, 13, 'bbbbb'); b.blk(182, 13, 'bbbbb');
    b.ember(175.2, 6.0, 30, 70); b.ember(181.2, 6.0, 75, 70);
    b.chain(178, 8, 5, 0.04, 1);
    b.coins(172, 12, 3); b.coins(177, 12, 3); b.coins(183, 12, 3); b.coins(188, 12, 4);
    b.gem(181, 9);

    // out onto the balcony
    b.stairs(196, 4, 1);
    b.goal(205);

    // scenery: torches on the wall, banners from the ceiling
    [22, 31, 48, 57, 73, 79, 86, 91, 107, 150, 168, 188].forEach(function (x) { b.deco('torch', x, 7, { top: 1, dx: 4 }); });
    [26, 40, 94, 100, 110, 149, 190].forEach(function (x) { b.deco('banner', x, 2, { top: 1, dx: 2 }); });
  }),
];
