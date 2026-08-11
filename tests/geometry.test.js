import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inMap, inZone, inAnyZone, zoneCenter } from '../src/rules/geometry.js';
import { COLS, ROWS, TILE } from '../src/config.js';

test('une case dans les bornes est sur la carte, une case hors bornes non', () => {
  assert.equal(inMap(0, 0), true);
  assert.equal(inMap(COLS - 1, ROWS - 1), true);
  assert.equal(inMap(-1, 0), false);
  assert.equal(inMap(COLS, 0), false);
});

test('une tuile appartient à une zone quand elle est dans son rectangle, bornes comprises', () => {
  const z = { x0: 12, y0: 6, x1: 17, y1: 10 };
  assert.equal(inZone(z, 12, 6), true);
  assert.equal(inZone(z, 17, 10), true);
  assert.equal(inZone(z, 11, 6), false);
});

test('une tuile est dans une des zones dès qu\'elle appartient à l\'une d\'elles', () => {
  const zones = [{ x0: 0, y0: 0, x1: 1, y1: 1 }, { x0: 5, y0: 5, x1: 6, y1: 6 }];
  assert.equal(inAnyZone(zones, 5, 6), true);
  assert.equal(inAnyZone(zones, 3, 3), false);
});

test('le centre d\'une zone est au milieu de son rectangle, en pixels', () => {
  const z = { x0: 0, y0: 0, x1: 1, y1: 1 };
  assert.deepEqual(zoneCenter(z), { x: TILE, y: TILE });
});
