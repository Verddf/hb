/* ============================================================
   THE GAME: controls, screens, saving, and the main loop
   ============================================================ */

const $ = function (id) { return document.getElementById(id); };
const STEP = 1000 / 60;
const SAVE_KEY = 'tobi-raincoat-cat-v1';
const save = { max: 0, hi: 0, gems: [0, 0, 0, 0], music: true, sfx: true };

function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s && typeof s === 'object') {
      if (typeof s.max === 'number') save.max = Math.max(0, Math.min(LEVELS.length - 1, s.max | 0));
      if (typeof s.hi === 'number') save.hi = s.hi | 0;
      if (Array.isArray(s.gems)) for (let i = 0; i < 4; i++) save.gems[i] = (s.gems[i] | 0) & 7;
      if (typeof s.music === 'boolean') save.music = s.music;
      if (typeof s.sfx === 'boolean') save.sfx = s.sfx;
    }
  } catch (e) { /* storage unavailable: play without saving */ }
}
function storeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }

const G = {
  mode: 'title', t: 0, paused: false,
  li: 0, sel: 0, lives: 3, score: 0, coins: 0, power: 0, gems: [0, 0, 0], fromCp: 0,
  S: null, iris: null, tally: null, hintGlide: false, hints: {}, touchUI: false, alpha: 1,
};

/* ---------- controls ---------- */

const keys = {};
const touch = { l: 0, r: 0, jump: 0, run: 0 };
const pad = { l: 0, r: 0, jump: 0, run: 0, ok: 0, start: 0 };
const GAME_KEYS = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, Space: 1, KeyZ: 1, KeyX: 1, KeyA: 1, KeyD: 1, KeyW: 1,
  ShiftLeft: 1, ShiftRight: 1, Enter: 1, KeyP: 1, Escape: 1, KeyK: 1, KeyJ: 1 };

let TEST_INPUT = null;      // tests can drive the hero directly

function readInput() {
  if (TEST_INPUT) return TEST_INPUT(G.S) || NO_INPUT;
  const k = keys;
  let l = k.ArrowLeft || k.KeyA || touch.l || pad.l, r = k.ArrowRight || k.KeyD || touch.r || pad.r;
  if (l && r) { l = 0; r = 0; }
  return {
    l: l ? 1 : 0, r: r ? 1 : 0,
    jump: (k.Space || k.KeyZ || k.ArrowUp || k.KeyW || k.KeyK || touch.jump || pad.jump) ? 1 : 0,
    run: (k.ShiftLeft || k.ShiftRight || k.KeyX || k.KeyJ || touch.run || pad.run) ? 1 : 0,
  };
}

function pollPad() {
  let gp = null;
  try { const a = navigator.getGamepads ? navigator.getGamepads() : []; for (let i = 0; i < a.length; i++) if (a[i] && a[i].connected) { gp = a[i]; break; } } catch (e) { gp = null; }
  const was = { ok: pad.ok, start: pad.start, l: pad.l, r: pad.r };
  pad.l = pad.r = pad.jump = pad.run = pad.ok = pad.start = 0;
  if (!gp) return;
  const b = function (i) { return gp.buttons[i] && gp.buttons[i].pressed; };
  const ax = gp.axes[0] || 0;
  pad.l = (ax < -0.4 || b(14)) ? 1 : 0; pad.r = (ax > 0.4 || b(15)) ? 1 : 0;
  pad.jump = (b(0) || b(3)) ? 1 : 0; pad.run = (b(2) || b(1) || b(5) || b(7)) ? 1 : 0;
  pad.ok = b(0) ? 1 : 0; pad.start = b(9) ? 1 : 0;
  if (pad.ok && !was.ok) { audioWake(); uiAction('ok'); }
  if (pad.start && !was.start) { audioWake(); uiAction(G.mode === 'play' ? 'pause' : 'ok'); }
  if (pad.l && !was.l) uiAction('left');
  if (pad.r && !was.r) uiAction('right');
}

// one-off presses: confirm, pause, menu left/right
function uiAction(a) {
  if (a === 'pause') {
    if (G.mode === 'play' && G.S && G.S.state === 'play') setPaused(!G.paused);
    return;
  }
  if (a === 'quit') { if (G.mode === 'play' && G.paused) { setPaused(false); toTitle(); } return; }
  if (G.mode === 'title') {
    if (a === 'left' && G.sel > 0) { G.sel--; sfx('select'); }
    else if (a === 'right' && G.sel < save.max) { G.sel++; sfx('select'); }
    else if (a === 'ok' && G.t > 20) { sfx('coin'); newGame(G.sel); }
  } else if (G.mode === 'intro') { if (a === 'ok' && G.t > 25) beginPlay(); }
  else if (G.mode === 'play') { if (a === 'ok' && G.paused) setPaused(false); }
  else if (G.mode === 'tally') { if (a === 'ok') { if (G.tally.left > 0) tallyFinish(); else if (G.tally.wait > 20) tallyNext(); } }
  else if (G.mode === 'over') { if (a === 'ok' && G.t > 50) { G.sel = G.li; toTitle(); } }
  else if (G.mode === 'ending') { if (a === 'ok' && G.t > 150) { G.sel = 0; toTitle(); } }
}

