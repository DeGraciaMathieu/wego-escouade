---
name: ai
description: Use when changing the enemy AI of ESCOUADE — how the red squad chooses fire orders (unit/point/watch/nade/smoke) and covered movement positions in src/ai/plan.js.
auto_invoke: true
---

# IA — `src/ai/plan.js`

`aiPlan(world, rng)` pose les ordres du camp rouge **en même temps** que le joueur, appelé
depuis `beginResolve`. Elle **lit** l'état (`world`) et **écrit** les ordres directement sur
les unités (`u.mv`, `u.fire`, `u.wantRun`). Elle ne mute aucune autre partie de l'état.

`world = { units, zones, aiMem, grid, smokeGrid, turn, scoreB, scoreR }`.

## Ce qu'elle décide, par unité (dans l'ordre de priorité)

1. **Fumigène défensif** : sous le feu (`supp>45`), à découvert et une cible visible → pose
   un `fire.kind='smoke'` entre soi et l'ennemi.
2. **Grenade** : ennemi groupé (`near>=2`) ou à couvert (`isCovered`) et à portée →
   `fire.kind='nade'` (position bruitée via `grnd`).
3. **Prise à partie** : sinon, choisit la cible la plus intéressante (distance à l'idéal,
   dégâts déjà subis, malus si à couvert, bonus mitrailleur) → `fire.kind='unit'`.
4. **Suppression** : sinon, tire sur la dernière position connue (`aiMem`, ≤ 3 tours) si en
   vue → `fire.kind='point'`.
5. **Guet** : sinon, `fire.kind='watch'` sur l'axe d'où l'ennemi viendra ; peut vouloir
   courir (`wantRun`).
6. **Déplacement** : échantillonne 64 positions dans le rayon de mouvement, score chacune
   (vue sur l'ancre, couverture, nature du terrain, appartenance à une zone selon le score,
   distance à l'objectif, défilement sous le feu, bruit `grnd`), et pose `u.mv` via
   `findPath`/`trimPath` vers la meilleure.

## S'appuie sur la couche règles

`los`, `isCovered`, `inAnyZone`, `zoneCenter`, `solid`, `findPath`, `trimPath` — l'IA lit le
monde à travers les mêmes règles pures que le reste du jeu. Ne pas dupliquer cette logique
ici.

## Aléa

L'aléa d'exploration/dispersion passe par le `rng` **injecté** (`rint`/`grnd` internes) →
déterministe pour une graine donnée. Jamais `Math.random`.

## Terminologie des ordres (ne pas réinventer)

`fire.kind ∈ {unit, point, watch, nade, smoke}` ; `mem`/`aiMem` = mémoire de la dernière
position connue de l'adversaire ; `wantRun` = veut courir ce tour.

## Modifier le comportement de l'IA

1. Éditer `aiPlan` (ou les helpers internes `objCenter`/`lastKnownCenter`) dans
   `src/ai/plan.js` ; utiliser les **règles** pour toute lecture du monde et le `rng`
   injecté pour l'aléa.
2. Tout poids/seuil de décision réglable → `config.js` si stable ; sinon garder local et
   commenté.
3. L'IA écrit des **ordres** (`u.mv`/`u.fire`), elle n'exécute pas la résolution (c'est
   `step`). Ne pas y muter `hp`, `supp`, positions.
4. Vérifier via `tests/smoke.test.js` (un tour complet inclut `aiPlan`) puis `npm test`.
