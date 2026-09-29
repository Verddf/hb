'use strict';

// Unified input: keyboard, on-screen touch buttons and gamepads all feed the
// same set of actions. Presses are latched so that a very quick tap between
// two simulation steps is never lost.
const Input = (() => {
  const ACTIONS = ['left', 'right', 'down', 'jump', 'run', 'start', 'pause', 'mute'];
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowDown: 'down', KeyS: 'down',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
    ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run', KeyJ: 'run',
    Enter: 'start', NumpadEnter: 'start',
    KeyP: 'pause', Escape: 'pause',
    KeyM: 'mute',
  };

  const keys = {};
  const touch = {};
  const latch = {};
  let prev = {};
  const state = {};
  const pressed = {};
  ACTIONS.forEach(a => { state[a] = false; pressed[a] = false; });

  window.addEventListener('keydown', e => {
    const a = KEYMAP[e.code];
    Sound.unlock();
    if (!a) return;
    e.preventDefault();
    if (!keys[e.code]) latch[a] = true;
    keys[e.code] = true;
  });
  window.addEventListener('keyup', e => {
    if (!KEYMAP[e.code]) return;
    e.preventDefault();
    keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    for (const k in touch) touch[k] = false;
  });

  // ---- touch controls -------------------------------------------------
  let touchUI = null;
  function setupTouch(root) {
    touchUI = root;
    const buttons = [...root.querySelectorAll('[data-action]')];
    const show = () => root.classList.remove('hidden');
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) show();

    // Recompute every held button from all active touches, so sliding a
    // thumb from one button to another behaves naturally.
    function sync(e) {
      e.preventDefault();
      Sound.unlock();
      show();
      const held = {};
      for (const t of e.touches) {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        const btn = el && el.closest && el.closest('[data-action]');
        if (btn) held[btn.dataset.action] = true;
      }
      for (const b of buttons) {
        const a = b.dataset.action;
        const on = !!held[a];
        if (on && !touch[a]) latch[a] = true;
        touch[a] = on;
        b.classList.toggle('on', on);
      }
    }
    root.addEventListener('touchstart', sync, { passive: false });
    root.addEventListener('touchmove', sync, { passive: false });
    root.addEventListener('touchend', sync, { passive: false });
    root.addEventListener('touchcancel', sync, { passive: false });
  }

  // Tapping the game screen itself acts as "start" (menus) — handy on phones.
  function tapToStart(el) {
    const go = e => {
      Sound.unlock();
      if (e.type === 'touchstart' && touchUI) touchUI.classList.remove('hidden');
      latch.start = true;
    };
    el.addEventListener('touchstart', go, { passive: true });
    el.addEventListener('mousedown', go);
  }

  // ---- gamepad ---------------------------------------------------------
  function readPad(cur) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const b = i => p.buttons[i] && p.buttons[i].pressed;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (ax < -0.4 || b(14)) cur.left = true;
      if (ax > 0.4 || b(15)) cur.right = true;
      if (ay > 0.6 || b(13)) cur.down = true;
      if (b(0) || b(12)) cur.jump = true;
      if (b(1) || b(2)) cur.run = true;
      if (b(9)) cur.pause = true;
      if (b(9) || b(8)) cur.start = true;
    }
  }

  function poll() {
    const cur = {};
    ACTIONS.forEach(a => { cur[a] = false; });
    for (const code in keys) if (keys[code]) cur[KEYMAP[code]] = true;
    for (const a in touch) if (touch[a]) cur[a] = true;
    readPad(cur);
    ACTIONS.forEach(a => {
      state[a] = cur[a];
      pressed[a] = (cur[a] && !prev[a]) || !!latch[a];
      latch[a] = false;
    });
    prev = cur;
  }

  return { state, pressed, poll, setupTouch, tapToStart };
})();
