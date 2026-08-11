import { test } from 'node:test';
import assert from 'node:assert/strict';
import { los } from '../src/rules/los.js';
import { T, COLS, ROWS, TILE } from '../src/config.js';

function emptyGrid() { return new Uint8Array(COLS * ROWS); } // tout à T.OPEN
const px = t => t * TILE + TILE / 2;

test('deux unités se voient à travers un terrain dégagé', () => {
  const grid = emptyGrid(), smoke = emptyGrid();
  assert.equal(los(grid, smoke, px(2), px(5), px(10), px(5)), true);
});

test('un mur porteur coupe net la ligne de vue', () => {
  const grid = emptyGrid(), smoke = emptyGrid();
  grid[5 * COLS + 6] = T.BLD;
  assert.equal(los(grid, smoke, px(2), px(5), px(10), px(5)), false);
});

test('le bois ne masque qu\'à partir de la deuxième tuile traversée', () => {
  const grid = emptyGrid(), smoke = emptyGrid();
  grid[5 * COLS + 6] = T.WOOD;
  assert.equal(los(grid, smoke, px(2), px(5), px(10), px(5)), true);  // une seule tuile de bois : on voit
  grid[5 * COLS + 7] = T.WOOD;
  assert.equal(los(grid, smoke, px(2), px(5), px(10), px(5)), false); // deux tuiles : la vue est coupée
});

test('un fumigène compte comme du masquant pour la ligne de vue', () => {
  const grid = emptyGrid(), smoke = emptyGrid();
  smoke[5 * COLS + 5] = 1;
  smoke[5 * COLS + 6] = 1;
  assert.equal(los(grid, smoke, px(2), px(5), px(10), px(5)), false);
});
