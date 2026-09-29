'use strict';

// Base class. Subclasses override the capability getters to describe how they
// react to stomps, fireballs, shells and star power.
class Enemy {
  constructor(game, x, y, w, h) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.vx = 0;
    this.vy = 0;
    this.dir = -1;
    this.speed = 30;
    this.active = false;
    this.dead = false;
    this.dying = false;
    this.onGround = false;
    this.t = 0;
  }

  // Place the enemy standing in tile (tx, ty).
  place(tx, ty) {
    this.x = tx * TILE + (TILE - this.w) / 2;
    this.y = (ty + 1) * TILE - this.h;
    return this;
  }

  get cx() { return this.x + this.w / 2; }
  get stompable() { return true; }
  get harmful() { return !this.dying; }
  get walker() { return false; }          // turns around when meeting other walkers
  get shellKillable() { return true; }
  get starKillable() { return true; }
  get behind() { return false; }          // drawn behind the tiles (pipe plants)

  // Enemies wait off-screen until the camera gets close.
  wake(camX) {
    if (!this.active && this.x < camX + VIEW_W + 24 && this.x + this.w > camX - 24) this.active = true;
  }

  walk(dt, turnAtEdges) {
    const L = this.game.level;
    this.vx = this.dir * this.speed;
    this.vy = Math.min(this.vy + PHYS.enemyGravity * dt, PHYS.maxFall);
    const res = moveBody(this, L, dt);
    if (res.wall) this.dir = -res.wall;
    if (turnAtEdges && this.onGround) {
      const ax = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
      const t = L.tile(Math.floor(ax / TILE), Math.floor((this.y + this.h + 2) / TILE));
      if (!SOLID.has(t) && t !== '=') this.dir = -this.dir;
    }
    if (this.y > L.pxH + 32) this.dead = true;
    return res;
  }

  // Knocked out by a shell, fireball, star or a bumped block: flip and fall.
  knock(dirX) {
    this.dying = true;
    this.vy = -280;
    this.vx = dirX * 70;
  }

  updateDying(dt) {
    this.vy += PHYS.enemyGravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y > this.game.level.pxH + 32) this.dead = true;
  }

  // Custom collision against the player (fire bars). null = use the hitbox.
  hitsPlayer() { return null; }
  // Returns true when stomping should award combo points.
  onStomp() { return true; }
  // Non-stomp contact that is not an attack (kicking a still shell).
  onTouch() { return false; }
  // Returns true if the fireball is used up.
  hitByFire(fb) {
    this.knock(fb.dir);
    this.game.addScore(200, this.cx, this.y);
    Sound.sfx('kick');
    return true;
  }
  update() {}
  draw() {}

  onScreen() {
    const cx = this.game.cam.x;
    return this.x + this.w > cx && this.x < cx + VIEW_W;
  }
}

// ---------------------------------------------------------------------------
class Grumble extends Enemy {
  constructor(game, tx, ty) {
    super(game, 0, 0, 14, 14);
    this.place(tx, ty);
    this.speed = 30;
    this.flat = false;
    this.flatT = 0;
  }
  get walker() { return !this.flat; }
  get harmful() { return !this.dying && !this.flat; }
  get stompable() { return !this.flat; }
  update(dt) {
    if (this.dying) return this.updateDying(dt);
    if (this.flat) {
      this.flatT -= dt;
      if (this.flatT <= 0) this.dead = true;
      return;
    }
    this.t += dt;
    this.walk(dt, false);
  }
  onStomp() {
    this.flat = true;
    this.flatT = 0.5;
    return true;
  }
  draw(ctx, camX) {
    const s = this.flat ? SPR.grumbleFlat : SPR.grumble[Math.floor(this.t * 6) % 2];
    blit(ctx, s, this.x - 1 - camX, this.y + this.h - 16, this.dir > 0, this.dying);
  }
}

// ---------------------------------------------------------------------------
class Snail extends Enemy {
  constructor(game, tx, ty) {
    super(game, 0, 0, 14, 14);
    this.place(tx, ty);
    this.state = 'walk';     // walk | shell | slide
    this.shellT = 0;
    this.combo = 0;
  }
  get walker() { return true; }
  get harmful() { return !this.dying && this.state !== 'shell'; }
  get sliding() { return this.state === 'slide' && !this.dying; }

