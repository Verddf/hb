'use strict';

// ---------------------------------------------------------------------------
// Core constants
// ---------------------------------------------------------------------------
const TILE = 16;          // tile size in pixels
const VIEW_W = 384;       // internal resolution (24 tiles wide)
const VIEW_H = 240;       // 15 tiles tall
const ROWS = 15;          // every level is 15 tiles tall
const STEP = 1 / 60;      // fixed simulation step

// Movement tuning. Units are pixels and seconds.
// Rising while jump is held uses a light gravity; letting go early switches
// to a heavy one. That gives the classic "hold for a high jump, tap for a
// hop" feel.
const PHYS = {
  gravityRise: 1150,    // rising, jump held
  gravityCut: 3400,     // rising, jump released
  gravityFall: 1900,    // falling
  maxFall: 430,
  walkMax: 96,
  runMax: 162,
  accelWalk: 360,
  accelRun: 420,
  accelAir: 300,
  friction: 420,
  skid: 1000,
  jumpVel: 415,
  jumpRunBonus: 40,     // extra launch speed at full run
  coyoteTime: 0.08,     // grace period to jump after walking off a ledge
  jumpBuffer: 0.12,     // jump pressed slightly before landing still counts
  stompBounce: 250,
  stompBounceHeld: 400,
  enemyGravity: 1500,
};

// Points for consecutive stomps without touching the ground. Past the end
// of the table every stomp is worth an extra life.
const COMBO_SCORES = [100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, 8000];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const approach = (v, target, amt) =>
  v < target ? Math.min(v + amt, target) : Math.max(v - amt, target);

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Deterministic pseudo random generator so procedural art is stable.
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return (s % 100000) / 100000;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// localStorage can throw (private mode, blocked storage) so wrap every access.
const Store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  },
};
