'use strict';

const SOLID = new Set(['#', 'X', 'B', 'b', '?', 'M', '*', '1', 'u', 'p', '^']);
const BUMPABLE = new Set(['B', 'b', '?', 'M', '*', '1', 'H']);

class Level {
  constructor(index) {
    const def = LEVELS[index];
    const b = buildLevel(index);
    this.index = index;
    this.def = def;
    this.name = def.name;
    this.theme = def.theme;
    this.time = def.time;
    this.w = def.width;
    this.grid = b.grid;
    this.spawns = b.spawns;
    this.startPos = b.startPos;
    this.flag = b.flagPos;
    this.castle = b.castlePos;
    this.checkpoints = b.checkpoints.map(c => ({ ...c, reached: false }));
    this.pxW = this.w * TILE;
    this.pxH = ROWS * TILE;
    this.bumps = [];          // animating bumped blocks
    this.coinBricks = {};     // remaining coins in multi-coin bricks
    this.ts = getTileset(this.theme);
  }

  tile(tx, ty) {
    if (ty < 0 || ty >= ROWS) return '.';
    if (tx < 0 || tx >= this.w) return 'X';   // invisible walls at both ends
    return this.grid[ty][tx];
  }
  setTile(tx, ty, c) {
    if (tx >= 0 && tx < this.w && ty >= 0 && ty < ROWS) this.grid[ty][tx] = c;
  }
  solid(tx, ty) { return SOLID.has(this.tile(tx, ty)); }

  // Is the rectangle free of solid tiles?
  free(x, y, w, h) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.01) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solid(tx, ty)) return false;
    return true;
  }

  update(dt) {
    for (const b of this.bumps) b.t += dt;
    this.bumps = this.bumps.filter(b => b.t < 0.2);
  }

  bumpOffset(tx, ty) {
    for (const b of this.bumps) {
      if (b.tx === tx && b.ty === ty) return -Math.round(Math.sin((b.t / 0.2) * Math.PI) * 6);
    }
    return 0;
  }

  draw(ctx, camX, time) {
    const ts = this.ts;
    const tx0 = Math.max(0, Math.floor(camX / TILE)), tx1 = Math.min(this.w - 1, Math.floor((camX + VIEW_W) / TILE));
    const qf = [0, 0, 0, 1, 2, 1][Math.floor(time * 6) % 6];
    const lf = Math.floor(time * 5) % 4;
    const cf = Math.floor(time * 8) % 4;
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = this.grid[ty][tx];
        if (t === '.' || t === 'H') continue;
        const x = tx * TILE - camX;
        let y = ty * TILE;
        let img = null;
        switch (t) {
          case '#': {
            const above = ty === 0 ? '#' : this.grid[ty - 1][tx];
            const v = (tx * 7 + ty * 3) % 3;
            img = above === '#' ? ts.groundMid[v] : ts.groundTop[v];
            break;
          }
          case 'B': case 'b': img = ts.brick; break;
          case '?': case 'M': case '*': case '1': img = ts.q[qf]; break;
          case 'u': img = ts.used; break;
          case 'X': img = ts.hard; break;
          case '^': img = ts.spikes; break;
          case '~': img = this.tile(tx, ty - 1) === '~' ? ts.lava[lf] : ts.lavaTop[lf]; break;
          case 'p': {
            let n = 0;
            while (this.tile(tx - 1 - n, ty) === 'p') n++;
            const left = n % 2 === 0;
            const top = this.tile(tx, ty - 1) !== 'p';
            img = ts.pipe[(top ? 'T' : 'B') + (left ? 'L' : 'R')];
            break;
          }
          case '=': {
            const l = this.tile(tx - 1, ty) !== '=', r = this.tile(tx + 1, ty) !== '=';
            img = ts.semi[l && r ? 'LR' : l ? 'L' : r ? 'R' : 'M'];
            break;
          }
          case 'o': blit(ctx, SPR.coin[cf], x, y); continue;
          default: continue;
        }
        if (BUMPABLE.has(t) || t === 'u') y += this.bumpOffset(tx, ty);
        ctx.drawImage(img, x, y);
        // darken exposed sides of ground so cliffs read clearly
        if (t === '#') {
          if (tx > 0 && this.grid[ty][tx - 1] !== '#') R(ctx, x, y, 1, 16, ts.edge);
          if (tx < this.w - 1 && this.grid[ty][tx + 1] !== '#') R(ctx, x + 15, y, 1, 16, ts.edge);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tile collision for any body with x, y, w, h, vx, vy. Moves on X then Y and
// reports what was hit. One-way platforms ('=') only block from above.
// ---------------------------------------------------------------------------
function moveBody(e, level, dt, opts = {}) {
  const res = { wall: 0, landed: false, ceiling: null };

  if (e.vx !== 0) {
    let nx = e.x + e.vx * dt;
    const y0 = Math.floor(e.y / TILE), y1 = Math.floor((e.y + e.h - 0.01) / TILE);
    if (e.vx > 0) {
      const tx = Math.floor((nx + e.w - 0.01) / TILE);
      for (let ty = y0; ty <= y1; ty++) {
        if (level.solid(tx, ty)) { nx = tx * TILE - e.w; res.wall = 1; break; }
      }
    } else {
      const tx = Math.floor(nx / TILE);
      for (let ty = y0; ty <= y1; ty++) {
        if (level.solid(tx, ty)) { nx = (tx + 1) * TILE; res.wall = -1; break; }
      }
    }
    e.x = nx;
    if (res.wall) e.vx = 0;
  }

  const prevBottom = e.y + e.h;
  let ny = e.y + e.vy * dt;
  const x0 = Math.floor((e.x + 0.01) / TILE), x1 = Math.floor((e.x + e.w - 0.01) / TILE);
  e.onGround = false;
  if (e.vy >= 0) {
    const ty = Math.floor((ny + e.h) / TILE);
    for (let tx = x0; tx <= x1; tx++) {
      const t = level.tile(tx, ty);
      if (SOLID.has(t) || (t === '=' && prevBottom <= ty * TILE + 0.5)) {
        ny = ty * TILE - e.h;
        e.vy = 0;
        e.onGround = true;
        res.landed = true;
        break;
      }
    }
  } else {
    const ty = Math.floor(ny / TILE);
    const hits = [];
    for (let tx = x0; tx <= x1; tx++) {
      const t = level.tile(tx, ty);
      // Hidden blocks only appear when hit from directly below.
      if (SOLID.has(t) || (opts.hidden && t === 'H' && e.y >= (ty + 1) * TILE - 0.5)) hits.push(tx);
    }
    if (hits.length) {
      ny = (ty + 1) * TILE;
      e.vy = 0;
      res.ceiling = { ty, hits };
    }
  }
  e.y = ny;
  return res;
}
