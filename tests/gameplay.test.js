'use strict';

// End-to-end gameplay checks in a real browser. The game's own animation
// loop is paused and the simulation is stepped manually with synthetic key
// presses, so every scenario is deterministic.
//
// Requires Playwright (npm install). Skips itself when it is not available.
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* optional */ }

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, () => resolve(server)));
}

// Installed into the page: helpers to drive the game frame by frame.
function installHarness() {
  const step = game.update.bind(game);
  game.update = () => {};   // stop the real-time loop
  const held = new Set();
  const key = (code, down) => {
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
    if (down) held.add(code); else held.delete(code);
  };
  window.T = {
    step(n = 1) { for (let i = 0; i < n; i++) step(STEP); },
    down(code) { key(code, true); },
    up(code) { key(code, false); },
    releaseAll() { [...held].forEach(c => key(c, false)); T.step(1); },
    hold(code, n) { key(code, true); T.step(n); key(code, false); },
    stepUntil(fn, max = 600) {
      for (let i = 0; i < max; i++) { if (fn()) return i; T.step(1); }
      return -1;
    },
    // Start a stage straight into gameplay (skipping the intro card).
    start(levelIndex, size = 'small') {
      T.releaseAll();
      game.startLevel = levelIndex;
      game.newGame();
      game.carrySize = size;
      game.loadLevel(levelIndex);
      game.setState('play');
      T.step(2);
    },
    // Put Kiko standing in tile (tx, ty).
    place(tx, ty) {
      const p = game.player;
      p.x = tx * TILE + 2;
      p.y = (ty + 1) * TILE - p.h;
      p.vx = 0;
      p.vy = 0;
      game.cam.x = clamp(p.x - 130, 0, game.level.pxW - VIEW_W);
      T.step(2);
    },
    find(type) { return game.enemies.find(e => e.constructor.name === type); },
  };
}

const run = chromium ? test : test.skip;
let server, browser, page;

test.before(async () => {
  if (!chromium) return;
  server = await serve();
  const opts = {};
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  browser = await chromium.launch(opts);
  page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.errors = errors;
  await page.goto(`http://localhost:${server.address().port}/index.html`);
  await page.waitForFunction(() => window.game && SPR.kiko);
  await page.evaluate(installHarness);
});

test.after(async () => {
  if (browser) await browser.close();
  if (server) server.close();
});

const inPage = fn => page.evaluate(fn);

run('the page loads without script errors', async () => {
  assert.deepStrictEqual(page.errors, []);
  assert.strictEqual(await inPage(() => game.state), 'title');
});

run('holding jump jumps higher than tapping it', async () => {
  const r = await inPage(() => {
    T.start(0);
    const p = game.player, y0 = p.y;
    let top = y0;
    T.down('KeyZ');
    for (let i = 0; i < 50; i++) { T.step(); top = Math.min(top, p.y); }
    T.up('KeyZ');
    T.stepUntil(() => p.onGround);
    const high = y0 - top;
    top = p.y;
    T.hold('KeyZ', 2);
    for (let i = 0; i < 50; i++) { T.step(); top = Math.min(top, p.y); }
    return { high, low: y0 - top };
  });
  assert.ok(r.high > 64 && r.high < 84, `full jump clears 4 tiles (${r.high}px)`);
  assert.ok(r.low < r.high * 0.55, `short hop (${r.low}px) is much lower than a full jump`);
});

run('running is faster than walking', async () => {
  const r = await inPage(() => {
    T.start(0);
    const p = game.player;
    T.down('ArrowRight');
    T.step(60);
    const walk = p.vx;
    T.down('ShiftLeft');
    T.step(60);
    const runV = p.vx;
    T.releaseAll();
    return { walk, runV };
  });
  assert.ok(Math.abs(r.walk - 96) < 1, `walk speed ${r.walk}`);
  assert.ok(Math.abs(r.runV - 162) < 1, `run speed ${r.runV}`);
});

run('coin blocks give coins and become used', async () => {
  const r = await inPage(() => {
    T.start(0);
    T.place(14, 12);
    T.hold('KeyZ', 30);
    T.step(30);
    return { tile: game.level.tile(14, 9), coins: game.coins, score: game.score };
  });
  assert.strictEqual(r.tile, 'u');
  assert.strictEqual(r.coins, 1);
  assert.ok(r.score >= 200);
});

run('a berry makes Kiko big, and big Kiko breaks bricks', async () => {
  const r = await inPage(() => {
    T.start(0);
    game.enemies = [];
    T.place(23, 12);
    T.hold('KeyZ', 30);
    T.stepUntil(() => game.items.length && game.items[0].emerge <= 0);
    const item = game.items[0], p = game.player;
    const kind = item.kind;
    p.x = item.x;
    p.y = item.y + item.h - p.h;
    T.step(1);
    const frozen = game.freeze > 0;
    T.step(60);
    const size = p.size, h = p.h;
    T.place(20, 12);
    T.hold('KeyZ', 30);
    T.step(20);
    return { kind, frozen, size, h, brick: game.level.tile(20, 9) };
  });
  assert.strictEqual(r.kind, 'berry');
  assert.ok(r.frozen, 'growing briefly freezes the action');
  assert.strictEqual(r.size, 'big');
  assert.strictEqual(r.h, 28);
  assert.strictEqual(r.brick, '.');
});