function setPaused(p) {
  if (G.paused === p) return;
  G.paused = p;
  sfx('pause');
  if (AU.mus && AU.musicOn) AU.mus.gain.value = p ? MUS_GAIN * 0.25 : MUS_GAIN;
  const b = $('bPause');
  if (b) { b.setAttribute('aria-pressed', p ? 'true' : 'false'); b.textContent = p ? 'Resume' : 'Pause'; }
}

/* ---------- moving between screens ---------- */

function toTitle() {
  G.mode = 'title'; G.t = 0; G.S = null; G.iris = null; G.paused = false;
  G.sel = Math.max(0, Math.min(save.max, G.sel));
  fxReset(LEVELS[0]);
  playSong('title');
}
function newGame(li) {
  G.lives = 3; G.score = 0; G.coins = 0; G.power = 0; G.gems = [0, 0, 0];
  startStage(li, 0);
}
// show the stage card, then play. Shards already found in this visit stay found after a fall.
function startStage(li, fromCp) {
  G.li = li; G.fromCp = fromCp | 0;
  G.mode = 'intro'; G.t = 0; G.S = null; G.iris = null; G.paused = false;
  stopSong();
}
function beginPlay() {
  const L = LEVELS[G.li];
  G.S = newSim(L, { fromCp: G.fromCp, power: G.power, coins: G.coins, score: G.score, lives: G.lives, gems: G.gems, vw: VW, vh: VH });
  G.mode = 'play'; G.t = 0;
  G.iris = { t: 0, dur: 34, dir: 1, then: null };
  fxReset(L);
  playSong(L.theme);
  if (G.li === 0 && !G.fromCp) toast(G.touchUI ? 'A JUMPS   B RUNS' : 'ARROWS MOVE  SPACE JUMPS  SHIFT RUNS', 240);
}
function afterDeath() {
  const S = G.S;
  G.score = S.score; G.coins = S.coins; G.gems = S.gems.slice(); G.power = 0;
  G.lives = S.lives - 1;
  if (G.lives <= 0) {
    G.mode = 'over'; G.t = 0;
    if (G.score > save.hi) { save.hi = G.score; storeSave(); }
    playSong('over');
  } else startStage(G.li, S.cpOn);
}
function startTally() {
  const S = G.S;
  G.mode = 'tally'; G.t = 0;
  G.tally = { left: S.time, wait: 0, bonus: S.bonus, gained: 0 };
}
function tallyFinish() {
  const S = G.S, tl = G.tally;
  S.score += tl.left * 50; tl.gained += tl.left * 50; tl.left = 0; S.time = 0;
}
function tallyTick() {
  const S = G.S, tl = G.tally;
  if (G.iris) {
    if (++G.iris.t >= G.iris.dur) { const th = G.iris.then; G.iris = null; if (th) th(); }
    return;
  }
  if (G.t < 40) return;
  if (tl.left > 0) {
    const n = Math.min(tl.left, 3);
    tl.left -= n; S.time = tl.left; S.score += n * 50; tl.gained += n * 50;
    if ((G.t & 3) === 0) sfx('tick');
  } else {
    tl.wait++;
    if (tl.wait > 260) tallyNext();
  }
}
function tallyNext() {
  if (G.iris) return;
  const S = G.S, li = G.li;
  G.score = S.score; G.coins = S.coins; G.lives = S.lives; G.power = S.p.power;
  save.gems[li] |= (S.gems[0] ? 1 : 0) | (S.gems[1] ? 2 : 0) | (S.gems[2] ? 4 : 0);
  if (li + 1 < LEVELS.length) save.max = Math.max(save.max, li + 1);
  if (G.score > save.hi) save.hi = G.score;
  storeSave();
  G.iris = { t: 0, dur: 30, dir: -1, then: function () {
    if (li + 1 < LEVELS.length) { G.gems = [0, 0, 0]; startStage(li + 1, 0); }
    else { G.mode = 'ending'; G.t = 0; G.S = null; fxReset(null); playSong('ending'); }
  } };
}

/* ---------- what the simulation reports becomes sound and sparkle ---------- */

function corpse(kind, x, y, how, dir, theme) {
  const batty = theme === 'cave' || theme === 'keep';
  const name = { mud: 'mud1', snail: 'snail1', shell: 'shell', prick: 'prick1', frog: 'frog1', flit: batty ? 'bat1' : 'storm1' }[kind];
  const im = SPR[name];
  if (!im) return;
  if (how === 'flat') {
    if (kind === 'mud') part({ k: 'spr', img: SPR.mud_flat, x: x - 8, y: y - 5, life: 36, blink: 1 });
    else part({ k: 'spr', img: im, x: x - im.width / 2, y: y - im.height, life: 32, sy: 0.45, blink: 1 });
  } else part({ k: 'spr', img: im, fy: 1, x: x - im.width / 2, y: y - im.height, vx: (dir || 0) * 1.2, vy: -3.2, g: 0.28, life: 90 });
}

