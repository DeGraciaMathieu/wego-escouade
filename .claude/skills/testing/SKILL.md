---
name: testing
description: Use when writing or running tests for ESCOUADE — the command, the macro-test philosophy, which test file covers what, and where a new test goes.
auto_invoke: true
---

# Testing — ESCOUADE

## Commande

```bash
npm test            # node --test (découvre tests/**/*.test.js)
npm run test:watch
```

`node:test` + `node:assert/strict`, aucune dépendance. Un hook Stop bloque la fin de tâche
si la suite échoue.

## Philosophie : tests **macro**

On teste ce qu'un joueur remarquerait, dans le vocabulaire du domaine — pas la forme
interne d'une fonction.

- ✅ « un mur porteur est infranchissable et masque la vue », « une cible à couvert réduit
  la précision du tireur », « le point du tour va à qui tient le plus de zones ».
- ❌ « `idx` renvoie 4 », « le tableau interne a une longueur 3 ».

Construire l'état avec un petit littéral explicite (une grille `Uint8Array`, quelques
unités), pas un helper qui cache le montage. Une règle à aléa reçoit un `rng` **de test**
(fonction déterministe, ex. `createRng(seed)` ou une séquence fixe) → résultat reproductible.
Viser 1–2 tests par règle : le cas nominal + le cas limite qui justifie la règle. Le
pourcentage de couverture n'est pas une cible.

## Mapping test → périmètre

| Fichier | Périmètre couvert |
| --- | --- |
| `tests/geometry.test.js` | index/appartenance carte, zones, centre de zone |
| `tests/terrain.test.js` | franchissabilité, masque de vue, coût de déplacement |
| `tests/cover.test.js` | multiplicateur de couverture (découvert, mobilier, enjambement) |
| `tests/los.test.js` | ligne de vue : dégagé, mur, bois à 2 tuiles, fumigène |
| `tests/pathfind.test.js` | A* (chemin, absence de chemin), troncature au budget |
| `tests/victory.test.js` | contrôle de zone, point du tour, conditions de fin |
| `tests/combat.test.js` | précision (`hitChance`), angle du tir (`shotAngle`) |
| `tests/threat.test.js` | carte de menace (portée, LOS, mur bloquant, cumul d'ennemis) |
| `tests/mapgen.test.js` | déterminisme à graine fixe, symétrie 180°, hall, composition |
| `tests/smoke.test.js` | **filet bout-en-bout headless** : charge le jeu (stubs DOM/canvas/audio), résout un tour, rejoue |

## Le filet de fumée

`tests/smoke.test.js` importe `src/main.js` sous des stubs (`document`, `window`, contexte
canvas no-op via Proxy, `document.hasFocus()===false` pour couper le son) et exerce
`newGame` + `beginResolve` + `step`×N + `endResolve` + `startReplay`. Il ne teste pas des
valeurs précises : il détecte les **régressions de glue** (référence oubliée, import cassé)
que les tests de règles ne voient pas. À relancer après tout déplacement de code dans le
moteur.

## Où mettre un nouveau test

- Nouvelle **règle pure** → un `tests/<nom>.test.js` qui importe `../src/rules/<nom>.js`,
  monte un petit état littéral, énonce le comportement en français.
- Nouveau comportement de **génération** → dans `tests/mapgen.test.js` (déterminisme /
  invariant structurel).
- Nouveau flux **moteur** (résolution, replay, IA) difficile à isoler → renforcer
  `tests/smoke.test.js` : ajouter un stub si besoin, piloter la séquence, asserter l'absence
  d'exception + un invariant simple (scores finis, unités présentes).
