'use strict';

const STAR_TIME = 10;
const START_LIVES = 3;

// Game states: title -> intro -> play -> (dying | clear) -> intro ... ->
// victory, or gameover when the last life is lost. 'pause' overlays play.
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'title';
    this.stateT = 0;
    this.time = 0;
    this.hiscore = Store.get('kiko-hiscore', 0);
    this.score = 0;
    this.coins = 0;
    this.lives = START_LIVES;
    this.levelIndex = 0;
    this.carrySize = 'small';
    this.checkpoint = null;
    this.cam = { x: 0 };
    this.shake = 0;
    this.freeze = 0;
    this.level = null;
    this.player = null;
    this.enemies = [];
    this.items = [];
    this.fireballs = [];
    this.platforms = [];
    this.effects = [];
    this.boss = null;
    this.clear = null;
    const params = new URLSearchParams(window.location.search);
    this.startLevel = clamp((parseInt(params.get('level'), 10) || 1) - 1, 0, LEVELS.length - 1);
    this.debug = params.has('debug');
    Sound.playMusic('title');
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  // ---------------------------------------------------------------------
  // Flow
  // ---------------------------------------------------------------------
  newGame() {
    this.score = 0;
    this.coins = 0;
    this.lives = START_LIVES;
    this.levelIndex = this.startLevel;
    this.carrySize = 'small';
    this.checkpoint = null;
    this.showIntro();
  }

  showIntro() {
    this.loadLevel(this.levelIndex);
    this.setState('intro');
    Sound.stopMusic();
  }

  toTitle() {
    this.setState('title');
    Sound.playMusic('title');
  }

  loadLevel(i) {
    const L = (this.level = new Level(i));
    this.enemies = [];
    this.items = [];
    this.fireballs = [];
    this.platforms = [];
    this.effects = [];
    for (const s of L.spawns) {
      if (s.type === 'platform') this.platforms.push(new MovingPlatform(this, s));
      else {
        const e = createSpawn(this, s);
        if (e) this.enemies.push(e);
      }
    }
    const cp = this.checkpoint && this.checkpoint.level === i ? this.checkpoint : null;
    if (cp) L.checkpoints.forEach(c => { if (c.x <= cp.x) c.reached = true; });
    const start = cp || L.startPos;
    this.player = new Player(this, start.x * TILE + 2, (start.y + 1) * TILE, this.carrySize);
    this.cam.x = clamp(this.player.x - VIEW_W * 0.35, 0, L.pxW - VIEW_W);
    this.timeLeft = L.time;
    this.timeAcc = 0;
    this.hurried = false;
    this.freeze = 0;
    this.shake = 0;
    this.boss = null;
    this.clear = null;
    this.flagY = L.flag ? (L.flag.y - 9) * TILE + 8 : 0;
  }

  levelMusic() {
    if (this.player && this.player.star > 0) return 'star';
    if (this.boss && !this.boss.dying) return 'boss';
    return THEMES[this.level.theme].music;
  }

  playLevelMusic() {
    Sound.playMusic(this.levelMusic(), this.timeLeft <= 100 ? 1.25 : 1);
  }

  nextLevel() {
    this.carrySize = this.player.size;
    this.checkpoint = null;
    this.levelIndex++;
    if (this.levelIndex >= LEVELS.length) {
      this.saveHiscore();
      this.setState('victory');
      Sound.playMusic('victory');
    } else {
      this.showIntro();
    }
  }

  saveHiscore() {
    if (this.score > this.hiscore) {
      this.hiscore = this.score;
      Store.set('kiko-hiscore', this.hiscore);
    }
  }

  autoPause() {
    if (this.state === 'play') {
      this.setState('pause');
      Sound.pauseMusic();
    }
  }

  // ---------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------
  update(dt) {
    Input.poll();
    this.time += dt;
    this.stateT += dt;
    const I = Input.pressed;
    if (I.mute) Sound.toggleMute();
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);

    switch (this.state) {
      case 'title':
        if (I.start || I.jump) this.newGame();
        break;
      case 'intro':
        if (this.stateT > 2.5) {
          this.setState('play');
          this.playLevelMusic();
        }
        break;
      case 'play':
        if (I.pause) {
          this.setState('pause');
          Sound.pauseMusic();
          Sound.sfx('pause');
          break;
        }
        this.updatePlay(dt);
        break;
      case 'pause':
        if (I.pause || I.start) {
          this.state = 'play';
          Sound.resumeMusic();
        }
        break;
      case 'dying':
        this.updateDying(dt);
        break;
      case 'clear':
        this.updateClear(dt);
        break;
      case 'gameover':
        if (this.stateT > 6 || (this.stateT > 1.5 && (I.start || I.jump))) this.toTitle();
        break;
      case 'victory':
        if (this.stateT > 3 && (I.start || I.jump)) this.toTitle();
        break;
    }
  }

  updatePlay(dt) {
    const p = this.player, L = this.level;

    // Growing / shrinking briefly freezes the action, like the classics.
    if (this.freeze > 0) {
      this.freeze -= dt;
      if (p.transform) p.transform.t += dt;
      if (this.freeze <= 0) p.transform = null;
      return;
    }

    this.timeAcc += dt;
    while (this.timeAcc >= 0.4) {
      this.timeAcc -= 0.4;
      this.timeLeft--;
      if (this.timeLeft === 100 && !this.hurried) {
        this.hurried = true;
        Sound.sfx('hurry');
        this.playLevelMusic();
      }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.killPlayer('time');
        return;
      }
    }

    L.update(dt);
    for (const pl of this.platforms) pl.update(dt);

    const I = Input.state, P = Input.pressed;
    p.update(dt, {
      left: I.left, right: I.right, down: I.down, jump: I.jump, run: I.run,
      jumpPressed: P.jump, runPressed: P.run,
    });
    if (this.state !== 'play') return;

    for (const e of this.enemies) {
      e.wake(this.cam.x);
      if (e.active) e.update(dt);
    }
    this.enemyInteractions();
    this.playerVsEnemies();
    if (this.state !== 'play') return;

    for (const f of this.fireballs) {
      f.update(dt);
      if (!f.dead) this.fireballHits(f);
    }
    for (const it of this.items) it.update(dt);
    this.collectItems();
    if (this.state !== 'play') return;

    for (const fx of this.effects) fx.update(dt);
    this.checkCheckpoints();
    this.checkFlag();
    this.updateCamera();
    this.cleanup();
  }

  updateCamera() {
    const p = this.player, L = this.level;
    const left = this.cam.x + VIEW_W * 0.35, right = this.cam.x + VIEW_W * 0.5;
    if (p.cx > right) this.cam.x += p.cx - right;
    else if (p.cx < left) this.cam.x -= left - p.cx;
    this.cam.x = clamp(this.cam.x, 0, L.pxW - VIEW_W);
  }

  cleanup() {
    this.enemies = this.enemies.filter(e => !e.dead);
    this.items = this.items.filter(i => !i.dead);
    this.fireballs = this.fireballs.filter(f => !f.dead);
    this.effects = this.effects.filter(f => !f.dead);
  }

  // ---------------------------------------------------------------------
  // Interactions
  // ---------------------------------------------------------------------
  enemyInteractions() {
    const list = this.enemies.filter(e => e.active && !e.dying && !e.dead);
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (a.dying || b.dying || !overlap(a, b)) continue;
        const aS = a.sliding, bS = b.sliding;
        if (aS && bS) {
          a.knock(-a.dir);
          b.knock(-b.dir);
          Sound.sfx('kick');
        } else if (aS || bS) {
          const shell = aS ? a : b, victim = aS ? b : a;
          if (!victim.shellKillable) continue;
          victim.knock(shell.dir);
          shell.combo++;
          this.addScore(COMBO_SCORES[Math.min(shell.combo + 1, COMBO_SCORES.length - 1)], victim.cx, victim.y);
          Sound.sfx('kick');
        } else if (a.walker && b.walker) {
          const d = a.cx < b.cx ? -1 : 1;
          a.dir = d;
          b.dir = -d;
        }
      }
    }
  }

  playerVsEnemies() {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.active || e.dying || e.dead) continue;
      const custom = e.hitsPlayer(p);
      if (custom !== null) {
        if (custom) p.hurt();
      } else if (overlap(p, e)) {
        if (p.star > 0 && e.starKillable) {
          e.knock(p.cx < e.cx ? 1 : -1);
          this.comboScore(p, e);
          Sound.sfx('kick');
        } else if (e.stompable && p.vy > 0 && p.prevBottom <= e.y + 8) {
          const award = e.onStomp(p);
          p.y = e.y - p.h;
          p.vy = -(Input.state.jump ? PHYS.stompBounceHeld : PHYS.stompBounce);
          p.jumping = true;
          p.onGround = false;
          Sound.sfx('stomp');
          if (award) this.comboScore(p, e);
        } else if (e.onTouch(p)) {
          // kicked a resting shell
        } else if (e.harmful && p.kickGrace <= 0) {
          p.hurt();
        }
      }
      if (this.state !== 'play' || this.freeze > 0) return;
    }
  }

  comboScore(p, e) {
    if (p.combo >= COMBO_SCORES.length) this.oneUp(e.cx, e.y);
    else this.addScore(COMBO_SCORES[p.combo], e.cx, e.y);
    p.combo++;
  }

  fireballHits(f) {
    for (const e of this.enemies) {
      if (!e.active || e.dying || e.dead || !overlap(f, e)) continue;
      if (e.hitByFire(f)) {
        f.explode();
        return;
      }
    }
  }

  collectItems() {
    const p = this.player;
    for (const it of this.items) {
      if (it.dead || it.emerge > 0 || !overlap(p, it)) continue;
      it.dead = true;
      switch (it.kind) {
        case 'berry':
          if (p.size === 'small') this.transformPlayer('big');
          Sound.sfx('powerup');
          this.addScore(1000, it.x + 7, it.y);
          break;
        case 'bloom':
          if (p.size !== 'fire') this.transformPlayer(p.size === 'small' ? 'big' : 'fire');
          Sound.sfx('powerup');
          this.addScore(1000, it.x + 7, it.y);
          break;
        case 'star':
          p.star = STAR_TIME;
          Sound.sfx('powerup');
          this.addScore(1000, it.x + 7, it.y);
          this.playLevelMusic();
          break;
        case 'heart':
          this.oneUp(it.x + 7, it.y);
          break;
        case 'crystal':
          this.startClear('crystal');
          return;
      }
    }
  }

  transformPlayer(to) {
    const p = this.player;
    if (p.size === to) return;
    p.transform = { from: p.size, to, t: 0 };
    p.setSize(to);
    this.freeze = 0.7;
  }

  onStarEnd() {
    if (this.state === 'play') this.playLevelMusic();
  }

  onBossStart(boss) {
    this.boss = boss;
    this.playLevelMusic();
  }

  onBossDefeated(boss) {
    for (const e of this.enemies) if (e instanceof BossFlame) e.dead = true;
    Sound.stopMusic();
    this.addScore(5000, boss.cx, boss.y - 12);
    const x = clamp(boss.cx, this.cam.x + 48, this.cam.x + VIEW_W - 48);
    this.items.push(new Crystal(this, x, 13 * TILE - 42));
  }

  // Hitting a block from below.
  bumpTile(tx, ty) {
    const L = this.level, p = this.player;
    const t = L.tile(tx, ty);
    const bump = () => L.bumps.push({ tx, ty, t: 0 });
    const spawn = kind => {
      L.setTile(tx, ty, 'u');
      this.items.push(new Item(this, kind, tx, ty));
      Sound.sfx('sprout');
      bump();
    };
    switch (t) {
      case '?':
        L.setTile(tx, ty, 'u');
        this.blockCoin(tx, ty);
        bump();
        break;
      case 'b': {
        const key = tx + ',' + ty;
        const left = (L.coinBricks[key] === undefined ? 8 : L.coinBricks[key]) - 1;
        L.coinBricks[key] = left;
        if (left <= 0) L.setTile(tx, ty, 'u');
        this.blockCoin(tx, ty);
        bump();
        break;
      }
      case 'M': spawn(p.size === 'small' ? 'berry' : 'bloom'); break;
      case '*': spawn('star'); break;
      case '1': case 'H': spawn('heart'); break;
      case 'B':
        if (p.big) {
          L.setTile(tx, ty, '.');
          this.brickBits(tx, ty);
          this.addScore(50);
          Sound.sfx('brick');
        } else {
          bump();
          Sound.sfx('bump');
        }
        break;
      default:
        Sound.sfx('bump');
        return;
    }
    // Anything standing on the block gets knocked into the air.
    const x0 = tx * TILE, top = ty * TILE;
    for (const e of this.enemies) {
      if (!e.active || e.dying || e.dead || !e.shellKillable) continue;
      if (e.x + e.w > x0 && e.x < x0 + TILE && Math.abs(e.y + e.h - top) < 4) {
        e.knock(e.cx < x0 + 8 ? -1 : 1);
        this.addScore(100, e.cx, e.y);
        Sound.sfx('kick');
      }
    }
    for (const it of this.items) {
      if (it.x + it.w > x0 && it.x < x0 + TILE && Math.abs(it.y + it.h - top) < 4) it.hop(x0 + 8);
    }
    if (L.tile(tx, ty - 1) === 'o') {
      L.setTile(tx, ty - 1, '.');
      this.blockCoin(tx, ty - 1);
    }
  }

  blockCoin(tx, ty) {
    this.effects.push(new CoinPop(this, tx * TILE + 8, ty * TILE - 16));
    this.addCoin();
    this.addScore(200, tx * TILE + 8, ty * TILE - 20);
  }

  collectCoin(x, y) {
    this.addCoin();
    this.score += 200;
    this.sparkle(x, y);
  }

  addCoin() {
    this.coins++;
    Sound.sfx('coin');
    if (this.coins >= 100) {
      this.coins -= 100;
      this.oneUp(this.player.cx, this.player.y - 8);
    }
  }

  addScore(n, x, y) {
    this.score += n;
    if (x !== undefined) this.popup(x, y - 4, String(n));
  }

  oneUp(x, y) {
    this.lives++;
    Sound.sfx('oneup');
    this.popup(x, y - 4, '1UP', '#7dff9a');
  }

  checkCheckpoints() {
    const p = this.player;
    for (const c of this.level.checkpoints) {
      if (c.reached || p.x < c.x * TILE) continue;
      c.reached = true;
      this.checkpoint = { level: this.levelIndex, x: c.x, y: c.y };
      Sound.sfx('checkpoint');
      this.popup(c.x * TILE + 8, c.y * TILE - 24, 'CHECKPOINT', '#7df9ff');
    }
  }

  checkFlag() {
    const f = this.level.flag;
    if (!f) return;
    // The trigger covers the whole pole column including its base block, so
    // walking into the block along the ground also grabs the flag.
    const x0 = f.x * TILE, p = this.player;
    if (p.x + p.w >= x0 - 1 && p.x <= x0 + TILE && p.y < (f.y + 1) * TILE) this.startClear('flag');
  }

  // ---------------------------------------------------------------------
  // Death and level clear
  // ---------------------------------------------------------------------
  killPlayer(cause) {
    const p = this.player;
    if (p.dead) return;
    p.dead = true;
    p.star = 0;
    p.transform = null;
    p.invuln = 0;
    p.vx = 0;
    p.vy = 0;
    p.deathFall = cause === 'pit' || cause === 'lava';
    if (cause === 'lava') {
      this.splash(p.cx, p.y + p.h);
      p.visible = false;
    }
    this.freeze = 0;
    this.setState('dying');
    Sound.stopMusic();
    Sound.sfx('die');
  }

  updateDying(dt) {
    const p = this.player;
    for (const fx of this.effects) fx.update(dt);
    this.effects = this.effects.filter(f => !f.dead);
    if (!p.deathFall && this.stateT > 0.5) {
      if (!p.deathJump) { p.deathJump = true; p.vy = -420; }
      p.vy = Math.min(p.vy + 1300 * dt, 600);
      p.y += p.vy * dt;
    }
    if (this.stateT > 3.2) {
      this.lives--;
      this.carrySize = 'small';
      if (this.lives <= 0) {
        this.saveHiscore();
        this.setState('gameover');
        Sound.sfx('gameover');
      } else {
        this.showIntro();
      }
    }
  }

  startClear(kind) {
    const p = this.player, L = this.level;
    this.setState('clear');
    Sound.stopMusic();
    p.vx = 0;
    p.vy = 0;
    p.star = 0;
    p.invuln = 0;
    this.freeze = 0;
    p.transform = null;
    if (p.crouch && p.roomToStand()) p.setCrouch(false);
    this.clear = { kind, phase: kind === 'flag' ? 'slide' : 'crystal', t: 0 };
    if (kind === 'flag') {
      const f = L.flag, poleX = f.x * TILE + 7;
      p.x = poleX - p.w + 1;
      p.face = 1;
      const height = f.y * TILE - (p.y + p.h);
      const pts = height > 120 ? 5000 : height > 90 ? 2000 : height > 60 ? 800 : height > 30 ? 400 : 100;
      this.addScore(pts, poleX + 14, p.y);
      Sound.sfx('flag');
    } else {
      Sound.sfx('crystal');
      for (let i = 0; i < 16; i++) this.sparkle(p.cx + (Math.random() - 0.5) * 40, p.y + (Math.random() - 0.5) * 30);
    }
  }

  updateClear(dt) {
    const c = this.clear, p = this.player, L = this.level;
    c.t += dt;
    L.update(dt);
    for (const pl of this.platforms) pl.update(dt);
    for (const e of this.enemies) if (e.active && e.dying) e.update(dt);
    for (const fx of this.effects) fx.update(dt);
    this.cleanup();

    switch (c.phase) {
      case 'slide': {
        const f = L.flag, baseTop = f.y * TILE, flagBottom = baseTop - 12;
        this.flagY = Math.min(this.flagY + 160 * dt, flagBottom);
        p.y = Math.min(p.y + 160 * dt, baseTop - p.h);
        p.frame = 'jump';
        if (this.flagY >= flagBottom && p.y >= baseTop - p.h) {
          c.phase = 'turn';
          c.t = 0;
          p.x = f.x * TILE + 9;
          p.face = -1;
        }
        break;
      }
      case 'turn':
        if (c.t > 0.4) {
          c.phase = 'walk';
          c.t = 0;
          p.face = 1;
          Sound.sfx('clear');
        }
        break;
      case 'walk': {
        const none = { left: false, down: false, jump: false, run: false, jumpPressed: false, runPressed: false };
        p.update(dt, { ...none, right: true });
        this.updateCamera();
        const door = L.castle ? L.castle.x * TILE + 40 : p.cx;
        if (p.cx >= door || c.t > 6) {
          p.visible = false;
          c.phase = 'tally';
          c.t = 0;
        }
        break;
      }
      case 'crystal':
        p.frame = Math.floor(c.t * 4) % 2 ? 'jump' : 'idle';
        for (const it of this.items) it.update(dt);
        if (c.t > 2.4) { c.phase = 'tally'; c.t = 0; }
        break;
      case 'tally':
        if (c.t > 0.4) {
          if (this.timeLeft > 0) {
            const n = Math.min(this.timeLeft, 3);
            this.timeLeft -= n;
            this.score += n * 50;
            if (Math.floor(c.t * 60) % 4 === 0) Sound.sfx('tick');
          } else {
            c.phase = 'done';
            c.t = 0;
          }
        }
        break;
      case 'done':
        if (c.t > 1.6) this.nextLevel();
        break;
    }
  }

  // ---------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------
  popup(x, y, text, color) { this.effects.push(new ScorePop(x, y, text, color)); }

  dust(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.effects.push(new Particle(x + (Math.random() - 0.5) * 8, y - 2, (Math.random() - 0.5) * 60,
        -20 - Math.random() * 40, '#f4efe4', 0.3, 2, 150));
    }
  }

  puff(x, y) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.effects.push(new Particle(x, y, Math.cos(a) * 50, Math.sin(a) * 50, i % 2 ? '#ffffff' : '#ffb01f', 0.25, 2, 0));
    }
  }

  sparkle(x, y) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      this.effects.push(new Particle(x, y, Math.cos(a) * 40, Math.sin(a) * 40, i % 2 ? '#fff7cf' : '#ffd23f', 0.3, 2, 0));
    }
  }

  splash(x, y) {
    Sound.sfx('splash');
    for (let i = 0; i < 8; i++) {
      this.effects.push(new Particle(x + (Math.random() - 0.5) * 10, y, (Math.random() - 0.5) * 90,
        -150 - Math.random() * 120, i % 2 ? '#ffd23f' : '#ff5a1f', 0.6, 3, 700));
    }
  }

  brickBits(tx, ty) {
    const x = tx * TILE, y = ty * TILE, col = this.level.ts.brickColor;
    const bits = [[2, 2, -70, -320], [9, 2, 70, -320], [2, 9, -60, -220], [9, 9, 60, -220]];
    for (const [ox, oy, vx, vy] of bits) this.effects.push(new Particle(x + ox, y + oy, vx, vy, col, 1.2, 5, 1100));
  }

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------
  render() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    switch (this.state) {
      case 'title': this.renderTitle(ctx); break;
      case 'intro': this.renderIntro(ctx); break;
      case 'gameover': this.renderGameOver(ctx); break;
      case 'victory': this.renderVictory(ctx); break;
      default:
        this.renderWorld(ctx);
        this.renderHUD(ctx);
        if (this.state === 'pause') this.renderPause(ctx);
    }
  }

  renderWorld(ctx) {
    const L = this.level, t = this.time;
    const sx = this.shake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
    const sy = this.shake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
    const camX = Math.round(this.cam.x) + sx;
    ctx.save();
    ctx.translate(0, sy);
    drawBackground(ctx, L.theme, camX, t);
    if (L.castle) ctx.drawImage(L.ts.castle, L.castle.x * TILE - camX, L.castle.y * TILE - 88);
    for (const e of this.enemies) if (e.active && e.behind) e.draw(ctx, camX, t);
    for (const it of this.items) if (it.behind) it.draw(ctx, camX, t);
    L.draw(ctx, camX, t);
    this.drawCheckpoints(ctx, camX);
    this.drawFlag(ctx, camX);
    for (const pl of this.platforms) pl.draw(ctx, camX, L.ts);
    for (const it of this.items) if (!it.behind) it.draw(ctx, camX, t);
    for (const e of this.enemies) if (e.active && !e.behind) e.draw(ctx, camX, t);
    for (const f of this.fireballs) f.draw(ctx, camX);
    this.player.draw(ctx, camX, t);
    for (const fx of this.effects) fx.draw(ctx, camX);
    if (this.debug) this.drawDebug(ctx, camX);
    ctx.restore();
  }

  drawFlag(ctx, camX) {
    const f = this.level.flag;
    if (!f) return;
    const x = f.x * TILE + 7 - camX;
    if (x < -40 || x > VIEW_W + 10) return;
    const top = (f.y - 9) * TILE, bottom = f.y * TILE;
    R(ctx, x, top + 4, 2, bottom - top - 4, '#eef4e6');
    R(ctx, x + 1, top + 4, 1, bottom - top - 4, '#a8b8a0');
    R(ctx, x - 1, top, 4, 5, OUT);
    R(ctx, x, top + 1, 2, 3, '#3fcf6a');
    const fy = Math.round(this.flagY);
    const col = THEMES[this.level.theme].castle.flag;
    for (let i = 0; i < 13; i++) {
      const h = Math.max(1, 11 - Math.floor(i * 0.8));
      const y0 = fy + Math.floor((11 - h) / 2);
      R(ctx, x - 1 - i, y0 - 1, 1, h + 2, OUT);
    }
    for (let i = 0; i < 12; i++) {
      const h = Math.max(1, 11 - Math.floor(i * 0.8));
      R(ctx, x - 1 - i, fy + Math.floor((11 - h) / 2), 1, h, col);
    }
    R(ctx, x - 6, fy + 4, 3, 3, '#ffffff');
  }

  drawCheckpoints(ctx, camX) {
    for (const c of this.level.checkpoints) {
      const x = c.x * TILE + 7 - camX, bottom = (c.y + 1) * TILE;
      if (x < -20 || x > VIEW_W + 20) continue;
      R(ctx, x, bottom - 30, 2, 30, '#5a4a3a');
      R(ctx, x - 1, bottom - 32, 4, 3, '#ffd23f');
      const col = c.reached ? '#27b3a3' : '#9a9aa8';
      const w = c.reached ? Math.floor(this.time * 6) % 2 : 0;
      R(ctx, x + 2, bottom - 29 + w, 10, 8, OUT);
      R(ctx, x + 2, bottom - 28 + w, 9, 6, col);
      R(ctx, x + 5, bottom - 26 + w, 3, 2, '#ffffff');
    }
  }

  drawDebug(ctx, camX) {
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 1;
    const box = b => ctx.strokeRect(Math.round(b.x - camX) + 0.5, Math.round(b.y) + 0.5, b.w - 1, b.h - 1);
    box(this.player);
    for (const e of this.enemies) if (e.active) box(e);
    for (const it of this.items) box(it);
  }

  renderHUD(ctx) {
    const o = { outline: OUT };
    Font.draw(ctx, 'KIKO', 16, 6, '#ffffff', o);
    Font.draw(ctx, String(this.score).padStart(6, '0'), 16, 16, '#ffffff', o);
    blit(ctx, SPR.heartIcon, 92, 5);
    Font.draw(ctx, '*' + this.lives, 102, 6, '#ffffff', o);
    blit(ctx, SPR.coinIcon, 92, 15);
    Font.draw(ctx, '*' + String(this.coins).padStart(2, '0'), 102, 16, '#ffffff', o);
    Font.draw(ctx, 'STAGE', 200, 6, '#ffffff', o);
    Font.draw(ctx, '1-' + (this.levelIndex + 1), 206, 16, '#ffffff', o);
    Font.draw(ctx, 'TIME', 318, 6, '#ffffff', o);
    const tl = this.state === 'intro' ? this.level.time : Math.max(0, this.timeLeft);
    Font.draw(ctx, String(tl).padStart(3, '0'), 321, 16, tl <= 100 && this.state !== 'intro' ? '#ff9a8a' : '#ffffff', o);
    if (Sound.muted) Font.draw(ctx, 'MUTED', VIEW_W - 6, VIEW_H - 12, '#ffffff', { align: 'right', outline: OUT });

    const b = this.boss;
    if (b && !b.dying && this.state !== 'intro') {
      Font.draw(ctx, 'MAGMAW', VIEW_W / 2, 30, '#ffb01f', { align: 'center', outline: OUT });
      R(ctx, VIEW_W / 2 - 41, 40, 82, 7, OUT);
      R(ctx, VIEW_W / 2 - 40, 41, 80, 5, '#4a1010');
      R(ctx, VIEW_W / 2 - 40, 41, Math.round(80 * Math.max(0, b.hp) / b.maxHp), 5, '#ff5a1f');
      R(ctx, VIEW_W / 2 - 40, 41, Math.round(80 * Math.max(0, b.hp) / b.maxHp), 1, '#ffd23f');
    }
  }

  renderPause(ctx) {
    ctx.fillStyle = 'rgba(10, 8, 24, 0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    Font.draw(ctx, 'PAUSED', VIEW_W / 2, 90, '#ffd23f', { align: 'center', scale: 2, outline: OUT });
    Font.draw(ctx, 'PRESS P OR ENTER TO RESUME', VIEW_W / 2, 124, '#ffffff', { align: 'center' });
    Font.draw(ctx, 'M TOGGLES SOUND', VIEW_W / 2, 138, '#9fd4e8', { align: 'center' });
  }

  renderTitle(ctx) {
    const t = this.time;
    drawBackground(ctx, 'meadow', t * 24, t);
    const ts = getTileset('meadow');
    const off = Math.floor(t * 48) % 16;
    for (let x = -off; x < VIEW_W; x += 16) {
      ctx.drawImage(ts.groundTop[0], x, 208);
      ctx.drawImage(ts.groundMid[0], x, 224);
    }
    Font.draw(ctx, "KIKO'S QUEST", VIEW_W / 2 + 3, 33, OUT, { align: 'center', scale: 3 });
    Font.draw(ctx, "KIKO'S QUEST", VIEW_W / 2, 30, '#ffd23f', { align: 'center', scale: 3, outline: OUT });
    Font.draw(ctx, 'A HOODLANDS ADVENTURE', VIEW_W / 2, 60, '#ffffff', { align: 'center', outline: OUT });
    if (Math.floor(t * 2) % 2 === 0) {
      Font.draw(ctx, 'PRESS ENTER OR TAP TO START', VIEW_W / 2, 88, '#ffffff', { align: 'center', outline: OUT });
    }
    const lines = [
      'MOVE   ARROWS / A D',
      'JUMP   Z / SPACE / UP',
      'RUN + FIRE   X / SHIFT',
      'CROUCH DOWN   PAUSE P   MUTE M',
    ];
    lines.forEach((l, i) => Font.draw(ctx, l, VIEW_W / 2, 112 + i * 11, '#e8f6ff', { align: 'center', outline: OUT }));
    Font.draw(ctx, 'TOP ' + String(this.hiscore).padStart(6, '0'), VIEW_W / 2, 164, '#ffd23f', { align: 'center', outline: OUT });
    if (this.startLevel > 0) Font.draw(ctx, 'STARTING AT STAGE 1-' + (this.startLevel + 1), VIEW_W / 2, 176, '#7df9ff', { align: 'center', outline: OUT });
    const f = 'run' + (1 + (Math.floor(t * 10) % 3));
    blit(ctx, SPR.kiko.normal.small[f], 200, 192);
    blit(ctx, SPR.grumble[Math.floor(t * 6) % 2], 150 + Math.sin(t * 2) * 6, 192, true);
  }

  renderIntro(ctx) {
    R(ctx, 0, 0, VIEW_W, VIEW_H, '#0d0b1a');
    this.renderHUD(ctx);
    Font.draw(ctx, 'STAGE 1-' + (this.levelIndex + 1), VIEW_W / 2, 70, '#ffffff', { align: 'center', scale: 2 });
    Font.draw(ctx, this.level.name, VIEW_W / 2, 94, '#ffd23f', { align: 'center' });
    const s = SPR.kiko.normal[this.carrySize === 'small' ? 'small' : 'big'].idle;
    blit(ctx, s, VIEW_W / 2 - 26, 140 - s.h);
    Font.draw(ctx, '* ' + this.lives, VIEW_W / 2 - 2, 128, '#ffffff');
    Font.draw(ctx, this.level.def.tip, VIEW_W / 2, 180, '#9fd4e8', { align: 'center' });
  }

  renderGameOver(ctx) {
    R(ctx, 0, 0, VIEW_W, VIEW_H, '#0d0b1a');
    Font.draw(ctx, 'GAME OVER', VIEW_W / 2, 90, '#ff5a4f', { align: 'center', scale: 2 });
    Font.draw(ctx, 'SCORE ' + String(this.score).padStart(6, '0'), VIEW_W / 2, 126, '#ffffff', { align: 'center' });
    Font.draw(ctx, 'TOP   ' + String(this.hiscore).padStart(6, '0'), VIEW_W / 2, 140, '#ffd23f', { align: 'center' });
  }

  renderVictory(ctx) {
    const t = this.time;
    drawBackground(ctx, 'sky', t * 16, t);
    Font.draw(ctx, 'YOU DID IT!', VIEW_W / 2, 34, '#ffd23f', { align: 'center', scale: 3, outline: OUT });
    Font.draw(ctx, 'THE SUNSTONE SHINES OVER THE HOODLANDS AGAIN', VIEW_W / 2, 68, '#ffffff', { align: 'center', outline: OUT });
    Font.draw(ctx, 'FINAL SCORE ' + String(this.score).padStart(6, '0'), VIEW_W / 2, 90, '#ffffff', { align: 'center', outline: OUT });
    Font.draw(ctx, 'TOP SCORE   ' + String(this.hiscore).padStart(6, '0'), VIEW_W / 2, 102, '#ffd23f', { align: 'center', outline: OUT });
    const bob = Math.round(Math.sin(t * 3) * 4);
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#7df9ff';
    ctx.beginPath();
    ctx.arc(VIEW_W / 2, 136 + bob, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    blit(ctx, SPR.crystal[Math.floor(t * 3) % 2], VIEW_W / 2 - 8, 128 + bob);
    const hop = Math.round(Math.abs(Math.sin(t * 5)) * 14);
    const s = SPR.kiko.fire.big[hop > 2 ? 'jump' : 'idle'];
    blit(ctx, s, VIEW_W / 2 - 40, 200 - s.h - hop);
    blit(ctx, SPR.kiko.normal.big[hop > 2 ? 'jump' : 'idle'], VIEW_W / 2 + 24, 200 - 32 - hop, true);
    const ts = getTileset('sky');
    for (let x = 0; x < VIEW_W; x += 16) {
      ctx.drawImage(ts.groundTop[0], x, 200);
      ctx.drawImage(ts.groundMid[0], x, 216);
      ctx.drawImage(ts.groundMid[1], x, 232);
    }
    if (this.stateT > 3 && Math.floor(t * 2) % 2 === 0) {
      Font.draw(ctx, 'PRESS ENTER TO PLAY AGAIN', VIEW_W / 2, 176, '#ffffff', { align: 'center', outline: OUT });
    }
  }
}