function handleEvents(S) {
  const evs = S.ev, th = S.L.theme, camX = S.camX;
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i], x = e[1], y = e[2];
    const seen = x > camX - 24 && x < camX + VW + 24;
    switch (e[0]) {
      case 'jump': sfx('jump'); dust(x, y, 2); break;
      case 'land': sfx('land'); dust(x, y, 3); break;
      case 'coin': sfx('coin'); sparkle(x, y, '#fff2a0', 4); break;
      case 'coinpop': sfx('coin'); part({ k: 'coin', x: x - 5, y: y - 13, vy: -4.3, g: 0.34, life: 24 }); break;
      case 'pts': part({ k: 'pts', x: x, y: y - 8, vy: -0.6, n: e[3], life: 42 }); break;
      case '1up': sfx('oneUp'); part({ k: 'pts', x: x, y: y - 14, vy: -0.5, n: '1UP', life: 80, c: '#a6ee9c' }); break;
      case 'bump': sfx('bump'); break;
      case 'bonk': sfx('bonk'); break;
      case 'break': {
        sfx('brk'); FX.shake = 4;
        const im = TILESET[th].brick;
        for (let k = 0; k < 4; k++) part({ k: 'deb', img: im, sx: (k & 1) * 8, sy0: (k >> 1) * 8, x: x - 8 + (k & 1) * 8, y: y - 8 + (k >> 1) * 8,
          vx: ((k & 1) ? 1 : -1) * (1 + (k >> 1) * 0.5), vy: (k >> 1) ? -2.6 : -4.2, g: 0.32, life: 60 });
        break;
      }
      case 'sprout': sfx('sprout'); break;
      case 'kill': corpse(e[3], x, y, e[4], e[5], th); if (e[4] === 'flip' && seen) sfx('kick'); break;
      case 'stomp': sfx('stomp'); sparkle(x, y + 2, WHITE, 5); break;
      case 'kick': sfx('kick'); break;
      case 'shellBump': if (seen) sfx('shell'); break;
      case 'power': sfx('power'); sparkle(x, y, '#ff9db0', 8); if (!G.hintGlide) { G.hintGlide = true; toast('HOLD JUMP IN THE AIR TO GLIDE', 260); } break;
      case 'hurt':
        sfx('hurt'); FX.shake = 5;
        part({ k: 'spr', img: SPR.umb_open, x: x - 8, y: y - 10, vx: -S.p.dir * 1.3, vy: -3.2, g: 0.12, life: 90, blink: 1 });
        break;
      case 'die':
        stopSong(); playSong('die');
        if (e[3] === 'pit' && th === 'meadow') {
          sfx('splash');
          for (let k = 0; k < 8; k++) part({ k: 'sq', x: x + (k - 4) * 2, y: S.H * TS - 12, vx: (k - 3.5) * 0.4, vy: -2.5 - Math.random() * 1.5, g: 0.2, life: 30, max: 30, s: 3, c: k & 1 ? '#c9efff' : WHITE });
        } else if (e[3] !== 'pit') sfx('hurt');
        break;
      case 'sunStart': sfx('power'); playSong('sun'); toast('SUN DROP! NOTHING CAN STOP YOU', 200); break;
      case 'sunEnd': if (S.state === 'play') playSong(th, S.hurry ? 1.25 : 1); break;
      case 'gem': sfx('gem'); sparkle(x, y, '#fff2a0', 10); toast('SUN SHARD ' + (S.gems[0] + S.gems[1] + S.gems[2]) + ' OF 3', 150); break;
      case 'cp': sfx('cp'); sparkle(x, y + 4, '#fff2a0', 8); toast('LAMP LIT. YOU RESTART HERE', 170); break;
      case 'goal':
        stopSong(); sfx('bell'); playSong('clear');
        for (let k = 0; k < 3; k++) sparkle(x + (k - 1) * 8, y + 16 + k * 4, k & 1 ? WHITE : '#fff2a0', 8);
        break;
      case 'spring': sfx('spring'); break;
      case 'crush': if (seen) { sfx('crush'); FX.shake = 7; dust(x - 8, y, 3); dust(x + 8, y, 3); } break;
      case 'glide': sfx('glide'); break;
      case 'hurry': sfx('hurry'); toast('HURRY UP!', 160); if (S.p.sun === 0) songRate(1.25); break;
      case 'ember': if (seen) sfx('ember'); break;
      case 'platDrop': if (seen) sfx('drop'); break;
    }
  }
}

/* ---------- one tick of the whole game ---------- */

function playTick() {
  const S = G.S;
  step(S, readInput());
  handleEvents(S);
  fxStep();
  if (S.L.theme === 'keep') {
    if (--FX.lightT <= 0) { FX.lightT = 240 + Math.random() * 420; FX.flash = 18; FX.thunder = 24; }
    if (FX.thunder > 0 && --FX.thunder === 0) sfx('thunder');
  }
  if (G.iris && ++G.iris.t >= G.iris.dur) { const th = G.iris.then; G.iris = null; if (th) th(); }
  // first-stage tips, each shown once
  const hints = S.L.hints;
  if (hints && S.state === 'play' && (FX.toastT <= 0 || FX.toastAge > 80)) {
    for (let i = 0; i < hints.length; i++) {
      const key = G.li + ':' + i;
      if (!G.hints[key] && S.p.x > hints[i][0] * TS && S.p.x < (hints[i][0] + 6) * TS) { G.hints[key] = 1; toast(hints[i][1], 190); break; }
    }
  }
  if (S.state === 'dead') afterDeath();
  else if (S.state === 'done') startTally();
}

function tick() {
  G.t++;
  pollPad();
  switch (G.mode) {
    case 'title': fxStep(); break;
    case 'intro': if (G.t > 150) beginPlay(); break;
    case 'play': if (!G.paused) playTick(); break;
    case 'tally': tallyTick(); fxStep(); break;
    case 'ending': fxStep(); break;
  }
}

