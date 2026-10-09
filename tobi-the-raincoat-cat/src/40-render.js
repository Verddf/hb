/* ============================================================
   DRAWING
   The game world is 16-pixel tiles; each game pixel is drawn as
   a Z x Z block of real screen pixels, so everything stays crisp.
   ============================================================ */

let cv = null, cx = null;
let Z = 2;                    // screen pixels per game pixel
let VW = 400, VH = 240;       // size of the view, in game pixels
let camPx = 0, camPy = 0;     // camera position, in screen pixels
let REDUCE_MOTION = false;
const INK = '#1b1b2f', WHITE = '#ffffff', GOLD = '#ffcf3f', ROSE = '#ff9db0';

function lerp(a, b, t) { return a + (b - a) * t; }

// draw an image at a place on the screen / at a place in the world
function gi(im, x, y) { cx.drawImage(im, Math.round(x * Z), Math.round(y * Z), im.width * Z, im.height * Z); }
function wi(im, x, y) { cx.drawImage(im, Math.round(x * Z) - camPx, Math.round(y * Z) - camPy, im.width * Z, im.height * Z); }
function gr(col, x, y, w, h) { cx.fillStyle = col; cx.fillRect(Math.round(x * Z), Math.round(y * Z), Math.round(w * Z), Math.round(h * Z)); }
function wr(col, x, y, w, h) { cx.fillStyle = col; cx.fillRect(Math.round(x * Z) - camPx, Math.round(y * Z) - camPy, Math.round(w * Z), Math.round(h * Z)); }

function txt(s, x, y, col, sc) {
  s = String(s).toUpperCase(); sc = sc || 1;
  const at = fontAtlas(col || WHITE);
  const py = Math.round(y * Z), st = 6 * sc * Z, w = 5 * sc * Z, h = 7 * sc * Z;
  let px = Math.round(x * Z);
  for (let i = 0; i < s.length; i++, px += st) {
    const gx = GLYPH_X[s[i]];
    if (gx !== undefined) cx.drawImage(at, gx, 0, 5, 7, px, py, w, h);
  }
}
function txtS(s, x, y, col, sc) { txt(s, x + (sc || 1), y + (sc || 1), INK, sc); txt(s, x, y, col, sc); }
function txtC(s, y, col, sc, plain) {
  s = String(s);
  const x = Math.round((VW - textW(s, sc)) / 2);
  if (plain) txt(s, x, y, col, sc); else txtS(s, x, y, col, sc);
}
// thick-outlined text, for titles
function txtO(s, x, y, col, sc, oc, th) {
  th = th || 1;
  for (let dy = -th; dy <= th; dy++) for (let dx = -th; dx <= th; dx++) if (dx || dy) txt(s, x + dx, y + dy, oc || INK, sc);
  txt(s, x, y, col, sc);
}

/* ---------- particles and weather (looks only; never affects play) ---------- */

const FX = { parts: [], rain: [], shake: 0, flash: 0, lightT: 260, toast: '', toastT: 0, toastAge: 0, thunder: 0 };
const flipCache = new Map();
function flippedY(im) { let f = flipCache.get(im); if (!f) { f = flipY(im); flipCache.set(im, f); } return f; }

