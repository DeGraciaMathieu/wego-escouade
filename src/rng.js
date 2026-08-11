/* ==========================================================================
   ESCOUADE — générateur pseudo-aléatoire seedé (aléa de jeu)
   Un seul générateur, injecté là où une règle a besoin d'aléa. Seul le point
   d'entrée (main / newGame) choisit la graine ; un test passe une graine fixe
   et obtient un résultat déterministe.
   ========================================================================== */
export function createRng(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
