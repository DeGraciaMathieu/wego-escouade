import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickFocusTarget } from '../src/ai/plan.js';

const enemy = (id, o = {}) => ({ id, hp: 100, maxHp: 100, cls: 'fus', covered: false, seers: 1, ...o });

test('l\'escouade concentre le feu sur l\'ennemi blessé et à découvert', () => {
  const enemies = [enemy(1, { hp: 100, covered: true }), enemy(2, { hp: 30, covered: false })];
  assert.equal(pickFocusTarget(enemies), 2);
});

test('une cible vue par plusieurs unités est prioritaire', () => {
  const enemies = [enemy(1, { seers: 1 }), enemy(2, { seers: 3 })];
  assert.equal(pickFocusTarget(enemies), 2);
});

test('le mitrailleur ennemi est priorisé à situation égale', () => {
  const enemies = [enemy(1, { cls: 'fus' }), enemy(2, { cls: 'mit' })];
  assert.equal(pickFocusTarget(enemies), 2);
});

test('à score égal, on départage par le plus petit identifiant (déterministe)', () => {
  const enemies = [enemy(5), enemy(2), enemy(9)];
  assert.equal(pickFocusTarget(enemies), 2);
});