/* ---------- screens ---------- */

function drawGroundStrip(theme, scroll) {
  const ts = TILESET[theme], tz = TS * Z, y0 = VH - 32;
  const off = Math.round((scroll % 16) * Z);
  for (let x = -1; x <= Math.ceil(VW / 16) + 1; x++) {
    cx.drawImage(ts.ground[14], x * tz - off, y0 * Z, tz, tz);
    cx.drawImage(ts.ground[15], x * tz - off, (y0 + 16) * Z, tz, tz);
  }
}

function drawLogo(y) {
  const s = 'TOBI', sc = VW < 300 ? 4 : 5, x = Math.round((VW - textW(s, sc)) / 2);
  txt(s, x + 3, y + 4, '#2a62c4', sc);
  txtO(s, x, y, GOLD, sc, INK, 2);
  cx.save();
  cx.beginPath(); cx.rect(0, Math.round(y * Z), VW * Z, Math.round(3 * sc * Z)); cx.clip();
  txt(s, x, y, '#fff2a0', sc);
  cx.restore();
  txtC('THE RAINCOAT CAT', y + 7 * sc + 7, WHITE, 1);
}

function drawTitle() {
  const L = LEVELS[0], t = G.t, scroll = t * 1.3;
  camPx = 0; camPy = 0;
  drawBackdrop(L, scroll, 0, t);
  // passing scenery
  const gy = VH - 32;
  for (let k = 0; k < 4; k++) {
    const sx = ((k * 150 + 60 - scroll) % 600 + 600) % 600 - 60;
    gi(k & 1 ? SPR.bush2 : SPR.bush, sx, gy - (k & 1 ? 9 : 14));
    gi(k & 1 ? SPR.flower : SPR.flower2, ((sx + 70) % 600), gy - 7);
  }
  drawGroundStrip('meadow', scroll);
  // Tobi, running on the spot with the umbrella on his back
  const hx = Math.round(VW * 0.24), f = ['run1', 'run2', 'run3', 'run2'][(t >> 2) & 3];
  gi(SPRL.umb_folded, hx - 3, gy - 12 + (f === 'run2' ? 1 : 0));
  gi(SPR['tobi_' + f], hx, gy - 16);
  if ((t & 7) === 0) part({ k: 'sq', x: hx + 2, y: gy - 2, vx: -1.2, vy: -0.3, life: 12, max: 12, s: 3, c: '#f4f8ff' });
  drawParts();
  drawRain(0.4);
  drawLogo(Math.round(VH * 0.12));
  txtC('THE STORM SCATTERED THE SUN.', Math.round(VH * 0.45), WHITE, 1);
  txtC('RING THE FOUR SUN BELLS!', Math.round(VH * 0.45) + 11, '#fff2a0', 1);
  const my = Math.round(VH * 0.62);
  if (save.max > 0) {
    const s = 'STAGE ' + (G.sel + 1) + '  ' + LEVELS[G.sel].name, w = textW(s, 1), x = Math.round((VW - w) / 2);
    gr('rgba(27,27,47,0.55)', x - 16, my - 4, w + 32, 15);
    txt(s, x, my, WHITE, 1);
    if (G.sel > 0) txt('<', x - 12, my, (t & 16) ? GOLD : WHITE, 1);
    if (G.sel < save.max) txt('>', x + w + 7, my, (t & 16) ? GOLD : WHITE, 1);
  }
  if ((t >> 5) & 1 || t < 40) txtC(G.touchUI ? 'TAP TO START' : 'PRESS ENTER OR CLICK TO START', my + 20, WHITE, 1);
  if (save.hi > 0) { const s = 'BEST ' + save.hi; txtS(s, VW - textW(s, 1) - 6, 6, WHITE, 1); }
}

function drawIntro() {
  gr('#0b0b16', 0, 0, VW, VH);
  const y = Math.round(VH * 0.26);
  txtC('STAGE ' + (G.li + 1), y, GOLD, 2, true);
  txtC(LEVELS[G.li].name, y + 22, WHITE, 1, true);
  const cxm = Math.round(VW / 2);
  gi(SPR.tobi_idle, cxm - 24, y + 46);
  txt('~ ' + G.lives, cxm - 2, y + 52, WHITE, 1);
  // shards found in this stage, now or on an earlier visit
  for (let i = 0; i < 3; i++) gi((G.gems[i] || (save.gems[G.li] >> i) & 1) ? SPR.gem : SPR.gem_off, cxm - 19 + i * 14, y + 76);
  if (G.fromCp) txtC('FROM THE LAMP', y + 100, '#9fd8ff', 1, true);
}

function panel(w, h, top) {
  const x = Math.round((VW - w) / 2), y = top == null ? Math.round((VH - h) / 2) : top;
  gr(INK, x - 2, y - 2, w + 4, h + 4); gr('#2a2d52', x, y, w, h); gr('#3a3f6e', x, y, w, 1); gr('#1f2140', x, y + h - 1, w, 1);
  return { x: x, y: y };
}