function fxReset(L) {
  FX.parts.length = 0; FX.shake = 0; FX.flash = 0; FX.lightT = 200; FX.toastT = 0;
  FX.rain.length = 0;
  const n = L && L.rain ? (L.rain === 2 ? 70 : 22) : 0;
  for (let i = 0; i < n; i++) FX.rain.push({ x: Math.random() * 480, y: Math.random() * 260, v: 4.5 + Math.random() * 2 });
}
function part(o) { if (FX.parts.length < 220) FX.parts.push(o); }
function toast(s, t) { FX.toast = s; FX.toastT = t || 170; FX.toastAge = 0; }
function dust(x, y, n) {
  for (let i = 0; i < n; i++) part({ k: 'sq', x: x - 1 + (i - (n - 1) / 2) * 4, y: y - 3, vx: (i - (n - 1) / 2) * 0.35, vy: -0.25 - Math.random() * 0.2, life: 14, max: 14, s: 3, c: '#f4f8ff' });
}
function sparkle(x, y, c, n) {
  n = n || 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + 0.6;
    part({ k: 'sq', x: x, y: y, vx: Math.cos(a) * 1.1, vy: Math.sin(a) * 1.1, life: 16, max: 16, s: 2, c: c || '#fff2a0' });
  }
}
function fxStep() {
  const a = FX.parts;
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    if (--p.life <= 0) continue;
    if (p.g) p.vy += p.g;
    p.x += p.vx || 0; p.y += p.vy || 0;
    a[n++] = p;
  }
  a.length = n;
  for (let i = 0; i < FX.rain.length; i++) {
    const r = FX.rain[i];
    r.y += r.v; r.x -= r.v * 0.28;
    if (r.y > VH + 6) { r.y = -8; r.x = Math.random() * (VW + 80); }
    if (r.x < -6) r.x += VW + 12;
  }
  if (FX.shake > 0) FX.shake--;
  if (FX.flash > 0) FX.flash--;
  if (FX.toastT > 0) FX.toastT--;
  FX.toastAge++;
}
function drawParts() {
  const a = FX.parts;
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    if (p.k === 'sq') {
      const s = Math.max(1, Math.round(p.s * p.life / p.max));
      wr(p.c, p.x - s / 2, p.y - s / 2, s, s);
    } else if (p.k === 'spr') {
      if (p.blink && p.life < 20 && (p.life & 2)) continue;
      const im = p.fy ? flippedY(p.img) : p.img;
      if (p.sy) cx.drawImage(im, Math.round(p.x * Z) - camPx, Math.round((p.y + im.height * (1 - p.sy)) * Z) - camPy, im.width * Z, Math.round(im.height * p.sy * Z));
      else wi(im, p.x, p.y);
    } else if (p.k === 'deb') {
      cx.drawImage(p.img, p.sx, p.sy0, 8, 8, Math.round(p.x * Z) - camPx, Math.round(p.y * Z) - camPy, 8 * Z, 8 * Z);
    } else if (p.k === 'pts') {
      const s = String(p.n), w = textW(s, 1);
      const sx = (Math.round(p.x * Z) - camPx) / Z - w / 2, sy = (Math.round(p.y * Z) - camPy) / Z;
      txt(s, sx + 1, sy + 1, INK, 1); txt(s, sx, sy, p.c || WHITE, 1);
    } else if (p.k === 'coin') {
      wi(COIN_FR[(p.life >> 1) & 3], p.x, p.y);
    }
  }
}

/* ---------- backdrop ---------- */