  update(dt) {
    if (this.dying) return this.updateDying(dt);
    this.t += dt;
    if (this.state === 'walk') {
      this.speed = 24;
      this.walk(dt, true);
    } else if (this.state === 'shell') {
      this.speed = 0;
      this.walk(dt, false);
      this.shellT -= dt;
      if (this.shellT <= 0) {
        this.state = 'walk';
        this.dir = this.game.player.cx < this.cx ? -1 : 1;
      }
    } else {
      this.speed = 230;
      const res = this.walk(dt, false);
      if (res.wall && this.onScreen()) Sound.sfx('bump');
    }
  }

  kick(fromX) {
    this.state = 'slide';
    this.dir = fromX < this.cx ? 1 : -1;
    this.combo = 0;
    Sound.sfx('kick');
    this.game.addScore(400, this.cx, this.y);
  }

  toShell() {
    this.state = 'shell';
    this.shellT = 7;
    this.vx = 0;
  }

  onStomp(p) {
    if (this.state === 'shell') {
      this.kick(p.cx);
      p.kickGrace = 0.25;
      return false;
    }
    this.toShell();
    return true;
  }

  onTouch(p) {
    if (this.state !== 'shell') return false;
    this.kick(p.cx);
    p.kickGrace = 0.25;
    return true;
  }

  draw(ctx, camX) {
    let s, jitter = 0;
    if (this.state === 'walk') s = SPR.snail[Math.floor(this.t * 4) % 2];
    else if (this.state === 'shell') {
      const wiggle = this.shellT < 1.6 && Math.floor(this.t * 12) % 2 === 0;
      s = wiggle ? SPR.shellPeek : SPR.shell[0];
      jitter = wiggle ? 1 : 0;
    } else s = SPR.shell[Math.floor(this.t * 16) % 4];
    blit(ctx, s, this.x - 1 - camX + jitter, this.y + this.h - 16, this.dir > 0, this.dying);
  }
}

// ---------------------------------------------------------------------------
class Prickle extends Enemy {
  constructor(game, tx, ty) {
    super(game, 0, 0, 14, 13);
    this.place(tx, ty);
    this.speed = 26;
  }
  get walker() { return true; }
  get stompable() { return false; }
  update(dt) {
    if (this.dying) return this.updateDying(dt);
    this.t += dt;
    this.walk(dt, false);
  }
  draw(ctx, camX) {
    blit(ctx, SPR.prickle[Math.floor(this.t * 5) % 2], this.x - 1 - camX, this.y + this.h - 16, this.dir > 0, this.dying);
  }
}

// ---------------------------------------------------------------------------
class Bee extends Enemy {
  constructor(game, tx, ty, vertical) {
    super(game, tx * TILE + 1, ty * TILE + 2, 14, 12);
    this.baseY = this.y;
    this.vertical = vertical;
  }
  update(dt) {
    if (this.dying) return this.updateDying(dt);
    this.t += dt;
    if (this.vertical) {
      this.y = this.baseY + Math.sin(this.t * 1.5) * 36;
      this.dir = this.game.player.cx < this.cx ? -1 : 1;
    } else {
      this.x += this.dir * 32 * dt;
      this.y = this.baseY + Math.sin(this.t * 3) * 14;
      if (this.x < -32) this.dead = true;
    }
  }
  onStomp() {
    this.knock(0);
    this.vy = 0;
    return true;
  }
  draw(ctx, camX) {
    blit(ctx, SPR.bee[Math.floor(this.t * 14) % 2], this.x - 1 - camX, this.y - 3, this.dir > 0, this.dying);
  }
}

