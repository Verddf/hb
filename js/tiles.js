'use strict';

// ---------------------------------------------------------------------------
// Visual themes. Each level picks one; tiles and backgrounds are painted
// procedurally from these palettes.
// ---------------------------------------------------------------------------
const THEME_DEFAULTS = {
  qblock: { base: '#f4b53a', hi: '#ffe38c', lo: '#b8740f', mark: '#fff7d6', rim: '#6a3c06' },
  used: { base: '#9a6a3c', hi: '#c49262', lo: '#5c3a1c', rim: '#3a2410' },
  lava: { base: '#ff5a1f', hi: '#ffd23f', lo: '#c0280c' },
  spike: { base: '#d6dae6', lo: '#7a7e92' },
};

const THEMES = {
  meadow: {
    music: 'meadow',
    sky: ['#5ec3ff', '#c4f0ff'],
    ground: { style: 'grass', top: '#5cc84a', topHi: '#a6ee6c', topLo: '#358f33', base: '#b56a38', hi: '#d68d58', lo: '#86461f' },
    brick: { base: '#c85c30', hi: '#f08c5a', lo: '#8a3416', mortar: '#4a1808' },
    hard: { base: '#b88e60', hi: '#e8c496', lo: '#6c4c2c' },
    pipe: { base: '#35b35b', hi: '#96f2a8', lo: '#1d7a3b', rim: '#0e4420' },
    semi: { style: 'plank', base: '#c98a4a', hi: '#f2bb7c', lo: '#7a4a1e' },
    plat: { base: '#e0a458', hi: '#ffd08a', lo: '#8a5a24' },
    castle: { base: '#c9b8a6', hi: '#efe4d6', lo: '#8a7866', door: '#2a1a14', flag: '#27b3a3' },
  },
  cave: {
    music: 'cave',
    sky: ['#110d22', '#2a1d4a'],
    ground: { style: 'rock', top: '#8aa0d8', topHi: '#c4d4ff', topLo: '#5a6ea8', base: '#48507a', hi: '#6470a0', lo: '#2e3456', gem: '#6ff5ff' },
    brick: { base: '#5a58b8', hi: '#8c8ae6', lo: '#34327a', mortar: '#1a1840' },
    hard: { base: '#6a7090', hi: '#9aa2c6', lo: '#3a3e5a' },
    pipe: { base: '#2aa198', hi: '#8af0e6', lo: '#16665f', rim: '#0a3a36' },
    semi: { style: 'crystal', base: '#7f6bd6', hi: '#c6b8ff', lo: '#4a3a96' },
    plat: { base: '#7f8fb8', hi: '#c4d4ff', lo: '#48507a' },
    castle: { base: '#8a8fb0', hi: '#c0c6e6', lo: '#4e5270', door: '#140f22', flag: '#27b3a3' },
  },
  sky: {
    music: 'sky',
    sky: ['#7a9cff', '#ffd6e6'],
    ground: { style: 'grass', top: '#7fe0a0', topHi: '#d0ffe0', topLo: '#3fae6e', base: '#e0b07a', hi: '#f4d0a0', lo: '#b07a48' },
    brick: { base: '#e07a6a', hi: '#ffab9a', lo: '#a04a3e', mortar: '#5a2222' },
    hard: { base: '#d8c0e8', hi: '#f6ecff', lo: '#9a80b0' },
    pipe: { base: '#5ac8a0', hi: '#b8ffe6', lo: '#2e8a6a', rim: '#14503c' },
    semi: { style: 'cloud', base: '#ffffff', hi: '#ffffff', lo: '#c8d4ff' },
    plat: { base: '#fff0f6', hi: '#ffffff', lo: '#b8a8d8' },
    castle: { base: '#f0e6ff', hi: '#ffffff', lo: '#b0a0d0', door: '#3a2a5a', flag: '#ff8a1c' },
  },
  castle: {
    music: 'castle',
    sky: ['#140606', '#3a0f0c'],
    ground: { style: 'stone', top: '#8e8a98', topHi: '#c4c0d0', topLo: '#5a5664', base: '#6a6674', hi: '#8e8a98', lo: '#3e3a46', mortar: '#2a2630' },
    brick: { base: '#7a2a2a', hi: '#a84a4a', lo: '#4a1414', mortar: '#240808' },
    hard: { base: '#5a5a6a', hi: '#8a8aa0', lo: '#2e2e3a' },
    pipe: { base: '#7a7a8a', hi: '#c0c0d0', lo: '#4a4a58', rim: '#222230' },
    semi: { style: 'grate', base: '#a8a8bc', hi: '#e2e2f0', lo: '#5a5a6e' },
    plat: { base: '#8a8aa0', hi: '#c0c0d0', lo: '#4a4a58' },
    castle: { base: '#6a6674', hi: '#8e8a98', lo: '#3e3a46', door: '#140606', flag: '#ff5a1f' },
  },
};
for (const t of Object.values(THEMES)) {
  for (const [k, v] of Object.entries(THEME_DEFAULTS)) if (!t[k]) t[k] = v;
}

