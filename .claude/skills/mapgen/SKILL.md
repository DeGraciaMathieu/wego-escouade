---
name: mapgen
description: Use when changing the procedural map generation of ESCOUADE — the house layout, rooms, doors, windows, damage, streets, control zones, or its 180° symmetry and determinism in src/state/mapgen.js.
auto_invoke: true
---

# Génération de carte — `src/state/mapgen.js`

`generateMap(rng, arch)` est **pur** : à graine (et archétype) fixe, il rend toujours la même
carte. Il compose la maison sur la **moitié gauche** puis la retourne à **180°**, et ne
retente (`MAP_ATTEMPTS`) que tant que la maison n'est pas jouable (`mapValid`). Retourne
`{grid, indoor, rooms, zones}` ; `main.js` (`genMap`) l'assigne à l'état et déclenche
`drawTerrain`.

## Archétypes (styles de terrain)

`arch` est un **preset de réglages** défini dans `config.js` (`ARCHETYPES`, ordre
`ARCHETYPE_ORDER`), par défaut `ARCHETYPES.maison` (= valeurs historiques, comportement
inchangé). Le **pipeline est commun** — mêmes étapes, même symétrie/validité/zones ; seuls
les leviers changent : `wing`/`patio` (proba d'aile/patio), `partitionStop` (densité de
cloisonnement — haut = grandes pièces), `loop`/`wideBay` (ouvertures), `furniture`
(multiplicateur de mobilier), `window`/`windowDouble`, `shells`/`shellP` (obus → gravats).
Trois archétypes : `maison` (cloisonné), `ruines` (bombardé, couvert brisé), `ouvert`
(grandes pièces, longues lignes de vue). Le joueur en change via le bouton **Terrain** de la
barre du haut (`#terrain`), ce qui relance une partie.

## Étapes de `buildMap` (fonction interne)

1. **Emprise** : corps principal, parfois une aile, parfois un patio.
2. **Mur d'enceinte** : toute dalle qui touche l'extérieur (`T.BLD`).
3. **Couloir de distribution** de la porte d'entrée au hall.
4. **Cloisonnement récursif** des deux blocs (`split`, cloisons `T.PART`).
5. **Portes** : arbre couvrant sur les pièces, puis quelques boucles et baies larges.
6. **Pièces typées et meublées** (`SALON`, `CUISINE`, `CHAMBRE`, `ATELIER`… → `T.WALL`
   mobilier bas, `T.WOOD` mobilier haut, `T.RUBBLE`) ; sélection d'une pièce **objectif**.
7. **Fenêtres, dégâts d'obus, rue, muret de cour**, puis **symétrie 180°** et pose des
   **zones** de contrôle (le hall `HALLZ` + une pièce et son symétrique).

`mapValid` (interne) vérifie que les deux escouades entrent et atteignent le hall, et les
proportions minimales franchissable/pièce/atteignable (`MAP_PASS_MIN`, `MAP_FLOOR_MIN`,
`MAP_REACH_MIN`).

## Aléa

Tout l'aléa de génération passe par le `rng` **injecté** (`rint`/`rng()` internes construits
dessus) → déterministe et testable. Ne jamais utiliser `Math.random` ici (la texture de
terrain, elle, est cosmétique et vit dans `drawTerrain` de `main.js` via `mapSeed`).

## Natures de terrain (définies dans `config.js`, `T`/`TI`)

`OPEN, BLD (mur porteur), WALL (mobilier bas), WOOD (mobilier haut), MARSH (plancher
effondré), ROAD (rue), RUBBLE (gravats), FLOOR (pièce), WIN (fenêtre), PART (cloison)`.
Chaque nature porte un `cost` et un `pass` dans `TI`. Ne pas réinventer ces clés.

## Ajouter/modifier une règle de génération

1. Éditer `buildMap` dans `src/state/mapgen.js` ; utiliser **`rint`/`rng()` internes**
   (jamais `Math.random`) pour rester déterministe.
2. Toute proportion/seuil/probabilité réglable → `config.js` (ex. `MAP_*`, ou un levier
   d'archétype dans `ARCHETYPES`) ; sinon garder au plus près de l'étape.
3. Préserver la **symétrie 180°** (les deux camps doivent avoir des positions miroir) et la
   **validité** (`mapValid`).
4. Mettre à jour `tests/mapgen.test.js` : déterminisme (même graine → même `grid`), symétrie,
   présence du hall, invariant structurel visé. `npm test` vert.

## Ajouter un archétype

1. Ajouter un preset dans `ARCHETYPES` (`config.js`) avec un `name` et les leviers, et sa
   clé dans `ARCHETYPE_ORDER`.
2. Si le style demande un nouveau levier, exposer un `arch.<levier>` dans `buildMap` (en
   remplaçant un littéral) — garder la valeur du preset `maison` égale à l'ancien littéral
   pour ne rien changer à la maison.
3. Ajouter au test la boucle d'invariants (symétrie, hall, déploiements praticables) — elle
   itère déjà `ARCHETYPE_ORDER`. Vérifier sur plusieurs graines que la carte reste valide.