// ---------------------------------------------------------------------------
// Pipe plant. Pops up periodically, but stays hidden while Kiko is right
// next to (or standing on) its pipe.
class Chomper extends Enemy {
  constructor(game, tx, topRow) {
    super(game, 0, 0, 12, 20);
    this.px = (tx + 1) * TILE - 8;
    this.x = this.px + 2;
    this.baseY = topRow * TILE;
    this.hideY = this.baseY + 2;
    this.outY = this.baseY - 23;
    this.sy = this.hideY;
    this.state = 'hidden';
    this.timer = 1.0;
    this.sync();
  }
  get behind() { return true; }
  get stompable() { return false; }
  get harmful() { return !this.dying && this.baseY - this.sy > 6; }
  sync() {
    this.y = this.sy + 2;
    this.h = Math.max(1, this.baseY - this.y);
  }
  update(dt) {
    this.t += dt;
    this.timer -= dt;
    const p = this.game.player;
    switch (this.state) {
      case 'hidden':
        if (this.timer <= 0) {
          if (Math.abs(p.cx - (this.px + 8)) > 30) { this.state = 'rise'; this.timer = 0.7; }
          else this.timer = 0.3;
        }
        break;
      case 'rise':
        this.sy = this.hideY + (this.outY - this.hideY) * (1 - Math.max(0, this.timer) / 0.7);
        if (this.timer <= 0) { this.state = 'out'; this.timer = 1.5; }
        break;
      case 'out':
        if (this.timer <= 0) { this.state = 'sink'; this.timer = 0.7; }
        break;
      default:
        this.sy = this.outY + (this.hideY - this.outY) * (1 - Math.max(0, this.timer) / 0.7);
        if (this.timer <= 0) { this.state = 'hidden'; this.timer = 1.4; }
    }
    this.sync();
  }
  knock() {
    this.dead = true;
    this.game.puff(this.px + 8, this.sy + 8);
  }
  hitByFire() {
    if (!this.harmful) return false;
    this.knock();
    this.game.addScore(200, this.px + 8, this.sy);
    Sound.sfx('kick');
    return true;
  }
  draw(ctx, camX) {
    blit(ctx, SPR.chomper[Math.floor(this.t * 5) % 2], this.px - camX, this.sy);
  }
}

// ---------------------------------------------------------------------------
// Rotating chain of fire around a block. Cannot be defeated.
class FireBar extends Enemy {
  constructor(game, tx, ty, len, speed) {
    const reach = len * 8;
    super(game, tx * TILE + 8 - reach, ty * TILE + 8 - reach, reach * 2, reach * 2);
    this.px = tx * TILE + 8;
    this.py = ty * TILE + 8;
    this.len = len;
    this.speed = speed;
    this.angle = speed > 0 ? 0 : Math.PI;
  }
  get stompable() { return false; }
  get shellKillable() { return false; }
  get starKillable() { return false; }
  update(dt) {
    this.t += dt;
    this.angle += this.speed * dt;
  }
  orbs() {
    const out = [];
    for (let i = 0; i < this.len; i++) {
      out.push([this.px + Math.cos(this.angle) * i * 8, this.py + Math.sin(this.angle) * i * 8]);
    }
    return out;
  }
  hitsPlayer(p) {
    for (const [ox, oy] of this.orbs()) {
      const nx = clamp(ox, p.x, p.x + p.w), ny = clamp(oy, p.y, p.y + p.h);
      if ((ox - nx) ** 2 + (oy - ny) ** 2 < 3.2 * 3.2) return true;
    }
    return false;
  }
  hitByFire() { return false; }
  draw(ctx, camX) {
    const f = Math.floor(this.t * 10) % 2;
    for (const [ox, oy] of this.orbs()) blit(ctx, SPR.orb[f], ox - 4 - camX, oy - 4);
  }
}

// ---------------------------------------------------------------------------
class LavaBubble extends Enemy {
  constructor(game, tx, delay) {
    super(game, tx * TILE + 2, 13 * TILE + 6, 12, 12);
    this.baseY = this.y;
    this.wait = 0.6 + delay;
  }
  get stompable() { return false; }
  get shellKillable() { return false; }
  get starKillable() { return false; }
  get harmful() { return this.wait <= 0; }
  hitByFire() { return false; }
  update(dt) {
    this.t += dt;
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) this.vy = -470;
      return;
    }
    this.vy += 1150 * dt;
    this.y += this.vy * dt;
    if (this.vy > 0 && this.y >= this.baseY) {
      this.y = this.baseY;
      this.wait = 2.0;
      if (this.onScreen()) this.game.splash(this.cx, this.baseY);
    }
  }
  draw(ctx, camX) {
    if (this.wait > 0) return;
    blit(ctx, SPR.bubble[Math.floor(this.t * 8) % 2], this.x - 2 - camX, this.y - 3, false, this.vy > 0);
  }
}

// ---------------------------------------------------------------------------
// Magmaw: the boss of Ember Keep. Hops at Kiko and spits fireballs. Three
// stomps (or six fireballs) defeat it.
class Boss extends Enemy {
  constructor(game, tx, ty) {
    super(game, 0, 0, 26, 28);
    this.place(tx, ty);
    this.maxHp = 6;
    this.hp = 6;
    this.hurtT = 0;
    this.actT = 2.2;
    this.mouthT = 0;
    this.minX = (tx - 13) * TILE;
    this.maxX = (tx + 8) * TILE;
    this.started = false;
  }
  get shellKillable() { return false; }
  get starKillable() { return false; }
  get rage() { return 1 + (this.maxHp - this.hp) * 0.14; }

