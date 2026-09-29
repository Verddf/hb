'use strict';

// ---------------------------------------------------------------------------
// Pixel canvas: a tiny paint program used to author sprites in code.
// Shapes are filled per pixel (no anti-aliasing) and outline() adds the
// classic dark 1px border around whatever was painted.
// ---------------------------------------------------------------------------
const OUT = '#1c1830';

const _rgba = {};
function hexToRgba(hex) {
  if (_rgba[hex]) return _rgba[hex];
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16),
    h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255];
  _rgba[hex] = v;
  return v;
}

function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

class PixelCanvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Array(w * h).fill(null);
  }
  set(x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
    return this;
  }
  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : null;
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
    return this;
  }
  circle(cx, cy, r, c) { return this.ellipse(cx, cy, r, r, c); }
  poly(pts, c) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        if (pointInPoly(x + 0.5, y + 0.5, pts)) this.set(x, y, c);
      }
    }
    return this;
  }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  // Repaint pixels: fn(x, y, currentColor) returns a new colour or undefined.
  map(fn) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        const n = fn(x, y, this.d[i]);
        if (n !== undefined) this.d[i] = n;
      }
    }
    return this;
  }
  outline(c = OUT) {
    const add = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.d[y * this.w + x] !== null) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push(y * this.w + x);
      }
    }
    for (const i of add) this.d[i] = c;
    return this;
  }
  // Paint rows of palette characters ('.' = transparent).
  stamp(rows, pal, ox = 0, oy = 0) {
    rows.forEach((row, y) => {
      if (row.length !== this.w && typeof console !== 'undefined') {
        console.warn('sprite row width mismatch', row.length, this.w, row);
      }
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch !== '.' && pal[ch]) this.set(ox + x, oy + y, pal[ch]);
      }
    });
    return this;
  }
  toCanvas() {
    const c = makeCanvas(this.w, this.h);
    const g = c.getContext('2d');
    const img = g.createImageData(this.w, this.h);
    for (let i = 0; i < this.d.length; i++) {
      const col = this.d[i];
      if (col) img.data.set(hexToRgba(col), i * 4);
    }
    g.putImageData(img, 0, 0);
    return c;
  }
}

function mirrorCanvas(c) {
  const m = makeCanvas(c.width, c.height);
  const g = m.getContext('2d');
  g.translate(c.width, 0);
  g.scale(-1, 1);
  g.drawImage(c, 0, 0);
  return m;
}

// A sprite holds the image as authored (n) and horizontally mirrored (m).
function toSprite(pc) {
  const n = pc.toCanvas();
  return { n, m: mirrorCanvas(n), w: pc.w, h: pc.h };
}