const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

function tileCanvas(fn, w = 16, h = 16) {
  const c = makeCanvas(w, h);
  fn(c.getContext('2d'));
  return c;
}

// ---- individual tile painters ---------------------------------------------
function paintGround(g, c, top, seed) {
  const r = rng(seed);
  R(g, 0, 0, 16, 16, c.base);
  if (c.style === 'stone') {
    // Castle masonry: two courses of staggered blocks.
    R(g, 0, 7, 16, 1, c.mortar);
    R(g, 0, 15, 16, 1, c.mortar);
    R(g, 9, 0, 1, 7, c.mortar);
    R(g, 3, 8, 1, 7, c.mortar);
    R(g, 0, 0, 9, 1, c.hi);
    R(g, 10, 0, 6, 1, c.hi);
    R(g, 0, 8, 3, 1, c.hi);
    R(g, 4, 8, 12, 1, c.hi);
    for (let i = 0; i < 5; i++) R(g, Math.floor(r() * 15), Math.floor(r() * 15), 1, 1, c.lo);
    if (top) { R(g, 0, 0, 16, 2, c.topHi); R(g, 0, 2, 16, 1, c.top); }
    return;
  }
  for (let i = 0; i < 9; i++) R(g, Math.floor(r() * 15), Math.floor(r() * 15), 2, 1, c.lo);
  for (let i = 0; i < 5; i++) R(g, Math.floor(r() * 15), Math.floor(r() * 15), 1, 1, c.hi);
  if (c.style === 'rock') {
    R(g, Math.floor(r() * 10) + 2, 9, 4, 1, c.lo);
    if (top) {
      R(g, 0, 0, 16, 3, c.top);
      R(g, 0, 0, 16, 1, c.topHi);
      R(g, 0, 3, 16, 1, c.topLo);
      const gx = Math.floor(r() * 12) + 2;
      R(g, gx, 1, 2, 2, c.gem);
      R(g, gx, 1, 1, 1, '#ffffff');
    }
    return;
  }
  if (top) {
    const drip = [1, 2, 1, 0, 2, 1, 3, 1, 0, 2, 1, 2, 0, 1, 2, 1];
    R(g, 0, 0, 16, 4, c.top);
    R(g, 0, 0, 16, 1, c.topHi);
    for (let x = 0; x < 16; x++) {
      R(g, x, 4, 1, drip[x], c.top);
      R(g, x, 4 + drip[x], 1, 1, c.topLo);
    }
    R(g, 3, 1, 1, 1, c.topHi);
    R(g, 11, 2, 1, 1, c.topHi);
  }
}

function paintBrick(g, c) {
  R(g, 0, 0, 16, 16, c.base);
  R(g, 0, 7, 16, 1, c.mortar);
  R(g, 0, 15, 16, 1, c.mortar);
  R(g, 7, 0, 1, 7, c.mortar);
  R(g, 15, 0, 1, 7, c.mortar);
  R(g, 3, 8, 1, 7, c.mortar);
  R(g, 11, 8, 1, 7, c.mortar);
  R(g, 0, 0, 7, 1, c.hi); R(g, 8, 0, 7, 1, c.hi);
  R(g, 0, 8, 3, 1, c.hi); R(g, 4, 8, 7, 1, c.hi); R(g, 12, 8, 4, 1, c.hi);
  R(g, 0, 6, 7, 1, c.lo); R(g, 8, 6, 7, 1, c.lo);
  R(g, 0, 14, 3, 1, c.lo); R(g, 4, 14, 7, 1, c.lo); R(g, 12, 14, 3, 1, c.lo);
}

