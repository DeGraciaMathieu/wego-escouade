---
name: feature
description: Implement a feature end-to-end in ESCOUADE, respecting the layered architecture and the purity contract. Use when the user asks to add or change game behaviour.
user_invocable: true
---

# feature — implémenter de bout en bout

## 1. Cadrer (avant de coder)

- **Reformuler** la demande en une phrase, côté joueur.
- Invoquer le skill **`architecture`** pour situer où ça touche (règle ? résolution ?
  mapgen ? IA ? entrées/UI ?).
- Poser les **questions qui manquent** — et ne rien inventer si le code ne tranche pas :
  - valeurs numériques précises (portée, dégâts, durée, coût, seuil) ;
  - interaction avec l'existant (ordres, phases, LOS, couverture, zones, replay) ;
  - cas limites (hors carte, sous fumée, unité morte, hors de portée).

## 2. Implémenter dans l'architecture

- La **décision déterministe** → une règle **pure** dans `src/rules/` (contrat du skill
  `rules`) ; l'**effet/mutation** → le moteur `main.js` qui l'appelle.
- Toute valeur réglable → `src/config.js`. Aucun `Math.random` de jeu → `rng` seedé injecté.
- Respecter `CLAUDE.md` : rien de tout ça n'est négociable.
- Si ça produit du visible pendant la résolution → l'ajouter à l'enregistrement replay.
- Si ça ajoute un ordre/raccourci → mettre à jour `index.html` (boutons `#actions`, légende
  `#hint`) pour que la doc vivante reste fidèle.

## 3. Tester au niveau macro

- Test macro pour chaque règle ajoutée (skill `testing`), en français, petit état littéral.
- Renforcer `tests/smoke.test.js` si le flux moteur a changé.
- **Lancer `npm test` et corriger jusqu'au vert.** Si une approche échoue deux fois, revenir
  au plan plutôt que tenter une 3ᵉ variante.

## 4. Mettre à jour la documentation

Si le périmètre a bougé : ajuster `CLAUDE.md`, le skill de domaine concerné, la légende/aide
in-game (`index.html`), et `docs/decisions.md` (nouvelle décision ou question ouverte).

## 5. Résumer

Fichiers modifiés · règles/tests ajoutés · résultat de `npm test` · toute question restée
ouverte.
