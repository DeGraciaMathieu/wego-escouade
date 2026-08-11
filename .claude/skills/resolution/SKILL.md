---
name: resolution
description: Use when working on the WEGO simultaneous resolution engine of ESCOUADE — the real-time step loop, firing/bullets, grenades, smoke, explosions, suppression, phases and replay recording in src/main.js.
auto_invoke: true
---

# Résolution simultanée (WEGO) — `src/main.js`

Après la phase `plan`, `beginResolve()` fige les ordres (joueur + IA via `aiPlan`) et lance
`RESOLVE` secondes de simulation temps-réel où les deux camps se résolvent **en parallèle**,
puis `endResolve()` marque les zones et fait avancer le tour. Le tout est ensuite rejouable.

## La boucle et le sous-pas

`loop(now)` (section BOUCLE) mesure `dt` (plafonné à `DT_MAX`) et, en phase `resolve`,
appelle `step(s)` par sous-pas de `SUBSTEP` (1/120 s) tant que `rt < RESOLVE`. `hitstop`
gèle brièvement la simulation après une explosion/mort.

## Fonctions clés (section RÉSOLUTION)

| Fonction | Rôle |
| --- | --- |
| `beginResolve()` | pose les ordres IA (`aiPlan`), démarre l'enregistrement, décale les cooldowns (`grnd`) |
| `step(dt)` | un sous-pas : déplacements, déclenchement des tirs, projectiles, grenades, particules, décrue de suppression, vision |
| `fire(u,tx,ty,hit,tgt)` | crée la balle — angle via `shotAngle` (règle) ; pousse dans `bullets` ; douille/traçante cosmétiques |
| `throwNade / popSmoke / rebuildSmoke` | grenades en arc, volume de fumée, grille de fumée pour la LOS |
| `explode(x,y,side)` | dégâts/suppression en rayon (`EXPLOSION_R`), brèche des cloisons proches (`breach`) |
| `damage / boomFx / wake / impact / sparks / puff / decal` | application des dégâts + effets visuels |
| `endResolve()` | contrôle des zones (`zoneControl`), point du tour (`roundPoint`), fin de partie (`victoryOutcome`/`timeUpOutcome`), `turn++` |

## Ce qui est règle vs ce qui est moteur

- **Décisions** → couche `rules/` (déjà extraite) : `hitChance`, `shotAngle`, `coverMul`,
  `los`, `zoneControl`, `victoryOutcome`. Les appeler, ne pas dupliquer la logique.
- **Orchestration/effets** → ici : mutation de l'état-monde (`bullets`, `units[].hp/supp`,
  `phase`, `scoreB`…), particules, son, canvas. C'est le bon endroit pour `Math.random`
  **cosmétique** (jamais pour un effet de jeu — cf. `rng`).

## Aléa dans la résolution

L'aléa de jeu passe par `rng()`/`grnd()` (seedés) : touché/raté (`rng()<acc`), balle
stoppée par le bois, brèche, offset de cooldown. L'aléa cosmétique (angles de particules,
traçante…) reste sur `Math.random`. Ne mélange pas les deux flux.

## Replay (section REPLAY)

On n'essaie pas de re-simuler : `recFrame()` enregistre `REC_HZ` images/s de l'état
(unités, balles, fumée) + les événements ponctuels (`recEvent`) ; `stepReplay`/`applyFrame`
rejouent la bande. Toute nouvelle donnée visible pendant la résolution doit être ajoutée à
l'enregistrement (`UF`/`BF` floats par unité/balle) pour être fidèlement rejouée.

## Ajouter un comportement de résolution

1. La partie **décision** (déterministe) → une règle dans `src/rules/` + test macro.
2. La partie **effet/mutation** → ici, en appelant la règle. Valeurs réglables → `config.js`.
3. Si elle produit du visible pendant `resolve` → l'ajouter à l'enregistrement replay.
4. Renforcer `tests/smoke.test.js` (le filet bout-en-bout) puis `npm test`.
