---
name: architecture
description: Use when you need the module map of ESCOUADE, to decide where new code belongs, or to trace how state flows between rules, engine, rendering and AI.
auto_invoke: true
---

# Architecture — ESCOUADE

Jeu WEGO : phase `plan` (le joueur et l'IA posent leurs ordres) → `resolve` (résolution
simultanée en temps réel, 4,5 s) → `replay` → `over`. Rendu canvas 2D, aucun build.

## Carte des modules

| Module | Rôle | Dépend de |
| --- | --- | --- |
| `src/config.js` | Valeurs nommées : dimensions, timings, portées, rayons, seuils, tables terrain `T`/`TI`/`TC`, classes `CLS`/`ROSTER`, couleurs | rien |
| `src/rng.js` | `createRng(seed)` — générateur seedé (aléa de jeu) | rien |
| `src/rules/geometry.js` | `idx, inMap, inZone, inAnyZone, zoneCenter` | config |
| `src/rules/terrain.js` | `isWallT, tcost, tcostPx, solid, blocksSight` | config, geometry |
| `src/rules/cover.js` | `coverMul, isCovered` (protection de la cible) | config, geometry |
| `src/rules/los.js` | `los` (ligne de vue grille + fumée) | config, geometry, terrain |
| `src/rules/pathfind.js` | `findPath` (A*), `trimPath` | config, geometry, terrain |
| `src/rules/victory.js` | `zoneControl, roundPoint, victoryOutcome, timeUpOutcome` | config, geometry |
| `src/rules/combat.js` | `hitChance, shotAngle` | (aucun import) |
| `src/rules/threat.js` | `threatTiles` (carte de menace : d'où un ennemi voit/tire) | config, geometry, los |
| `src/state/mapgen.js` | `generateMap(rng)` → `{grid,indoor,rooms,zones}` | config, geometry, terrain |
| `src/ai/plan.js` | `aiPlan(world, rng)` — pose les ordres de l'IA | config, geometry, terrain, los, cover, pathfind |
| `src/audio/audio.js` | `sfx(type)` — synthèse WebAudio | (globals navigateur) |
| `src/main.js` | **Moteur** : état, résolution, rendu, entrées, replay, interface, boucle | tout ce qui précède |

**Sens des flèches** (import ne pointe que vers le bas) : `config` ← `rules` ← `state`/`ai`
← `main`. Le rendu et les entrées vivent dans `main.js` et lisent/écrivent l'état ; ils
n'importent pas dans `rules/`.

## Le moteur `main.js`, par sections

Fichier découpé en sections nommées (chercher les bandeaux `/* === … === */`) :

| Section | Contenu clé |
| --- | --- |
| état + helpers RNG | `let grid, units, bullets, …, phase, turn, scoreB, …` ; `rng`/`grnd`/`rint` (jeu) et `rnd` (cosmétique) |
| CARTE | `genMap()` (appelle `generateMap(rng)`) |
| RENDU DU TERRAIN | `drawTerrain, breach, rr, eachTile, blobLayer` |
| UNITÉS | `mkUnit, setupUnits, alive, byId, updateVision` |
| PHASE D'ORDRES | `orderMove, walkAgain, orderFireUnit, orderFirePoint, orderWatch, orderSmoke, orderNade` |
| RÉSOLUTION | `beginResolve, step, noisePing, updateParts, fire, throwNade, popSmoke, rebuildSmoke, explode, boomFx, damage, wake, impact, sparks, puff, decal, endResolve, finish` |
| REPLAY | `recEvent, recBeginTurn, recFrame, applyFrame, startReplay, loadReplayTurn, stepReplay, quitReplay, updateReplayUI, drawRecOrders` |
| RENDU | `draw, drawTerrainTip, corpse, drawSmoke, drawUnit, drawGhosts, drawWatchCone, drawCrossings, drawOrders` |
| ENTRÉES | `mapPos, unitAt, cycleSel, setMode` + écouteurs souris/clavier/boutons |
| INTERFACE | `refreshUI` (panneau escouade DOM) |
| BOUCLE | `newGame, loop` (rAF) |

## L'état-monde (module-level de `main.js`)

Un unique état mutable partagé, passé aux règles par morceaux : `grid, indoor, rooms,
units, bullets, parts, nades, smokes, smokeGrid, zones` (le monde) ; `turn, phase, rt,
shake, hitstop, scoreB, scoreR, over` (l'avancement) ; `sel, mode, hover, hoverPath, speed`
(l'IHM) ; `mem, aiMem` (mémoire brouillard de guerre) ; `rng` (graine de partie) ; `rec,
curRec, replaying, rp, preRep` (replay).

## Où va le nouveau code

| Type de changement | Où |
| --- | --- |
| Nouvelle décision de jeu déterministe (portée, coût, hit, LOS, chemin, victoire…) | nouveau module `src/rules/<nom>.js` **pur** + test macro |
| Nouvelle valeur réglable (dimension, portée, rayon, durée, seuil, couleur-règle) | `src/config.js` |
| Effet visuel / son / particule | `main.js` (section RENDU ou effets) / `audio.js` — **cosmétique**, `Math.random` autorisé |
| Nouvelle règle de génération de carte | `src/state/mapgen.js` (dans `buildMap`, via `rng`) |
| Nouveau comportement de l'IA | `src/ai/plan.js` |
| Nouvel ordre joueur / raccourci | section PHASE D'ORDRES + ENTRÉES de `main.js` (+ `index.html` boutons/légende) |
| Nouvelle donnée de résolution | section RÉSOLUTION de `main.js`, en s'appuyant sur les règles |

Règle d'or : si le code est **déterministe et sans effet**, il va dans `rules/` (testable) ;
sinon il reste orchestration dans le moteur. Voir `docs/decisions.md` pour les arbitrages.
