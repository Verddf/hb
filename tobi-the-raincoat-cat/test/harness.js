// Loads the simulation and levels into Node and offers test helpers.
const fs = require('fs');
const path = require('path');
const src = ['10-sim.js', '20-levels.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n');
const api = new Function(src + '\nreturn {TS,T,SOLID,PH,ESZ,ENEMY,newSim,cloneSim,step,LEVELS,tileAt,solidT,makeLevel};')();
Object.assign(global, api);

const CH = { 0: ' ', 1: '#', 2: 'B', 3: '?', 4: 'u', 5: 'X', 6: '=', 7: '^', 8: '~', 9: 'o', 10: '[', 11: ']', 12: '[', 13: ']', 14: '_' };
const ECH = { mud: 'm', snail: 's', prick: 'p', frog: 'f', flit: 'v', ember: 'e', crusher: 'C', spring: 'S', gem: 'G', cp: 'K', goal: '|', plat: 'P', chain: '*' };

function dump(L, x0, x1) {
  x0 = x0 || 0; x1 = Math.min(L.W, x1 || L.W);
  const rows = [];
  for (let y = 0; y < L.H; y++) { const r = []; for (let x = x0; x < x1; x++) r.push(CH[L.grid[y * L.W + x]] || '.'); rows.push(r); }
  for (const e of L.ents) {
    const cx = Math.floor((e.x + (e.w || 0) / 2) / TS), cy = Math.floor((e.y + (e.h || 1) - 1) / TS);
    if (cx >= x0 && cx < x1 && cy >= 0 && cy < L.H) rows[cy][cx - x0] = ECH[e.t] || '.';
    if (e.t === 'plat') for (let i = 0; i < e.w / TS; i++) { const X = Math.floor(e.x / TS) + i; if (X >= x0 && X < x1) rows[Math.floor(e.y / TS)][X - x0] = 'P'; }
  }
  const sx = Math.floor(L.start.x / TS), sy = Math.floor(L.start.y / TS);
  if (sx >= x0 && sx < x1) rows[sy][sx - x0] = '@';
  let hdr = '   ';
  for (let x = x0; x < x1; x++) hdr += (x % 10 === 0) ? String(Math.floor(x / 10) % 10) : (x % 5 === 0 ? '+' : ' ');
  const out = [hdr];
  rows.forEach((r, y) => out.push(String(y).padStart(2) + ' ' + r.join('')));
  return out.join('\n');
}

module.exports = { dump };
