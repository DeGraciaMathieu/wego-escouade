import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverMul, isCovered } from '../src/rules/cover.js';
import { T, COLS, ROWS, TILE } from '../src/config.js';

function emptyGrid() { return new Uint8Array(COLS * ROWS); } // tout à T.OPEN
const px = t => t * TILE + TILE / 2;

test('une cible à découvert n\'a aucune protection', () => {
  const g = emptyGrid();
  assert.equal(coverMul(g, px(10), px(5), px(5), px(5)), 1);
  assert.equal(isCovered(g, px(10), px(5), px(5), px(5)), false);
});

test('une cible dans du mobilier haut réduit la précision du tireur', () => {
  const g = emptyGrid();
  g[5 * COLS + 5] = T.WOOD;
  assert.equal(coverMul(g, px(10), px(5), px(5), px(5)), 0.55);
  assert.equal(isCovered(g, px(10), px(5), px(5), px(5)), true);
});

test('une cible en train d\'enjamber un mobilier bas est offerte', () => {
  const g = emptyGrid();
  g[5 * COLS + 5] = T.WALL;
  assert.equal(coverMul(g, px(10), px(5), px(5), px(5)), 1.28);
  assert.equal(isCovered(g, px(10), px(5), px(5), px(5)), false);
});