function drawBackdrop(L, camX, camY, frame) {
  const b = BG[L.theme], W = VW * Z, H = VH * Z;
  const maxCY = Math.max(0, L.H * TS - VH);
  cx.drawImage(b.sky, 0, 0, 1, 240, 0, 0, W, H);
  for (let i = 0; i < b.layers.length; i++) {
    const l = b.layers[i], lw = l.img.width, lh = l.img.height;
    const oy = VH - lh + (maxCY - camY) * l.fy;
    let ox = -((camX * l.fx) % lw);
    if (ox > 0) ox -= lw;
    const py = Math.round(oy * Z);
    for (let x = ox; x < VW; x += lw) cx.drawImage(l.img, Math.round(x * Z), py, lw * Z, lh * Z);
  }
  if (L.theme === 'keep') {
    drawRain(0.55);
    if (FX.flash > 0 && !REDUCE_MOTION) {
      cx.globalAlpha = (FX.flash > 14 || (FX.flash > 5 && FX.flash < 10)) ? 0.75 : 0.2;
      cx.fillStyle = '#dfe8ff'; cx.fillRect(0, 0, W, H);
      cx.globalAlpha = 1;
    }
    // the hall's back wall covers the storm between its two ends
    const wall = b.wall, x0 = Math.max(0, L.wall0 * TS - camX), x1 = Math.min(VW, L.wall1 * TS - camX);
    if (x1 > x0) {
      cx.save();
      cx.beginPath(); cx.rect(Math.round(x0 * Z), 0, Math.round((x1 - x0) * Z), H); cx.clip();
      let ox = -(camX % 224);
      if (ox > 0) ox -= 224;
      for (let x = ox; x < VW; x += 224) cx.drawImage(wall, Math.round(x * Z), Math.round(-camY * Z), 224 * Z, 240 * Z);
      cx.restore();
    }
  }
}
function drawRain(alpha) {
  if (!FX.rain.length) return;
  cx.globalAlpha = alpha; cx.fillStyle = '#d9ecff';
  const w = Math.max(1, Math.round(Z * 0.75));
  for (let i = 0; i < FX.rain.length; i++) {
    const r = FX.rain[i];
    if (r.x > VW) continue;
    cx.fillRect(Math.round(r.x * Z), Math.round(r.y * Z), w, 4 * Z);
    cx.fillRect(Math.round((r.x + 1) * Z), Math.round((r.y - 3) * Z), w, 3 * Z);
  }
  cx.globalAlpha = 1;
}

/* ---------- tiles ---------- */

let COIN_FR = null;
const BONUS_SEQ = [0, 0, 0, 1, 2, 1];

function groundMasks(L) {
  const W = L.W, H = L.H, g = L.grid, m = new Uint8Array(W * H);
  const G = function (x, y) { return (x < 0 || x >= W || y < 0 || y >= H) ? 1 : (g[y * W + x] === T.GROUND ? 1 : 0); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y * W + x] === T.GROUND) m[y * W + x] = G(x, y - 1) | (G(x + 1, y) << 1) | (G(x, y + 1) << 2) | (G(x - 1, y) << 3);
  }
  return m;
}

function tileImage(S, ts, t, i, gm) {
  switch (t) {
    case T.GROUND: return ts.ground[gm[i]];
    case T.BRICK: return ts.brick;
    case T.BONUS: return ts.bonus[BONUS_SEQ[(S.frame >> 3) % 6]];
    case T.USED: return ts.used;
    case T.HARD: return ts.hard;
    case T.ONEWAY: return ts.oneway;
    case T.SPIKE: return ts.spike;
    case T.LAVA: return ts.lava[(S.frame >> 4) & 3];
    case T.PIL_TL: return ts.pil[0];
    case T.PIL_TR: return ts.pil[1];
    case T.PIL_L: return ts.pil[2];
    case T.PIL_R: return ts.pil[3];
    case T.BRIDGE: return ts.bridge;
  }
  return null;
}

function drawTiles(S, camX, camY) {
  const L = S.L, ts = TILESET[L.theme], W = S.W, H = S.H, grid = S.grid;
  const gm = L.gm || (L.gm = groundMasks(L));
  const x0 = Math.max(0, Math.floor(camX / TS)), x1 = Math.min(W - 1, Math.floor((camX + VW) / TS));
  const y0 = Math.max(0, Math.floor(camY / TS)), y1 = Math.min(H - 1, Math.floor((camY + VH) / TS));
  const tz = TS * Z, coin = COIN_FR[(S.frame >> 3) & 3], water = L.theme === 'meadow' ? ts.water[(S.frame >> 4) & 3] : null;
  const bumps = S.bumps;
  for (let ty = y0; ty <= y1; ty++) {
    const py = ty * tz - camPy;
    for (let tx = x0; tx <= x1; tx++) {
      const i = ty * W + tx, t = grid[i];
      if (t === T.EMPTY) { if (water && ty === H - 1) cx.drawImage(water, tx * tz - camPx, py, tz, tz); continue; }
      if (t === T.COIN) { cx.drawImage(coin, tx * tz - camPx + 3 * Z, py + 2 * Z, 10 * Z, 11 * Z); continue; }
      let oy = 0;
      for (let k = 0; k < bumps.length; k++) if (bumps[k].tx === tx && bumps[k].ty === ty) oy = -Math.round(Math.sin(bumps[k].t / 12 * Math.PI) * 5) * Z;
      const im = tileImage(S, ts, t, i, gm);
      if (im) cx.drawImage(im, tx * tz - camPx, py + oy, tz, im.height * Z);
    }
  }
}

