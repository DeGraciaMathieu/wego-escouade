# /review

Revue complète des changements en cours d'ESCOUADE.

## Déroulé

1. Lire `CLAUDE.md` pour les conventions non négociables.
2. Récupérer le périmètre : `git diff`, `git diff --cached`, `git status`,
   `git log --oneline -5`. **S'il n'y a aucun changement, s'arrêter et le dire.**
3. Vérifier point par point (ci-dessous).
4. Lancer `npm test`.
5. Rapport structuré avec un statut par item (OK / VIOLATION / N/A) + verdict global.

## Points à vérifier

### Conventions (CLAUDE.md)
- `src/rules/` reste **pur** : aucun `document`/`window`/`canvas`, aucun `Math.random`/
  `Date.now`/`performance.now`, aucune mutation d'argument, aucun import de `state`/`ai`/
  `audio`/`main`.
- Aléa de jeu via `rng` seedé injecté ; aléa cosmétique via `Math.random` cantonné au
  rendu/effets. Les deux flux ne sont pas mélangés.
- Aucune valeur magique de jeu hors `config.js` (hors coefficients de formule documentés).
- Les règles **décident**, le moteur **applique** : pas de logique testable rapatriée dans
  un handler d'événement ou une fonction de dessin.
- Terminologie du domaine respectée (phases, camps, `fire.kind`, classes, `T.*`).

### Couverture de tests
- Toute règle ajoutée/modifiée a un test **macro** (comportement, pas implémentation).
- Le filet `tests/smoke.test.js` couvre encore le flux si le moteur a changé.
- `npm test` est vert.

### Maintenabilité
- Couplage, responsabilité unique, duplication, longueur/complexité des fonctions, nommage,
  valeurs magiques.

### Cohérence système
- Intégration avec l'existant (ordres, phases, LOS, couverture, zones, replay).
- Forme de l'état/données conforme aux patterns établis (état passé en paramètre aux règles,
  ordres écrits par l'IA, enregistrement replay complété si nouveau visible).
- Doc vivante (`index.html` légende/aide) fidèle si des terrains/raccourcis ont changé.

## Sortie

Tableau `item → OK / VIOLATION / N/A` (+ localisation `fichier:ligne` et correction attendue
pour chaque VIOLATION), résultat de `npm test`, puis **verdict global**.