const Q_GLYPH = ['.####.', '##..##', '....##', '...##.', '..##..', '......', '..##..'];

function paintBlock(g, c, markColor) {
  R(g, 0, 0, 16, 16, c.rim);
  R(g, 1, 1, 14, 14, c.base);
  R(g, 1, 1, 14, 1, c.hi);
  R(g, 1, 1, 1, 14, c.hi);
  R(g, 1, 14, 14, 1, c.lo);
  R(g, 14, 1, 1, 14, c.lo);
  for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) R(g, x, y, 1, 1, c.lo);
  if (!markColor) return;
  Q_GLYPH.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '#') continue;
      R(g, 5 + x + 1, 4 + y + 1, 1, 1, c.lo);
    }
  });
  Q_GLYPH.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') R(g, 5 + x, 4 + y, 1, 1, markColor);
  });
}

function paintHard(g, c) {
  R(g, 0, 0, 16, 16, c.base);
  R(g, 0, 0, 16, 1, c.hi);
  R(g, 0, 0, 1, 16, c.hi);
  R(g, 0, 15, 16, 1, c.lo);
  R(g, 15, 0, 1, 16, c.lo);
  R(g, 3, 3, 10, 1, c.lo);
  R(g, 3, 3, 1, 10, c.lo);
  R(g, 3, 12, 10, 1, c.hi);
  R(g, 12, 3, 1, 10, c.hi);
}

// Pipes are painted 32px wide then split into left/right halves.
function pipeColor(c, x, x0, x1) {
  if (x === x0 || x === x1) return c.rim;
  const t = (x - x0) / (x1 - x0);
  if (t < 0.12) return c.base;
  if (t < 0.32) return c.hi;
  if (t < 0.7) return c.base;
  return c.lo;
}
function paintPipe(c) {
  const top = makeCanvas(32, 16), body = makeCanvas(32, 16);
  const gt = top.getContext('2d'), gb = body.getContext('2d');
  for (let x = 0; x < 32; x++) {
    R(gt, x, 0, 1, 16, pipeColor(c, x, 0, 31));
    if (x >= 2 && x <= 29) R(gb, x, 0, 1, 16, pipeColor(c, x, 2, 29));
  }
  R(gt, 0, 0, 32, 1, c.rim);
  R(gt, 0, 15, 32, 1, c.rim);
  R(gt, 1, 1, 30, 1, c.hi);
  R(gb, 2, 0, 28, 1, c.rim);
  const half = (src, sx) => tileCanvas(g => g.drawImage(src, sx, 0, 16, 16, 0, 0, 16, 16));
  return { TL: half(top, 0), TR: half(top, 16), BL: half(body, 0), BR: half(body, 16) };
}

function paintSpikes(c) {
  const p = new PixelCanvas(16, 16);
  for (let i = 0; i < 4; i++) {
    const x = i * 4;
    p.poly([[x + 0.2, 16], [x + 2, 7], [x + 3.8, 16]], c.base);
    p.poly([[x + 2, 7], [x + 3.8, 16], [x + 2, 16]], c.lo);
  }
  p.outline(OUT);
  return p.toCanvas();
}

function paintLava(c, top, frame) {
  return tileCanvas(g => {
    const r = rng(7 + frame);
    if (!top) {
      R(g, 0, 0, 16, 16, c.base);
      for (let i = 0; i < 6; i++) R(g, Math.floor(r() * 14), Math.floor(r() * 14), 2, 1, i % 2 ? c.lo : c.hi);
      return;
    }
    for (let x = 0; x < 16; x++) {
      const y = 3 + Math.round(Math.sin((x + frame * 4) / 16 * Math.PI * 2) * 1.5);
      R(g, x, y, 1, 16 - y, c.base);
      R(g, x, y, 1, 1, c.hi);
      R(g, x, y + 1, 1, 1, '#ff9a3c');
    }
    R(g, (frame * 5) % 14 + 1, 9, 2, 2, c.hi);
    R(g, (frame * 3 + 7) % 14 + 1, 12, 1, 1, c.lo);
  });
}

