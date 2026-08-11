# /check-tests

Analyse la couverture de tests des changements en cours et propose les tests **macro**
manquants — **sans les écrire avant approbation**.

## Déroulé

1. Lire `CLAUDE.md` et le skill `testing`.
2. Périmètre : `git diff`, `git diff --cached`, `git status`, `git log --oneline -5`.
   **Rien à examiner → s'arrêter.**
3. Lancer `npm test` (état de départ).
4. Pour chaque règle/comportement ajouté ou modifié, évaluer la couverture :
   - une règle pure de `src/rules/` sans test macro correspondant ?
   - un cas limite qui justifie la règle (hors carte, sous fumée, hors de portée, unité
     morte, égalité de zone…) non couvert ?
   - un flux moteur modifié (résolution, replay, IA) non exercé par `tests/smoke.test.js` ?
5. **Proposer** la liste des tests manquants : pour chacun, l'énoncé de comportement (en
   français), le fichier cible (`tests/<nom>.test.js`), et l'état littéral minimal à monter.
6. **Attendre l'approbation de l'utilisateur.** Puis écrire les tests approuvés et
   relancer `npm test` jusqu'au vert.

## Sortie

Couverture actuelle (item → couvert / manquant), liste proposée des tests macro, puis —
après approbation seulement — les tests écrits et le résultat de `npm test`.
