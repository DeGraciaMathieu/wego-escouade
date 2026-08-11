# Refactor decisions

Écrit par `/refactor-game`. Consigne ce que le code ne peut pas exprimer : pourquoi ce
découpage, pourquoi cette toolchain, ce qui n'a délibérément pas été touché, ce qui reste
indécis.

Lu par `/scaffold-claude` pour ne pas avoir à tout redéduire.

## Archetype

Selected: **Real-time canvas** (avec coquille WEGO tour par tour)
Why: phase de résolution = boucle `requestAnimationFrame` continue avec `dt`, sous-pas à
1/120 s, entités (unités, balles, grenades, particules) à position/vélocité, collisions,
résolution dégâts/score, rendu par frame sur canvas 2D.
Does not fit :
- **Structure en tours/phases discrètes** (`plan → resolve → replay → over`) : on pose tous
  les ordres avant toute simulation, puis les deux camps se résolvent simultanément. C'est
  une coquille tour-par-tour autour du cœur temps-réel → `loop`/machine à phases plus épaisse
  que l'archétype pur.
- **Sous-système replay** : enregistrement d'images pendant la résolution puis relecture
  (`rec`, `rp`, `preRep`, `stepReplay`). Aucun archétype ne le couvre.
- **Génération procédurale de carte** (`generateMap`), **planification IA** (`aiPlan`) et
  **mémoire brouillard de guerre** (`mem`/`aiMem`) : fabriques/décisions, pas de la physique.

## Toolchain

Branch: **zero-build**
Triggering signal: aucun signal Vite présent — pas d'import npm, pas de TypeScript, pas
d'assets à bundler (tout est tracé au canvas + WebAudio synthétisé), ~1900 lignes de JS
(sous le seuil ~2000, point limite noté et tranché en faveur du zéro-build).
Node: 22
Test runner: **node:test** (`node --test`, `node:assert/strict`)

## Layout

| Module | Responsibility | Came from |
| --- | --- | --- |
| `src/config.js` | Toutes les valeurs nommées : dimensions, timings, portées, rayons, seuils, tables terrain/classes, couleurs-règles | consts de tête + valeurs dispersées (section 8 de l'inventaire) |
| `src/rng.js` | Générateur pseudo-aléatoire seedé (`createRng`) — aléa de jeu | nouveau (contrat rules-extraction) |
| `src/rules/geometry.js` | `idx, inMap, inZone, inAnyZone, zoneCenter` | header |
| `src/rules/terrain.js` | `isWallT, tcost, tcostPx, solid, blocksSight` | header + `solid`/`blocksSight` |
| `src/rules/cover.js` | `coverMul, isCovered` — protection de la cible | `coverMul` |
| `src/rules/los.js` | `los` — ligne de vue (grille + fumée) | `los` |
| `src/rules/pathfind.js` | `findPath` (A*), `trimPath` | `findPath`/`trimPath` |
| `src/rules/victory.js` | `zoneControl, roundPoint, victoryOutcome, timeUpOutcome` | décompte + fin dans `endResolve` |
| `src/rules/combat.js` | `hitChance, shotAngle` — précision et angle du tir | déclencheur de tir + `fire` |
| `src/state/mapgen.js` | `generateMap(rng)` pur → `{grid,indoor,rooms,zones}` | `buildMap`/`mapValid`/`genMap` |
| `src/ai/plan.js` | `aiPlan(world, rng)` — pose les ordres de l'IA | `aiPlan`/`objCenter`/`lastKnownCenter` |
| `src/audio/audio.js` | Synthèse WebAudio (`sfx`) | section SON |
| `src/main.js` | Moteur : état mutable partagé, résolution/`step`, rendu, entrées, replay, interface, boucle | le reste du prototype |

**Note de découpage.** Le moteur WEGO partage un unique état-monde mutable avec ~21
réassignations transverses (`phase=`, `turn=`, `sel=`, `mode=`…). En ESM natif, seul le
module déclarant peut réassigner un `let` ; sortir `render`/`input`/`loop` en modules
imposerait un conteneur d'état partagé (réécriture mécanique de centaines de références,
non vérifiable au navigateur ici). La logique **pure et réutilisable** — le point du refactor
— est entièrement extraite dans `rules/`, `state/mapgen.js`, `ai/plan.js`. Le moteur reste
un tout cohérent dans `main.js`, découpé en **sections nommées** (CARTE, RENDU DU TERRAIN,
UNITÉS, PHASE D'ORDRES, RÉSOLUTION, REPLAY, RENDU, ENTRÉES, INTERFACE, BOUCLE) qui portent
les responsabilités par archéologie.

## Rules extracted

| Rule | Module | Test | Notes |
| --- | --- | --- | --- |
| géométrie grille/zones | `rules/geometry.js` | `tests/geometry.test.js` | config seul, signatures inchangées |
| lecture du terrain | `rules/terrain.js` | `tests/terrain.test.js` | reçoit `grid` |
| couverture | `rules/cover.js` | `tests/cover.test.js` | reçoit `grid` |
| ligne de vue | `rules/los.js` | `tests/los.test.js` | reçoit `grid`, `smokeGrid` |
| pathfinding | `rules/pathfind.js` | `tests/pathfind.test.js` | reçoit `grid` |
| contrôle de zone / victoire | `rules/victory.js` | `tests/victory.test.js` | décisions, la boucle applique |
| tir | `rules/combat.js` | `tests/combat.test.js` | `rng` injecté, consommé dans le même ordre |
| génération de carte | `state/mapgen.js` | `tests/mapgen.test.js` | déterminisme à graine fixe |
| filet bout-en-bout | `main.js` (exports) | `tests/smoke.test.js` | charge le jeu, résout un tour, rejoue (stubs DOM) |

## Randomness and time

| Call site | Classification | Handling |
| --- | --- | --- |
| touché/raté, dispersion & déviation du tir | rule-bearing | `rng` seedé injecté (`combat.js`) |
| balle stoppée par le bois, brèche des cloisons | rule-bearing | `rng()` seedé (dans `main.js`/`step`) |
| offset de cooldown initial (`beginResolve`) | rule-bearing | `grnd` (seedé) |
| génération de carte (buildMap) | rule-bearing | `generateMap(rng)` seedé |
| positions/grenade de l'IA (`aiPlan`) | rule-bearing | `rng` seedé injecté |
| particules (spark/smoke/pop/case…), textures terrain, traçante, tremblement d'écran, bruit WebAudio, phase de marche initiale | cosmetic | laissé sur `Math.random()` (non seedé) |

Time : aucune règle ne lit l'horloge. La boucle mesure `dt` et le passe ; `rt` (temps de
résolution) reste porté par la boucle. `performance.now()` ne sert qu'à initialiser `last`.

