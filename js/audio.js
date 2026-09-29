'use strict';

// All sound is synthesised with the Web Audio API: no audio files needed.
// Browsers only allow audio after a user gesture, so unlock() is called from
// the input handlers.
const Sound = (() => {
  let ctx = null;
  let master, sfxBus, musicBus, noiseBuf;
  let muted = Store.get('kiko-muted', false);

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC(); } catch (e) { return; }
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.9;
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.4;
      musicBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      if (pending) { const p = pending; pending = null; playMusic(p.name, p.rate); }
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function toggleMute() {
    muted = !muted;
    Store.set('kiko-muted', muted);
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
    return muted;
  }

  // A single enveloped oscillator blip.
  function tone(freq, dur, o = {}) {
    if (!ctx) return;
    const t0 = (o.at !== undefined ? o.at : ctx.currentTime) + (o.delay || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t0 + dur);
    const g = ctx.createGain();
    const vol = o.vol !== undefined ? o.vol : 0.1;
    if (o.sustain) {
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
      g.gain.setValueAtTime(vol, t0 + Math.max(0.01, dur - 0.04));
      g.gain.linearRampToValueAtTime(0, t0 + dur);
    } else {
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    }
    osc.connect(g).connect(o.bus || sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, o = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.value = o.freq || 2000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  const seq = (notes, step, o = {}) =>
    notes.forEach((f, i) => { if (f) tone(f, o.len || step * 1.1, { ...o, delay: (o.delay || 0) + i * step }); });

  const SFX = {
    jump: () => tone(250, 0.17, { slide: 640, vol: 0.08 }),
    jumpBig: () => tone(180, 0.2, { slide: 470, vol: 0.09 }),
    coin: () => { tone(988, 0.07, { vol: 0.07 }); tone(1319, 0.3, { vol: 0.07, delay: 0.07 }); },
    stomp: () => { tone(440, 0.12, { slide: 110, vol: 0.12 }); noise(0.06, { vol: 0.1, freq: 1400 }); },
    kick: () => { tone(880, 0.05, { vol: 0.09 }); tone(587, 0.08, { vol: 0.09, delay: 0.04 }); },
    bump: () => tone(150, 0.1, { type: 'triangle', vol: 0.3, slide: 80 }),
    brick: () => { noise(0.28, { vol: 0.28, freq: 2600 }); tone(220, 0.12, { type: 'triangle', vol: 0.25, slide: 60 }); },
    sprout: () => seq([392, 523, 659, 784, 1047], 0.05, { vol: 0.06 }),
    powerup: () => seq([523, 659, 784, 1047, 659, 784, 1047, 1319, 784, 1047, 1319, 1568], 0.04, { vol: 0.07 }),
    shrink: () => seq([784, 587, 523, 392, 330, 262], 0.06, { vol: 0.08, type: 'triangle' }),
    fireball: () => tone(1400, 0.07, { slide: 250, vol: 0.06 }),
    oneup: () => seq([660, 880, 1320, 1100, 1480, 1760], 0.08, { vol: 0.07 }),
    die: () => seq([988, 932, 880, 0, 698, 659, 587, 0, 440, 415, 392], 0.1, { vol: 0.08, len: 0.1 }),
    flag: () => tone(1200, 1.0, { slide: 200, vol: 0.05, type: 'square' }),
    clear: () => {
      seq([523, 659, 784, 1047, 784, 1047, 1319], 0.11, { vol: 0.07, sustain: true, len: 0.1 });
      seq([131, 165, 196, 262, 196, 262, 330], 0.11, { vol: 0.12, type: 'triangle', sustain: true, len: 0.1 });
      tone(1568, 0.6, { vol: 0.07, delay: 0.8, sustain: true });
      tone(392, 0.6, { vol: 0.12, delay: 0.8, sustain: true, type: 'triangle' });
    },
    gameover: () => seq([523, 0, 392, 0, 330, 0, 440, 494, 440, 415, 466, 415, 392], 0.13, { vol: 0.07, sustain: true, len: 0.12 }),
    pause: () => seq([988, 784, 988, 784], 0.06, { vol: 0.06 }),
    tick: () => tone(1800, 0.03, { vol: 0.03 }),
    hurry: () => seq([1319, 1175, 1319, 1175, 1568], 0.07, { vol: 0.07 }),
    bossHit: () => { tone(300, 0.25, { slide: 70, vol: 0.14 }); noise(0.2, { vol: 0.2, freq: 900 }); },
    bossDie: () => { noise(0.9, { vol: 0.3, freq: 700 }); seq([392, 330, 262, 196, 131], 0.12, { vol: 0.1, type: 'sawtooth' }); },
    flame: () => noise(0.25, { vol: 0.15, freq: 900, filter: 'bandpass' }),
    crystal: () => seq([784, 988, 1175, 1568, 1976, 2349], 0.07, { vol: 0.06, type: 'triangle' }),
    checkpoint: () => seq([659, 784, 1047], 0.07, { vol: 0.07 }),
    splash: () => noise(0.35, { vol: 0.25, freq: 600 }),
    thud: () => { tone(90, 0.2, { type: 'triangle', vol: 0.3, slide: 40 }); noise(0.15, { vol: 0.15, freq: 400 }); },
  };

  function sfx(name) {
    if (!ctx || !SFX[name]) return;
    SFX[name]();
  }

  // ---------------------------------------------------------------------
  // Music: a tiny step sequencer. Each track is written as note tokens where
  // '-' holds the previous note and '.' is a rest. Every token is an eighth.
  // All melodies are original compositions for this game.
  // ---------------------------------------------------------------------
  const TRACKS = {
    title: {
      bpm: 118,
      lead: 'C5 - E5 - G5 - E5 - | F5 - A5 - C6 - A5 - | G5 - E5 - C5 - E5 - | D5 - - - G4 - - -',
      bass: 'C3 - - - G2 - - - | F2 - - - C3 - - - | C3 - - - A2 - - - | G2 - - - G2 - - -',
    },
    meadow: {
      bpm: 140,
      lead: 'E5 G5 C6 - G5 A5 G5 E5 | D5 - C5 D5 E5 - G4 - | F5 A5 C6 - A5 G5 F5 E5 | D5 E5 D5 C5 D5 - . . | ' +
            'E5 G5 C6 - G5 A5 G5 E5 | D5 - C5 D5 E5 - A5 - | G5 F5 E5 D5 C5 - D5 E5 | C5 - - - . . . .',
      bass: 'C3 . G3 . C3 . G3 . | G2 . D3 . G2 . D3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . B2 . | ' +
            'C3 . G3 . C3 . G3 . | A2 . E3 . A2 . E3 . | F2 . C3 . G2 . D3 . | C3 . G2 . C3 . . .',
    },
    cave: {
      bpm: 112,
      lead: 'A4 - C5 - E5 - D5 C5 | B4 - G4 - A4 - - - | A4 - C5 - E5 - G5 F5 | E5 - D5 - E5 - - - | ' +
            'F5 - E5 - D5 - C5 - | B4 - C5 - D5 - - - | C5 - B4 - A4 - G#4 - | A4 - - - . . . .',
      bass: 'A2 - - - E2 - - - | G2 - - - A2 - - - | A2 - - - E2 - - - | C3 - - - E2 - - - | ' +
            'D2 - - - A2 - - - | G2 - - - B2 - - - | A2 - - - E2 - - - | A2 - - - E2 - - -',
      leadWave: 'triangle',
      leadVol: 0.09,
    },
    sky: {
      bpm: 132,
      lead: 'D5 G5 B5 - A5 G5 D5 - | E5 G5 C6 - B5 A5 G5 - | B4 D5 G5 - F#5 E5 D5 - | C5 E5 A5 - G5 F#5 E5 D5 | ' +
            'D5 G5 B5 - A5 G5 D5 - | E5 G5 C6 - B5 A5 G5 - | A5 - B5 - C6 - A5 - | G5 - - - . . . .',
      bass: 'G2 . D3 . G2 . D3 . | C3 . G2 . C3 . G2 . | G2 . D3 . E2 . B2 . | A2 . E3 . D3 . A2 . | ' +
            'G2 . D3 . G2 . D3 . | C3 . G2 . C3 . G2 . | D3 . A2 . D3 . F#2 . | G2 . D3 . G2 . . .',
    },
    castle: {
      bpm: 156,
      lead: 'D5 - D5 F5 E5 - D5 C#5 | D5 - A4 - A#4 - A4 - | D5 - D5 F5 G5 - F5 E5 | F5 - E5 - D5 - - - | ' +
            'A5 - G5 F5 E5 - F5 G5 | A5 - D5 - E5 - C#5 - | D5 - F5 - E5 - C#5 - | D5 - - - . . . .',
      bass: 'D2 D3 D2 D3 D2 D3 D2 D3 | A#1 A#2 A#1 A#2 A1 A2 A1 A2 | D2 D3 D2 D3 G1 G2 G1 G2 | A1 A2 A1 A2 D2 D3 D2 D3 | ' +
            'F2 F3 F2 F3 C2 C3 C2 C3 | D2 D3 D2 D3 A1 A2 A1 A2 | A#1 A#2 A#1 A#2 A1 A2 A1 A2 | D2 D3 D2 D3 D2 . . .',
    },
    boss: {
      bpm: 172,
      lead: 'D5 D5 . D5 F5 . D5 . | C5 C5 . C5 D#5 . C5 . | D5 D5 . D5 F5 . G5 . | A5 - G5 - F5 - E5 -',
      bass: 'D2 D3 D2 D3 D2 D3 D2 D3 | C2 C3 C2 C3 C2 C3 C2 C3 | D2 D3 D2 D3 D2 D3 D2 D3 | A1 A2 A1 A2 A1 A2 C#2 C#3',
    },
    star: {
      bpm: 190,
      lead: 'C5 C5 C5 . C5 . C5 D5 | E5 E5 E5 . E5 . D5 C5 | D5 D5 D5 . D5 . D5 E5 | F5 - E5 - D5 - B4 -',
      bass: 'C3 G3 C3 G3 C3 G3 C3 G3 | A2 E3 A2 E3 A2 E3 A2 E3 | F2 C3 F2 C3 F2 C3 F2 C3 | G2 D3 G2 D3 G2 D3 G2 D3',
    },
    victory: {
      bpm: 126,
      lead: 'C5 E5 G5 C6 - - G5 - | A5 - F5 - C6 - - - | B5 - G5 - D6 - B5 - | C6 - - - - - . .',
      bass: 'C3 - G2 - C3 - G2 - | F2 - C3 - F2 - C3 - | G2 - D3 - G2 - D3 - | C3 - G2 - C3 - . .',
    },
  };

  const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteFreq(tok) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(tok);
    if (!m) return 0;
    const n = NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    const midi = 12 * (parseInt(m[3], 10) + 1) + n;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function parseVoice(str) {
    const toks = str.split(/\s+/).filter(t => t && t !== '|');
    const events = new Array(toks.length).fill(null);
    let last = -1;
    toks.forEach((t, i) => {
      if (t === '-') { if (last >= 0) events[last].len++; }
      else if (t === '.') { last = -1; }
      else { events[i] = { f: noteFreq(t), len: 1 }; last = i; }
    });
    return { events, len: toks.length };
  }

  const compiled = {};
  for (const [name, t] of Object.entries(TRACKS)) {
    compiled[name] = {
      step: 60 / t.bpm / 2,
      voices: [
        { ...parseVoice(t.lead), wave: t.leadWave || 'square', vol: t.leadVol || 0.055 },
        { ...parseVoice(t.bass), wave: 'triangle', vol: 0.14 },
      ],
    };
  }

  let current = null, currentName = null, timer = null, stepIdx = 0, nextTime = 0, rate = 1, pending = null;

  function schedule() {
    if (!ctx || !current) return;
    while (nextTime < ctx.currentTime + 0.15) {
      const stepDur = current.step / rate;
      for (const v of current.voices) {
        const ev = v.events[stepIdx % v.len];
        if (ev && ev.f) tone(ev.f, ev.len * stepDur * 0.92, { at: nextTime, type: v.wave, vol: v.vol, sustain: true, bus: musicBus });
      }
      nextTime += stepDur;
      stepIdx++;
    }
  }

  function playMusic(name, r = 1) {
    if (!ctx) { pending = { name, rate: r }; return; }
    if (currentName === name && timer && rate === r) return;
    stopMusic();
    current = compiled[name];
    currentName = name;
    if (!current) return;
    rate = r;
    stepIdx = 0;
    nextTime = ctx.currentTime + 0.08;
    timer = setInterval(schedule, 25);
    schedule();
  }

  function stopMusic() {
    pending = null;
    if (timer) clearInterval(timer);
    timer = null;
    current = null;
    currentName = null;
  }

  function pauseMusic() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function resumeMusic() {
    if (!ctx || !current || timer) return;
    nextTime = ctx.currentTime + 0.08;
    timer = setInterval(schedule, 25);
  }

  return {
    unlock, sfx, playMusic, stopMusic, pauseMusic, resumeMusic, toggleMute,
    get muted() { return muted; },
    get music() { return currentName; },
  };
})();
