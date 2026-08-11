import { test } from 'node:test';
import assert from 'node:assert/strict';
import { threatTiles } from '../src/rules/threat.js';
import { idx } from '../src/rules/geometry.js';
import { T, COLS, ROWS, TILE } from '../src/config.js';

function emptyGrid() { return new Uint8Array(COLS * ROWS); }
const at = t => t * TILE + TILE / 2;

test('une tuile à portée et en vue d\'un ennemi est menacée', () => {
  const grid = emptyGrid(), smoke = emptyGrid();
  const enemies = [{ x: at(10), y: at(5), reach: 600 }];
  const threat = threatTiles(grid, smoke, enemies);
  assert.equal(threat[idx(5, 5)], 1);
});

test('une tuile hors de portée n\'est pas menacée', () => {
  const grid = emptyGrid(), smoke = emptyGrid();
  const enemies = [{ x: at(10), y: at(5), reach: 100 }];  // portée courte
  const threat = threatTiles(grid, smoke, enemies);
  assert.equal(threat[idx(2, 5)], 0);
});

test('un mur coupe la menace derrière lui', () => {
  const grid = emptyGrid(), smoke = emptyGrid();
  grid[idx(7, 5)] = T.BLD;                                 // mur entre l'ennemi et la tuile
  const enemies = [{ x: at(10), y: at(5), reach: 600 }];
  const threat = threatTiles(grid, smoke, enemies);
  assert.equal(threat[idx(4, 5)], 0);
});

test('deux ennemis qui voient la même tuile cumulent la menace', () => {
  const grid = emptyGrid(), smoke = emptyGrid();
  const enemies = [{ x: at(10), y: at(5), reach: 600 }, { x: at(5), y: at(12), reach: 600 }];
  const threat = threatTiles(grid, smoke, enemies);
  assert.equal(threat[idx(5, 5)], 2);
});
