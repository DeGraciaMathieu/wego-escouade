import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPath, trimPath } from '../src/rules/pathfind.js';
import { T, COLS, ROWS, TILE } from '../src/config.js';

function emptyGrid() { return new Uint8Array(COLS * ROWS); } // tout à T.OPEN
const c = t => t * TILE + TILE / 2; // centre pixel d'une tuile

test('un chemin mène jusqu\'à la tuile visée en terrain dégagé', () => {
  const grid = emptyGrid();
  const path = findPath(grid, 1, 5, 5, 5);
  assert.ok(path && path.length > 0);
  assert.deepEqual(path[path.length - 1], { x: c(5), y: c(5) });
});

test('aucun chemin vers une tuile infranchissable', () => {
  const grid = emptyGrid();
  grid[5 * COLS + 5] = T.BLD;
  assert.equal(findPath(grid, 1, 5, 5, 5), null);
});

test('trimPath tronque le chemin quand le budget est dépassé', () => {
  const grid = emptyGrid(); // tcostPx = 1 partout
  const full = [{ x: c(2), y: c(5) }, { x: c(3), y: c(5) }, { x: c(4), y: c(5) }];
  const r = trimPath(grid, c(1), c(5), full, 50); // deux tuiles = 80 px, budget 50
  assert.equal(r.len, 50);
  assert.ok(r.pts.length < full.length);
});