  update(dt) {
    if (this.dying) return this.updateDying(dt);
    const game = this.game, p = game.player;
    if (!this.started) { this.started = true; game.onBossStart(this); }
    this.t += dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.mouthT > 0) this.mouthT -= dt;

    if (this.onGround) {
      this.dir = p.cx < this.cx ? -1 : 1;
      this.actT -= dt * this.rage;
      this.speed = 32 * this.rage;
      if (this.actT <= 0) {
        if (Math.random() < 0.5) {
          this.vy = -440;
          this.speed = 95 * this.rage;
        } else {
          this.spit();
        }
        this.actT = 1.5 + Math.random() * 1.2;
      }
    }
    const wasAir = !this.onGround;
    this.vx = this.dir * this.speed;
    this.vy = Math.min(this.vy + PHYS.enemyGravity * dt, PHYS.maxFall);
    moveBody(this, game.level, dt);
    this.x = clamp(this.x, this.minX, this.maxX);
    if (wasAir && this.onGround && this.t > 0.5) {
      Sound.sfx('thud');
      game.shake = Math.max(game.shake, 0.2);
      game.dust(this.x + 4, this.y + this.h, 2);
      game.dust(this.x + this.w - 4, this.y + this.h, 2);
    }
  }

  spit() {
    this.mouthT = 0.5;
    Sound.sfx('flame');
    const fx = this.dir < 0 ? this.x - 8 : this.x + this.w - 2;
    const flame = new BossFlame(this.game, fx, this.y + 13, this.dir);
    this.game.enemies.push(flame);
  }

  onStomp() {
    if (this.hurtT <= 0) this.damage(2);
    return false;
  }
  hitByFire() {
    if (this.hurtT <= 0) this.damage(1);
    return true;
  }
  damage(n) {
    const game = this.game;
    this.hp -= n;
    this.hurtT = 1.0;
    this.actT = Math.min(this.actT, 0.8);
    game.shake = 0.3;
    Sound.sfx('bossHit');
    game.addScore(500, this.cx, this.y);
    if (this.hp <= 0) {
      this.dying = true;
      this.vy = -320;
      this.vx = 0;
      Sound.sfx('bossDie');
      game.onBossDefeated(this);
    }
  }
  draw(ctx, camX) {
    if (this.hurtT > 0 && Math.floor(this.hurtT * 20) % 2 === 0) return;
    const open = this.mouthT > 0 || !this.onGround;
    const s = open ? SPR.boss[2] : SPR.boss[Math.floor(this.t * 5) % 2];
    blit(ctx, s, this.x + this.w / 2 - 16 - camX, this.y + this.h - 32, this.dir > 0, this.dying);
  }
}

class BossFlame extends Enemy {
  constructor(game, x, y, dir) {
    super(game, x, y, 10, 8);
    this.dir = dir;
    this.active = true;
    this.baseY = y;
  }
  get stompable() { return false; }
  get shellKillable() { return false; }
  get starKillable() { return false; }
  hitByFire() { return false; }
  update(dt) {
    this.t += dt;
    this.x += this.dir * 125 * dt;
    this.y = this.baseY + Math.sin(this.t * 10) * 2;
    const cx = this.game.cam.x;
    if (!this.game.level.free(this.x, this.y, this.w, this.h) || this.x < cx - 32 || this.x > cx + VIEW_W + 32) {
      this.dead = true;
      this.game.puff(this.cx, this.y + 4);
    }
  }
  draw(ctx, camX) {
    const f = Math.floor(this.t * 12) % 2;
    blit(ctx, SPR.flame[f], this.x - this.dir * 5 - camX, this.y + 1);
    blit(ctx, SPR.flame[1 - f], this.x + 1 - camX, this.y);
  }
}

function createSpawn(game, s) {
  switch (s.type) {
    case 'grumble': return new Grumble(game, s.x, s.y);
    case 'snail': return new Snail(game, s.x, s.y);
    case 'prickle': return new Prickle(game, s.x, s.y);
    case 'bee': return new Bee(game, s.x, s.y, false);
    case 'beeV': return new Bee(game, s.x, s.y, true);
    case 'chomper': return new Chomper(game, s.x, s.y);
    case 'firebar': return new FireBar(game, s.x, s.y, s.len, s.speed);
    case 'bubble': return new LavaBubble(game, s.x, s.delay);
    case 'boss': return new Boss(game, s.x, s.y);
    default: return null;
  }
}
