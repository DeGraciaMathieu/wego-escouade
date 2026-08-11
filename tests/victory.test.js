import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zoneControl, roundPoint, victoryOutcome } from '../src/rules/victory.js';
import { WINPTS, TILE } from '../src/config.js';

const at = t => t * TILE + TILE / 2;
const unit = (side, tx, ty) => ({ side, alive: true, x: at(tx), y: at(ty) });

test('on tient une zone quand on y est plus nombreux, le point va à qui en tient le plus', () => {
  const zones = [{ x0: 0, y0: 0, x1: 2, y1: 2 }];
  const units = [unit('b', 1, 1), unit('b', 2, 2), unit('r', 0, 0)];
  const { holders, zb, zr } = zoneControl(zones, units);
  assert.deepEqual(holders, ['b']);
  assert.equal(zb, 1);
  assert.equal(zr, 0);
  assert.equal(roundPoint(zb, zr), 'b');
});

test('une zone à égalité de présence n\'est tenue par personne', () => {
  const zones = [{ x0: 0, y0: 0, x1: 2, y1: 2 }];
  const units = [unit('b', 1, 1), unit('r', 2, 2)];
  const { holders } = zoneControl(zones, units);
  assert.deepEqual(holders, [null]);
});

test('neutraliser l\'escouade adverse met fin à la partie', () => {
  assert.deepEqual(victoryOutcome({ aliveR: 0, aliveB: 4, scoreB: 0, scoreR: 0 }),
    { title: 'Objectif atteint', sub: 'Escouade adverse neutralisée' });
});

test('atteindre le seuil de points de zones donne la victoire', () => {
  assert.equal(victoryOutcome({ aliveR: 4, aliveB: 4, scoreB: WINPTS, scoreR: 0 }).title, 'Objectifs tenus');
});

test('tant qu\'aucune condition n\'est remplie, la partie continue', () => {
  assert.equal(victoryOutcome({ aliveR: 4, aliveB: 4, scoreB: 1, scoreR: 1 }), null);
});
