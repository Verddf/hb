// Beam-search player: proves a stage can be finished from the start (or the
// checkpoint) without the umbrella and without taking a single hit.
// Works in Node (via harness) and in the browser (given the sim functions).
(function (root) {
  function distField(L, api, target, grid) {
    const { TS, SOLID } = api, W = L.W, H = L.H;
    grid = grid || L.grid;
    const d = new Int32Array(W * H).fill(1e6);
    const q = [];
    if (target) { const i = target.y * W + target.x; d[i] = 0; q.push(i); }
    else { const gx = L.goalX; for (let y = 0; y < H; y++) if (!SOLID[grid[y * W + gx]]) { d[y * W + gx] = 0; q.push(y * W + gx); } }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % W, y = (i - x) / W, nd = d[i] + 1;
      const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of nb) {
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const j = ny * W + nx;
        if ((SOLID[grid[j]] && !(target && target.through && grid[j] === 2)) || d[j] <= nd) continue;
        d[j] = nd; q.push(j);
      }
    }
    return d;
  }

  const ACTIONS = [
    { r: 1, run: 1 }, { r: 1, run: 1, jump: 1 }, { r: 1 }, { r: 1, jump: 1 },
    {}, { jump: 1 }, { l: 1, run: 1 }, { l: 1, jump: 1 }, { l: 1 },
  ];

  function solve(L, api, o) {
    o = o || {};
    const { TS, newSim, cloneSim, step } = api;
    const HOLD = o.hold || 5, BEAM = o.beam || 140, MAXIT = o.maxIter || 2400;
    const ACTS = o.noRun ? ACTIONS.filter(a => !a.run) : ACTIONS;
    const d = distField(L, api, o.target), W = L.W, H = L.H;
    const dAt = (x, y) => (x < 0 || x >= W || y < 0 || y >= H) ? 1e6 : d[y * W + x];
    const score = S => {
      const p = S.p, px = p.x + p.w / 2, py = p.y + p.h / 2;
      const cx = Math.floor(px / TS), cy = Math.max(0, Math.min(H - 1, Math.floor(py / TS)));
      const dd = dAt(cx, cy);
      if (dd >= 1e6) return -1e9;
      const dr = dAt(cx + 1, cy), dl = dAt(cx - 1, cy), du = dAt(cx, cy - 1), dn = dAt(cx, cy + 1);
      const sx = dr < dl ? 1 : dl < dr ? -1 : 0, sy = dn < du ? 1 : du < dn ? -1 : 0;
      return -dd * TS + sx * (px - cx * TS - 8) + sy * (py - cy * TS - 8);
    };
    const S0 = o.from ? cloneSim(o.from) : newSim(L, { fromCp: o.fromCp | 0, noItems: !o.items, power: !!o.power, vw: o.vw || 320, vh: 240, lives: 3 });
    const done = o.done || (S => S.state === 'clear');
    let beam = [{ S: S0, path: null, a: -1, sc: score(S0) }];
    let best = -1e9, bestNode = beam[0];
    for (let it = 0; it < MAXIT; it++) {
      const seen = new Map();
      for (const node of beam) {
        for (let k2 = 0; k2 < ACTS.length; k2++) {
          const a = ACTS[k2], ai = ACTIONS.indexOf(a), S = cloneSim(node.S);
          let ok = true;
          for (let k = 0; k < HOLD; k++) {
            step(S, a);
            if (done(S)) {
              const path = []; let n = { path: node, a: ai };
              for (; n && n.a >= 0; n = n.path) path.push(n.a);
              path.reverse();
              const out = { ok: true, frames: (it + 1) * HOLD, path: path, hold: HOLD, score: S.score, coins: S.coins };
              Object.defineProperty(out, 'S', { value: S, enumerable: false });   // the finished run, for follow-up searches
              return out;
            }
            if (S.state !== 'play' || S.p.inv > 0) { ok = false; break; }
          }
          if (!ok) continue;
          const p = S.p;
          const key = (p.x >> 2) + ',' + (p.y >> 2) + ',' + Math.round(p.vx) + ',' + (p.vy < -0.5 ? -1 : p.vy > 0.5 ? 1 : 0) + ',' + (p.ground ? 1 : 0);
          const sc = score(S);
          const prev = seen.get(key);
          if (!prev || prev.sc < sc) seen.set(key, { S: S, path: node, a: ai, sc: sc });
        }
      }
      const all = Array.from(seen.values());
      if (!all.length) return { ok: false, why: 'all died', at: bestNode.S.p.x / TS, y: bestNode.S.p.y / TS, frames: it * HOLD };
      all.sort((a, b) => b.sc - a.sc);
      // keep the best overall, plus the best that are standing on something
      const keep = all.slice(0, Math.floor(BEAM * 0.6));
      const set = new Set(keep);
      let n = 0;
      for (const s of all) { if (keep.length >= BEAM) break; if (!set.has(s) && s.S.p.ground) { keep.push(s); n++; } }
      for (const s of all) { if (keep.length >= BEAM) break; if (!set.has(s) && !s.S.p.ground) keep.push(s); }
      beam = keep;
      if (beam[0].sc > best) { best = beam[0].sc; bestNode = beam[0]; }
    }
    return { ok: false, why: 'out of time', at: bestNode.S.p.x / TS, y: bestNode.S.p.y / TS };
  }

  // replay a found path, returning the final sim
  function replay(L, api, res, o) {
    const S = api.newSim(L, Object.assign({ noItems: true, vw: 320, vh: 240, lives: 3 }, o || {}));
    for (const ai of res.path) for (let k = 0; k < res.hold; k++) { if (S.state === 'play') api.step(S, ACTIONS[ai]); }
    return S;
  }

  root.TobiBot = { solve: solve, replay: replay, ACTIONS: ACTIONS, distField: distField };
})(typeof window !== 'undefined' ? window : global);