// One-way platforms, with rounded ends where the run starts/stops.
function paintSemi(c, left, right) {
  const p = new PixelCanvas(16, 16);
  if (c.style === 'cloud') {
    p.rect(0, 3, 16, 6, c.base);
    for (const x of [2, 7, 12]) p.circle(x + 1, 4, 3.2, c.base);
    if (left) p.rect(0, 0, 3, 16, null);
    if (right) p.rect(13, 0, 3, 16, null);
    if (left) p.circle(4, 5.5, 3.6, c.base);
    if (right) p.circle(12, 5.5, 3.6, c.base);
    p.map((x, y, col) => (col === c.base && y >= 7 ? c.lo : undefined));
    return p.toCanvas();
  }
  if (c.style === 'crystal') {
    p.rect(0, 0, 16, 5, c.base);
    p.rect(0, 0, 16, 1, c.hi);
    p.poly([[2, 5], [5, 5], [3.5, 10]], c.base);
    p.poly([[9, 5], [13, 5], [11, 11]], c.lo);
    p.rect(0, 4, 16, 1, c.lo);
    p.outline(OUT);
    return p.toCanvas();
  }
  if (c.style === 'grate') {
    p.rect(0, 0, 16, 4, c.base);
    p.rect(0, 0, 16, 1, c.hi);
    p.rect(0, 3, 16, 1, c.lo);
    p.line(1, 4, 7, 9, c.base);
    p.line(14, 4, 8, 9, c.base);
    p.rect(0, 9, 16, 2, c.lo);
    p.outline(OUT);
    return p.toCanvas();
  }
  // wooden plank bridge
  p.rect(0, 0, 16, 5, c.base);
  p.rect(0, 0, 16, 1, c.hi);
  p.rect(0, 4, 16, 1, c.lo);
  p.rect(5, 1, 1, 3, c.lo);
  p.rect(11, 1, 1, 3, c.lo);
  if (left) p.rect(0, 5, 2, 4, c.lo);
  if (right) p.rect(14, 5, 2, 4, c.lo);
  return p.toCanvas();
}

function paintPlatformPiece(c, kind) {
  return tileCanvas(g => {
    R(g, 0, 0, 16, 8, c.lo);
    R(g, kind === 'L' ? 1 : 0, 1, kind === 'M' ? 16 : 15, 6, c.base);
    R(g, kind === 'L' ? 1 : 0, 1, kind === 'M' ? 16 : 15, 1, c.hi);
    R(g, 7, 3, 2, 2, c.lo);
  }, 16, 8);
}

// End-of-level castle: 80 x 88 px.
function paintCastle(c) {
  return tileCanvas(g => {
    const block = (x, y, w, h) => {
      R(g, x, y, w, h, c.base);
      for (let yy = y; yy < y + h; yy += 8) {
        R(g, x, yy, w, 1, c.lo);
        const off = ((yy - y) / 8) % 2 ? 4 : 0;
        for (let xx = x + off; xx < x + w; xx += 8) R(g, xx, yy, 1, 8, c.lo);
        R(g, x, yy + 1, w, 1, c.hi);
      }
    };
    block(0, 40, 80, 48);
    for (let x = 0; x < 80; x += 16) block(x, 32, 8, 8);
    block(16, 8, 48, 32);
    for (let x = 16; x < 64; x += 12) block(x, 0, 6, 8);
    R(g, 32, 60, 16, 28, c.door);
    R(g, 34, 58, 12, 2, c.door);
    R(g, 36, 56, 8, 2, c.door);
    R(g, 26, 18, 6, 10, c.door);
    R(g, 48, 18, 6, 10, c.door);
    R(g, 27, 19, 2, 3, '#ffd23f');
    R(g, 49, 19, 2, 3, '#ffd23f');
  }, 80, 88);
}

