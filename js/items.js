'use strict';

// ---------------------------------------------------------------------------
// Power-ups that rise out of blocks.
//   berry  -> grow big          bloom -> fire power
//   star   -> invincibility     heart -> extra life
//   crystal (the Sunstone) -> ends the final stage
// ---------------------------------------------------------------------------
class Item {
  constructor(game, kind, tx, ty) {
    this.game = game;
    this.kind = kind;
    this.w = 14;
    this.h = 14;
    this.x = tx * TILE + 1;
    this.y = ty * TILE + 2;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.t = 0;
    this.dead = false;
    this.emerge = 16;     // pixels still to rise out of the block
    this.dir = 1;
  }
  get behind() { return this.emerge > 0; }

  update(dt) {
    this.t += dt;
    if (this.emerge > 0) {
      const d = Math.min(this.emerge, 32 * dt);
      this.y -= d;
      this.emerge -= d;
      if (this.emerge <= 0 && this.kind === 'star') this.vy = -250;
      return;
    }
    const L = this.game.level;
    if (this.kind === 'berry' || this.kind === 'heart') {
      this.vx = this.dir * (this.kind === 'heart' ? 64 : 56);
      this.vy = Math.min(this.vy + 1300 * dt, PHYS.maxFall);
      const r = moveBody(this, L, dt);
      if (r.wall) this.dir = -r.wall;
    } else if (this.kind === 'star') {
      this.vx = this.dir * 78;
      this.vy = Math.min(this.vy + 1000 * dt, PHYS.maxFall);
      const r = moveBody(this, L, dt);
      if (r.wall) this.dir = -r.wall;
      if (r.landed) this.vy = -330;
    }
    if (this.y > L.pxH + 16) this.dead = true;
  }

  // A block bumped underneath knocks the item into the air.
  hop(fromX) {
    if (this.emerge > 0 || this.kind === 'bloom') return;
    this.vy = -260;
    this.dir = this.x + this.w / 2 < fromX ? -1 : 1;
  }

  draw(ctx, camX) {
    let s;
    switch (this.kind) {
      case 'berry': s = SPR.berry; break;
      case 'heart': s = SPR.heart; break;
      case 'bloom': s = SPR.bloom[Math.floor(this.t * 8) % 4]; break;
      default: s = SPR.star[Math.floor(this.t * 10) % 4];
    }
    blit(ctx, s, this.x - 1 - camX, this.y + this.h - 16);
  }
}

class Crystal {
  constructor(game, x, targetY) {
    this.game = game;
    this.kind = 'crystal';
    this.w = 14;
    this.h = 14;
    this.x = x - 7;
    this.y = -20;
    this.targetY = targetY;
    this.t = 0;
    this.dead = false;
    this.emerge = 0;
  }
  get behind() { return false; }
  update(dt) {
    this.t += dt;
    if (this.y < this.targetY) this.y = Math.min(this.targetY, this.y + 70 * dt);
    else this.y = this.targetY + Math.sin(this.t * 3) * 3;
    if (Math.random() < dt * 8) this.game.sparkle(this.x + 7 + (Math.random() - 0.5) * 18, this.y + 7 + (Math.random() - 0.5) * 18);
  }
  hop() {}
  draw(ctx, camX) {
    const x = Math.round(this.x + 7 - camX), y = Math.round(this.y + 7);
    ctx.save();
    ctx.globalAlpha = 0.25 + Math.sin(this.t * 4) * 0.1;
    ctx.fillStyle = '#7df9ff';
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    blit(ctx, SPR.crystal[Math.floor(this.t * 3) % 2], this.x - 1 - camX, this.y - 1);
  }
}

// ---------------------------------------------------------------------------
class Fireball {
  constructor(game, x, y, dir) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.w = 8;
    this.h = 8;
    this.dir = dir;
    this.vx = dir * 270;
    this.vy = 120;
    this.onGround = false;
    this.t = 0;
    this.dead = false;
  }
  update(dt) {
    this.t += dt;
    this.vy = Math.min(this.vy + 1600 * dt, 420);
    const r = moveBody(this, this.game.level, dt);
    if (r.wall || r.ceiling) { this.explode(); return; }
    if (r.landed) this.vy = -200;
    this.vx = this.dir * 270;
    const cx = this.game.cam.x;
    if (this.x < cx - 16 || this.x > cx + VIEW_W + 16 || this.y > this.game.level.pxH) this.dead = true;
  }
  explode() {
    this.dead = true;
    this.game.puff(this.x + 4, this.y + 4);
  }
  draw(ctx, camX) {
    blit(ctx, SPR.fireball[Math.floor(this.t * 16) % 4], this.x - camX, this.y);
  }
}

// ---------------------------------------------------------------------------
// Moving platforms ease back and forth along one axis. They are one-way:
// you can jump up through them and land on top.
class MovingPlatform {
  constructor(game, s) {
    this.game = game;
    this.x0 = s.x * TILE;
    this.y0 = s.y * TILE;
    this.x = this.x0;
    this.y = this.y0;
    this.w = s.w * TILE;
    this.h = 8;
    this.axis = s.axis;
    this.range = s.range;
    this.speed = s.speed;
    this.t = 0;
    this.dx = 0;
    this.dy = 0;
  }
  update(dt) {
    this.t += dt;
    const k = (1 - Math.cos(this.t * this.speed)) / 2;
    const nx = this.axis === 'h' ? this.x0 + this.range * TILE * k : this.x0;
    const ny = this.axis === 'v' ? this.y0 - this.range * TILE * k : this.y0;
    this.dx = nx - this.x;
    this.dy = ny - this.y;
    this.x = nx;
    this.y = ny;
  }
  draw(ctx, camX, ts) {
    const n = Math.round(this.w / TILE);
    for (let i = 0; i < n; i++) {
      const img = i === 0 ? ts.plat.L : i === n - 1 ? ts.plat.R : ts.plat.M;
      ctx.drawImage(img, Math.round(this.x + i * TILE - camX), Math.round(this.y));
    }
  }
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------
class Particle {
  constructor(x, y, vx, vy, color, life, size = 2, grav = 900) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.color = color; this.life = life; this.size = size; this.grav = grav;
    this.dead = false;
  }
  update(dt) {
    this.vy += this.grav * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx, camX) {
    R(ctx, Math.round(this.x - camX), Math.round(this.y), this.size, this.size, this.color);
  }
}

class ScorePop {
  constructor(x, y, text, color = '#ffffff') {
    this.x = x; this.y = y; this.text = text; this.color = color;
    this.t = 0;
    this.dead = false;
  }
  update(dt) {
    this.t += dt;
    this.y -= 28 * dt;
    if (this.t > 0.9) this.dead = true;
  }
  draw(ctx, camX) {
    Font.draw(ctx, this.text, this.x - camX, this.y, this.color, { align: 'center', outline: OUT });
  }
}

// Coin that pops out of a block, spins up and vanishes.
class CoinPop {
  constructor(game, x, y) {
    this.game = game;
    this.x = x; this.y = y;
    this.vy = -340;
    this.t = 0;
    this.dead = false;
  }
  update(dt) {
    this.t += dt;
    this.vy += 1100 * dt;
    this.y += this.vy * dt;
    if (this.t > 0.52) {
      this.dead = true;
      this.game.sparkle(this.x, this.y + 8);
    }
  }
  draw(ctx, camX) {
    blit(ctx, SPR.coin[Math.floor(this.t * 16) % 4], this.x - 8 - camX, this.y);
  }
}