function blit(ctx, s, x, y, mirror = false, flipY = false) {
  x = Math.round(x);
  y = Math.round(y);
  const img = mirror ? s.m : s.n;
  if (!flipY) {
    ctx.drawImage(img, x, y);
    return;
  }
  ctx.save();
  ctx.translate(x, y + s.h);
  ctx.scale(1, -1);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Kiko, the hero: a young explorer in a cat-eared hood and a long scarf.
// Hand-authored pixel rows, facing right.
// k outline  h/H hood  s skin  w eye white  p cheek  r/R scarf
// t/T tunic  b belt  o/O boots
// ---------------------------------------------------------------------------
const KIKO_SMALL_HEAD = [
  '....kk...kk.....',
  '...khhk.khhk....',
  '...khhhkhhhhk...',
  '..khhhhhhhhhhk..',
  '..khhhhhhhhhhhk.',
  '..khhhhksssssssk',
  '..khHhksssswkssk',
  '..khHhksssswkpsk',
  '...khhksssssssk.',
];
const KIKO_SMALL_BODY = [
  '....krrrrrrrk...',
  '..rrktttttttsk..',
  '...rkTttttttk...',
  '....kTTttttTk...',
];
const KIKO_SMALL_LEGS = {
  idle: ['....ktTk.kTtk...', '...kooOk.kooOk..', '...kkkkk.kkkkk..'],
  run1: ['..ktTk...kTtk...', '.kooOk....kooOk.', '.kkkk......kkkk.'],
  run2: ['.....ktTTk......', '....kooOoOk.....', '....kkkkkkk.....'],
  run3: ['...kTk..ktTk....', '..kOOk...kooOk..', '..kkk.....kkkkk.'],
};
const KIKO_SMALL_JUMP = [
  '.rr.krrrrrrrk...',
  '...kttttttttsk..',
  '....kTttttttk...',
  '...kTTTtttTk....',
  '..kooOk...ktTk..',
  '..kkkk...kooOOk.',
  '..........kkkk..',
];
const KIKO_DEAD = [
  '...kk......kk...',
  '..khhk....khhk..',
  '..khhhkkkkhhhk..',
  '.khhhhhhhhhhhhk.',
  '.khhsssssssshhk.',
  '.khhsksssskshhk.',
  '.khhssskkssshhk.',
  '..khsssssssshk..',
  'sk.kkrrrrrrkk.ks',
  'skkrrrrrrrrrrkks',
  '.kkttttttttttkk.',
  '...kTTttttTTk...',
  '...kTTttttTTk...',
  '...kTTk..kTTk...',
  '..kooOk..kOook..',
  '..kkkkk..kkkkk..',
];

const KIKO_BIG_HEAD = [
  '....kk....kk....',
  '...khhk..khhk...',
  '...khHhkkkhHhk..',
  '..khhhhhhhhhhk..',
  '.khhhhhhhhhhhhk.',
  '.khhhhhhhhhhhhhk',
  '.khhhhksssssssk.',
  '.khHhhksssswkssk',
  '.khHhhksssswkssk',
  '.khHhhkssssssppk',
  '..khhhksssssssk.',
  '...khhkkkkkkkk..',
];
const KIKO_BIG_TORSO = [
  '....krrrrrrrk...',
  '..rrkrrRrrrrk...',
  '..rRkttttttttk..',
  '...rkttttttttk..',
  '...kTtttttttssk.',
  '...kTtttttttssk.',
  '...kTTttttttkk..',
  '...kbbbbbbbbk...',
  '...kTTttttTTk...',
  '...kTTttttTTk...',
  '...kTTTttTTTk...',
  '...kkTTkkTTkk...',
];
const KIKO_BIG_LEGS = {
  idle: ['...kTTk..kTTk...', '...kTTk..kTTk...', '...kTtk..kTtk...', '...kTtk..kTtk...',
    '...koook.koook..', '...kooOk.kooOk..', '...kooOOkkooOOk.', '...kkkkkkkkkkkk.'],
  run1: ['..kTTk...kTTk...', '..kTtk....kTTk..', '.kTtk.....kTtk..', '.kTtk......kTtk.',
    'kook.......koook', 'kOk........kooOk', 'kk.........kooOk', '...........kkkkk'],
  run2: ['....kTTTTk......', '....kTTtTk......', '....kTttTk......', '....kTttTk......',
    '....kooooOk.....', '....koooooOk....', '....kooooOOk....', '....kkkkkkkk....'],
  run3: ['...kTTkTTk......', '..kTTk.kTTk.....', '..kTtk..kTtk....', '.kTtk....kTtk...',
    '.kook....koook..', 'kOOk.....kooOk..', 'kkk......kooOOk.', '.........kkkkkk.'],
  jump: ['..kTTk...kTTk...', '.kTtk.....kTTk..', 'kTtk......kTtk..', 'kook.......kTtk.',
    'kOOk.......koook', 'kkkk.......kooOk', '...........kkkkk', '................'],
};
const KIKO_BIG_CROUCH = [
  '...krrrrrrrrk...',
  '..kTtttttttssk..',
  '..kTTtttttTTTk..',
  '.kTTTTttttTTTTk.',
  '.kooOOk..kooOOk.',
  '.kkkkkk..kkkkkk.',
];

const KIKO_PAL = {
  k: OUT, h: '#27b3a3', H: '#177a70', s: '#ffd0a6', w: '#ffffff', p: '#ff8f9c',
  r: '#ff8a1c', R: '#c45a06', t: '#3b4bc4', T: '#262f86', b: '#7a4a1c', o: '#8c5226', O: '#5a3214',
};
const KIKO_PALETTES = {
  normal: KIKO_PAL,
  fire: { ...KIKO_PAL, h: '#f6f6fa', H: '#c2c2d6', r: '#ffd23f', R: '#d09a00', t: '#e2402c', T: '#9c2616' },
  star1: { ...KIKO_PAL, h: '#ffd23f', H: '#d09a00', r: '#ff5ec4', R: '#b0307a', t: '#8a2be2', T: '#5a1a9a' },
  star2: { ...KIKO_PAL, h: '#ff5ec4', H: '#b0307a', r: '#7df9ff', R: '#2aa6b0', t: '#1f9e6a', T: '#12603f' },
};
const STAR_CYCLE = ['star1', 'fire', 'star2', 'normal'];

function kikoFrames() {
  const blank = '................';
  const small = {
    idle: [...KIKO_SMALL_HEAD, ...KIKO_SMALL_BODY, ...KIKO_SMALL_LEGS.idle],
    run1: [...KIKO_SMALL_HEAD, ...KIKO_SMALL_BODY, ...KIKO_SMALL_LEGS.run1],
    run2: [...KIKO_SMALL_HEAD, ...KIKO_SMALL_BODY, ...KIKO_SMALL_LEGS.run2],
    run3: [...KIKO_SMALL_HEAD, ...KIKO_SMALL_BODY, ...KIKO_SMALL_LEGS.run3],
    jump: [...KIKO_SMALL_HEAD, ...KIKO_SMALL_JUMP],
    dead: KIKO_DEAD,
  };
  const big = {
    idle: [...KIKO_BIG_HEAD, ...KIKO_BIG_TORSO, ...KIKO_BIG_LEGS.idle],
    run1: [...KIKO_BIG_HEAD, ...KIKO_BIG_TORSO, ...KIKO_BIG_LEGS.run1],
    run2: [...KIKO_BIG_HEAD, ...KIKO_BIG_TORSO, ...KIKO_BIG_LEGS.run2],
    run3: [...KIKO_BIG_HEAD, ...KIKO_BIG_TORSO, ...KIKO_BIG_LEGS.run3],
    jump: [...KIKO_BIG_HEAD, ...KIKO_BIG_TORSO, ...KIKO_BIG_LEGS.jump],
    crouch: [...new Array(14).fill(blank), ...KIKO_BIG_HEAD, ...KIKO_BIG_CROUCH],
  };
  return { small, big };
}

// ---------------------------------------------------------------------------
// Enemies (authored facing left) and items.
// ---------------------------------------------------------------------------
function shadeLowerRight(p, from, to, cx, cy, k) {
  p.map((x, y, c) => (c === from && (x - cx) * 0.6 + (y - cy) > k ? to : undefined));
}

// Grumble: a grumpy purple blob that marches forward.
function paintGrumble(frame) {
  const p = new PixelCanvas(16, 16);
  const body = '#a05cc8', shade = '#6f3a96', light = '#d2a6ee', foot = '#3a2416';
  const fo = frame ? 1 : 0;
  p.ellipse(4 - fo, 14.3, 2.6, 1.8, foot);
  p.ellipse(12 + fo, 14.3, 2.6, 1.8, foot);
  p.ellipse(8, 8.2, 7, 6.2, body);
  shadeLowerRight(p, body, shade, 8, 8, 3.2);
  p.map((x, y, c) => (c === body && (x - 5) ** 2 + (y - 4) ** 2 < 3 ? light : undefined));
  p.rect(4, 6, 2, 3, '#ffffff');
  p.rect(9, 6, 2, 3, '#ffffff');
  p.rect(4, 7, 1, 2, OUT);
  p.rect(9, 7, 1, 2, OUT);
  p.set(3, 4, OUT); p.set(4, 5, OUT); p.set(5, 5, OUT);
  p.set(11, 4, OUT); p.set(10, 5, OUT); p.set(9, 5, OUT);
  p.rect(5, 11, 5, 1, OUT);
  p.set(5, 12, '#ffffff');
  p.set(9, 12, '#ffffff');
  return p.outline();
}

function paintGrumbleFlat() {
  const p = new PixelCanvas(16, 16);
  const body = '#a05cc8', shade = '#6f3a96';
  p.ellipse(8, 13, 7.2, 2.8, body);
  p.rect(1, 14, 14, 1, shade);
  p.rect(4, 12, 2, 1, '#ffffff');
  p.rect(10, 12, 2, 1, '#ffffff');
  p.set(4, 12, OUT);
  p.set(11, 12, OUT);
  return p.outline();
}

// Shellsnail: walks carefully (turns at ledges), hides in its shell when
// stomped, and the shell can be kicked into other enemies.
function spiral(p, from, color, cx, cy, turn) {
  p.map((x, y, c) => {
    if (c !== from) return undefined;
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    const r = Math.hypot(dx, dy);
    let a = (Math.atan2(dy, dx) + turn) / (Math.PI * 2);
    a -= Math.floor(a);
    const t = r / 2.3 - a;
    return t - Math.floor(t) < 0.36 && r > 0.8 ? color : undefined;
  });
}

function paintSnail(frame) {
  const p = new PixelCanvas(16, 16);
  const body = '#8ad8b8', bodyD = '#4fa68a', shell = '#f08a24', shellD = '#b35a10', swirl = '#ffd166';
  const bob = frame ? 1 : 0;
  p.rect(1, 13, 14, 2, body);
  p.ellipse(3.5, 11, 3, 3.6, body);
  p.rect(2, 5 + bob, 1, 4, bodyD);
  p.rect(5, 5 + bob, 1, 4, bodyD);
  p.rect(1, 3 + bob, 2, 2, '#ffffff');
  p.rect(4, 3 + bob, 2, 2, '#ffffff');
  p.set(1, 4 + bob, OUT);
  p.set(4, 4 + bob, OUT);
  p.rect(1, 14, 14, 1, bodyD);
  p.circle(10, 9, 5.2, shell);
  spiral(p, shell, swirl, 10, 9, frame * 0.3);
  shadeLowerRight(p, shell, shellD, 10, 9, 2.6);
  return p.outline();
}

function paintShell(frame, peek) {
  const p = new PixelCanvas(16, 16);
  const shell = '#f08a24', shellD = '#b35a10', swirl = '#ffd166';
  p.ellipse(8, 9.6, 6.4, 5.8, shell);
  spiral(p, shell, swirl, 8, 9.6, frame * Math.PI / 2);
  shadeLowerRight(p, shell, shellD, 8, 9.6, 3);
  p.rect(2, 14, 12, 1, shellD);
  if (peek) {
    p.rect(1, 12, 3, 2, '#8ad8b8');
    p.set(1, 12, '#ffffff');
  }
  return p.outline();
}

// Buzzbee: flies in a wavy line.
function paintBee(frame) {
  const p = new PixelCanvas(16, 16);
  const body = '#ffd23f', dark = '#3a2a1a', wing = '#e3f6ff';
  if (frame === 0) {
    p.ellipse(7.5, 3.5, 2.2, 3, wing);
    p.ellipse(11.5, 3.5, 2.2, 3, wing);
  } else {
    p.ellipse(7, 5.2, 3.4, 1.8, wing);
    p.ellipse(12, 5.2, 3.2, 1.8, wing);
  }
  p.ellipse(8.5, 9.6, 6.4, 4.4, body);
  p.map((x, y, c) => (c === body && (x === 8 || x === 9 || x === 12) ? dark : undefined));
  p.rect(14, 9, 1, 1, dark);
  p.rect(3, 8, 2, 2, '#ffffff');
  p.set(3, 9, OUT);
  p.map((x, y, c) => (c === body && y >= 12 ? '#e0a400' : undefined));
  return p.outline();
}

// Prickle: a spiny critter. Stomping it hurts!
function paintPrickle(frame) {
  const p = new PixelCanvas(16, 16);
  const red = '#e8453c', redD = '#a82a22', spike = '#fff4d6', foot = '#3a2416';
  for (const sx of [3.5, 7.5, 11.5]) p.poly([[sx - 2.5, 8], [sx, 1.5 + (sx === 7.5 ? -0.5 : 0)], [sx + 2.5, 8]], spike);
  p.poly([[0.5, 10], [0.5, 5], [3, 8]], spike);
  p.poly([[15.5, 10], [15.5, 5], [13, 8]], spike);
  const fo = frame ? 1 : 0;
  p.ellipse(4.5 - fo, 14.4, 2.4, 1.6, foot);
  p.ellipse(11.5 + fo, 14.4, 2.4, 1.6, foot);
  p.ellipse(8, 10.5, 6.8, 4.6, red);
  shadeLowerRight(p, red, redD, 8, 10, 2.4);
  p.rect(3, 9, 2, 2, '#ffffff');
  p.set(3, 10, OUT);
  p.rect(2, 12, 2, 1, OUT);
  return p.outline();
}

// Snapvine: a biting plant living in pipes.
function paintChomper(frame) {
  const p = new PixelCanvas(16, 24);
  const head = '#b14fd8', headD = '#7a2c9e', spot = '#f2d7ff', stem = '#3fae4a', mouth = '#5a0f2a';
  p.rect(7, 13, 2, 11, stem);
  p.ellipse(4, 18, 3.2, 1.5, stem);
  p.ellipse(12, 21, 3.2, 1.5, stem);
  p.ellipse(8, 7.5, 7, 6.8, head);
  shadeLowerRight(p, head, headD, 8, 7, 3.5);
  if (frame === 0) {
    p.ellipse(8, 5, 5, 3.8, mouth);
    for (const x of [4, 7, 10]) { p.set(x, 2, '#ffffff'); p.set(x + 1, 2, '#ffffff'); p.set(x, 3, '#ffffff'); }
    for (const x of [5, 8, 11]) { p.set(x, 8, '#ffffff'); p.set(x - 1, 8, '#ffffff'); p.set(x, 7, '#ffffff'); }
  } else {
    p.rect(2, 7, 12, 1, mouth);
    for (const x of [3, 6, 9, 12]) p.set(x, 8, '#ffffff');
    for (const x of [4, 7, 10]) p.set(x, 6, '#ffffff');
  }
  for (const [x, y] of [[4, 11], [11, 11], [12, 4]]) p.set(x, y, spot);
  return p.outline();
}

function paintOrb(frame, big) {
  const p = new PixelCanvas(8, 8);
  p.circle(4, 4, big ? 3.8 : 3.3, '#ff6a1f');
  p.circle(frame ? 3.6 : 4.4, frame ? 3.6 : 4.2, 2.1, '#ffd23f');
  p.set(frame ? 3 : 4, frame ? 3 : 3, '#fffbe0');
  return p;
}

function paintFireball(frame) {
  const p = new PixelCanvas(8, 8);
  p.circle(4, 4, 3.4, '#ff5a1f');
  const a = frame * Math.PI / 2;
  p.circle(4 + Math.cos(a) * 1.3, 4 + Math.sin(a) * 1.3, 1.8, '#ffd23f');
  p.set(4 + Math.round(Math.cos(a) * 1.5), 4 + Math.round(Math.sin(a) * 1.5), '#ffffff');
  return p;
}

// Lava bubble that leaps out of lava pits.
function paintBubble(frame) {
  const p = new PixelCanvas(16, 16);
  p.ellipse(8, 11, 4 + frame, 5, '#ff8a1f');
  p.poly([[4, 10], [8, frame ? 1 : 3], [12, 10]], '#ff8a1f');
  p.circle(8, 10, 5, '#ff5a1f');
  p.circle(7, 9, 2.8, '#ffb01f');
  p.rect(5, 9, 2, 2, '#fff6c8');
  p.rect(9, 9, 2, 2, '#fff6c8');
  p.set(5, 10, OUT);
  p.set(9, 10, OUT);
  return p.outline('#7a1a06');
}

// Magmaw, the boss: a lava toad with horns. 32x32.
function paintBoss(frame, open) {
  const p = new PixelCanvas(32, 32);
  const skin = '#b8321f', skinD = '#7a1d12', belly = '#ff9a3c', crack = '#ffd23f', horn = '#f3e3c3', foot = '#5a140c';
  const f = frame ? 1 : 0;
  p.ellipse(8 - f, 29.4, 5, 2.4, foot);
  p.ellipse(24 + f, 29.4, 5, 2.4, foot);
  p.poly([[5, 11], [2, 1], [12, 8]], horn);
  p.poly([[20, 8], [30, 1], [27, 11]], horn);
  p.ellipse(16, 17.5, 14.5, 11.5, skin);
  shadeLowerRight(p, skin, skinD, 16, 17, 8);
  p.ellipse(16, 23, 9, 5.5, belly);
  p.line(4, 14, 7, 19, crack);
  p.line(7, 19, 6, 22, crack);
  p.line(27, 12, 28, 17, crack);
  p.line(23, 8, 25, 10, crack);
  p.circle(10.5, 12, 3.2, '#ffe14d');
  p.circle(21.5, 12, 3.2, '#ffe14d');
  p.rect(9, 11, 2, 3, OUT);
  p.rect(20, 11, 2, 3, OUT);
  p.line(6, 7, 13, 9, OUT);
  p.line(26, 7, 19, 9, OUT);
  p.line(6, 8, 13, 10, OUT);
  p.line(26, 8, 19, 10, OUT);
  if (open) {
    p.ellipse(15, 20, 7.5, 4.2, '#3a0a08');
    for (const x of [10, 13, 16, 19]) { p.set(x, 17, '#ffffff'); p.set(x + 1, 17, '#ffffff'); p.set(x, 18, '#ffffff'); }
    p.ellipse(15, 22, 4, 1.4, '#ff5a1f');
  } else {
    p.rect(8, 19, 15, 2, '#3a0a08');
    p.set(10, 21, '#ffffff');
    p.set(20, 21, '#ffffff');
  }
  return p.outline();
}

function paintCoin(frame) {
  const p = new PixelCanvas(16, 16);
  const widths = [5.2, 3.8, 1.4, 3.8];
  const rx = widths[frame];
  const gold = '#ffd23f', rim = '#e39a00', shine = '#fff7cf';
  if (frame === 2) {
    p.rect(7, 2, 2, 12, rim);
    p.rect(7, 3, 1, 10, gold);
  } else {
    p.ellipse(8, 8, rx, 6.4, rim);
    p.ellipse(8, 8, Math.max(1, rx - 1.4), 5, gold);
    if (frame === 0) {
      p.rect(7, 5, 2, 6, rim);
      p.rect(7, 5, 1, 6, shine);
    }
    p.set(8 - Math.floor(rx) + 1, 4, shine);
  }
  return p.outline('#6a3a00');
}

function paintBerry() {
  const p = new PixelCanvas(16, 16);
  p.circle(8, 9.8, 5.6, '#ff5a4f');
  shadeLowerRight(p, '#ff5a4f', '#c8322c', 8, 10, 2.8);
  p.rect(5, 6, 2, 2, '#ffd0c8');
  p.rect(8, 1, 1, 4, '#3a7a2a');
  p.ellipse(11, 3, 2.6, 1.3, '#4fc25a');
  p.rect(6, 10, 1, 2, OUT);
  p.rect(10, 10, 1, 2, OUT);
  return p.outline();
}

function paintBloom(frame) {
  const p = new PixelCanvas(16, 16);
  const petal = ['#ff5a1f', '#ff9a1f', '#ff3a6a', '#ffb01f'][frame];
  p.rect(7, 10, 2, 6, '#3fae4a');
  p.ellipse(4.2, 13, 2.6, 1.2, '#3fae4a');
  p.ellipse(11.8, 13, 2.6, 1.2, '#3fae4a');
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
    p.circle(8 + Math.cos(a) * 3.6, 6 + Math.sin(a) * 3.6, 2.4, petal);
  }
  p.circle(8, 6, 2.3, '#fff3a0');
  p.set(7, 6, OUT);
  p.set(9, 6, OUT);
  return p.outline();
}