function drawTally() {
  const S = G.S, tl = G.tally;
  if (G.t < 30) return;
  // high on the screen, so the hero and the bell stay in view underneath
  const p = panel(Math.min(VW - 24, 196), 98, 24), x = p.x + 12, r = p.x + Math.min(VW - 24, 196) - 12;
  txtC('STAGE CLEAR!', p.y + 9, GOLD, 1, true);
  const row = function (label, val, yy, col) { txt(label, x, yy, '#c9cfee', 1); txt(val, r - textW(String(val), 1), yy, col || WHITE, 1); };
  row('BELL', '+' + tl.bonus, p.y + 27);
  row('TIME LEFT', tl.left + ' ~ 50', p.y + 39);
  txt('SUN SHARDS', x, p.y + 53, '#c9cfee', 1);
  for (let i = 0; i < 3; i++) gi(S.gems[i] ? SPR.i_gem : SPR.i_gem_off, r - 27 + i * 10, p.y + 53);
  gr('#3a3f6e', x, p.y + 66, r - x, 1);
  const sc = String(S.score);
  row('SCORE', '000000'.slice(sc.length) + sc, p.y + 72, GOLD);
  if (tl.left === 0 && ((G.t >> 4) & 1)) txtC(G.touchUI ? 'TAP TO GO ON' : 'PRESS ENTER', p.y + 85, WHITE, 1, true);
}

function drawPause() {
  gr('rgba(11,11,22,0.62)', 0, 0, VW, VH);
  const y = Math.round(VH * 0.34);
  txtC('PAUSED', y, GOLD, 2);
  txtC(G.touchUI ? 'TAP TO RESUME' : 'ENTER  RESUME', y + 30, WHITE, 1);
  if (!G.touchUI) {
    txtC('Q  QUIT TO TITLE', y + 43, '#c9cfee', 1);
    txtC('ARROWS MOVE  SPACE JUMPS  SHIFT RUNS', y + 68, '#9fd8ff', 1);
  }
}

function drawOver() {
  gr('#0b0b16', 0, 0, VW, VH);
  const y = Math.round(VH * 0.3);
  txtC('GAME OVER', y, ROSE, 2, true);
  gi(SPR.tobi_hurt, Math.round(VW / 2) - 8, y + 28);
  const sc = String(G.score);
  txtC('SCORE ' + '000000'.slice(sc.length) + sc, y + 56, WHITE, 1, true);
  if (G.t > 50 && ((G.t >> 5) & 1)) txtC(G.touchUI ? 'TAP TO TRY AGAIN' : 'PRESS ENTER TO TRY AGAIN', y + 78, WHITE, 1, true);
}

let SUNRISE = null;
function drawEnding() {
  const t = G.t, W = VW * Z, H = VH * Z;
  if (!SUNRISE) SUNRISE = bands(['#5aa9f5', '#7dbcf7', '#a3d0f8', '#c9e2f7', '#f6e9c8', '#ffe0a0', '#ffd27f', '#ffc46b']);
  cx.drawImage(SUNRISE, 0, 0, 1, 240, 0, 0, W, H);
  // the sun climbs back into the sky
  const rise = Math.min(1, t / 240), sx = Math.round(VW * 0.26), sy = Math.round(VH - 50 - rise * (VH * 0.34));
  const g2 = cx;
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * TAU + t * 0.006, r0 = 30, r1 = 40 + ((k & 1) ? 6 : 0);
    g2.fillStyle = '#fff2a0';
    for (let q = r0; q < r1; q += 2) g2.fillRect(Math.round((sx + Math.cos(a) * q - 1) * Z), Math.round((sy + Math.sin(a) * q - 1) * Z), 3 * Z, 3 * Z);
  }
  for (let y = -24; y <= 24; y++) {
    const hw = Math.round(Math.sqrt(24 * 24 - y * y));
    gr(y < -8 ? '#fffbe0' : '#fff2a0', sx - hw, sy + y, hw * 2, 1);
  }
  gr(INK, sx - 9, sy - 4, 3, 5); gr(INK, sx + 6, sy - 4, 3, 5);
  gr(INK, sx - 7, sy + 8, 14, 2); gr(INK, sx - 9, sy + 6, 2, 2); gr(INK, sx + 7, sy + 6, 2, 2);
  // hills, ground, and a very pleased cat
  const b = BG.meadow;
  for (let i = 1; i < b.layers.length; i++) {
    const l = b.layers[i];
    for (let x = -((t * 0.1 * l.fx) % 512); x < VW; x += 512) cx.drawImage(l.img, Math.round(x * Z), Math.round((VH - 240) * Z), 512 * Z, 240 * Z);
  }
  drawGroundStrip('meadow', 0);
  const gy = VH - 32, hop = Math.abs(Math.sin(t * 0.12)) * 7;
  gi(SPR.bellpost, Math.round(VW * 0.76), gy - 112); gi(SPR.bell, Math.round(VW * 0.76) + 5 + Math.round(Math.sin(t * 0.2) * 2), gy - 101);
  gi(SPR.bush, Math.round(VW * 0.08), gy - 14); gi(SPR.flower, Math.round(VW * 0.52), gy - 7); gi(SPR.flower2, Math.round(VW * 0.3), gy - 7);
  gi(SPR.tobi_cheer, Math.round(VW * 0.5) - 8, gy - 16 - hop);
  if ((t & 7) === 0) part({ k: 'sq', x: Math.random() * VW, y: Math.random() * VH * 0.6, vx: 0, vy: 0.3, life: 30, max: 30, s: 3, c: (t & 8) ? '#ffffff' : '#fff2a0' });
  camPx = 0; camPy = 0;
  drawParts();
  const ty = Math.round(VH * 0.06);
  txtC('THE SUN IS BACK!', ty, WHITE, VW < 300 ? 1 : 2);
  if (t > 90) txtC('ALL FOUR BELLS RING OUT.', ty + 21, WHITE, 1);
  if (t > 150) {
    let n = 0;
    for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) if (save.gems[i] & (1 << k)) n++;
    const sc = String(G.score);
    txtC('SCORE ' + '000000'.slice(sc.length) + sc + '   SHARDS ' + n + '/12', ty + 34, '#fff2a0', 1);
    txtC('THANK YOU FOR PLAYING', VH - 26, WHITE, 1);
    if ((t >> 5) & 1) txtC(G.touchUI ? 'TAP TO PLAY AGAIN' : 'PRESS ENTER TO PLAY AGAIN', VH - 14, '#fff2a0', 1);
  }
}

