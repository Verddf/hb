'use strict';

// ---------------------------------------------------------------------------
// Level format
//
// Levels are built with a small builder API so every feature is one readable
// line with explicit tile coordinates (x = column, y = row, row 0 is the top,
// the ground surface is row 13 and the screen is 15 rows tall).
//
// Tile characters stored in the grid:
//   .  empty            #  ground            X  hard block
//   B  brick            b  brick with coins  ?  coin block
//   M  power-up block   *  star block        H  hidden 1-up block
//   u  used block       p  pipe              =  one-way platform
//   ^  spikes           ~  lava              o  coin
// ---------------------------------------------------------------------------
const LEVEL_ROWS = 15;

class LevelBuilder {
  constructor(width) {
    this.w = width;
    this.grid = Array.from({ length: LEVEL_ROWS }, () => new Array(width).fill('.'));
    this.spawns = [];
    this.startPos = { x: 2, y: 12 };
    this.flagPos = null;
    this.castlePos = null;
    this.checkpoints = [];
  }
  set(x, y, ch) {
    if (x >= 0 && x < this.w && y >= 0 && y < LEVEL_ROWS) this.grid[y][x] = ch;
    return this;
  }
  fill(x0, y0, x1, y1, ch) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, ch);
    return this;
  }
  // Solid ground from row `top` down to the bottom of the screen.
  ground(x0, x1, top = 13) { return this.fill(x0, top, x1, LEVEL_ROWS - 1, '#'); }
  ceiling(x0, x1, bottom = 1) { return this.fill(x0, 0, x1, bottom, '#'); }
  // Place a string of tiles left to right ('' skips a cell with ' ').
  row(x, y, str) {
    [...str].forEach((c, i) => { if (c !== ' ') this.set(x + i, y, c); });
    return this;
  }
  coins(x, y, n) { for (let i = 0; i < n; i++) this.set(x + i, y, 'o'); return this; }
  arc(x, y, n) {
    for (let i = 0; i < n; i++) this.set(x + i, y - Math.round(Math.sin((i / (n - 1)) * Math.PI) * 2), 'o');
    return this;
  }
  pipe(x, h, plant = false, base = 13) {
    const top = base - h;
    this.fill(x, top, x + 1, base - 1, 'p');
    if (plant) this.spawns.push({ type: 'chomper', x, y: top });
    return this;
  }
  stairs(x, n, dir = 'up', base = 13) {
    for (let i = 0; i < n; i++) {
      const h = dir === 'up' ? i + 1 : n - i;
      this.fill(x + i, base - h, x + i, base - 1, 'X');
    }
    return this;
  }
  semi(x, y, w) { for (let i = 0; i < w; i++) this.set(x + i, y, '='); return this; }
  spikes(x0, x1, y = 12) { return this.fill(x0, y, x1, y, '^'); }
  lava(x0, x1, top = 13) { return this.fill(x0, top, x1, LEVEL_ROWS - 1, '~'); }
  hidden(x, y) { return this.set(x, y, 'H'); }
  // y is the row the enemy stands in (default: on the main ground).
  enemy(type, x, y = 12) { this.spawns.push({ type, x, y }); return this; }
  platform(x, y, w, axis = 'h', range = 3, speed = 1) {
    this.spawns.push({ type: 'platform', x, y, w, axis, range, speed });
    return this;
  }
  firebar(x, y, len = 5, speed = 1.6) {
    this.set(x, y, 'X');
    this.spawns.push({ type: 'firebar', x, y, len, speed });
    return this;
  }
  bubble(x, delay = 0) { this.spawns.push({ type: 'bubble', x, y: 13, delay }); return this; }
  boss(x, y = 12) { this.spawns.push({ type: 'boss', x, y }); return this; }
  start(x, y = 12) { this.startPos = { x, y }; return this; }
  checkpoint(x, y = 12) { this.checkpoints.push({ x, y }); return this; }
  // Flagpole standing on a hard block at row base-1.
  flag(x, base = 13) { this.set(x, base - 1, 'X'); this.flagPos = { x, y: base - 1 }; return this; }
  castle(x, base = 13) { this.castlePos = { x, y: base }; return this; }

  toAscii() { return this.grid.map(r => r.join('')).join('\n'); }
}