function starPoints(cx, cy, R, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rad = i % 2 ? r : R;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  return pts;
}

function paintStar(frame) {
  const p = new PixelCanvas(16, 16);
  const col = ['#ffd23f', '#ff9f1c', '#fff3a0', '#7df9ff'][frame];
  p.poly(starPoints(8, 8.6, 7.6, 3.4), col);
  p.rect(6, 7, 1, 2, OUT);
  p.rect(9, 7, 1, 2, OUT);
  return p.outline();
}

function paintHeart() {
  const p = new PixelCanvas(16, 16);
  const c = '#ff5c8a';
  p.circle(5.3, 6.3, 3.6, c);
  p.circle(10.7, 6.3, 3.6, c);
  p.poly([[1.8, 7.5], [14.2, 7.5], [8, 14.5]], c);
  shadeLowerRight(p, c, '#c8305a', 8, 8, 3);
  p.rect(4, 4, 2, 2, '#ffd6e2');
  return p.outline();
}

function paintCrystal(frame) {
  const p = new PixelCanvas(16, 16);
  p.poly([[8, 0.5], [14.5, 6], [8, 15.5], [1.5, 6]], '#7df9ff');
  p.poly([[8, 0.5], [14.5, 6], [8, 6]], '#c8fdff');
  p.poly([[8, 6], [14.5, 6], [8, 15.5]], '#34c3d8');
  p.poly([[1.5, 6], [8, 6], [8, 15.5]], '#5ee6f0');
  if (frame) p.rect(5, 3, 1, 2, '#ffffff');
  return p.outline('#0e3a5a');
}