const _tilesets = {};
function getTileset(themeName) {
  if (_tilesets[themeName]) return _tilesets[themeName];
  const th = THEMES[themeName];
  const ts = {
    groundTop: [0, 1, 2].map(s => tileCanvas(g => paintGround(g, th.ground, true, 11 + s * 17))),
    groundMid: [0, 1, 2].map(s => tileCanvas(g => paintGround(g, th.ground, false, 5 + s * 23))),
    brick: tileCanvas(g => paintBrick(g, th.brick)),
    q: [th.qblock.mark, '#ffe7a0', th.qblock.hi].map(m => tileCanvas(g => paintBlock(g, th.qblock, m))),
    used: tileCanvas(g => paintBlock(g, th.used, null)),
    hard: tileCanvas(g => paintHard(g, th.hard)),
    pipe: paintPipe(th.pipe),
    spikes: paintSpikes(th.spike),
    lavaTop: [0, 1, 2, 3].map(f => paintLava(th.lava, true, f)),
    lava: [0, 1, 2, 3].map(f => paintLava(th.lava, false, f)),
    semi: {
      M: paintSemi(th.semi, false, false),
      L: paintSemi(th.semi, true, false),
      R: paintSemi(th.semi, false, true),
      LR: paintSemi(th.semi, true, true),
    },
    plat: { L: paintPlatformPiece(th.plat, 'L'), M: paintPlatformPiece(th.plat, 'M'), R: paintPlatformPiece(th.plat, 'R') },
    castle: paintCastle(th.castle),
    brickColor: th.brick.base,
    edge: th.ground.lo,
  };
  _tilesets[themeName] = ts;
  return ts;
}

// ---------------------------------------------------------------------------
// Parallax backgrounds. Each layer is 512px wide and tiles seamlessly.
// ---------------------------------------------------------------------------
const BG_W = 512;
const TAU = Math.PI * 2;
const wave = (x, k, phase = 0) => Math.sin((x / BG_W) * TAU * k + phase);

function skyGradient(colors) {
  return tileCanvas(g => {
    const grd = g.createLinearGradient(0, 0, 0, VIEW_H);
    grd.addColorStop(0, colors[0]);
    grd.addColorStop(1, colors[1]);
    g.fillStyle = grd;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }, VIEW_W, VIEW_H);
}

// Silhouette ridge: heightFn(x) gives the top y for each column.
function ridge(g, heightFn, color, topColor) {
  for (let x = 0; x < BG_W; x++) {
    const h = Math.round(heightFn(x));
    R(g, x, h, 1, VIEW_H - h, color);
    if (topColor) R(g, x, h, 1, 1, topColor);
  }
}

function pixelBlob(g, cx, cy, r, color) {
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y));
    R(g, Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1, color);
  }
}

function cloud(g, x, y, s, color, shade) {
  pixelBlob(g, x, y, 7 * s, color);
  pixelBlob(g, x + 9 * s, y - 4 * s, 9 * s, color);
  pixelBlob(g, x + 20 * s, y, 7 * s, color);
  R(g, x - 6 * s, y, 32 * s, 6 * s, color);
  if (shade) R(g, x - 6 * s, y + 5 * s, 32 * s, 1, shade);
}

function wrapDraw(g, fn) {
  // Draw at x and x - BG_W so shapes crossing the seam wrap around.
  fn(0);
  g.save();
  g.translate(-BG_W, 0);
  fn(-BG_W);
  g.restore();
  g.save();
  g.translate(BG_W, 0);
  fn(BG_W);
  g.restore();
}