run('stomping a grumble squashes it and bounces Kiko', async () => {
  const r = await inPage(() => {
    T.start(0);
    const g = T.find('Grumble'), p = game.player;
    g.active = true;
    p.x = g.x;
    p.y = g.y - p.h - 12;
    p.vy = 120;
    T.stepUntil(() => g.flat, 30);
    return { flat: g.flat, vy: p.vy, score: game.score, state: game.state };
  });
  assert.ok(r.flat);
  assert.ok(r.vy < 0, 'bounced upward');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.state, 'play');
});

run('touching an enemy shrinks big Kiko and defeats small Kiko', async () => {
  const r = await inPage(() => {
    T.start(0, 'big');
    const g = T.find('Grumble'), p = game.player;
    g.active = true;
    T.place(Math.floor(g.x / TILE) - 1, 12);
    p.x = g.x - p.w + 2;
    T.step(1);
    T.step(60);
    const afterHit = { size: p.size, invuln: p.invuln > 0, state: game.state };
    T.start(0);
    const g2 = T.find('Grumble');
    g2.active = true;
    game.player.x = g2.x - 10;
    game.player.y = g2.y + g2.h - game.player.h;
    T.step(2);
    return { afterHit, state: game.state };
  });
  assert.strictEqual(r.afterHit.size, 'small');
  assert.ok(r.afterHit.invuln);
  assert.strictEqual(r.afterHit.state, 'play');
  assert.strictEqual(r.state, 'dying');
});

run('snail shells can be kicked into other enemies', async () => {
  const r = await inPage(() => {
    T.start(0);
    const s = T.find('Snail'), p = game.player;
    s.active = true;
    p.x = s.x;
    p.y = s.y - p.h - 8;
    p.vy = 150;
    T.stepUntil(() => s.state !== 'walk', 30);
    const afterStomp = s.state;
    // Step away so Kiko doesn't land on the shell again.
    T.place(Math.floor(s.x / TILE) - 3, 12);
    const resting = s.state;
    // Walk into the resting shell to kick it, with a grumble waiting ahead.
    const g = T.find('Grumble');
    g.active = true;
    g.x = s.x + 60;
    g.y = s.y;
    p.x = s.x - p.w - 1;
    p.y = s.y + s.h - p.h;
    p.vx = 40;
    T.down('ArrowRight');
    T.step(3);
    T.up('ArrowRight');
    const kicked = s.state;
    T.stepUntil(() => g.dying, 60);
    return { afterStomp, resting, kicked, grumbleDown: g.dying, state: game.state };
  });
  assert.strictEqual(r.afterStomp, 'shell');
  assert.strictEqual(r.resting, 'shell');
  assert.strictEqual(r.kicked, 'slide');
  assert.ok(r.grumbleDown, 'sliding shell knocks out enemies');
  assert.strictEqual(r.state, 'play');
});

run('fire Kiko throws fireballs that defeat enemies', async () => {
  const r = await inPage(() => {
    T.start(0, 'fire');
    const g = T.find('Grumble');
    g.active = true;
    T.place(Math.floor(g.x / TILE) - 5, 12);
    game.player.face = 1;
    T.hold('KeyX', 2);
    const thrown = game.fireballs.length;
    T.stepUntil(() => g.dying, 90);
    return { thrown, dying: g.dying };
  });
  assert.strictEqual(r.thrown, 1);
  assert.ok(r.dying);
});

run('hidden blocks reveal a 1-up heart', async () => {
  const r = await inPage(() => {
    T.start(0);
    T.place(56, 12);
    T.hold('KeyZ', 30);
    T.stepUntil(() => game.items.length && game.items[0].emerge <= 0, 60);
    const heart = game.items[0];
    const lives = game.lives, p = game.player;
    p.x = heart.x;
    p.y = heart.y + heart.h - p.h;
    T.step(2);
    return { tile: game.level.tile(56, 8), kind: heart.kind, gained: game.lives - lives };
  });
  assert.strictEqual(r.tile, 'u');
  assert.strictEqual(r.kind, 'heart');
  assert.strictEqual(r.gained, 1);
});

run('moving platforms carry Kiko', async () => {
  const r = await inPage(() => {
    T.start(1);
    const pl = game.platforms[0], p = game.player;
    T.step(30);
    p.x = pl.x + 12;
    p.y = pl.y - p.h;
    p.vy = 0;
    T.step(2);
    const off = p.x - pl.x;
    const x0 = p.x;
    T.step(90);
    return { onGround: p.onGround, drift: Math.abs((p.x - pl.x) - off), moved: p.x - x0, gap: Math.abs(p.y + p.h - pl.y) };
  });
  assert.ok(r.onGround);
  assert.ok(r.moved > 10, `carried ${r.moved}px`);
  assert.ok(r.drift < 1.5, `stays put on the platform (drift ${r.drift})`);
  assert.ok(r.gap < 1);
});

