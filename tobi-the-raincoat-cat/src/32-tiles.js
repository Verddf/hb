/* ============================================================
   TILES, SCENERY AND BACKDROPS
   These are painted by code, one small rectangle at a time,
   in four colour schemes: meadow, cave, sky and keep.
   ============================================================ */

function R(g, col, x, y, w, h) { g.fillStyle = col; g.fillRect(x, y, w == null ? 1 : w, h == null ? 1 : h); }

// a filled ellipse built from pixel rows; topOnly gives a dome with a flat base
function blob(g, col, cx, cy, rx, ry, topOnly) {
  g.fillStyle = col;
  cx = Math.round(cx); cy = Math.round(cy); rx = Math.round(rx); ry = Math.max(1, Math.round(ry));
  for (let y = -ry; y <= (topOnly ? 0 : ry); y++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    if (hw > 0) g.fillRect(cx - hw, cy + y, hw * 2, 1);
  }
}
// a pointed spike (stalactite, stalagmite): dir 1 points down, -1 up
function spike(g, col, cx, y0, hw, len, dir) {
  g.fillStyle = col;
  for (let i = 0; i < len; i++) {
    const w = Math.round(hw * (1 - i / len));
    g.fillRect(cx - w, y0 + dir * i, w * 2 + 1, 1);
  }
}
// small repeatable random numbers so scenery is the same on every visit
function rng(seed) {
  let s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const THEMES = ['meadow', 'cave', 'sky', 'keep'];
const TILESET = {};     // theme -> images for each kind of tile
const BG = {};          // theme -> backdrop layers

/* ---------- ground: 16 versions per theme, one for each mix of open sides ---------- */

function groundTile(theme, m) {
  const c = mk(16, 16), g = c.getContext('2d');
  const up = m & 1, rt = m & 2, dn = m & 4, lf = m & 8;
  if (theme === 'meadow') {
    R(g, '#b9733f', 0, 0, 16, 16);
    [[2, 5, 2], [10, 3, 2], [6, 10, 2], [13, 12, 2], [1, 13, 1], [8, 7, 1]].forEach(function (a) { R(g, '#99592f', a[0], a[1], a[2], 1); });
    [[5, 8, 1], [12, 6, 1], [3, 11, 1], [9, 13, 2], [14, 2, 1]].forEach(function (a) { R(g, '#d39a5e', a[0], a[1], a[2], 1); });
    if (!lf) R(g, '#6b3e20', 0, 0, 1, 16);
    if (!rt) R(g, '#6b3e20', 15, 0, 1, 16);
    if (!dn) R(g, '#6b3e20', 0, 15, 16, 1);
    if (!up) {
      const d = [5, 5, 6, 6, 5, 4, 4, 5, 6, 7, 6, 5, 4, 5, 5, 4];
      for (let x = 0; x < 16; x++) {
        R(g, '#1d6a43', x, 0); R(g, '#bdf06e', x, 1);
        R(g, '#62d04e', x, 2, 1, d[x] - 2); R(g, '#2f9c4a', x, d[x]);
      }
      if (!lf) { g.clearRect(0, 0, 1, 1); R(g, '#1d6a43', 0, 1, 1, 5); }
      if (!rt) { g.clearRect(15, 0, 1, 1); R(g, '#1d6a43', 15, 1, 1, 5); }
    }
  } else if (theme === 'cave') {
    R(g, '#484b7a', 0, 0, 16, 16);
    [[3, 3, 4, 1], [6, 4, 1, 3], [10, 9, 4, 1], [10, 10, 1, 3], [1, 11, 3, 1], [13, 2, 2, 1]].forEach(function (a) { R(g, '#34365f', a[0], a[1], a[2], a[3]); });
    [[4, 6, 2], [12, 5, 2], [7, 12, 2], [1, 8, 1], [14, 13, 1]].forEach(function (a) { R(g, '#6a6fa6', a[0], a[1], a[2], 1); });
    if (!lf) R(g, '#23244a', 0, 0, 1, 16);
    if (!rt) R(g, '#23244a', 15, 0, 1, 16);
    if (!up) {
      R(g, '#9aa1d4', 0, 0, 16, 1); R(g, '#6a6fa6', 0, 1, 16, 1);
      R(g, '#35c9b6', 2, 0, 4, 1); R(g, '#1d8f8a', 3, 1, 2, 1); R(g, '#35c9b6', 10, 0, 3, 1); R(g, '#1d8f8a', 11, 1, 1, 1);
    }
    if (!dn) {
      R(g, '#23244a', 0, 14, 16, 2);
      [0, 1, 5, 6, 7, 11, 12, 15].forEach(function (x) { g.clearRect(x, 15, 1, 1); });
      [6, 12].forEach(function (x) { g.clearRect(x, 14, 1, 1); });
    }
  } else if (theme === 'sky') {
    const E = '#86b4e6';
    R(g, '#ffffff', 0, 0, 16, 16);
    [[3, 6, 3], [10, 9, 3], [6, 12, 2], [12, 4, 2]].forEach(function (a) { R(g, '#dbeeff', a[0], a[1], a[2], 1); });
    if (!lf) { R(g, E, 0, 0, 1, 16); }
    if (!rt) { R(g, E, 15, 0, 1, 16); R(g, '#dbeeff', 14, 0, 1, 16); }
    if (!dn) {
      R(g, '#dbeeff', lf ? 0 : 1, 10, rt ? 16 : 15, 2); R(g, '#b4d3f2', lf ? 0 : 1, 12, rt ? 16 : 15, 4);
      const bc = [1, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 1, 2, 1];
      for (let x = 0; x < 16; x++) { g.clearRect(x, 16 - bc[x], 1, bc[x]); R(g, E, x, 15 - bc[x]); }
      if (!lf) { g.clearRect(0, 13, 1, 3); g.clearRect(1, 15, 1, 1); R(g, E, 1, 14); R(g, E, 0, 12); }
      if (!rt) { g.clearRect(15, 13, 1, 3); g.clearRect(14, 15, 1, 1); R(g, E, 14, 14); R(g, E, 15, 12); }
    }
    if (!up) {
      const tc = [2, 1, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 1, 2];
      for (let x = 0; x < 16; x++) { g.clearRect(x, 0, 1, tc[x]); R(g, E, x, tc[x]); }
      if (!lf) { g.clearRect(0, 0, 1, 4); R(g, E, 0, 4); R(g, E, 1, 3); }
      if (!rt) { g.clearRect(15, 0, 1, 4); R(g, E, 15, 4); R(g, E, 14, 3); }
    }
  } else {
    R(g, '#565b80', 0, 0, 16, 16);
    R(g, '#4b5074', 0, 9, 7, 6);
    R(g, '#7c83ad', 0, 0, 16, 1); R(g, '#7c83ad', 0, 8, 16, 1);
    R(g, '#2f3250', 0, 7, 16, 1); R(g, '#2f3250', 0, 15, 16, 1);
    R(g, '#2f3250', 15, 0, 1, 8); R(g, '#2f3250', 7, 8, 1, 8);
    if (!up) { R(g, '#c2c8ea', 0, 0, 16, 1); R(g, '#8f96c0', 0, 1, 16, 1); }
    if (!dn) R(g, '#1f2138', 0, 15, 16, 1);
    if (!lf) R(g, '#2f3250', 0, 0, 1, 16);
    if (!rt) R(g, '#2f3250', 15, 0, 1, 16);
  }
  return c;
}

/* ---------- blocks ---------- */

function brickTile(theme) {
  if (theme === 'meadow' || theme === 'sky') {
    // a wooden crate
    return art(`
      kkkkkkkkkkkkkkkk
      kOOOOOOOOOOOOOok
      kOnnnnnnnnnnnnNk
      kOnNoooooooooNNk
      kOnoNoooooooNoNk
      kOnooNoooooNooNk
      kOnoooNoooNoooNk
      kOnooooNoNooooNk
      kOnoooooNoooooNk
      kOnooooNoNooooNk
      kOnoooNoooNoooNk
      kOnooNoooooNooNk
      kOnoNoooooooNoNk
      kOnNNNNNNNNNNNNk
      koNNNNNNNNNNNNNk
      kkkkkkkkkkkkkkkk
    `, theme === 'sky' ? { O: '#fff3d6', o: '#efcf9c', n: '#cfa06a', N: '#9a6f42', k: '#5a3d22' } : { k: '#3d2412' });
  }
  const P = theme === 'cave' ? ['#3f86a8', '#7cc3dc', '#1c3f5e'] : ['#8a8fb5', '#c0c5e0', '#3a3f5c'];
  const c = mk(16, 16), g = c.getContext('2d');
  R(g, P[0], 0, 0, 16, 16);
  for (let i = 0; i < 4; i++) {
    const y = i * 4;
    R(g, P[1], 0, y, 16, 1); R(g, P[2], 0, y + 3, 16, 1);
    if (i % 2 === 0) { R(g, P[2], 7, y, 1, 3); R(g, P[2], 15, y, 1, 3); }
    else { R(g, P[2], 3, y, 1, 3); R(g, P[2], 11, y, 1, 3); }
  }
  return c;
}

// the sun block: bonk it from below
function bonusTile(emblem) {
  const c = art(`
    kkkkkkkkkkkkkkkk
    kYYYYYYYYYYYYYYk
    kYyyyyyyyyyyyyak
    kYykyyyyyyyykyak
    kYyyyyyyyyyyyyak
    kYyyyyyyyyyyyyak
    kYyyyyyyyyyyyyak
    kYyyyyyyyyyyyyak
    kYyyyyyyyyyyyyak
    kYyyyyyyyyyyyyak
    kYyyyyyyyyyyyyak
    kYyyyyyyyyyyyyak
    kYykyyyyyyyykyak
    kYyyyyyyyyyyyyak
    kaaaaaaaaaaaaaak
    kkkkkkkkkkkkkkkk
  `);
  const g = c.getContext('2d');
  const sun = ['...##...', '.#.##.#.', '..####..', '###..###', '###..###', '..####..', '.#.##.#.', '...##...'];
  for (let pass = 0; pass < 2; pass++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if (sun[y][x] !== '#') continue;
    if (pass === 0) R(g, '#c2611f', 5 + x, 5 + y); else R(g, emblem, 4 + x, 4 + y);
  }
  return c;
}
function usedTile() {
  return art(`
    kkkkkkkkkkkkkkkk
    koooooooooooooNk
    konnnnnnnnnnnnNk
    konknnnnnnnnknNk
    konnnnnnnnnnnnNk
    konnnnnnnnnnnnNk
    konnnnNNNNnnnnNk
    konnnNnnnnonnnNk
    konnnNnnnnonnnNk
    konnnnoooonnnnNk
    konnnnnnnnnnnnNk
    konnnnnnnnnnnnNk
    konknnnnnnnnknNk
    konnnnnnnnnnnnNk
    kNNNNNNNNNNNNNNk
    kkkkkkkkkkkkkkkk
  `);
}
function hardTile(theme) {
  const P = { meadow: ['#c9b28a', '#f2e4bd', '#8f7650'], cave: ['#7b78b0', '#b3b5e6', '#4b4a80'],
    sky: ['#dfeafb', '#ffffff', '#9dbde6'], keep: ['#6e7396', '#a3a9cc', '#3f4363'] }[theme];
  const c = mk(16, 16), g = c.getContext('2d');
  R(g, theme === 'sky' ? '#5a7fb5' : '#1b1b2f', 0, 0, 16, 16);
  R(g, P[0], 1, 1, 14, 14);
  R(g, P[1], 1, 1, 14, 2); R(g, P[1], 1, 1, 2, 14);
  R(g, P[2], 1, 13, 14, 2); R(g, P[2], 13, 1, 2, 14);
  R(g, P[0], 13, 1, 1, 1); R(g, P[0], 1, 13, 1, 1);
  R(g, P[2], 5, 5, 6, 1); R(g, P[2], 5, 5, 1, 6); R(g, P[1], 5, 10, 6, 1); R(g, P[1], 10, 5, 1, 6);
  return c;
}
function onewayTile(theme) {
  if (theme === 'sky') {
    // a strip of rainbow
    const c = mk(16, 16), g = c.getContext('2d');
    ['#ff7b7b', '#ffb454', '#ffe873', '#84e07a', '#63bdff', '#a993ff'].forEach(function (col, i) { R(g, col, 0, i, 16, 1); });
    R(g, '#ffffff', 2, 0, 2, 1); R(g, '#ffffff', 10, 1, 1, 1);
    return c;
  }
  if (theme === 'keep') {
    return art(`
      kkkkkkkkkkkkkkkk
      kSSSkSSSkSSSkSSk
      ksskkksskkksskkk
      kKKkKKKkKKKkKKKk
      kkkkkkkkkkkkkkkk
      .k............k.
    `);
  }
  return art(`
    kkkkkkkkkkkkkkkk
    kOOOOOOOOOOOOOOk
    koooNooooooNoook
    konnnnnnnnnnnnnk
    kkkkkkkkkkkkkkkk
    ..kNk......kNk..
    ...k........k...
  `, theme === 'cave' ? { O: '#b3b5e6', o: '#8a8dc4', n: '#62659c', N: '#34365f' } : null);
}
function spikeTile(theme) {
  const one = rows(`
    ...kk...
    ...kSk..
    ..kSSk..
    ..kSsk..
    .kSSssk.
    .kSSssk.
    kSSSsssk
    kSSSsssk
    kkkkkkkk
  `);
  const r = [];
  for (let i = 0; i < 7; i++) r.push('................');
  for (let i = 0; i < one.length; i++) r.push(one[i] + one[i]);
  return art(r, theme === 'cave' ? { S: '#d6f8ff', s: '#59c5e8', k: '#1c3f5e' } : null);
}
// tree stump (meadow) or stone column (elsewhere): returns [topLeft, topRight, left, right]
function pillarTiles(theme) {
  const top = mk(32, 16), body = mk(32, 16), g = top.getContext('2d'), h = body.getContext('2d');
  const wood = theme === 'meadow';
  const P = wood ? { o: '#3d2412', a: '#9a6238', d: '#6b3e20', l: '#bd8250', c1: '#f4cfa0', c2: '#dba06a' }
    : theme === 'cave' ? { o: '#1b1b2f', a: '#6a6fa6', d: '#484b7a', l: '#9aa1d4', c1: '#b3b5e6', c2: '#7b78b0' }
      : { o: '#1b1b2f', a: '#8086a8', d: '#565b80', l: '#b4bbe0', c1: '#d5daf0', c2: '#a3a9cc' };
  const bark = function (q, y0, y1) {
    R(q, P.o, 1, y0, 30, y1 - y0); R(q, P.a, 2, y0, 28, y1 - y0);
    R(q, P.l, 3, y0, 2, y1 - y0); R(q, P.d, 24, y0, 6, y1 - y0);
    [8, 14, 20].forEach(function (x, i) { R(q, P.d, x, y0, 1, y1 - y0); });
    [10, 17].forEach(function (x) { R(q, P.l, x, y0, 1, y1 - y0); });
  };
  bark(h, 0, 16);
  if (wood) { R(h, P.d, 11, 4, 2, 3); R(h, P.o, 12, 5, 1, 1); R(h, P.l, 5, 10, 1, 3); R(h, P.o, 26, 9, 1, 4); }
  else { R(h, P.d, 2, 7, 28, 1); R(h, P.l, 2, 8, 22, 1); }
  bark(g, 5, 16);
  R(g, P.o, 1, 0, 30, 5);
  R(g, P.c1, 1, 1, 30, 3); R(g, P.o, 0, 1, 1, 3); R(g, P.o, 31, 1, 1, 3);
  if (wood) { R(g, P.c2, 6, 2, 9, 1); R(g, P.c2, 18, 2, 6, 1); R(g, P.c2, 10, 3, 12, 1); R(g, P.c2, 26, 3, 3, 1); R(g, P.o, 2, 5, 28, 1); }
  else { R(g, P.c2, 1, 3, 30, 1); R(g, P.o, 2, 5, 28, 1); R(g, P.l, 2, 6, 22, 1); }
  const cut = function (src, sx) { const c = mk(16, 16); c.getContext('2d').drawImage(src, sx, 0, 16, 16, 0, 0, 16, 16); return c; };
  return [cut(top, 0), cut(top, 16), cut(body, 0), cut(body, 16)];
}
function bridgeTile() {
  return art(`
    kkkkkkkkkkkkkkkk
    kOOONOOONOOONOOk
    koooNoooNoooNook
    konnNonnNonnNonk
    kkkkkkkkkkkkkkkk
    .kNk........kNk.
    ..kNk......kNk..
    ...kk......kk...
  `, { k: '#3d2412' });
}
// lava (keep) and water (meadow ponds): two frames each
function liquidTile(kind, f) {
  const c = mk(16, 16), g = c.getContext('2d');
  const P = kind === 'lava' ? ['#fff2a0', '#ffcf3f', '#ff7a2f', '#e8414f', '#a3223e'] : ['#ffffff', '#c9efff', '#63bdff', '#3b8be6', '#2a62c4'];
  const wave = [1, 0, 0, 1, 2, 2, 1, 0, 1, 0, 0, 1, 2, 2, 1, 0];
  for (let x = 0; x < 16; x++) {
    const o = wave[(x + f * 4) % 16] + 2;
    R(g, P[0], x, o); R(g, P[1], x, o + 1, 1, 2); R(g, P[2], x, o + 3, 1, 4); R(g, P[3], x, o + 7, 1, 16);
  }
  R(g, P[4], 3, 13, 3, 1); R(g, P[4], 11, 11, 2, 1); R(g, P[1], (4 + f * 7) % 16, 9, 2, 1); R(g, P[1], (12 + f * 5) % 16, 12, 1, 1);
  return c;
}

/* ---------- platforms that move or fall ---------- */

function platImg(theme, w, fall) {
  const c = mk(w, 8), g = c.getContext('2d');
  if (theme === 'sky') {
    const E = fall ? '#e08fb5' : '#86b4e6', A = fall ? '#ffe4f1' : '#ffffff', B = fall ? '#ffc4dd' : '#cfe6ff';
    R(g, E, 2, 0, w - 4, 8); R(g, E, 0, 2, w, 4); R(g, E, 1, 1, w - 2, 6);
    R(g, A, 2, 1, w - 4, 5); R(g, A, 1, 2, w - 2, 3); R(g, B, 2, 5, w - 4, 2); R(g, B, 1, 4, w - 2, 1);
    for (let x = 6; x < w - 4; x += 9) R(g, E, x, 7, 3, 1);
    return c;
  }
  const P = {
    meadow: fall ? ['#fff2a0', '#f0c04e', '#b98432', '#3d2412'] : ['#f4cfa0', '#dba06a', '#9a6238', '#3d2412'],
    cave: fall ? ['#e6d6ff', '#b99be8', '#7a5fb0', '#1b1b2f'] : ['#b3b5e6', '#8a8dc4', '#565a8f', '#1b1b2f'],
    keep: fall ? ['#f2b48a', '#d98a5a', '#9a5632', '#1b1b2f'] : ['#c0c5e0', '#8a8fb5', '#565b80', '#1b1b2f'],
  }[theme] || ['#f4cfa0', '#dba06a', '#9a6238', '#3d2412'];
  R(g, P[3], 0, 0, w, 7); R(g, P[0], 1, 1, w - 2, 1); R(g, P[1], 1, 2, w - 2, 3); R(g, P[2], 1, 5, w - 2, 1);
  for (let x = 8; x < w; x += 8) R(g, P[2], x - 1, 1, 1, 5);
  R(g, P[3], 3, 3, 1, 1); R(g, P[3], w - 4, 3, 1, 1);
  R(g, P[3], 4, 7, 2, 1); R(g, P[3], w - 6, 7, 2, 1);
  if (fall) { for (let x = 12; x < w - 6; x += 16) { R(g, P[3], x, 2, 1, 1); R(g, P[3], x + 1, 3, 1, 1); R(g, P[3], x, 4, 1, 1); } }
  return c;
}

/* ---------- scenery ---------- */

function buildDecor() {
  let c, g;
  // bushes
  c = mk(32, 14); g = c.getContext('2d');
  blob(g, '#1d6a43', 9, 13, 9, 9, true); blob(g, '#1d6a43', 18, 13, 11, 13, true); blob(g, '#1d6a43', 26, 13, 6, 8, true);
  blob(g, '#3fb85a', 9, 13, 8, 8, true); blob(g, '#3fb85a', 18, 13, 10, 12, true); blob(g, '#3fb85a', 26, 13, 5, 7, true);
  blob(g, '#6fd96a', 8, 9, 4, 3); blob(g, '#6fd96a', 17, 6, 5, 3); R(g, '#bdf06e', 15, 4, 3, 1); R(g, '#bdf06e', 6, 8, 2, 1);
  R(g, '#2f9c4a', 12, 10, 2, 1); R(g, '#2f9c4a', 22, 9, 2, 1); R(g, '#2f9c4a', 4, 12, 3, 1);
  SPR.bush = c;
  c = mk(16, 9); g = c.getContext('2d');
  blob(g, '#1d6a43', 8, 8, 8, 8, true); blob(g, '#3fb85a', 8, 8, 7, 7, true); blob(g, '#6fd96a', 7, 5, 3, 2); R(g, '#bdf06e', 6, 4, 2, 1);
  SPR.bush2 = c;
  def('grass', `
    .g...l.
    ggl.gg.
    gGgggGg
  `);
  def('flower', `
    .rpr.
    rpypr
    .rpr.
    ..G..
    .gG..
    ..Gg.
    ..G..
  `);
  def('flower2', `
    .wiw.
    wiyiw
    .wiw.
    ..G..
    ..Gg.
    .gG..
    ..G..
  `);
  def('puddle', `
    ...iiiiiiiiiiiiii...
    .iiwwwiiiiiiiiiiiii.
    ..bbbbbbbbbbbbbbbb..
  `);
  def('sign', `
    ...kkkkkkkk...
    ..kOOOOOOOOk..
    .kOoooooNoook.
    .kOooooooNookk
    .kOoNNNNNNNook
    .kOooooooNookk
    .kOoooooNoook.
    ..knnnnnnnnk..
    ...kkkkkkkk...
    ......kNk.....
    ......kNk.....
    ......kNk.....
    ......kNk.....
    .....kkNkk....
  `, { k: '#3d2412' });
  def('fence', `
    ..k.......k.....
    .kOk.....kOk....
    .kOk.....kOk....
    kkOkkkkkkkOkkkkk
    kOOOOOOOOOOOOOOk
    kkokkkkkkkokkkkk
    .kok.....kok....
    kkokkkkkkkokkkkk
    kooooooooooooook
    kkokkkkkkkokkkkk
    .kok.....kok....
  `, { k: '#3d2412' });
  // cave: glowing mushrooms, crystals
  def('shroom', `
    ..kkkk..
    .kmmmmk.
    kmwmmwmk
    kmmmmmmk
    kkkkkkkk
    ..kcck..
    ..kcck..
  `, { m: '#59e0e8', k: '#1c3f5e' });
  def('shroom2', `
    .kkk.
    kmmmk
    kmwmk
    kkkkk
    .kck.
  `, { m: '#ff8fd0', k: '#5a2350' });
  def('crystal', `
    ....kk......
    ...kiik.....
    ..kiwibk..k.
    ..kiwibk.kik
    .kiiwibbkiibk
    .kiiiibbkiwbk
    .kiiiibBkiibk
    .kiiibbBkibBk
    kiiiibbBBkbBk
    kiiibbBBBkbBk
    kkkkkkkkkkkkk
  `, { k: '#1c3f5e', i: '#b8f3ff', b: '#59c5e8', B: '#2a86b8' });
  def('crystal2', `
    ...kk....
    ..kuuk...
    ..kuwvk..
    .kuuwvvk.
    .kuuvvVk.
    kuuuvvVVk
    kuuvvVVVk
    kkkkkkkkk
  `, { k: '#2c1b4d' });
  // keep: torches and banners
  def('torch1', `
    ...ff...
    ..feef..
    ..feef..
    .feeeef.
    .frerrf.
    ..rrrr..
    .kkkkkk.
    ..kNNk..
    ..kNNk..
    ...kk...
    ...kk...
  `);
  def('torch2', `
    ....f...
    ...ff...
    ..feef..
    .feeef..
    .freeef.
    ..rrer..
    .kkkkkk.
    ..kNNk..
    ..kNNk..
    ...kk...
    ...kk...
  `);
  def('banner', `
    kkkkkkkkkkkk
    krrrrrrrrrRk
    krrrryyrrrRk
    krryryyryrRk
    krrryyyyrrRk
    kryyyrryyyRk
    kryyyrryyyRk
    krrryyyyrrRk
    krryryyryrRk
    krrrryyrrrRk
    krrrrrrrrrRk
    krrrrrrrrrRk
    krrrrrrrrrRk
    krrrrrrrrrRk
    krrrrrrrrrRk
    krrrrRRrrrRk
    krrrRkkRrrRk
    krrRk..kRrRk
    krRk....kRRk
    kRk......kRk
    kk........kk
  `);
  // the bell post at the end of each stage (the bell itself is drawn separately so it can swing)
  c = mk(24, 112); g = c.getContext('2d');
  R(g, '#3d2412', 9, 4, 6, 108); R(g, '#9a6238', 10, 4, 4, 107); R(g, '#bd8250', 10, 4, 1, 107); R(g, '#6b3e20', 13, 4, 1, 107);
  for (let y = 20; y < 108; y += 16) R(g, '#6b3e20', 10, y, 4, 1);
  R(g, '#3d2412', 1, 5, 22, 5); R(g, '#bd8250', 2, 6, 20, 1); R(g, '#9a6238', 2, 7, 20, 2);
  R(g, '#3d2412', 8, 0, 8, 5); R(g, '#ffcf3f', 9, 1, 6, 3); R(g, '#fff2a0', 9, 1, 2, 1);
  R(g, '#3d2412', 6, 108, 12, 4); R(g, '#9a6238', 7, 109, 10, 2);
  R(g, '#3d2412', 4, 10, 1, 3); R(g, '#3d2412', 19, 10, 1, 3);
  SPR.bellpost = c;
  // crusher: a stone block with a bad temper
  for (let f = 0; f < 2; f++) {
    c = mk(32, 32); g = c.getContext('2d');
    R(g, '#1b1b2f', 1, 0, 30, 28); R(g, '#1b1b2f', 0, 1, 32, 26);
    R(g, '#8a8fb5', 2, 1, 28, 26); R(g, '#c0c5e0', 2, 1, 28, 2); R(g, '#c0c5e0', 1, 2, 2, 24);
    R(g, '#565b80', 2, 24, 28, 3); R(g, '#565b80', 28, 2, 3, 24);
    R(g, '#6e7396', 6, 5, 3, 1); R(g, '#6e7396', 22, 20, 4, 1); R(g, '#6e7396', 5, 19, 2, 1); R(g, '#6e7396', 24, 6, 2, 1);
    // spikes underneath
    for (let x = 2; x < 30; x += 7) { spike(g, '#1b1b2f', x + 3, 27, 3, 5, 1); spike(g, '#d5daf0', x + 3, 27, 2, 4, 1); }
    // face
    if (f === 0) {
      R(g, '#1b1b2f', 7, 11, 6, 2); R(g, '#1b1b2f', 19, 11, 6, 2);                // dozing
      R(g, '#1b1b2f', 11, 19, 10, 2);
    } else {
      R(g, '#1b1b2f', 6, 8, 3, 2); R(g, '#1b1b2f', 9, 9, 3, 2); R(g, '#1b1b2f', 12, 10, 2, 2);
      R(g, '#1b1b2f', 23, 8, 3, 2); R(g, '#1b1b2f', 20, 9, 3, 2); R(g, '#1b1b2f', 18, 10, 2, 2);
      R(g, '#ffffff', 7, 11, 6, 4); R(g, '#ffffff', 19, 11, 6, 4);
      R(g, '#e8414f', 10, 12, 3, 3); R(g, '#e8414f', 19, 12, 3, 3);
      R(g, '#1b1b2f', 9, 18, 14, 5); R(g, '#ffffff', 10, 19, 12, 3);
      for (let x = 12; x < 22; x += 3) R(g, '#1b1b2f', x, 19, 1, 3);
    }
    SPR['crusher' + f] = c;
  }
}

/* ---------- backdrops ---------- */

function puff(g, x, y, w, body, under) {
  // a flat-bottomed cloud of width w whose base sits on line y
  const r = w / 2;
  blob(g, body, x + r * 0.55, y, r * 0.5, r * 0.42, true);
  blob(g, body, x + r * 1.05, y, r * 0.62, r * 0.7, true);
  blob(g, body, x + r * 1.55, y, r * 0.42, r * 0.36, true);
  g.fillStyle = body; g.fillRect(Math.round(x + r * 0.1), y, Math.round(w - r * 0.2), 3);
  g.fillStyle = under; g.fillRect(Math.round(x + r * 0.16), y + 3, Math.round(w - r * 0.32), 1);
}
function hill(g, cx, base, rx, ry, body, light, dark) {
  blob(g, body, cx, base, rx, ry, true);
  blob(g, light, cx - rx * 0.22, base - ry * 0.42, rx * 0.36, ry * 0.3);
  g.fillStyle = dark;
  g.fillRect(Math.round(cx + rx * 0.2), Math.round(base - ry * 0.45), 4, 1);
  g.fillRect(Math.round(cx + rx * 0.3), Math.round(base - ry * 0.3), 3, 1);
  g.fillRect(Math.round(cx - rx * 0.5), Math.round(base - ry * 0.12), 4, 1);
}
function bands(cols) {
  // a tall one-pixel strip of colour bands, stretched across the screen as the sky
  const c = mk(1, 240), g = c.getContext('2d'), n = cols.length;
  for (let i = 0; i < n; i++) R(g, cols[i], 0, Math.round(i * 240 / n), 1, Math.ceil(240 / n) + 1);
  return c;
}

function buildBackdrops() {
  let c, g, rnd;
  // ----- meadow: washed sky, a rainbow, two rows of hills
  BG.meadow = { sky: bands(['#6fc2ff', '#7fcaff', '#90d3ff', '#a3dcff', '#b7e5ff', '#cbeeff', '#dcf5ff', '#eafaff']), layers: [] };
  c = mk(512, 240); g = c.getContext('2d');
  const RB = ['#ff8f8f', '#ffc27a', '#fff3a0', '#a6ee9c', '#9bd2ff', '#c7b4ff'];
  for (let y = 0; y < 210; y++) for (let x = 180; x < 512; x++) {
    const d = Math.sqrt((x - 372) * (x - 372) + (y - 232) * (y - 232)) - 168;
    if (d >= 0 && d < 12) { g.globalAlpha = 0.55; R(g, RB[5 - Math.floor(d / 2)], x, y); }
  }
  g.globalAlpha = 1;
  puff(g, 30, 60, 74, '#ffffff', '#cfe9fb'); puff(g, 150, 96, 46, '#ffffff', '#cfe9fb');
  puff(g, 250, 44, 58, '#ffffff', '#cfe9fb'); puff(g, 420, 78, 66, '#ffffff', '#cfe9fb'); puff(g, 330, 118, 34, '#f6fcff', '#cfe9fb');
  BG.meadow.layers.push({ img: c, fx: 0.08, fy: 0.05 });
  c = mk(512, 240); g = c.getContext('2d');
  hill(g, 70, 214, 96, 74, '#9fe3bd', '#b9eecf', '#84d2a6'); hill(g, 250, 214, 120, 96, '#9fe3bd', '#b9eecf', '#84d2a6');
  hill(g, 420, 214, 86, 60, '#9fe3bd', '#b9eecf', '#84d2a6'); hill(g, 582, 214, 96, 74, '#9fe3bd', '#b9eecf', '#84d2a6');
  R(g, '#9fe3bd', 0, 214, 512, 26);
  BG.meadow.layers.push({ img: c, fx: 0.2, fy: 0.1 });
  c = mk(512, 240); g = c.getContext('2d');
  hill(g, 140, 222, 84, 50, '#5fcb8d', '#7edba4', '#49b577'); hill(g, 330, 222, 60, 34, '#5fcb8d', '#7edba4', '#49b577');
  hill(g, 470, 222, 76, 58, '#5fcb8d', '#7edba4', '#49b577'); hill(g, -42, 222, 76, 58, '#5fcb8d', '#7edba4', '#49b577');
  R(g, '#5fcb8d', 0, 222, 512, 18);
  // little round trees along the near hills
  [[36, 206], [232, 214], [258, 218], [396, 212]].forEach(function (t) {
    R(g, '#2f7d55', t[0] - 1, t[1] - 6, 2, 10); blob(g, '#2f9c63', t[0], t[1] - 10, 7, 7); blob(g, '#4fbf7c', t[0] - 2, t[1] - 12, 3, 3);
  });
  BG.meadow.layers.push({ img: c, fx: 0.42, fy: 0.2 });

  // ----- cave: dark rock, hanging and standing spikes, a few glowing specks
  BG.cave = { sky: bands(['#14122c', '#171533', '#1b183b', '#1f1c44', '#231f4c', '#272354', '#2b265b', '#2e2961']), layers: [] };
  c = mk(512, 240); g = c.getContext('2d'); rnd = rng(7);
  R(g, '#201d47', 0, 0, 512, 26); R(g, '#201d47', 0, 214, 512, 26);
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(rnd() * 512), len = 26 + Math.floor(rnd() * 60), hw = 6 + Math.floor(rnd() * 12);
    spike(g, '#201d47', x, 26, hw, len, 1); spike(g, '#201d47', x - 512, 26, hw, len, 1); spike(g, '#201d47', x + 512, 26, hw, len, 1);
    const x2 = Math.floor(rnd() * 512), len2 = 20 + Math.floor(rnd() * 56), hw2 = 6 + Math.floor(rnd() * 14);
    spike(g, '#201d47', x2, 214, hw2, len2, -1); spike(g, '#201d47', x2 - 512, 214, hw2, len2, -1); spike(g, '#201d47', x2 + 512, 214, hw2, len2, -1);
  }
  BG.cave.layers.push({ img: c, fx: 0.15, fy: 0 });
  c = mk(512, 240); g = c.getContext('2d'); rnd = rng(21);
  for (let i = 0; i < 5; i++) {
    const x = 40 + i * 104 + Math.floor(rnd() * 30), w = 10 + Math.floor(rnd() * 8);
    // an hourglass pillar joining roof and floor
    for (let y = 0; y < 240; y++) {
      const t = Math.abs(y - 120) / 120, hw = Math.round(w * (0.45 + 0.9 * t * t));
      R(g, '#2c285c', x - hw, y, hw * 2, 1); R(g, '#353170', x - hw, y, 2, 1);
    }
  }
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rnd() * 512), y = 40 + Math.floor(rnd() * 160), col = rnd() < 0.5 ? '#59e0e8' : (rnd() < 0.5 ? '#ff8fd0' : '#b99be8');
    R(g, col, x, y, 1, 1); if (rnd() < 0.4) { R(g, col, x - 1, y, 3, 1); R(g, col, x, y - 1, 1, 3); }
  }
  BG.cave.layers.push({ img: c, fx: 0.38, fy: 0 });

  // ----- sky: deep blue above, towers of cloud below
  BG.sky = { sky: bands(['#3a86ee', '#4691f2', '#549df5', '#63a9f8', '#74b6fa', '#86c3fc', '#99cffd', '#addbfe', '#c0e6ff']), layers: [] };
  c = mk(512, 280); g = c.getContext('2d'); rnd = rng(3);
  for (let i = 0; i < 9; i++) {
    const x = i * 60 + Math.floor(rnd() * 30), rx = 46 + Math.floor(rnd() * 40), ry = 40 + Math.floor(rnd() * 70);
    [0, -512, 512].forEach(function (o) { blob(g, '#cfe8ff', x + o, 280, rx, ry, true); blob(g, '#dcefff', x + o - rx * 0.12, 280 - ry * 0.72, rx * 0.46, ry * 0.14); });
  }
  BG.sky.layers.push({ img: c, fx: 0.1, fy: 0.22, h: 280 });
  c = mk(512, 300); g = c.getContext('2d'); rnd = rng(11);
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(rnd() * 470), y = 30 + Math.floor(rnd() * 240), w = 34 + Math.floor(rnd() * 50);
    puff(g, x, y, w, '#d9ecff', '#bcdaf8');      // paler than the cloud you can stand on
  }
  BG.sky.layers.push({ img: c, fx: 0.3, fy: 0.5, h: 300 });

  // ----- keep: a storm outside, and the hall's back wall with tall windows
  BG.keep = { sky: bands(['#151a36', '#19203f', '#1e2648', '#232c51', '#28335a', '#2e3a63', '#34416c', '#3a4874']), layers: [] };
  c = mk(512, 240); g = c.getContext('2d'); rnd = rng(5);
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(rnd() * 512), y = 14 + Math.floor(rnd() * 90), rx = 40 + Math.floor(rnd() * 50), ry = 10 + Math.floor(rnd() * 14);
    [0, -512, 512].forEach(function (o) { blob(g, '#232a4b', x + o, y, rx, ry); blob(g, '#2b3357', x + o - 8, y - 4, rx * 0.6, ry * 0.5); });
  }
  // far-off towers
  [[60, 150, 14], [96, 170, 10], [300, 140, 16], [340, 176, 12], [455, 160, 12]].forEach(function (t) {
    R(g, '#1a1f3c', t[0], t[1], t[2], 240 - t[1]); R(g, '#1a1f3c', t[0] - 2, t[1] - 4, t[2] + 4, 5);
    spike(g, '#1a1f3c', t[0] + Math.floor(t[2] / 2), t[1] - 5, Math.floor(t[2] / 2) + 2, 14, -1);
    R(g, '#ffd66b', t[0] + 3, t[1] + 12, 2, 3);
  });
  R(g, '#1a1f3c', 0, 204, 512, 36);
  BG.keep.layers.push({ img: c, fx: 0.08, fy: 0 });
  // the back wall: repeats every 224 pixels and has a window cut through it
  c = mk(224, 240); g = c.getContext('2d');
  R(g, '#292b49', 0, 0, 224, 240);
  for (let y = 0; y < 240; y += 8) {
    R(g, '#202239', 0, y + 7, 224, 1);
    for (let x = (y / 8) % 2 ? 8 : 0; x < 224; x += 16) R(g, '#202239', x, y, 1, 7);
  }
  rnd = rng(9);
  for (let i = 0; i < 40; i++) {
    const bx = Math.floor(rnd() * 14) * 16 + ((Math.floor(rnd() * 30) % 2) ? 8 : 0), by = Math.floor(rnd() * 30) * 8;
    if (((by / 8) % 2 ? 8 : 0) === bx % 16) R(g, rnd() < 0.5 ? '#2f3254' : '#252742', bx + 1, by, 15, 7);
  }
  // pillar
  R(g, '#1b1b2f', 0, 0, 18, 240); R(g, '#3b3e66', 1, 0, 16, 240); R(g, '#4a4e7c', 2, 0, 3, 240); R(g, '#2f3254', 12, 0, 5, 240);
  R(g, '#1b1b2f', 0, 36, 20, 8); R(g, '#4a4e7c', 0, 37, 20, 3); R(g, '#3b3e66', 0, 40, 20, 3);
  R(g, '#1b1b2f', 0, 196, 20, 8); R(g, '#4a4e7c', 0, 197, 20, 3); R(g, '#3b3e66', 0, 200, 20, 3);
  // window: an arched opening, x 104..136, y 72..152
  const wx = 104, wy = 72, ww = 32, wh = 80;
  R(g, '#1b1b2f', wx - 3, wy + 13, ww + 6, wh - 13 + 3); blob(g, '#1b1b2f', wx + ww / 2, wy + 16, ww / 2 + 3, 19, true);
  R(g, '#4a4e7c', wx - 2, wy + 14, ww + 4, wh - 14 + 1); blob(g, '#4a4e7c', wx + ww / 2, wy + 16, ww / 2 + 2, 18, true);
  g.globalCompositeOperation = 'destination-out';
  R(g, '#000', wx, wy + 16, ww, wh - 16); blob(g, '#000', wx + ww / 2, wy + 16, ww / 2, 16, true);
  g.globalCompositeOperation = 'source-over';
  R(g, '#1b1b2f', wx + 10, wy, 1, wh); R(g, '#1b1b2f', wx + 21, wy, 1, wh); R(g, '#1b1b2f', wx, wy + 44, ww, 1);
  R(g, '#1b1b2f', wx - 5, wy + wh, ww + 10, 4); R(g, '#4a4e7c', wx - 4, wy + wh, ww + 8, 2);
  BG.keep.wall = c;
}

function buildTiles() {
  THEMES.forEach(function (th) {
    const ts = { ground: [], bonus: [], pil: pillarTiles(th), plat: {} };
    for (let m = 0; m < 16; m++) ts.ground.push(groundTile(th, m));
    ts.brick = brickTile(th);
    ts.bonus = [bonusTile('#ffffff'), bonusTile('#fff2a0'), bonusTile('#ffe14d')];
    ts.used = usedTile();
    ts.hard = hardTile(th);
    ts.oneway = onewayTile(th);
    ts.spike = spikeTile(th);
    ts.bridge = bridgeTile();
    ts.lava = [liquidTile('lava', 0), liquidTile('lava', 1), liquidTile('lava', 2), liquidTile('lava', 3)];
    ts.water = [liquidTile('water', 0), liquidTile('water', 1), liquidTile('water', 2), liquidTile('water', 3)];
    TILESET[th] = ts;
  });
}
function platFor(theme, w, fall) {
  const ts = TILESET[theme], k = w + (fall ? 'f' : 'm');
  return ts.plat[k] || (ts.plat[k] = platImg(theme, w, fall));
}
