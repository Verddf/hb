'use strict';

// Structural checks for the level data. Runs with plain Node:  node --test
const test = require('node:test');
const assert = require('node:assert');
const { LEVELS, buildLevel, LEVEL_ROWS } = require('../js/levels.js');

const SOLID = new Set(['#', 'X', 'B', 'b', '?', 'M', '*', '1', 'u', 'p', '^']);
const WALKERS = new Set(['grumble', 'snail', 'prickle']);

LEVELS.forEach((def, i) => {
  const b = buildLevel(i);
  const tile = (x, y) => (y < 0 || y >= LEVEL_ROWS || x < 0 || x >= def.width ? '.' : b.grid[y][x]);
  const standable = (x, y) => SOLID.has(tile(x, y + 1)) || tile(x, y + 1) === '=';

  test(`stage ${i + 1} (${def.name}) has a full grid`, () => {
    assert.strictEqual(b.grid.length, LEVEL_ROWS);
    for (const row of b.grid) assert.strictEqual(row.length, def.width);
    assert.ok(def.time > 0 && def.tip && def.name);
  });

  test(`stage ${i + 1} starts on solid ground`, () => {
    const { x, y } = b.startPos;
    assert.strictEqual(tile(x, y), '.', 'start tile must be empty');
    assert.ok(standable(x, y), 'start must have ground underneath');
  });

  test(`stage ${i + 1} has a way to finish`, () => {
    const hasBoss = b.spawns.some(s => s.type === 'boss');
    assert.ok(b.flagPos || hasBoss, 'needs a flagpole or a boss');
    if (b.flagPos) {
      assert.strictEqual(tile(b.flagPos.x, b.flagPos.y), 'X', 'flag stands on a hard block');
      assert.ok(SOLID.has(tile(b.flagPos.x, b.flagPos.y + 1)), 'flag base is grounded');
      assert.ok(b.castlePos && b.castlePos.x > b.flagPos.x, 'castle comes after the flag');
      const door = b.castlePos.x + 2;
      for (let x = b.flagPos.x + 1; x <= door; x++) {
        assert.ok(SOLID.has(tile(x, 13)), `ground between flag and castle door at column ${x}`);
      }
    }
  });

  test(`stage ${i + 1} pipes are two tiles wide`, () => {
    b.grid.forEach((row, y) => {
      let run = 0;
      for (let x = 0; x <= row.length; x++) {
        if (row[x] === 'p') run++;
        else {
          assert.strictEqual(run % 2, 0, `pipe run of ${run} ending at ${x},${y}`);
          run = 0;
        }
      }
    });
  });

  test(`stage ${i + 1} spawns are placed sensibly`, () => {
    for (const s of b.spawns) {
      const where = `${s.type} at ${s.x},${s.y}`;
      if (s.type === 'chomper') {
        assert.strictEqual(tile(s.x, s.y), 'p', `${where} must sit in a pipe top`);
        assert.notStrictEqual(tile(s.x, s.y - 1), 'p', `${where} must be the top of the pipe`);
        continue;
      }
      if (s.type === 'firebar') { assert.strictEqual(tile(s.x, s.y), 'X', `${where} pivot block`); continue; }
      if (s.type === 'bubble') { assert.strictEqual(tile(s.x, 13), '~', `${where} must be in lava`); continue; }
      if (s.type === 'platform') {
        for (let k = 0; k < s.w; k++) assert.ok(!SOLID.has(tile(s.x + k, s.y)), `${where} overlaps a solid tile`);
        continue;
      }
      assert.ok(!SOLID.has(tile(s.x, s.y)), `${where} is inside a solid tile`);
      if (WALKERS.has(s.type) || s.type === 'boss') assert.ok(standable(s.x, s.y), `${where} has nothing to stand on`);
    }
    for (const c of b.checkpoints) assert.ok(standable(c.x, c.y), `checkpoint at ${c.x} must be on the ground`);
  });
});

test('stages get harder: the last one ends with a boss', () => {
  const last = buildLevel(LEVELS.length - 1);
  assert.ok(last.spawns.some(s => s.type === 'boss'));
});