const LEVELS = [
  // -------------------------------------------------------------------------
  {
    name: 'MEADOW RUN',
    theme: 'meadow',
    time: 400,
    width: 212,
    tip: 'HOLD RUN TO SPRINT AND JUMP FARTHER',
    build(b) {
      b.start(3);
      b.ground(0, 68);
      b.row(14, 9, '?');
      b.row(20, 9, 'B?BMB');
      b.row(22, 5, '?');
      b.enemy('grumble', 25);
      b.pipe(30, 2);
      b.enemy('grumble', 36);
      b.pipe(40, 3);
      b.coins(44, 8, 3);
      b.enemy('grumble', 46);
      b.enemy('grumble', 48);
      b.pipe(51, 4);
      b.hidden(56, 8);
      b.pipe(60, 4);
      b.enemy('grumble', 64);
      // gap 69-70
      b.ground(71, 90);
      b.row(75, 9, 'B?B');
      b.row(78, 6, 'BBBBBBBB');
      b.coins(79, 4, 6);
      b.enemy('grumble', 80, 5);
      b.enemy('grumble', 83, 5);
      b.arc(89, 9, 6);
      // gap 91-93
      b.ground(94, 156);
      b.row(98, 9, 'BbB');
      b.checkpoint(104);
      b.enemy('snail', 108);
      b.row(112, 9, '?');
      b.row(115, 9, '?');
      b.row(115, 5, 'M');
      b.row(118, 9, '?');
      b.enemy('grumble', 121);
      b.enemy('grumble', 123);
      b.row(126, 9, 'B');
      b.row(129, 5, 'BBB');
      b.coins(129, 4, 3);
      b.enemy('grumble', 131);
      b.enemy('grumble', 133);
      b.row(134, 5, 'B??B');
      b.row(135, 9, 'BB');
      b.stairs(140, 4, 'up');
      b.stairs(146, 4, 'down');
      b.stairs(152, 4, 'up');
      b.fill(156, 9, 156, 12, 'X');
      // gap 157-158
      b.ground(159, 211);
      b.stairs(159, 4, 'down');
      b.pipe(167, 2);
      b.row(171, 9, 'BB?B');
      b.enemy('grumble', 175);
      b.enemy('grumble', 177);
      b.pipe(181, 2);
      b.stairs(184, 8, 'up');
      b.fill(192, 5, 192, 12, 'X');
      b.flag(201);
      b.castle(205);
    },
  },
  // -------------------------------------------------------------------------
  {
    name: 'CRYSTAL CAVERNS',
    theme: 'cave',
    time: 400,
    width: 200,
    tip: 'KICK SNAIL SHELLS INTO OTHER ENEMIES',
    build(b) {
      b.start(2);
      b.ceiling(0, 180);
      b.ground(0, 44);
      b.row(9, 9, '?M?');
      b.enemy('grumble', 15);
      b.enemy('grumble', 17);
      b.row(20, 9, 'BBBBBB');
      b.coins(20, 8, 6);
      b.enemy('snail', 23, 8);
      b.pipe(29, 3, true);
      b.enemy('prickle', 34);
      b.pipe(38, 2);
      // pit 45-52 crossed on a moving platform
      b.platform(46, 10, 3, 'h', 3, 1.2);
      b.ground(53, 120);
      b.row(57, 9, 'B*B');
      b.enemy('prickle', 61);
      b.enemy('grumble', 64);
      b.spikes(68, 70);
      b.enemy('snail', 74);
      b.pipe(78, 4, true);
      b.row(83, 9, '??');
      b.checkpoint(86);
      b.row(92, 9, 'BBBBBB?BBBBB');
      b.row(92, 5, 'bBBB');
      b.coins(94, 11, 8);
      b.enemy('grumble', 97);
      b.enemy('grumble', 99);
      b.enemy('prickle', 102);
      b.pipe(108, 2);
      b.pipe(114, 3, true);
      // pit 121-132 with rising platforms
      b.platform(123, 10, 2, 'v', 3, 1.0);
      b.platform(128, 9, 2, 'v', 3, 1.3);
      b.ground(133, 176);
      b.enemy('snail', 137);
      b.enemy('snail', 140);
      b.row(144, 9, 'BMB');
      b.enemy('prickle', 150);
      b.enemy('prickle', 153);
      b.spikes(156, 158);
      b.pipe(161, 3, true);
      b.stairs(170, 5, 'up');
      b.fill(175, 8, 176, 12, 'X');
      // gap 177-179
      b.ground(180, 199);
      b.flag(188);
      b.castle(192);
    },
  },
  // -------------------------------------------------------------------------
  {
    name: 'SKYWARD BRIDGES',
    theme: 'sky',
    time: 350,
    width: 210,
    tip: 'CLOUDS CAN BE JUMPED THROUGH FROM BELOW',
    build(b) {
      b.start(2);
      b.ground(0, 14);
      b.row(6, 9, '?M?');
      b.enemy('grumble', 12);
      b.semi(17, 10, 4);
      b.coins(17, 9, 4);
      b.ground(24, 33, 11);
      b.enemy('bee', 31, 8);
      b.platform(35, 11, 3, 'h', 3, 1.2);
      b.ground(42, 52, 10);
      b.row(44, 6, 'B?B');
      b.enemy('snail', 49, 9);
      b.semi(55, 9, 3);
      b.semi(60, 7, 3);
      b.semi(65, 9, 3);
      b.coins(60, 6, 3);
      b.enemy('bee', 63, 4);
      b.ground(70, 80, 12);
      b.checkpoint(72, 11);
      b.enemy('grumble', 75, 11);
      b.enemy('grumble', 77, 11);
      b.pipe(79, 2, true, 12);
      b.semi(84, 11, 6);
      b.semi(93, 11, 6);
      b.coins(90, 9, 3);
      b.enemy('bee', 89, 8);
      b.enemy('bee', 97, 7);
      b.platform(101, 11, 3, 'v', 5, 0.9);
      b.ground(106, 114, 8);
      b.row(108, 4, '?*?');
      b.coins(111, 7, 3);
      b.enemy('prickle', 112, 7);
      b.semi(118, 10, 3);
      b.ground(123, 135, 12);
      b.enemy('prickle', 127, 11);
      b.enemy('prickle', 130, 11);
      b.enemy('beeV', 134, 7);
      b.platform(138, 11, 3, 'h', 4, 1.3);
      b.platform(147, 9, 3, 'h', 4, 1.0);
      b.ground(156, 162, 11);
      b.enemy('grumble', 159, 10);
      b.semi(165, 10, 3);
      b.semi(169, 8, 3);
      b.semi(173, 6, 3);
      b.coins(169, 7, 3);
      b.coins(173, 5, 3);
      b.ground(177, 209);
      b.row(179, 9, 'BMB');
      b.stairs(183, 6, 'up');
      b.fill(189, 7, 189, 12, 'X');
      b.flag(198);
      b.castle(202);
    },
  },
  // -------------------------------------------------------------------------
  {
    name: 'EMBER KEEP',
    theme: 'castle',
    time: 350,
    width: 156,
    tip: 'STOMP THE MAGMAW TO WIN BACK THE SUNSTONE',
    build(b) {
      b.start(2);
      b.ceiling(0, 155);
      b.ground(0, 16);
      b.row(7, 9, '?M?');
      b.lava(17, 20);
      b.bubble(18, 0);
      b.ground(21, 40);
      b.firebar(27, 9, 5, 1.8);
      b.enemy('prickle', 32);
      b.fill(35, 10, 38, 12, 'X');
      b.firebar(36, 5, 4, -2.2);
      b.lava(41, 46);
      b.fill(43, 11, 44, 14, 'X');
      b.bubble(42, 0.8);
      b.bubble(45, 1.6);
      b.ground(47, 70);
      b.checkpoint(48);
      b.fill(52, 2, 62, 6, '#');
      b.firebar(57, 9, 5, 1.5);
      b.enemy('grumble', 64);
      b.enemy('grumble', 66);
      b.lava(71, 78);
      b.platform(72, 10, 3, 'h', 3, 1.2);
      b.bubble(76, 0.5);
      b.ground(79, 110);
      b.row(82, 9, 'B?B');
      b.hidden(86, 8);
      b.enemy('prickle', 88);
      b.enemy('prickle', 92);
      b.enemy('snail', 96);
      b.firebar(100, 9, 6, 2.0);
      b.firebar(106, 9, 6, -2.0);
      b.lava(111, 116);
      b.semi(111, 12, 6);
      b.bubble(112, 0);
      b.bubble(115, 1.2);
      b.ground(117, 155);
      b.row(120, 9, 'BMB');
      b.checkpoint(124);
      // boss arena
      b.semi(135, 9, 3);
      b.semi(149, 9, 3);
      b.boss(146);
    },
  },
];

function buildLevel(index) {
  const def = LEVELS[index];
  const b = new LevelBuilder(def.width);
  def.build(b);
  return b;
}

if (typeof module !== 'undefined') module.exports = { LEVELS, LevelBuilder, buildLevel, LEVEL_ROWS };