function drawDecor(S, camX) {
  const d = S.L.decor;
  for (let i = 0; i < d.length; i++) {
    const o = d[i];
    if (o.x < camX - 48 || o.x > camX + VW + 8) continue;
    let im = SPR[o.k];
    if (o.k === 'torch') {
      im = SPR[((S.frame >> 3) & 1) ? 'torch1' : 'torch2'];
      const fl = ((S.frame >> 2) & 3) === 0 ? 1 : 0;
      const gx = o.x + (o.dx || 0) + 4, gy = o.y + 3;     // a soft stepped glow around the flame
      cx.globalAlpha = 0.07;
      wr('#ffd27f', gx - 16 - fl, gy - 8, 32 + fl * 2, 16); wr('#ffd27f', gx - 12, gy - 13 - fl, 24, 26 + fl * 2);
      wr('#ffe9a8', gx - 9, gy - 5, 18, 10); wr('#ffe9a8', gx - 6, gy - 8, 12, 16);
      cx.globalAlpha = 1;
    }
    if (!im) continue;
    wi(im, o.x + (o.dx || 0), o.top ? o.y : o.y - im.height + (o.dy || 0));
  }
}

/* ---------- creatures, items, the hero ---------- */

function heroFrame(S) {
  const p = S.p;
  if (p.dead) return 'hurt';
  if (S.state === 'clear' || S.state === 'done') return p.ground ? 'cheer' : 'fall';
  if (!p.ground) return (p.glide || p.vy < 0) ? 'jump' : 'fall';
  if (p.skid) return 'skid';
  if (Math.abs(p.vx) > 0.15) return ['run1', 'run2', 'run3', 'run2'][Math.floor(p.runD / 7) % 4];
  return (S.frame % 190 > 182) ? 'blink' : 'idle';
}

function drawHero(S, a) {
  const p = S.p;
  if (p.inv > 0 && ((S.frame >> 1) & 1)) return;
  const x = lerp(p.ox, p.x, a);
  let y = lerp(p.oy, p.y, a);
  const f = heroFrame(S);
  let dir = p.dir;
  if (f === 'skid') dir = -dir;
  if (f === 'cheer') y -= Math.abs(Math.sin(S.st * 0.16)) * 5;
  const glow = p.sun > 0 && ((S.frame >> 1) & 1) && (p.sun > 100 || ((S.frame >> 3) & 1));
  const im = (dir > 0 ? SPR : SPRL)[(glow ? 'tobs_' : 'tobi_') + f];
  const sx = x - 3, sy = y - 2;
  if (p.power && !p.dead) {
    if (p.glide) wi(SPR.umb_open, sx, sy - 7);
    else wi(dir > 0 ? SPRL.umb_folded : SPR.umb_folded, dir > 0 ? sx - 3 : sx + 11, sy + 4 + (f === 'run2' ? 1 : 0));
  }
  wi(im, sx, sy);
  if (p.sun > 0 && (S.frame & 3) === 0) part({ k: 'sq', x: x + Math.random() * 10, y: y + Math.random() * 14, vx: 0, vy: -0.4, life: 12, max: 12, s: 2, c: (S.frame & 4) ? '#fff2a0' : '#ffffff' });
}

