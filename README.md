# ESCOUADE

Jeu de stratégie **WEGO** à échelle réduite. Un ordre = un déplacement ET un tir, posés en
même temps que l'IA, puis résolus simultanément pendant 4,5 s de temps réel — suivis d'un
replay du tour.

## Lancer le jeu

> ⚠️ **Le double-clic sur `index.html` ne fonctionne plus.** Le jeu est désormais découpé en
> modules ES natifs, que le navigateur **ne charge pas** via `file://`. Il faut un serveur.

```bash
npm run dev      # sert le dossier (npx serve .) — ouvrir l'URL affichée
```

Puis ouvrir `index.html` à l'URL servie (typiquement `http://localhost:3000`).

## Tester

```bash
npm test         # node --test : couche règles + génération + filet bout-en-bout
npm run test:watch
```

Aucune dépendance runtime, aucune dépendance de build. Node ≥ 22 (ES modules natifs +
runner de test intégré).

## Comment jouer

- **Clic** sol : se déplacer · **Clic** ennemi : le prendre à partie · **Maj+clic** sol :
  tir de suppression
- **1** déplacer · **2** courir · **3** tirer · **4** grenade · **5** guet · **6** fumigène
- **Tab** unité suivante · **clic droit** annuler les ordres · **Espace** exécuter
- Tenez plus de zones que l'adversaire pour marquer les points ; 5 points ou l'élimination
  de l'escouade adverse donnent la victoire (12 tours max).

## Structure

```
index.html            coquille : DOM/canvas + <script type="module" src="./src/main.js">
src/
  config.js           toutes les valeurs nommées (dimensions, timings, portées, terrains, classes)
  rng.js              générateur pseudo-aléatoire seedé (aléa de jeu)
  rules/              logique pure et testée (aucune dépendance DOM, aucun aléa non injecté)
    geometry.js  terrain.js  cover.js  los.js  pathfind.js  victory.js  combat.js
  state/mapgen.js     génération procédurale de carte, pure et déterministe à graine fixe
  ai/plan.js          planification des ordres de l'IA
  audio/audio.js      synthèse WebAudio (aucun fichier son)
  main.js             moteur : état, résolution, rendu, entrées, replay, interface, boucle
tests/                tests macro (règles, génération, filet bout-en-bout headless)
docs/decisions.md     décisions du refactor (archétype, toolchain, aléa, points ouverts)
```

Voir `docs/decisions.md` pour le raisonnement du découpage et ce qui reste ouvert.
