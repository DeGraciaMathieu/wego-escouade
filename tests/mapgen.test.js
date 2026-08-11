import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMap } from '../src/state/mapgen.js';
import { createRng } from '../src/rng.js';
import { idx } from '../src/rules/geometry.js';
import { COLS, ROWS } from '../src/config.js';

test('à graine fixe, la carte générée est reproductible à l\'identique', () => {
  const a = generateMap(createRng(12345));
  const b = generateMap(createRng(12345));
  assert.deepEqual([...a.grid], [...b.grid]);
  assert.deepEqual(a.zones, b.zones);
});

test('la carte est symétrique à 180°', () => {
  const { grid } = generateMap(createRng(7));
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      assert.equal(grid[idx(x, y)], grid[idx(COLS - 1 - x, ROWS - 1 - y)]);
});

test('le hall central fait toujours partie des zones de contrôle', () => {
  const { zones } = generateMap(createRng(999));
  assert.ok(zones.some(z => z.n === 'HALL'));
});

test('une maison est bien composée : sols et murs présents', () => {
  const { grid } = generateMap(createRng(42));
  const floors = [...grid].filter(v => v === 7).length;   // T.FLOOR
  const walls = [...grid].filter(v => v === 1).length;    // T.BLD
  assert.ok(floors > 0 && walls > 0);
});