function makeBackground(themeName) {
  const th = THEMES[themeName];
  const layers = [];
  const layer = (f, fn) => layers.push({ f, c: tileCanvas(fn, BG_W, VIEW_H) });

  if (themeName === 'meadow') {
    layer(0.08, g => wrapDraw(g, () => {
      for (const [x, y, s] of [[40, 40, 1], [200, 62, 0.7], [330, 34, 1], [450, 70, 0.6]]) cloud(g, x, y, s, '#ffffff', '#d8f2ff');
    }));
    layer(0.18, g => ridge(g, x => 132 + 22 * wave(x, 2) + 12 * wave(x, 5, 1), '#9fd6e8', '#c4ecf6'));
    layer(0.4, g => {
      ridge(g, x => 176 + 12 * wave(x, 3, 2) + 7 * wave(x, 7), '#6cc46a', '#9ae08a');
      const r = rng(3);
      for (let i = 0; i < 40; i++) R(g, Math.floor(r() * BG_W), 190 + Math.floor(r() * 40), 2, 2, '#58b058');
    });
  } else if (themeName === 'cave') {
    layer(0.15, g => {
      ridge(g, x => 150 + 20 * wave(x, 3) + 10 * wave(x, 8, 1), '#1d1638');
      const r = rng(9);
      for (let i = 0; i < 26; i++) {
        const x = Math.floor(r() * BG_W), y = 40 + Math.floor(r() * 160);
        const col = r() < 0.5 ? '#5ef0ff' : '#c77dff';
        R(g, x, y, 1, 3, col); R(g, x - 1, y + 1, 3, 1, col);
      }
    });
    layer(0.35, g => {
      for (let x = 0; x < BG_W; x += 1) {
        const h = Math.max(0, Math.round(26 + 18 * wave(x, 6) + 12 * wave(x, 17, 2)));
        R(g, x, 0, 1, h, '#261c46');
      }
      ridge(g, x => 196 + 10 * wave(x, 5, 1) + 6 * wave(x, 13), '#261c46');
    });
  } else if (themeName === 'sky') {
    layer(0.06, g => wrapDraw(g, () => {
      for (const [x, y, s] of [[30, 50, 1.2], [260, 30, 0.9], [400, 80, 1]]) cloud(g, x, y, s, '#fff4fa', '#f0d4ea');
    }));
    layer(0.15, g => {
      for (const [x, y] of [[90, 120], [300, 96], [440, 140]]) {
        R(g, x, y, 34, 6, '#b6a4e8');
        for (let i = 0; i < 6; i++) R(g, x + 3 + i * 2, y + 6, 34 - 6 - i * 4, 1, '#a08ad8');
      }
    });
    layer(0.3, g => {
      ridge(g, x => 196 + 8 * wave(x, 4) + 6 * wave(x, 9, 2), '#ffffff', '#ffffff');
      ridge(g, x => 214 + 6 * wave(x, 5, 1), '#ffe4f0');
    });
  } else {
    layer(0.2, g => {
      for (let x = 0; x < BG_W; x += 128) {
        R(g, x + 20, 30, 40, 210, '#2a1010');
        R(g, x + 30, 60, 20, 30, '#4a1a10');
        R(g, x + 32, 62, 16, 26, '#ff7a2a');
        R(g, x + 39, 62, 2, 26, '#4a1a10');
        R(g, x + 32, 74, 16, 2, '#4a1a10');
      }
    });
    layer(0.45, g => {
      for (let x = 0; x < BG_W; x += 64) {
        R(g, x + 8, 0, 20, VIEW_H, '#1e0a0a');
        R(g, x + 8, 0, 2, VIEW_H, '#2e1212');
        R(g, x + 14, 110, 8, 4, '#3a3a44');
      }
    });
  }
  return { sky: skyGradient(th.sky), layers };
}

const _backgrounds = {};
function drawBackground(ctx, themeName, camX, time) {
  const bg = _backgrounds[themeName] || (_backgrounds[themeName] = makeBackground(themeName));
  ctx.drawImage(bg.sky, 0, 0);
  for (const l of bg.layers) {
    const off = -(((camX * l.f) % BG_W) + BG_W) % BG_W;
    for (let x = Math.floor(off); x < VIEW_W; x += BG_W) ctx.drawImage(l.c, x, 0);
  }
  if (themeName === 'castle') {
    // flickering torch glow along the back wall
    for (let i = 0; i < 4; i++) {
      const x = Math.round(((i * 128 + 60 - camX * 0.45) % 512 + 512) % 512 - 64);
      const flick = Math.sin(time * 12 + i * 2) > 0 ? 1 : 0;
      R(ctx, x, 100, 4, 8, '#5a3a2a');
      R(ctx, x - 1 + flick, 94, 6 - flick, 6, '#ff8a1f');
      R(ctx, x + 1, 96, 2, 3, '#ffe14d');
    }
  }
}
