---
name: rules
description: Use when adding or changing game logic in ESCOUADE (line of sight, cover, pathfinding, hit chance, zone control, terrain cost…) — the purity contract of src/rules/ and how to add a pure, tested rule.
auto_invoke: true
---

# Règles — `src/rules/`

La couche règles est le cœur testable du jeu : des **décisions pures**. C'est là que va
toute logique déterministe et sans effet.

## Contrat de pureté (obligatoire)

Un module de `src/rules/` doit satisfaire **tout** ceci :

1. Aucun `document`, `window`, `canvas`, aucun nœud DOM en entrée ou sortie.
2. Aucun `Math.random`, `Date.now`, `performance.now`.
3. Aucune mutation d'argument : reçoit l'état, **retourne** la décision / l'état suivant.
4. N'importe que `config.js` (+ `geometry.js`/`terrain.js` bas-niveau). Jamais `state/`,
   `ai/`, `audio/`, `main.js`.
5. Mêmes entrées → mêmes sorties, dans n'importe quel ordre.

Si une fonction ne peut pas respecter 1–5, ce n'est pas une règle : c'est de
l'orchestration → elle reste dans le moteur (`main.js`). Le dis plutôt que de la forcer.

## Concept → implémentation

| Concept de jeu | Fonction | Fichier | État reçu |
| --- | --- | --- | --- |
| Index de tuile, appartenance carte/zone, centre de zone | `idx, inMap, inZone, inAnyZone, zoneCenter` | `geometry.js` | `zones` |
| Mur ? masque la vue ? coût de déplacement ? | `isWallT, solid, blocksSight, tcost, tcostPx` | `terrain.js` | `grid` |
| Protection de la cible (multiplicateur de précision) | `coverMul, isCovered` | `cover.js` | `grid` |
| Ligne de vue (mur coupe net, bois/fumée à 2 tuiles) | `los` | `los.js` | `grid, smokeGrid` |
| Chemin A*, troncature au budget de déplacement | `findPath, trimPath` | `pathfind.js` | `grid` |
| Qui tient chaque zone, point du tour, fin de partie | `zoneControl, roundPoint, victoryOutcome, timeUpOutcome` | `victory.js` | `zones, units` |
| Probabilité de toucher, angle du projectile | `hitChance, shotAngle` | `combat.js` | (params + `rng`) |

## L'aléa dans une règle

Une règle **ne lit jamais** `Math.random`. Si elle a besoin d'aléa (dispersion du tir…),
elle **reçoit un `rng`** en paramètre — une fonction `() => [0,1)`. Voir `shotAngle(base,
spread, hit, rng)` : elle consomme `rng()` dans un ordre déterministe. Un test passe un
`rng` fixe (`createRng(seed)` de `src/rng.js`, ou une séquence). Cf. skill `mapgen`/`ai`
qui reçoivent `rng` de la même façon.

## Ajouter une nouvelle règle

1. Créer `src/rules/<nom>.js`, fonction **pure** ; importer uniquement `config.js`
   (+ `geometry`/`terrain` si besoin).
2. Passer l'état nécessaire en **paramètre** (`grid`, `smokeGrid`, `zones`, `units`, `rng`),
   ne rien lire de global, ne muter aucun argument.
3. Mettre toute valeur réglable dans `config.js` (jamais en dur dans la règle) ; seuls les
   coefficients internes de formule peuvent rester (cf. `docs/decisions.md`).
4. Écrire son **test macro** (`tests/<nom>.test.js`) : comportement en français, petit état
   littéral. Voir skill `testing`.
5. L'**appeler depuis le moteur** (`main.js`), qui garde les effets/mutations. Ex. : le
   déclencheur de tir calcule `hitChance(...)` puis applique le résultat ; `endResolve`
   appelle `zoneControl(...)` puis écrit `z.held`/les scores.
6. `npm test` vert avant de considérer la tâche finie.
