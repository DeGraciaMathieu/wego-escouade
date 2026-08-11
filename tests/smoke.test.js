/* ==========================================================================
   Test de fumée « headless » — filet de sécurité du découpage en modules.
   On charge tout le jeu sous des stubs DOM/canvas/audio, et on joue un tour
   complet (plan -> résolution -> fin de tour) puis un replay. Toute régression
   introduite en déplaçant du code (référence oubliée, import cassé) fait
   échouer ce test, là où les tests de règles ne voient que la couche pure.
   ========================================================================== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESOLVE } from '../src/config.js';

// --- stubs d'environnement navigateur, posés avant le chargement du jeu ---
const noop = () => {};
const grad = { addColorStop: noop };
const ctx = new Proxy({}, {
  get(_, p) {
    if (p === 'measureText') return () => ({ width: 0 });
    if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => grad;
    if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
    return noop;                                  // méthodes de dessin : sans effet
  },
  set: () => true,
});
const el = new Proxy({}, {
  get(_, p) {
    if (p === 'getContext') return () => ctx;
    if (p === 'getBoundingClientRect') return () => ({ left: 0, top: 0, width: 1200, height: 680 });
    if (p === 'classList') return { add: noop, remove: noop, toggle: noop, contains: () => false };
    if (p === 'querySelectorAll' || p === 'querySelector') return () => [];
    if (p === 'style' || p === 'dataset') return {};
    if (p === 'width') return 1200;
    if (p === 'height') return 680;
    return noop;
  },
  set: () => true,
});
globalThis.document = {
  getElementById: () => el,
  createElement: () => el,
  querySelectorAll: () => [],
  addEventListener: noop,
  hasFocus: () => false,                          // => aucun son créé (sfx se garde)
};
globalThis.window = { addEventListener: noop };
globalThis.performance = { now: () => 0 };
globalThis.requestAnimationFrame = () => 0;       // pas de boucle rAF pendant le test

test('le jeu se charge et met en place une partie sans planter', async () => {
  const g = await import('../src/main.js');
  assert.equal(g.units.length, 8);                // 4 unités par camp
  assert.equal(g.phase, 'plan');
  assert.equal(g.turn, 1);
});

test('plusieurs tours se résolvent sans planter (contact, IA coordonnée)', async () => {
  const g = await import('../src/main.js');
  const step = 1 / 120;
  for (let turn = 0; turn < 5 && g.phase === 'plan'; turn++) {
    g.beginResolve();                       // pose les ordres IA (focus fire, fumée, overwatch)
    for (let t = 0; t < RESOLVE; t += step) g.step(step);
    g.endResolve();
  }
  assert.ok(['plan', 'over'].includes(g.phase));
  assert.ok(Number.isFinite(g.scoreB) && Number.isFinite(g.scoreR));
});

test('le replay du tour joué se déroule sans planter', async () => {
  const g = await import('../src/main.js');
  g.startReplay();
  for (let i = 0; i < 60; i++) g.stepReplay(1 / 60);
  assert.ok(true); // aucune exception levée
});

test('le rendu d\'une frame ne plante pas (pipeline de dessin, aides tactiques)', async () => {
  const g = await import('../src/main.js');
  g.draw();          // exercice le pipeline de rendu sous les stubs canvas
  assert.ok(true);   // aucune exception levée
});
