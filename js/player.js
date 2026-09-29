'use strict';

// Kiko. Sizes: 'small' (one hit and you're out), 'big' (can break bricks),
// 'fire' (big + throws bouncing fireballs with the run button).
class Player {
  constructor(game, x, bottom, size = 'small') {
    this.game = game;
    this.size = size;
    this.w = 12;
    this.h = size === 'small' ? 15 : 28;
    this.x = x;
    this.y = bottom - this.h;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.face = 1;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.jumping = false;
    this.crouch = false;
    this.skid = false;
    this.anim = 0;
    this.frame = 'idle';
    this.invuln = 0;
    this.star = 0;
    this.throwT = 0;
    this.kickGrace = 0;
    this.combo = 0;
    this.platform = null;
    this.dead = false;
    this.visible = true;
    this.prevBottom = this.y + this.h;
    this.transform = null;
    this.dustT = 0;
  }

  get big() { return this.size !== 'small'; }
  get cx() { return this.x + this.w / 2; }

  setHeight(h) {
    const bottom = this.y + this.h;
    this.h = h;
    this.y = bottom - h;
  }

  roomToStand() {
    return this.game.level.free(this.x, this.y + this.h - 28, this.w, 28);
  }

  setCrouch(on) {
    if (on === this.crouch) return;
    this.crouch = on;
    this.setHeight(on || !this.big ? 15 : 28);
  }

  setSize(size) {
    this.size = size;
    if (size === 'small') {
      this.crouch = false;
      this.setHeight(15);
    } else if (this.roomToStand()) {
      this.crouch = false;
      this.setHeight(28);
    } else {
      // Grew up under a low ceiling: stay crouched until there is room.
      this.crouch = true;
      this.setHeight(15);
    }
  }

  update(dt, inp) {
    const game = this.game, L = game.level;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.throwT > 0) this.throwT -= dt;
    if (this.kickGrace > 0) this.kickGrace -= dt;
    if (this.star > 0) {
      this.star -= dt;
      if (this.star <= 0) { this.star = 0; game.onStarEnd(); }
    }

    // Ride moving platforms.
    if (this.platform) {
      const pl = this.platform;
      if (this.x + this.w > pl.x && this.x < pl.x + pl.w) {
        if (L.free(this.x + pl.dx, this.y, this.w, this.h)) this.x += pl.dx;
        this.y += pl.dy;
      }
      this.platform = null;
    }

    // ---- horizontal movement ------------------------------------------
    let dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (this.big) {
      if (inp.down && this.onGround) this.setCrouch(true);
      else if (this.crouch && !inp.down && this.roomToStand()) this.setCrouch(false);
    }
    if (this.crouch && this.onGround) dir = 0;   // crouch-slide

    const maxSp = inp.run ? PHYS.runMax : PHYS.walkMax;
    this.skid = false;
    if (dir) {
      if (this.vx * dir < 0) {
        // reversing: skid hard on the ground, gentler in the air
        this.vx += dir * (this.onGround ? PHYS.skid : PHYS.accelAir * 1.5) * dt;
        this.skid = this.onGround;
      } else {
        const acc = !this.onGround ? PHYS.accelAir : inp.run ? PHYS.accelRun : PHYS.accelWalk;
        const sp = Math.abs(this.vx);
        if (sp < maxSp) this.vx = dir * Math.min(sp + acc * dt, maxSp);
        else if (this.onGround) this.vx = dir * Math.max(sp - PHYS.friction * dt, maxSp);
      }
      this.face = dir;
    } else {
      this.vx = approach(this.vx, 0, (this.onGround ? PHYS.friction : PHYS.friction * 0.3) * dt);
    }

    // ---- jumping (with coyote time and input buffering) ----------------
    this.coyote = this.onGround ? PHYS.coyoteTime : this.coyote - dt;
    this.jumpBuf = inp.jumpPressed ? PHYS.jumpBuffer : this.jumpBuf - dt;
    if (this.jumpBuf > 0 && this.coyote > 0) {
      const ratio = Math.min(Math.abs(this.vx) / PHYS.runMax, 1);
      this.vy = -(PHYS.jumpVel + PHYS.jumpRunBonus * ratio);
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuf = 0;
      this.jumping = true;
      Sound.sfx(this.big ? 'jumpBig' : 'jump');
    }
    let g = PHYS.gravityFall;
    if (this.vy < 0) g = inp.jump && this.jumping ? PHYS.gravityRise : PHYS.gravityCut;
    this.vy = Math.min(this.vy + g * dt, PHYS.maxFall);

    // ---- fireballs --------------------------------------------------------
    if (inp.runPressed && this.size === 'fire' && !this.crouch && game.fireballs.length < 2) {
      const fx = this.face > 0 ? this.x + this.w - 2 : this.x - 6;
      game.fireballs.push(new Fireball(game, fx, this.y + 8, this.face));
      this.throwT = 0.15;
      Sound.sfx('fireball');
    }

    // ---- move and collide -------------------------------------------------
    if (this.vy < 0) this.cornerCorrect(dt);
    const wasGround = this.onGround;
    const fallSpeed = this.vy;
    this.prevBottom = this.y + this.h;
    const res = moveBody(this, L, dt, { hidden: true });
    if (res.ceiling) this.hitCeiling(res.ceiling);
    this.landOnPlatforms();
    this.x = clamp(this.x, 0, L.pxW - this.w);