function drawEnt(S, e, a, rising) {
  const t = e.t, f = S.frame;
  const x = lerp(e.ox, e.x, a), y = lerp(e.oy, e.y, a);
  const batty = S.L.theme === 'cave' || S.L.theme === 'keep';
  let im;
  switch (t) {
    case 'mud': wi(SPR[e.on && ((f + (e.x | 0)) >> 3) & 1 ? 'mud1' : 'mud2'], x - 2, y + e.h - 16); break;
    case 'snail':
      if (e.st === 0) wi((e.dir > 0 ? SPR : SPRL)[e.on && (f >> 4) & 1 ? 'snail1' : 'snail2'], x - 2, y + e.h - 16);
      else {
        const wake = e.vx === 0 && e.tm > 400 ? ((f >> 1) & 1) * 2 - 1 : 0;
        wi(e.vx !== 0 && ((f >> 2) & 1) ? SPRL.shell : SPR.shell, x + wake, y + 1);
      }
      break;
    case 'prick': wi((e.dir > 0 ? SPR : SPRL)[e.on && (f >> 3) & 1 ? 'prick1' : 'prick2'], x - 2, y + e.h - 13); break;
    case 'flit':
      if (batty) wi((e.dir > 0 ? SPR : SPRL)[(f >> 3) & 1 ? 'bat1' : 'bat2'], x - 2, y);
      else wi(SPR[(f >> 4) & 1 ? 'storm1' : 'storm2'], x - 2, y - 1);
      break;
    case 'frog': im = (e.dir > 0 ? SPR : SPRL)[e.gr ? 'frog1' : 'frog2']; wi(im, x - 2, y + e.h - im.height); break;
    case 'ember':
      if (e.st === 0) {
        if (e.tm < 40) {                               // bubbles warn of a leap
          const ly = (S.H - 1) * TS + 3;
          wr('#fff2a0', e.x + 1 + ((f >> 2) & 3) * 2, ly - ((f >> 1) & 3), 2, 2);
          wr('#ffcf3f', e.x + 7 - ((f >> 3) & 1) * 3, ly - ((f >> 2) & 1) * 2, 2, 2);
        }
      } else { im = SPR[(f >> 2) & 1 ? 'ember1' : 'ember2']; wi(e.vy > 0 ? flippedY(im) : im, x - 1, y - 1); }
      break;
    case 'chain': {
      const an = e.a0 + (f - 1 + a) * e.w0, c = Math.cos(an), s = Math.sin(an);
      for (let k = 1; k <= e.n; k++) wi(SPR[((f >> 2) + k) & 1 ? 'fire1' : 'fire2'], e.x + c * k * 8 - 4, e.y + s * k * 8 - 4);
      break;
    }
    case 'crusher': wi(SPR[e.st === 0 ? 'crusher0' : 'crusher1'], x - 2, y); break;
    case 'plat': {
      if (e.drop === 2) break;
      const sh = e.fall && !e.drop && e.tm > 0 ? ((f >> 1) & 1) * 2 - 1 : 0;
      wi(platFor(S.L.theme, e.w, e.fall), x + sh, y);
      break;
    }
    case 'spring': wi(SPR[e.tm > 6 ? 'spring2' : 'spring1'], x, y + e.h - 10); break;
    case 'umb': wi(SPR.item_umb, x - 1, y); break;
    case 'sun': wi(SPR[(f >> 2) & 1 ? 'sun1' : 'sun2'], x, y); break;
    case 'heart': wi(SPR.heart, x, y + 1); break;
    case 'gem': {
      const by = Math.round(Math.sin((f + e.i * 23) / 14) * 2);
      wi(SPR.gem, x, y + by);
      const k = (f + e.i * 17) % 48;
      if (k < 10) { wr(WHITE, x + 7, y + by + 1 - (k < 5 ? 1 : 0), 1, 3); wr(WHITE, x + 6, y + by + 2 - (k < 5 ? 1 : 0), 3, 1); }
      break;
    }
    case 'cp': wi(S.cpOn >= e.ci ? SPR.lamp_on : SPR.lamp_off, x - 1, y); break;
    case 'goal': {
      const rung = S.state === 'clear' || S.state === 'done';
      const sw = rung ? Math.round(Math.sin(S.st * 0.33) * 3 * Math.max(0, 1 - S.st / 130)) : 0;
      wi(SPR.bellpost, x - 9, y);
      wi(SPR.bell, x - 4 + sw, y + 11);
      break;
    }
  }
}

