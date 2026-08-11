import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hitChance, shotAngle } from '../src/rules/combat.js';

const FUS = { acc: 0.7, ideal: 330, fall: 370, movePen: 0.45 };

test('à distance idéale, immobile et à découvert, la précision est celle de la classe', () => {
  const acc = hitChance({ c: FUS, d: 330, moving: false, supp: 0, watching: false });
  assert.equal(acc, 0.7);
});

test('en mouvement, la précision baisse selon la pénalité de la classe', () => {
  const acc = hitChance({ c: FUS, d: 330, moving: true, supp: 0, watching: false });
  assert.ok(Math.abs(acc - 0.7 * 0.45) < 1e-9);
});

test('une cible à couvert réduit la précision du tireur', () => {
  const acc = hitChance({ c: FUS, d: 330, moving: false, supp: 0, watching: false, cover: 0.55 });
  assert.ok(Math.abs(acc - 0.7 * 0.55) < 1e-9);
});

test('un tir réussi part dans l\'axe à la dispersion près', () => {
  const rng = () => 0.5;                       // dispersion centrée => aucun écart
  assert.equal(shotAngle(1.0, 0.02, true, rng), 1.0);
});

test('un tir raté dévie franchement hors de l\'axe', () => {
  const seq = [0.5, 0.9, 0];                   // dispersion nulle, direction +, amplitude minimale
  let i = 0;
  const rng = () => seq[i++];
  const a = shotAngle(1.0, 0.02, false, rng);
  assert.ok(Math.abs(a - (1.0 + 0.045)) < 1e-9);
});