function draw(a) {
  if (!cx) return;
  cx.imageSmoothingEnabled = false;
  const S = G.S;
  if (G.mode === 'title') drawTitle();
  else if (G.mode === 'intro') drawIntro();
  else if (G.mode === 'over') drawOver();
  else if (G.mode === 'ending') drawEnding();
  else if (S) {
    drawWorld(S, (G.paused || G.mode !== 'play') ? 1 : a);
    drawHUD(S);
    if (G.mode === 'tally') drawTally();
    if (G.iris) {
      const k = G.iris.t / G.iris.dur, e = G.iris.dir > 0 ? k * k : (1 - k) * (1 - k);
      drawIris(S.p.x + 5 - S.camX, S.p.y + 7 - S.camY, e * Math.sqrt(VW * VW + VH * VH));
    }
    if (G.paused) drawPause();
  }
}

/* ---------- fitting the picture to the page ---------- */

function resize() {
  const stage = $('stage'), padEl = $('pad');
  if (!stage || !cv) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const full = document.fullscreenElement === stage;
  const cs = getComputedStyle(stage);
  const room = full ? window.innerWidth : stage.parentNode.clientWidth;
  const availW = room - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const land = G.touchUI && window.innerWidth > window.innerHeight && window.innerHeight < 520;
  stage.classList.toggle('overlay', land || (full && G.touchUI));
  const overlay = stage.classList.contains('overlay');
  const padH = (G.touchUI && !overlay && padEl) ? padEl.offsetHeight + 10 : 0;
  let availH;
  if (full) availH = window.innerHeight - padH - 8;
  else if (land) availH = window.innerHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 8;   // the page scrolls the header away
  else {
    const top = stage.getBoundingClientRect().top + (window.scrollY || 0);
    availH = window.innerHeight - Math.min(top, 140) - padH - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 14;
  }
  availH = Math.max(150, Math.min(availH, 1100));
  const dw = Math.max(64, Math.floor(availW * dpr)), dh = Math.max(64, Math.floor(availH * dpr));
  // A whole-number zoom keeps the pixels crisp. On small screens take the biggest that fits;
  // once pixels are comfortably large, weigh picture size against how much of the stage is in view.
  const zmax = Math.max(1, Math.min(Math.floor(dh / 208), Math.floor(dw / 224)));
  const zVis = Math.ceil(2 * dpr - 0.001);
  let z = zmax;
  if (zmax > zVis) {
    let best = -1;
    for (let k = zVis; k <= zmax; k++) {
      const w = Math.min(448, Math.floor(dw / k)), h = Math.min(240, Math.floor(dh / k));
      const sc = (w * k) * (h * k) * Math.pow(Math.min(1, w / 384), 1.5) * Math.min(1, h / 240);
      if (sc > best * 1.001) { best = sc; z = k; }
    }
  }
  const vw = Math.max(160, Math.min(448, Math.floor(dw / z))), vh = Math.max(144, Math.min(240, Math.floor(dh / z)));
  if (cv.width !== vw * z || cv.height !== vh * z) { cv.width = vw * z; cv.height = vh * z; }
  cv.style.width = (vw * z / dpr) + 'px'; cv.style.height = (vh * z / dpr) + 'px';
  Z = z; VW = vw; VH = vh;
  cx.imageSmoothingEnabled = false;
  if (G.S) { G.S.vw = VW; G.S.vh = VH; clampCamera(G.S); G.S.ocx = G.S.camX; G.S.ocy = G.S.camY; }
  draw(1);
}

/* ---------- wiring up the page ---------- */

function bindKeys() {
  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target;
    if (el && el.closest && el.closest('button, a, input, select, textarea')) return;   // let page controls work normally
    const c = e.code;
    if (GAME_KEYS[c]) e.preventDefault();
    if (e.repeat) return;
    keys[c] = true;
    audioWake();
    if (c === 'Enter' || c === 'Space' || c === 'KeyZ') uiAction('ok');
    else if (c === 'KeyP' || c === 'Escape') uiAction('pause');
    else if (c === 'ArrowLeft' || c === 'KeyA') uiAction('left');
    else if (c === 'ArrowRight' || c === 'KeyD') uiAction('right');
    else if (c === 'KeyQ') uiAction('quit');
    else if (c === 'KeyM') { toggleMusic(); }
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  // clicking away pauses the game and stops the sound; coming back brings the sound back
  window.addEventListener('blur', function () {
    for (const k in keys) keys[k] = false;
    if (G.mode === 'play' && G.S && G.S.state === 'play') setPaused(true);
    audioSleep();
  });
  window.addEventListener('focus', function () { if (AU.ctx && !document.hidden) audioWake(); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (G.mode === 'play' && G.S && G.S.state === 'play') setPaused(true);
      audioSleep();
    } else if (AU.ctx && document.hasFocus()) audioWake();
  });
}