/* ---------- the whole scene ---------- */

function drawWorld(S, a) {
  const L = S.L;
  let camX = lerp(S.ocx, S.camX, a), camY = lerp(S.ocy, S.camY, a);
  camPx = Math.round(camX * Z); camPy = Math.round(camY * Z);
  drawBackdrop(L, camX, camY, S.frame);
  if (FX.shake > 0 && !REDUCE_MOTION) {
    camPx += Math.round((Math.random() - 0.5) * FX.shake * Z);
    camPy += Math.round((Math.random() - 0.5) * FX.shake * Z);
  }
  drawDecor(S, camX);
  const ents = S.ents, lo = camX - 64, hi = camX + VW + 64;
  for (let i = 0; i < ents.length; i++) { const e = ents[i]; if (!e.gone && e.rise > 0) drawEnt(S, e, a); }
  drawTiles(S, camX, camY);
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.gone || e.rise > 0) continue;
    if (e.t !== 'chain' && (e.x > hi || e.x + e.w < lo)) continue;
    drawEnt(S, e, a);
  }
  drawHero(S, a);
  drawParts();
  if (L.theme !== 'keep') drawRain(0.4);
}

function drawHUD(S) {
  const y = 6;
  cx.drawImage(SPR.tobi_idle, 1, 0, 14, 10, 5 * Z, (y - 2) * Z, 14 * Z, 10 * Z);
  txtS('~' + S.lives, 21, y, WHITE);
  gi(SPR.i_coin, 44, y); txtS('~' + (S.coins < 10 ? '0' : '') + S.coins, 53, y, WHITE);
  for (let i = 0; i < 3; i++) gi(S.gems[i] ? SPR.i_gem : SPR.i_gem_off, 80 + i * 9, y);
  if (S.p.power) gi(SPR.i_umb, 110, y);
  const tm = String(S.time), tpad = '000'.slice(tm.length) + tm;
  const hot = S.hurry && S.state === 'play' && ((S.frame >> 3) & 1);
  txtS(tpad, VW - 23, y, hot ? ROSE : WHITE); gi(SPR.i_clock, VW - 33, y);
  const sc = String(S.score);
  txtS('000000'.slice(sc.length) + sc, VW - 39 - 35, y, WHITE);
  if (S.p.sun > 0) {
    const w = Math.round(30 * S.p.sun / 600), bx = Math.round(VW / 2) - 15;
    gr(INK, bx - 1, y + 9, 32, 4); gr(GOLD, bx, y + 10, w, 2);
  }
  if (FX.toastT > 0 && (FX.toastT > 30 || (FX.toastT & 4))) {
    // a tip or notice, on a soft dark strip under the score bar
    const w = textW(FX.toast, 1), tx = Math.round((VW - w) / 2);
    gr('rgba(27,27,47,0.5)', tx - 5, 21, w + 10, 13);
    txt(FX.toast, tx, 24, WHITE, 1);
  }
}

// a black screen with a round hole in it: opens to start a stage, closes to end one
function drawIris(px, py, r) {
  cx.fillStyle = '#0b0b16';
  if (r <= 0) { cx.fillRect(0, 0, VW * Z, VH * Z); return; }
  for (let y = 0; y < VH; y++) {
    const dy = y + 0.5 - py, d2 = r * r - dy * dy;
    if (d2 <= 0) { cx.fillRect(0, y * Z, VW * Z, Z); continue; }
    const hw = Math.sqrt(d2), x0 = Math.floor(px - hw), x1 = Math.ceil(px + hw);
    if (x0 > 0) cx.fillRect(0, y * Z, x0 * Z, Z);
    if (x1 < VW) cx.fillRect(x1 * Z, y * Z, (VW - x1) * Z, Z);
  }
}
