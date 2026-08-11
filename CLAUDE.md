# ESCOUADE

Jeu de stratégie **WEGO** à échelle réduite (canvas 2D, vanilla JS). Un ordre = un
déplacement ET un tir, posés en même temps que l'IA, puis résolus simultanément pendant
4,5 s de temps réel, suivis d'un replay du tour.

## Stack

- **JavaScript, ES modules natifs, Node ≥ 22, zéro-build.** Aucune dépendance runtime ni
  de build. Aucun lint/formatter configuré.
- Rendu : canvas 2D. Son : synthèse WebAudio (aucun fichier).
- Tests : `node:test` + `node:assert/strict`.

```bash
npm run dev        # sert le dossier (npx serve .) — ouvrir index.html à l'URL servie
npm test           # node --test
npm run test:watch # node --test --watch
```

> Le double-clic sur `index.html` ne fonctionne plus : les modules ES natifs ne se chargent
> pas via `file://`. Toujours passer par `npm run dev`.

## Architecture (résumé)

Voir le skill **`architecture`** pour la carte complète.

- `src/config.js` — toutes les valeurs nommées (dimensions, timings, portées, rayons,
  seuils, tables terrain `T`/`TI`/`TC`, classes `CLS`/`ROSTER`, couleurs).
- `src/rng.js` — `createRng(seed)`, générateur seedé pour l'aléa **de jeu**.
- `src/rules/*` — logique **pure et testée** (geometry, terrain, cover, los, pathfind,
  victory, combat).
- `src/state/mapgen.js` — `generateMap(rng)`, génération procédurale déterministe.
- `src/ai/plan.js` — `aiPlan(world, rng)`, planification des ordres de l'IA.
- `src/audio/audio.js` — `sfx(type)`.
- `src/main.js` — **moteur** : état-monde mutable partagé, résolution (`step`), rendu,
  entrées, replay, interface, boucle. Découpé en sections nommées.

## Conventions non négociables

1. **`src/rules/` est pur.** Interdit dans un module de `rules/` : `document`, `window`,
   `canvas`, `Math.random`, `Date.now`, `performance.now`, la mutation d'un argument, et
   tout import depuis `state/`, `ai/`, `audio/` ou `main.js`. Un module de règle **reçoit**
   l'état par paramètre (`grid`, `smokeGrid`, `zones`, `units`, `rng`) et **retourne** une
   décision. Il ne peut importer que `config.js` (+ `geometry.js`/`terrain.js` bas-niveau).
2. **Les règles décident, le moteur applique.** Toute mutation d'état, tout effet (canvas,
   son, particules, DOM) reste dans `main.js` (ou `render`/effets). Ne rapatrie pas de
   logique testable dans un handler d'événement ou une fonction de dessin.
3. **Aléa.** L'aléa **qui affecte le jeu** (touché/raté, dispersion, génération de carte,
   IA, brèche…) passe par le générateur seedé `rng` (`createRng`), **injecté** — jamais
   `Math.random` directement. L'aléa **cosmétique** (particules, textures, traçante,
   tremblement d'écran, son) reste sur `Math.random` dans le rendu/les effets. Le point
   d'entrée (`newGame`) choisit la graine ; un test passe une graine fixe.
4. **Pas de valeur magique hors `config.js`.** Toute dimension, portée, rayon, durée, seuil
   ou couleur-règle nommée va dans `config.js`. Exception documentée : les **coefficients
   internes de formule** (ex. dégâts d'obus `18+52*f*f`) restent au plus près de leur calcul
   dans la règle — voir `docs/decisions.md`.
5. **Le temps s'injecte.** Une règle ne lit jamais l'horloge : la boucle mesure `dt` et le
   passe ; `rt` (temps de résolution) est porté par la boucle.
6. **Terminologie du domaine.** Ne réinvente pas le vocabulaire existant : phases
   (`plan`/`resolve`/`replay`/`over`), camps (`b`/`r`), ordres (`unit`/`point`/`watch`/
   `nade`/`smoke`), classes (`ecl`/`fus`/`mit`/`gre`), natures de terrain (`T.*`).

## Convention visuelle / doc

La légende des terrains (`#legend`) et l'aide clavier (`#hint`, boutons `#actions`) dans
`index.html` sont écrites à la main et doivent rester fidèles à `config.js` (`T`/`TI`/`TC`)
et au handler `keydown`/`setMode` de `main.js`. Un hook Stop le vérifie.

## Comportement (règles de travail)

- **Ne jamais déclarer une tâche finie sans avoir lancé `npm test` et vu la suite passer.**
- Si une approche échoue deux fois, **revenir au plan** avant de tenter une troisième
  variante.
- Comportement du jeu = contrat : tout changement de comportement non demandé est un bug.
- Rédiger commentaires et docs **en français** (langue du dépôt).

## Skills disponibles

- `architecture` — carte des modules et « où va le nouveau code ».
- `testing` — commande, philosophie macro, mapping test→périmètre.
- `rules` — la couche règles pure : contrat et ajout d'une règle.
- `resolution` — le moteur de résolution simultanée WEGO (`step`, tir, effets, phases, replay).
- `mapgen` — génération procédurale déterministe de carte.
- `ai` — planification des ordres de l'IA.
- `feature` *(invocable)* — implémenter une fonctionnalité de bout en bout.
- `prd` — rédiger une spécification, sans implémenter.

## Questions ouvertes (non tranchées par le code)

- `HALLX=11` (local à la génération) vs `HALLZ.x0=12` : relation non explicitée.
- Seuil replay `rp.t>1.2` : non nommé, non documenté.
- `u.smoke` par défaut `1` pour les non-grenadiers alors que `CLS` ne déclare pas ce champ.