function bindPad() {
  const d = $('dpad'), ab = $('ab');
  const dp = new Map(), ap = new Map();
  const updD = function () {
    touch.l = 0; touch.r = 0;
    dp.forEach(function (v) { if (v < 0) touch.l = 1; else touch.r = 1; });
    d.dataset.on = touch.l ? 'l' : touch.r ? 'r' : '';
  };
  const setD = function (e) {
    const r = d.getBoundingClientRect(), was = dp.get(e.pointerId), v = (e.clientX - r.left) < r.width / 2 ? -1 : 1;
    dp.set(e.pointerId, v); updD();
    if (was !== v) uiAction(v < 0 ? 'left' : 'right');
  };
  d.addEventListener('pointerdown', function (e) { e.preventDefault(); try { d.setPointerCapture(e.pointerId); } catch (x) {} audioWake(); setD(e); });
  d.addEventListener('pointermove', function (e) { if (dp.has(e.pointerId)) setD(e); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { d.addEventListener(n, function (e) { dp.delete(e.pointerId); updD(); }); });
  const updA = function () {
    touch.jump = 0; touch.run = 0;
    ap.forEach(function (v) { if (v & 1) touch.run = 1; if (v & 2) touch.jump = 1; });
    ab.dataset.on = (touch.run ? 'b' : '') + (touch.jump ? 'a' : '');
  };
  const setA = function (e, first) {
    const r = ab.getBoundingClientRect(), k = (e.clientX - r.left) / r.width;
    const v = k < 0.4 ? 1 : k > 0.6 ? 2 : 3, was = ap.get(e.pointerId) || 0;
    ap.set(e.pointerId, v); updA();
    if ((v & 2) && !(was & 2)) uiAction('ok');
  };
  ab.addEventListener('pointerdown', function (e) { e.preventDefault(); try { ab.setPointerCapture(e.pointerId); } catch (x) {} audioWake(); setA(e, true); });
  ab.addEventListener('pointermove', function (e) { if (ap.has(e.pointerId)) setA(e, false); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { ab.addEventListener(n, function (e) { ap.delete(e.pointerId); updA(); }); });
}

function useTouchUI(on) {
  if (G.touchUI === on) return;
  G.touchUI = on;
  const p = $('pad');
  if (p) p.hidden = !on;
  resize();
}

function toggleMusic() {
  save.music = !save.music; setMusic(save.music); storeSave();
  const b = $('bMusic'); if (b) b.setAttribute('aria-pressed', save.music ? 'true' : 'false');
}
function toggleSfx() {
  save.sfx = !save.sfx; setSfx(save.sfx); storeSave();
  const b = $('bSound'); if (b) b.setAttribute('aria-pressed', save.sfx ? 'true' : 'false');
  if (save.sfx) sfx('coin');
}

function bindUI() {
  const stage = $('stage');
  cv.addEventListener('pointerdown', function (e) {
    audioWake();
    if (e.pointerType === 'touch') {
      useTouchUI(true);
      // on a phone held sideways, bring the screen fully into view
      if (stage.classList.contains('overlay') && !document.fullscreenElement) { try { stage.scrollIntoView({ block: 'center' }); } catch (x) {} }
    }
    if (G.mode === 'title' && save.max > 0) {
      // the stage picker's arrows can be tapped
      const r = cv.getBoundingClientRect(), gx = (e.clientX - r.left) / r.width * VW, gy = (e.clientY - r.top) / r.height * VH;
      const my = Math.round(VH * 0.62);
      if (gy > my - 8 && gy < my + 14) { uiAction(gx < VW / 2 ? 'left' : 'right'); return; }
    }
    if (G.mode === 'play' && !G.paused) return;
    uiAction('ok');
  });
  const click = function (id, fn) {
    const b = $(id);
    if (b) b.addEventListener('click', function () { audioWake(); fn(); b.blur(); });
  };
  click('bPause', function () { uiAction('pause'); });
  click('bMusic', toggleMusic);
  click('bSound', toggleSfx);
  const bf = $('bFull');
  if (bf) {
    if (!stage.requestFullscreen || document.fullscreenEnabled === false) bf.hidden = true;
    else click('bFull', function () {
      if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen().catch(function () {}); }
      else { const p = stage.requestFullscreen(); if (p && p.catch) p.catch(function () { bf.hidden = true; }); }
    });
  }
  document.addEventListener('fullscreenchange', function () { setTimeout(resize, 30); });
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });
  if (window.ResizeObserver) new ResizeObserver(function () { resize(); }).observe(stage.parentNode);
  $('bMusic').setAttribute('aria-pressed', save.music ? 'true' : 'false');
  $('bSound').setAttribute('aria-pressed', save.sfx ? 'true' : 'false');
  try {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    REDUCE_MOTION = mq.matches;
    if (mq.addEventListener) mq.addEventListener('change', function () { REDUCE_MOTION = mq.matches; });
  } catch (e) { REDUCE_MOTION = false; }
}

