/* ============================================================
   SOUND
   Effects and music are made on the spot from simple waves,
   the way an old game console did it. No audio files.
   ============================================================ */

const MUS_GAIN = 0.9, SFX_GAIN = 2.2;
const AU = { ctx: null, master: null, mus: null, sfx: null, musicOn: true, sfxOn: true,
  song: null, cur: '', want: '', pos: 0, next: 0, rate: 1, timer: 0, noise: null, last: {}, waking: false };

function audioWake() {
  if (!AU.ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = AU.ctx = new AC();
      AU.master = c.createGain(); AU.master.gain.value = 1;
      const comp = c.createDynamicsCompressor();          // only a safety net for the loudest moments
      comp.threshold.value = -10; comp.knee.value = 6; comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.15;
      AU.master.connect(comp); comp.connect(c.destination);
      AU.mus = c.createGain(); AU.mus.gain.value = AU.musicOn ? MUS_GAIN : 0; AU.mus.connect(AU.master);
      AU.sfx = c.createGain(); AU.sfx.gain.value = AU.sfxOn ? SFX_GAIN : 0; AU.sfx.connect(AU.master);
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      AU.noise = n;
      AU.timer = setInterval(musicTick, 30);
      if (AU.want) { const w = AU.want; AU.cur = ''; playSong(w); }
    } catch (e) { AU.ctx = null; }
  }
  if (AU.ctx && AU.ctx.state === 'suspended') {
    AU.waking = true;
    const done = function () { AU.waking = false; };
    AU.ctx.resume().then(done, done);
  }
}
// silence everything while the page is in the background or another window has the keyboard
function audioSleep() { if (AU.ctx && AU.ctx.state === 'running') AU.ctx.suspend().catch(function () {}); }
function setMusic(on) { AU.musicOn = on; if (AU.mus) AU.mus.gain.value = on ? MUS_GAIN : 0; }
function setSfx(on) { AU.sfxOn = on; if (AU.sfx) AU.sfx.gain.value = on ? SFX_GAIN : 0; }

/* ---------- effects ---------- */