run('falling in a pit costs a life and restarts the stage', async () => {
  const r = await inPage(() => {
    T.start(0);
    const lives = game.lives;
    T.place(69, 5);
    T.stepUntil(() => game.state === 'dying', 120);
    const dying = game.state;
    T.stepUntil(() => game.state === 'intro', 300);
    return { dying, state: game.state, lost: lives - game.lives };
  });
  assert.strictEqual(r.dying, 'dying');
  assert.strictEqual(r.state, 'intro');
  assert.strictEqual(r.lost, 1);
});

run('checkpoints set the respawn point', async () => {
  const r = await inPage(() => {
    T.start(0);
    T.place(105, 12);
    const cp = game.checkpoint && game.checkpoint.x;
    game.killPlayer('hit');
    T.stepUntil(() => game.state === 'intro', 300);
    return { cp, respawnTile: Math.floor(game.player.x / TILE) };
  });
  assert.strictEqual(r.cp, 104);
  assert.strictEqual(r.respawnTile, 104);
});

run('spikes, lava and fire bars are dangerous', async () => {
  const r = await inPage(() => {
    T.start(1);
    T.place(69, 9);
    T.stepUntil(() => game.state !== 'play', 60);
    const spikes = game.state;
    T.start(3);
    T.place(18, 8);
    T.stepUntil(() => game.state !== 'play', 90);
    const lava = game.state;
    T.start(3, 'big');
    T.place(27, 12);
    T.stepUntil(() => game.player.size === 'small', 300);
    const bar = game.player.size;
    T.start(3);
    game.enemies = game.enemies.filter(e => e instanceof FireBar);
    T.place(27, 12);
    T.step(300);
    return { spikes, lava, bar, smallSafe: game.state };
  });
  assert.strictEqual(r.spikes, 'dying');
  assert.strictEqual(r.lava, 'dying');
  assert.strictEqual(r.bar, 'small', 'big Kiko gets clipped by the fire bar');
  assert.strictEqual(r.smallSafe, 'play', 'small Kiko can duck under it');
});

run('running out of time is fatal', async () => {
  const r = await inPage(() => {
    T.start(0);
    game.timeLeft = 1;
    T.step(30);
    return game.state;
  });
  assert.strictEqual(r, 'dying');
});

run('touching the flagpole clears the stage and moves on', async () => {
  const r = await inPage(() => {
    T.start(0);
    T.place(197, 12);
    T.down('ArrowRight');
    T.stepUntil(() => game.state === 'clear', 120);
    T.up('ArrowRight');
    const clear = game.state;
    const before = game.score;
    T.stepUntil(() => game.state === 'intro', 60 * 20);
    return { clear, state: game.state, level: game.levelIndex, gained: game.score - before };
  });
  assert.strictEqual(r.clear, 'clear');
  assert.strictEqual(r.state, 'intro');
  assert.strictEqual(r.level, 1);
  assert.ok(r.gained > 0, 'time bonus is added');
});

run('the boss takes three stomps, then the Sunstone wins the game', async () => {
  const r = await inPage(() => {
    T.start(3);
    T.place(140, 12);
    const p = game.player;
    p.invuln = 1e9;   // ignore boss fireballs for this test
    const b = T.find('Boss');
    T.stepUntil(() => b.active && b.started, 60);
    let stomps = 0;
    while (!b.dying && stomps < 5) {
      T.stepUntil(() => b.hurtT <= 0 && b.onGround, 300);
      p.x = b.cx - p.w / 2;
      p.y = b.y - p.h - 6;
      p.vy = 150;
      T.stepUntil(() => b.hurtT > 0 || b.dying, 20);
      stomps++;
    }
    const bossDown = b.dying;
    T.stepUntil(() => game.items.some(i => i.kind === 'crystal' && i.y >= i.targetY), 400);
    const c = game.items.find(i => i.kind === 'crystal');
    p.x = c.x;
    p.y = c.y;
    p.vy = 0;
    T.step(1);
    const cleared = game.state;
    T.stepUntil(() => game.state === 'victory', 60 * 20);
    return { stomps, bossDown, crystal: !!c, cleared, state: game.state };
  });
  assert.ok(r.bossDown);
  assert.strictEqual(r.stomps, 3);
  assert.ok(r.crystal);
  assert.strictEqual(r.cleared, 'clear');
  assert.strictEqual(r.state, 'victory');
});

run('losing the last life ends the game', async () => {
  const r = await inPage(() => {
    T.start(0);
    game.lives = 1;
    game.killPlayer('hit');
    T.stepUntil(() => game.state === 'gameover', 300);
    const over = game.state;
    T.step(60 * 7);
    return { over, after: game.state };
  });
  assert.strictEqual(r.over, 'gameover');
  assert.strictEqual(r.after, 'title');
});

run('no script errors happened during the scenarios', async () => {
  assert.deepStrictEqual(page.errors, []);
});