Seed : **choisie au point d'entrée** — `newGame()` fait `rng=createRng((Math.random()*2^32)>>>0)`,
donc chaque partie varie ; un test passe une graine fixe pour un résultat déterministe.

## Deliberately left alone

Comportement qui peut sembler fautif mais préservé, car le refactor ne doit pas changer le jeu.

- **Double affectation `u.fire=null` dans `endResolve`** : `if(u.fire&&u.fire.kind==='nade') u.fire=null; u.fire=null;` — la seconde ligne rend la première redondante. Laissé tel quel (aucun effet observable).
- **Coefficients de formules laissés dans le code des règles** (ex. dégâts d'obus `Math.round(18+52*f*f)`, suppression `70*f`/`25`/`*2.2`/`*8`, probabilité balle-bois `*0.0055`, marche `dm*0.40`, seuil de suppression `supp>50`) : ce sont des internes de formule, pas des réglages nommés de la section 8 de l'inventaire ; ils restent au plus près de leur calcul plutôt que dans `config.js`.
- **Collision de nom `rng`** : le générateur seedé s'appelle `rng` ; une variable **locale** `rng` (= « portée », `u.c.ideal+u.c.fall`) préexiste dans l'aperçu des ordres (`drawOrders`). Shadowing local sans effet, non renommé (le contrat interdit de renommer dans la même tranche).

## Open questions

Décisions que le code ne tranche pas et qui n'ont pas été prises (jamais résolues au jugé).

- **`HALLX=11` (local à `buildMap`) vs `HALLZ.x0=12`** : la relation entre la colonne de
  cloison du hall et l'emprise de la zone HALL n'est pas explicitée.
- **Seuil `rp.t>1.2`** utilisé comme repositionnement au tour précédent dans le replay : non
  nommé, non documenté.
- **Champ `u.smoke`** initialisé à `2` pour le grenadier et `1` pour les autres, alors que
  `CLS` ne définit pas de champ `smoke` : la valeur par défaut `1` des non-grenadiers n'est
  pas documentée.