function tone(type, f0, f1, dur, vol, delay) {
  const c = AU.ctx, t = c.currentTime + (delay || 0);
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(AU.sfx);
  o.start(t); o.stop(t + dur + 0.03);
}
function hiss(dur, vol, delay, hp, lp) {
  const c = AU.ctx, t = c.currentTime + (delay || 0);
  const s = c.createBufferSource(), g = c.createGain();
  s.buffer = AU.noise; s.loop = true;
  let node = s;
  if (hp) { const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
  if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  node.connect(g); g.connect(AU.sfx);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
}
function arp(type, freqs, each, vol, delay) {
  for (let i = 0; i < freqs.length; i++) tone(type, freqs[i], freqs[i], each * 1.7, vol, (delay || 0) + i * each);
}
const SFX = {
  jump: function () { tone('square', 290, 610, 0.17, 0.10); },
  land: function () { hiss(0.06, 0.12, 0, 0, 900); },
  coin: function () { tone('square', 988, 988, 0.07, 0.085); tone('square', 1319, 1319, 0.32, 0.085, 0.07); },
  bump: function () { tone('triangle', 190, 90, 0.11, 0.12); },
  bonk: function () { tone('square', 130, 95, 0.06, 0.09); },
  brk: function () { hiss(0.22, 0.11, 0, 500, 0); tone('square', 230, 60, 0.16, 0.05); },
  sprout: function () { arp('square', [392, 523, 659, 784, 1047], 0.045, 0.07); },
  power: function () { arp('square', [523, 659, 784, 1047, 1319, 1568], 0.06, 0.09); },
  hurt: function () { tone('sawtooth', 620, 110, 0.42, 0.11); },
  stomp: function () { tone('square', 540, 150, 0.12, 0.12); hiss(0.05, 0.08, 0, 0, 1500); },
  kick: function () { tone('square', 420, 820, 0.06, 0.07); tone('triangle', 220, 110, 0.08, 0.11, 0.02); },
  shell: function () { tone('triangle', 320, 150, 0.06, 0.1); },
  oneUp: function () { arp('square', [1047, 1319, 1568, 2093, 2637, 3136], 0.07, 0.08); },
  spring: function () { tone('square', 190, 950, 0.26, 0.10); },
  cp: function () { tone('triangle', 784, 784, 0.25, 0.11); tone('triangle', 1175, 1175, 0.5, 0.11, 0.12); },
  gem: function () { arp('triangle', [1568, 2093, 2637, 3136], 0.06, 0.1); },
  bell: function () { [1, 2, 2.76, 5.4].forEach(function (m, i) { tone('sine', 620 * m, 620 * m, 1.8 / (1 + i * 0.7), 0.08 / (1 + i)); }); },
  crush: function () { hiss(0.3, 0.12, 0, 0, 500); tone('triangle', 95, 40, 0.3, 0.18); },
  glide: function () { hiss(0.16, 0.05, 0, 1200, 0); },
  pause: function () { tone('square', 660, 660, 0.07, 0.08); tone('square', 440, 440, 0.1, 0.08, 0.07); },
  tick: function () { tone('square', 1250, 1250, 0.025, 0.045); },
  select: function () { tone('square', 700, 700, 0.05, 0.07); },
  hurry: function () { arp('square', [880, 1175, 880, 1175, 880, 1175], 0.07, 0.08); },
  ember: function () { tone('sawtooth', 160, 420, 0.2, 0.035); },
  drop: function () { tone('triangle', 300, 120, 0.2, 0.1); },
  thunder: function () { hiss(1.5, 0.5, 0, 0, 260); hiss(0.4, 0.2, 0, 0, 1200); },
  splash: function () { hiss(0.3, 0.1, 0, 700, 0); },
};
function sfx(name) {
  const c = AU.ctx;
  if (!c || !AU.sfxOn || (c.state !== 'running' && !AU.waking)) return;
  if (AU.last[name] && c.currentTime - AU.last[name] < 0.035) return;   // no machine-gun repeats
  AU.last[name] = c.currentTime;
  try { SFX[name](); } catch (e) {}
}

/* ---------- music ---------- */

const NOTE_IX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteHz(n) {
  let i = NOTE_IX[n[0]], k = 1;
  if (n[1] === '#') { i++; k = 2; } else if (n[1] === 'b') { i--; k = 2; }
  return 440 * Math.pow(2, (i - 9 + (+n.slice(k) - 4) * 12) / 12);
}
// "E5:2 G5 C6:4 -:2"  note:length in sixteenths; a missing length repeats the last; - is a rest
function parseTrack(tr) {
  const by = {};
  let at = 0, len = 2;
  tr.s.trim().split(/\s+/).forEach(function (tok) {
    const q = tok.split(':');
    if (q[1]) len = +q[1];
    if (q[0] !== '-') (by[at] || (by[at] = [])).push({ n: q[0], hz: tr.w === 'drum' ? 0 : noteHz(q[0]), len: len, v: 1 });
    at += len;
  });
  tr.len = at;
  if (tr.echo) {
    Object.keys(by).forEach(function (k) {
      const a = (+k + tr.echo) % at;
      by[k].slice().forEach(function (e) { if (e.v === 1) (by[a] || (by[a] = [])).push({ n: e.n, hz: e.hz, len: e.len, v: 0.35 }); });
    });
  }
  tr.by = by;
}

function bars(list) { return list.join(' '); }
function stabs(chords) {
  const ST = { C: ['E4', 'G4'], Am: ['E4', 'A4'], F: ['F4', 'A4'], G: ['D4', 'G4'], Dm: ['F4', 'A4'] };
  return chords.map(function (ch) {
    const p = ch.split('/'), a = ST[p[0]], b = ST[p[1] || p[0]];
    return '-:2 ' + a[0] + ':2 -:2 ' + a[1] + ':2 -:2 ' + b[0] + ':2 -:2 ' + b[1] + ':2';
  }).join(' ');
}
function walk4(chords) {
  const BS = { C: ['C3', 'G3'], Am: ['A2', 'E3'], F: ['F2', 'C3'], G: ['G2', 'D3'], Dm: ['D3', 'A2'] };
  return chords.map(function (ch) {
    const p = ch.split('/'), a = BS[p[0]], b = BS[p[1] || p[0]];
    return a[0] + ':4 ' + a[1] + ':4 ' + b[0] + ':4 ' + b[1] + ':4';
  }).join(' ');
}
const MEADOW_CH = ['C', 'Am', 'F', 'G', 'C', 'Am', 'F/G', 'C', 'F', 'C', 'F', 'G', 'Am', 'F', 'Dm/G', 'C'];

const SONGS = {
  meadow: { bpm: 132, loop: true, tracks: [
    { w: 'square', v: 0.085, s: bars([
      'E5:2 G5 C6:4 G5:2 E5 G5:4', 'A5:2 C6 E6:4 C6:2 A5 C6:4', 'A5:2 F5 A5 C6 D6:4 C6:2 A5', 'B5:2 G5 B5 D6 G5:4 -:4',
      'E5:2 G5 C6:4 E6:2 D6 C6:4', 'A5:2 C6 E6:4 G6:2 E6 C6:4', 'F5:2 A5 C6 A5 G5 B5 D6 B5', 'C6:6 G5:2 C6:4 -:4',
      'F5:4 A5 C6 A5', 'E5:4 G5 C6:6 -:2', 'F5:4 A5 D6 C6', 'B5:6 A5:2 G5:4 -:4',
      'A5:2 B5 C6:4 E6 C6', 'A5:2 C6 F6:4 E6:2 D6 C6:4', 'D6:2 F6 E6 D6 B5 D6 G5 B5', 'C6:8 -:8']) },
    { w: 'square', v: 0.04, s: stabs(MEADOW_CH) },
    { w: 'triangle', v: 0.2, s: walk4(MEADOW_CH) },
    { w: 'drum', v: 0.13, s: 'k:2 h s h k k s h' },
  ] },
  cave: { bpm: 104, loop: true, tracks: [
    { w: 'square', v: 0.07, echo: 3, s: bars([
      '-:4 E5:2 A5 -:4 C6:2 B5', 'A5:8 -:8', '-:4 F5:2 A5 -:4 C6:2 A5', 'G#5:6 B5:2 E5:8',
      '-:4 E5:2 A5 -:2 C6 E6 D6', 'C6:4 B5 A5:8', '-:4 F5:2 A5 C6:4 D6:2 C6', 'B5:4 G#5 E5:8']) },
    { w: 'triangle', v: 0.24, s: bars([
      'A2:2 -:2 A2:2 C3 -:2 E3:2 D3 C3', 'A2:2 -:2 A2:2 C3 -:2 E3:2 D3 C3',
      'F2:2 -:2 F2:2 A2 -:2 C3:2 A2 F2', 'E2:2 -:2 E2:2 G#2 -:2 B2:2 G#2 E2']) },
    { w: 'drum', v: 0.1, s: 'k:4 -:4 h:2 h -:4' },
  ] },
  sky: { bpm: 144, loop: true, tracks: [
    { w: 'square', v: 0.075, s: bars([
      'C6:4 A5:2 C6 F6:6 -:2', 'E6:4 C6:2 E6 G6:6 -:2', 'F6:4 D6:2 F6 A6:4 F6', 'D6:4 Bb5:2 D6 F6:4 D6',
      'C6:4 A5:2 C6 F6:4 A6', 'G6:6 E6:2 C6:4 E6', 'D6:2 F6 Bb6:4 C6:2 E6 G6:4', 'F6:8 -:8']) },
    { w: 'square', v: 0.035, s: bars([
      'F4:2 A4 C5 A4 F4 A4 C5 A4', 'E4:2 G4 C5 G4 E4 G4 C5 G4', 'D4:2 F4 A4 F4 D4 F4 A4 F4', 'D4:2 F4 Bb4 F4 D4 F4 Bb4 F4',
      'F4:2 A4 C5 A4 F4 A4 C5 A4', 'E4:2 G4 C5 G4 E4 G4 C5 G4', 'D4:2 F4 Bb4 F4 E4 G4 C5 G4', 'F4:2 A4 C5 A4 F4 A4 C5 A4']) },
    { w: 'triangle', v: 0.15, s: bars([
      'F2:6 F2:2 C3:4 F2', 'C3:6 C3:2 G2:4 C3', 'D3:6 D3:2 A2:4 D3', 'Bb2:6 Bb2:2 F2:4 Bb2',
      'F2:6 F2:2 C3:4 F2', 'C3:6 C3:2 G2:4 C3', 'Bb2:4 Bb2 C3 C3', 'F2:6 F2:2 C3:4 F2']) },
    { w: 'drum', v: 0.1, s: 'k:2 h h h s h h h' },
  ] },
  keep: { bpm: 152, loop: true, tracks: [
    { w: 'square', v: 0.075, echo: 2, s: bars([
      'D5:2 F5 A5:4 G5:2 F5 E5:4', 'F5:2 A5 D6:6 -:2 A5:4', 'Bb5:2 D6 F6:4 E6:2 D6 Bb5:4', 'A5:4 C#6 E6:6 -:2',
      'D6:2 C6 A5:4 F5:2 A5 D6:4', 'Bb5:2 A5 G5:4 Bb5:2 D6 G6:4', 'A5:2 C#6 E6 A6 G6 E6 C#6 A5', 'D6:8 -:8']) },
    { w: 'triangle', v: 0.2, s: bars([
      'D3:2 D3 D3 D3 D3 D3 F3 E3', 'D3:2 D3 D3 D3 D3 D3 F3 E3', 'Bb2:2 Bb2 Bb2 Bb2 Bb2 Bb2 D3 C3', 'A2:2 A2 A2 A2 A2 A2 C#3 E3',
      'D3:2 D3 D3 D3 D3 D3 F3 E3', 'G2:2 G2 G2 G2 G2 G2 Bb2 A2', 'A2:2 A2 A2 A2 A2 A2 C#3 E3', 'D3:2 D3 D3 D3 D3 D3 A2 D3']) },
    { w: 'drum', v: 0.13, s: 'k:2 h s k k h s h' },
  ] },
  sun: { bpm: 184, loop: true, tracks: [
    { w: 'square', v: 0.08, s: bars(['C6:2 E6 G6 C7 G6 E6 C6 E6', 'F5:2 A5 C6 F6 C6 A5 F5 A5', 'G5:2 B5 D6 G6 D6 B5 G5 B5', 'C6:2 E6 G6 C7 E7 C7 G6 E6']) },
    { w: 'triangle', v: 0.22, s: bars(['C3:4 C3 G3 C3', 'F2:4 F2 C3 F2', 'G2:4 G2 D3 G2', 'C3:4 G2 C3 C3']) },
    { w: 'drum', v: 0.13, s: 'k:2 h k h s h k h' },
  ] },
  clear: { bpm: 150, loop: false, tracks: [
    { w: 'square', v: 0.09, s: 'C5:2 E5 G5 C6:4 G5:2 C6 E6:6 -:2 D6:2 E6 F6 G6 C7:8' },
    { w: 'square', v: 0.05, s: 'E4:2 G4 C5 E5:4 C5:2 E5 G5:6 -:2 B4:2 C5 D5 E5 E5:8' },
    { w: 'triangle', v: 0.22, s: 'C3:6 C3:4 G2:4 C3:6 -:2 G2:8 C3:8' },
  ] },
  die: { bpm: 140, loop: false, tracks: [
    { w: 'square', v: 0.09, s: 'E5:2 C5 A4 F4 E4:6' },
    { w: 'triangle', v: 0.22, s: 'A2:8 E2:6' },
  ] },
  over: { bpm: 96, loop: false, tracks: [
    { w: 'square', v: 0.08, s: 'C5:4 G4 E4 A4:6 G4:2 F4:4 D4 C4:8' },
    { w: 'triangle', v: 0.22, s: 'C3:8 A2:8 F2:8 G2:4 C3:8' },
  ] },
};
SONGS.title = SONGS.meadow;
SONGS.ending = SONGS.sky;

function playSong(name, rate) {
  AU.want = name; AU.rate = rate || 1;
  if (!AU.ctx) return;                       // remembered; starts once sound is allowed
  if (AU.cur === name && AU.song) return;
  const s = SONGS[name];
  if (!s) { AU.song = null; AU.cur = ''; return; }
  if (!s.len) { s.len = 0; s.tracks.forEach(function (tr) { parseTrack(tr); s.len = Math.max(s.len, tr.len); }); }
  AU.song = s; AU.cur = name; AU.pos = 0; AU.next = AU.ctx.currentTime + 0.08;
}
function stopSong() { AU.song = null; AU.cur = ''; AU.want = ''; }
function songRate(r) { AU.rate = r; }

function musicTick() {
  const c = AU.ctx, s = AU.song;
  if (!c || !s || c.state !== 'running') return;
  if (AU.next < c.currentTime) AU.next = c.currentTime + 0.05;   // the tab was asleep
  const step = 15 / (s.bpm * AU.rate);
  while (AU.next < c.currentTime + 0.16) {
    if (AU.pos >= s.len) {
      if (s.loop) AU.pos = 0;
      else { AU.song = null; AU.cur = ''; return; }
    }
    for (let i = 0; i < s.tracks.length; i++) {
      const tr = s.tracks[i], evs = tr.by[AU.pos % tr.len];
      if (evs) for (let k = 0; k < evs.length; k++) playNote(tr, evs[k], AU.next, step);
    }
    AU.pos++; AU.next += step;
  }
}
function playNote(tr, e, t, step) {
  const c = AU.ctx, v = tr.v * e.v;
  if (tr.w === 'drum') {
    if (e.n === 'k') {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.11);
      g.gain.setValueAtTime(v * 1.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.connect(g); g.connect(AU.mus); o.start(t); o.stop(t + 0.15);
    } else {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), d = e.n === 's' ? 0.1 : 0.035;
      s.buffer = AU.noise; f.type = 'highpass'; f.frequency.value = e.n === 's' ? 1400 : 6500;
      g.gain.setValueAtTime(v * (e.n === 's' ? 0.8 : 0.4), t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      s.connect(f); f.connect(g); g.connect(AU.mus); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
    }
    return;
  }
  const o = c.createOscillator(), g = c.createGain(), d = Math.max(0.05, e.len * step * 0.92);
  o.type = tr.w; o.frequency.value = e.hz;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(v, t + 0.008);
  g.gain.linearRampToValueAtTime(v * 0.6, t + d * 0.7);
  g.gain.linearRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(AU.mus);
  o.start(t); o.stop(t + d + 0.02);
}
