# /check-conventions

Contrôle léger des conventions + cohérence test/doc sur les changements en cours.

## Déroulé

1. Lire `CLAUDE.md`.
2. Périmètre : `git diff`, `git diff --cached`, `git status`, `git log --oneline -5`.
   **Rien à examiner → s'arrêter.**
3. Vérifier :
   - **Pureté `rules/`** : pas de DOM, pas de `Math.random`/horloge, pas de mutation
     d'argument, imports limités à `config` (+ `geometry`/`terrain`).
   - **Aléa** : jeu → `rng` seedé injecté ; cosmétique → `Math.random` dans rendu/effets.
   - **Valeurs magiques** : aucune valeur de jeu réglable hors `config.js` (hors
     coefficients de formule documentés dans `docs/decisions.md`).
   - **Règles décident / moteur applique** : pas de logique dans un handler ou un draw.
   - **Terminologie** du domaine respectée.
   - **Cohérence doc** : si terrains (`T`/`TI`/`TC`) ou raccourcis (`keydown`/`setMode`) ont
     changé, la légende/aide de `index.html` a été mise à jour.
4. Lancer `npm test`.

## Sortie

Statut par item (OK / VIOLATION / N/A) avec localisation et correction, résultat de
`npm test`, verdict global.
