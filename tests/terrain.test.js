import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solid, blocksSight, tcost } from '../src/rules/terrain.js';
import { T, COLS, ROWS } from '../src/config.js';

// une grille minimale, une seule tuile posée à (5,5)
function gridWith(tile, x = 5, y = 5) {
  const g = new Uint8Array(COLS * ROWS); // tout à T.OPEN (0)
  g[y * COLS + x] = tile;
  return g;
}

test('un mur porteur est infranchissable et masque la vue', () => {
  const g = gridWith(T.BLD);
  assert.equal(solid(g, 5, 5), true);
  assert.equal(blocksSight(g, 5, 5), true);
});

test('une pièce est franchissable et laisse voir au travers', () => {
  const g = gridWith(T.FLOOR);
  assert.equal(solid(g, 5, 5), false);
  assert.equal(blocksSight(g, 5, 5), false);
});

test('une fenêtre arrête le passage mais pas la vue', () => {
  const g = gridWith(T.WIN);
  assert.equal(solid(g, 5, 5), true);
  assert.equal(blocksSight(g, 5, 5), false);
});

test('le coût de déplacement suit la nature du terrain', () => {
  const road = gridWith(T.ROAD);
  const marsh = gridWith(T.MARSH);
  assert.equal(tcost(road, 5, 5), 0.62);   // la rue est rapide
  assert.equal(tcost(marsh, 5, 5), 2.4);   // le plancher effondré est lent
});

test('hors de la carte, tout est solide et coûte 1', () => {
  const g = gridWith(T.OPEN);
  assert.equal(solid(g, -1, 0), true);
  assert.equal(tcost(g, -1, 0), 1);
});