// Small 8x8 icons for the HUD.
function paintCoinIcon() {
  const p = new PixelCanvas(8, 8);
  p.ellipse(4, 4, 2.6, 3.4, '#ffd23f');
  p.rect(4, 2, 1, 4, '#e39a00');
  return p.outline('#6a3a00');
}
function paintHeartIcon() {
  const p = new PixelCanvas(8, 8);
  p.circle(2.8, 3, 1.9, '#ff5c8a');
  p.circle(5.2, 3, 1.9, '#ff5c8a');
  p.poly([[0.8, 3.4], [7.2, 3.4], [4, 7.2]], '#ff5c8a');
  return p.outline();
}

// ---------------------------------------------------------------------------
// Bake everything once at startup.
// ---------------------------------------------------------------------------
const SPR = {};

function buildSprites() {
  const frames = kikoFrames();
  SPR.kiko = {};
  for (const [palName, pal] of Object.entries(KIKO_PALETTES)) {
    SPR.kiko[palName] = { small: {}, big: {} };
    for (const size of ['small', 'big']) {
      for (const [name, rows] of Object.entries(frames[size])) {
        SPR.kiko[palName][size][name] = toSprite(new PixelCanvas(16, rows.length).stamp(rows, pal));
      }
    }
  }
  SPR.grumble = [toSprite(paintGrumble(0)), toSprite(paintGrumble(1))];
  SPR.grumbleFlat = toSprite(paintGrumbleFlat());
  SPR.snail = [toSprite(paintSnail(0)), toSprite(paintSnail(1))];
  SPR.shell = [0, 1, 2, 3].map(f => toSprite(paintShell(f, false)));
  SPR.shellPeek = toSprite(paintShell(0, true));
  SPR.bee = [toSprite(paintBee(0)), toSprite(paintBee(1))];
  SPR.prickle = [toSprite(paintPrickle(0)), toSprite(paintPrickle(1))];
  SPR.chomper = [toSprite(paintChomper(0)), toSprite(paintChomper(1))];
  SPR.orb = [toSprite(paintOrb(0, false)), toSprite(paintOrb(1, false))];
  SPR.flame = [toSprite(paintOrb(0, true)), toSprite(paintOrb(1, true))];
  SPR.fireball = [0, 1, 2, 3].map(f => toSprite(paintFireball(f)));
  SPR.bubble = [toSprite(paintBubble(0)), toSprite(paintBubble(1))];
  SPR.boss = [toSprite(paintBoss(0, false)), toSprite(paintBoss(1, false)), toSprite(paintBoss(0, true))];
  SPR.coin = [0, 1, 2, 3].map(f => toSprite(paintCoin(f)));
  SPR.berry = toSprite(paintBerry());
  SPR.bloom = [0, 1, 2, 3].map(f => toSprite(paintBloom(f)));
  SPR.star = [0, 1, 2, 3].map(f => toSprite(paintStar(f)));
  SPR.heart = toSprite(paintHeart());
  SPR.crystal = [toSprite(paintCrystal(0)), toSprite(paintCrystal(1))];
  SPR.coinIcon = toSprite(paintCoinIcon());
  SPR.heartIcon = toSprite(paintHeartIcon());
}