// the little pictures in the field guide are the game's own sprites
function paintGuide() {
  const list = document.querySelectorAll('canvas[data-s]');
  const D = Math.ceil(Math.max(1, window.devicePixelRatio || 1)), K = 3;
  for (let i = 0; i < list.length; i++) {
    const c = list[i], n = c.getAttribute('data-s');
    const im = n === 'block' ? TILESET.meadow.bonus[0] : n === 'crate' ? TILESET.meadow.brick : SPR[n];
    if (!im) continue;
    c.width = im.width * K * D; c.height = im.height * K * D;
    c.style.width = (im.width * K) + 'px'; c.style.height = (im.height * K) + 'px';
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(im, 0, 0, c.width, c.height);
  }
}

/* ---------- start ---------- */

let lastT = 0, acc = 0, dtAvg = STEP, FROZEN = false;
function frame(now) {
  requestAnimationFrame(frame);
  if (FROZEN) { lastT = now; return; }       // a test is stepping the game by hand
  let dt = now - lastT;
  lastT = now;
  if (dt > 250) dt = 250;                 // came back from another tab: do not fast-forward
  if (dt < 0) dt = 0;
  if (dt > 3 && dt < 60) dtAvg += (dt - dtAvg) * 0.05;
  let n = 0, alpha = 1;
  if (Math.abs(dtAvg - STEP) < 1.1) {
    // a 60 Hz screen: exactly one tick per picture, shown as it is (no added delay);
    // only a real hitch (a missed picture) gets extra ticks to catch up
    n = Math.max(1, Math.min(5, Math.round(dt / STEP)));
    acc = 0;
  } else {
    // any other screen: fixed ticks, and pictures blended between the last two for smooth motion
    acc += dt;
    while (acc >= STEP && n < 6) { acc -= STEP; n++; }
    if (n === 6) acc = 0;
    alpha = acc / STEP;
  }
  for (let i = 0; i < n; i++) tick();
  draw(alpha);
}

function start(data) {
  cv = $('game'); cx = cv.getContext('2d', { alpha: false });
  loadSave();
  AU.musicOn = save.music; AU.sfxOn = save.sfx;
  buildArt();
  COIN_FR = [SPR.coin0, SPR.coin1, SPR.coin2, SPRL.coin1];
  bindKeys(); bindPad(); bindUI();
  paintGuide();
  let coarse = false;
  try { coarse = window.matchMedia('(pointer: coarse)').matches; } catch (e) { coarse = false; }
  if (coarse) useTouchUI(true);
  G.sel = save.max;
  toTitle();
  // carry on where things were if the page was updated while open
  if (data && typeof data.li === 'number' && data.mode && data.mode !== 'title' && data.mode !== 'ending') {
    G.lives = Math.max(1, data.lives | 0); G.score = data.score | 0; G.coins = data.coins | 0; G.power = 0; G.gems = [0, 0, 0];
    startStage(Math.max(0, Math.min(LEVELS.length - 1, data.li | 0)), 0);
  }
  resize();
  lastT = performance.now();
  requestAnimationFrame(frame);
}

const HOT = window.claude && window.claude.hot;
if (HOT && HOT.snapshot) HOT.snapshot(function () { return { li: G.li, lives: G.lives, score: G.score, coins: G.coins, mode: G.mode }; });
window.__tobi = { G: G, LEVELS: LEVELS, save: save, FX: FX, AU: AU, api: { TS: TS, SOLID: SOLID, newSim: newSim, cloneSim: cloneSim, step: step },
  keys: keys, uiAction: uiAction, view: function () { return { Z: Z, VW: VW, VH: VH }; },
  audio: { SONGS: SONGS, SFX: SFX, playNote: playNote, parseTrack: parseTrack, MUS_GAIN: MUS_GAIN, SFX_GAIN: SFX_GAIN },
  setInput: function (fn) { TEST_INPUT = fn; },
  freeze: function (on) { FROZEN = !!on; },
  advance: function (n) { for (let i = 0; i < n; i++) tick(); draw(1); },
  // for testing: a picture of a whole stage
  overview: function (li) {
    const L = LEVELS[li], keep = [cv, cx, Z, VW, VH];
    const c = mk(L.W * TS, L.H * TS);
    cv = c; cx = c.getContext('2d'); Z = 1; VW = c.width; VH = c.height;
    const S = newSim(L, { vw: VW, vh: VH });
    for (let i = 0; i < S.ents.length; i++) S.ents[i].on = 1;
    S.camX = 0; S.camY = 0; S.ocx = 0; S.ocy = 0;
    FX.rain.length = 0; FX.parts.length = 0;
    drawWorld(S, 1);
    cv = keep[0]; cx = keep[1]; Z = keep[2]; VW = keep[3]; VH = keep[4];
    return c.toDataURL('image/png');
  },
  // for testing: drop straight into a stage
  startAt: function (li, o) {
    o = o || {};
    G.lives = 3; G.score = 0; G.coins = 0; G.power = o.power ? 1 : 0; G.li = li; G.fromCp = o.fromCp | 0; G.gems = [0, 0, 0];
    beginPlay(); G.iris = null;
    return G.S;
  } };
if (HOT && HOT.ready) HOT.ready(start); else start((HOT && HOT.data) || {});