    if (this.onGround) {
      this.jumping = false;
      this.combo = 0;
      if (!wasGround && fallSpeed > 260) game.dust(this.cx, this.y + this.h, 3);
    }

    this.touchTiles();
    if (this.dead) return;
    if (this.y > L.pxH + 8) {
      game.killPlayer('pit');
      return;
    }

    // ---- animation -------------------------------------------------------
    if (!this.onGround) this.frame = 'jump';
    else if (this.crouch) this.frame = 'crouch';
    else if (this.skid) {
      this.frame = 'run1';
      this.dustT -= dt;
      if (this.dustT <= 0) { this.dustT = 0.06; game.dust(this.cx, this.y + this.h, 1); }
    } else if (Math.abs(this.vx) > 3) {
      this.anim += Math.abs(this.vx) * dt * 0.085;
      this.frame = 'run' + (1 + (Math.floor(this.anim) % 3));
    } else {
      this.frame = 'idle';
      this.anim = 0;
    }
  }

  // Nudge around block corners when a jump only clips the edge of one.
  cornerCorrect(dt) {
    const L = this.game.level;
    const ty = Math.floor((this.y + this.vy * dt) / TILE);
    const x0 = Math.floor(this.x / TILE), x1 = Math.floor((this.x + this.w - 0.01) / TILE);
    if (x0 === x1) return;
    const a = L.solid(x0, ty), b = L.solid(x1, ty);
    if (a && !b) {
      const push = (x0 + 1) * TILE - this.x;
      if (push <= 5 && L.free(this.x + push, this.y, this.w, this.h)) this.x += push;
    } else if (b && !a) {
      const push = this.x + this.w - x1 * TILE;
      if (push <= 5 && L.free(this.x - push, this.y, this.w, this.h)) this.x -= push;
    }
  }

  hitCeiling(c) {
    let best = c.hits[0], bestD = Infinity;
    for (const tx of c.hits) {
      const d = Math.abs((tx + 0.5) * TILE - this.cx);
      if (d < bestD) { bestD = d; best = tx; }
    }
    this.jumping = false;
    this.game.bumpTile(best, c.ty);
  }

  landOnPlatforms() {
    if (this.vy < 0) return;
    for (const pl of this.game.platforms) {
      if (this.x + this.w <= pl.x || this.x >= pl.x + pl.w) continue;
      const bottom = this.y + this.h;
      if (this.prevBottom <= pl.y + Math.abs(pl.dy) + 1 && bottom >= pl.y - 0.01) {
        this.y = pl.y - this.h;
        this.vy = 0;
        this.onGround = true;
        this.platform = pl;
        return;
      }
    }
  }

  touchTiles() {
    const game = this.game, L = game.level;
    const x0 = Math.floor(this.x / TILE), x1 = Math.floor((this.x + this.w - 0.01) / TILE);
    const y0 = Math.floor(this.y / TILE), y1 = Math.floor((this.y + this.h - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = L.tile(tx, ty);
        if (t === 'o') {
          L.setTile(tx, ty, '.');
          game.collectCoin(tx * TILE + 8, ty * TILE + 8);
        } else if (t === '~' && this.y + this.h > ty * TILE + 6) {
          game.killPlayer('lava');
          return;
        }
      }
    }
    if (this.invuln > 0 || this.star > 0) return;
    const sx0 = Math.floor((this.x - 1) / TILE), sx1 = Math.floor((this.x + this.w + 1) / TILE);
    const sy1 = Math.floor((this.y + this.h + 1) / TILE);
    for (let ty = y0; ty <= sy1; ty++) {
      for (let tx = sx0; tx <= sx1; tx++) {
        if (L.tile(tx, ty) === '^') {
          this.hurt();
          if (!this.dead) { this.vy = -300; this.jumping = false; }
          return;
        }
      }
    }
  }

  hurt() {
    const game = this.game;
    if (this.invuln > 0 || this.star > 0 || this.dead || game.freeze > 0) return;
    if (this.size === 'small') {
      game.killPlayer('hit');
      return;
    }
    game.transformPlayer(this.size === 'fire' ? 'big' : 'small');
    this.invuln = 2;
    Sound.sfx('shrink');
  }

  draw(ctx, camX, time) {
    if (!this.visible) return;
    if (this.invuln > 0 && !this.dead && !this.transform && Math.floor(this.invuln * 24) % 2 === 0) return;
    let size = this.big ? 'big' : 'small';
    let pal = this.size === 'fire' ? 'fire' : 'normal';
    let frame = this.dead ? 'dead' : this.frame;
    if (this.transform) {
      const form = Math.floor(this.transform.t * 14) % 2 === 0 ? this.transform.to : this.transform.from;
      size = form === 'small' ? 'small' : 'big';
      pal = form === 'fire' ? 'fire' : 'normal';
    }
    if (this.star > 0) pal = STAR_CYCLE[Math.floor(time * (this.star < 2 ? 6 : 16)) % 4];
    if (this.dead) size = 'small';
    const set = SPR.kiko[pal][size];
    const s = set[frame] || set.idle;
    blit(ctx, s, this.x + this.w / 2 - 8 - camX, this.y + this.h - s.h, this.face < 0);
  }
}
