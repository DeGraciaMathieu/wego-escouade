import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleTiles } from '../src/rules/visibility.js';
import { idx } from '../src/rules/geometry.js';
import { T, COLS, ROWS, TILE } from '../src/config.js';

function emptyGrid() { return new Uint8Array(COLS * ROWS); }
const at = t => t * TILE + TILE / 2;

test('une tuile à portée et en vue d\'un observateur est visible', () => {
  const grid = emptyGrid(), smoke = emptyGrid();
  const viewers = [{ x: at(5), y: at(5) }];
  const vis = visibleTiles(grid, smoke, viewers, 600);
  assert.equal(vis[idx(10, 5)], 1);
});

test('une tuile au-delà de la portée reste dans le brouillard', () => {
  const grid = emptyGrid(), smoke = emptyGrid();
  const viewers = [{ x: at(5), y: at(5) }];
  const vis = visibleTiles(grid, smoke, viewers, 100);   // vision courte
  assert.equal(vis[idx(15, 5)], 0);
});

test('un mur masque ce qui est derrière lui', () => {
  const grid = emptyGrid(), smoke = emptyGrid();
  grid[idx(7, 5)] = T.BLD;                                // mur entre l'observateur et la tuile
  const viewers = [{ x: at(5), y: at(5) }];
  const vis = visibleTiles(grid, smoke, viewers, 600);
  assert.equal(vis[idx(10, 5)], 0);
});

test('deux observateurs couvrent chacun leur secteur', () => {
  const grid = emptyGrid(), smoke = emptyGrid();
  const viewers = [{ x: at(3), y: at(3) }, { x: at(25), y: at(14) }];
  const vis = visibleTiles(grid, smoke, viewers, 300);
  assert.equal(vis[idx(3, 3)], 1);
  assert.equal(vis[idx(25, 14)], 1);
});
