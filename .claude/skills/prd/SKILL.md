---
name: prd
description: Use when the user wants a written specification (PRD) for an ESCOUADE feature before any implementation — explore the code for the technical baseline, ask only the product decisions, then write the spec. Implements nothing.
user_invocable: true
---

# prd — rédiger une spécification (sans implémenter)

Ce skill **n'écrit aucun code**. Il produit un document de spécification.

## Démarche

1. **Explorer le code** pour remplir la baseline technique : invoquer `architecture`,
   repérer les modules/règles/valeurs (`config.js`) et les contraintes concernés. Ne pas
   deviner ce que le code contient — le lire.
2. **Poser uniquement les décisions produit** (celles que le code ne tranche pas) : valeurs
   de gameplay visées, interactions voulues, ce qui est explicitement hors périmètre.
3. **Écrire le PRD** dans le format fixe ci-dessous, en français.

## Format du PRD

- **Objectif** — le résultat côté joueur, en une ou deux phrases.
- **Baseline technique** — modules/règles/valeurs existants concernés (chemins réels :
  `src/rules/…`, `src/config.js`, `main.js` section …).
- **Comportement** — règles précises, valeurs numériques, cas limites.
- **Hors périmètre** — ce qui n'est délibérément pas fait.
- **Impact par couche** — `config` / `rules` / `state` (mapgen) / `ai` / moteur (`main.js`) /
  entrées-UI (`index.html`) / replay : ce qui change dans chacune.
- **Critères d'acceptation** — observables, côté joueur.
- **Tests** — les tests macro à écrire (skill `testing`) et le renfort éventuel du filet.
- **Risques et questions ouvertes** — y compris les points repris de `docs/decisions.md`.

Ne rien implémenter : à la fin, proposer d'enchaîner avec le skill `feature`.
