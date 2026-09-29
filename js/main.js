'use strict';

(function main() {
  buildSprites();

  const canvas = document.getElementById('screen');
  const game = new Game(canvas);
  window.game = game;   // handy for debugging from the console

  Input.setupTouch(document.getElementById('touch'));
  Input.tapToStart(canvas);

  // Scale the 384x240 screen to fit the window. Integer scaling keeps pixels
  // perfectly square on large screens; small screens use whatever fits.
  function fit() {
    const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    const scale = s >= 3 ? Math.floor(s) : s;
    canvas.style.width = Math.floor(VIEW_W * scale) + 'px';
    canvas.style.height = Math.floor(VIEW_H * scale) + 'px';
  }
  window.addEventListener('resize', fit);
  fit();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.autoPause();
  });

  // Fixed-timestep simulation, rendered once per animation frame.
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    let steps = 0;
    while (acc >= STEP && steps < 8) {
      game.update(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 8) acc = 0;
    game.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
