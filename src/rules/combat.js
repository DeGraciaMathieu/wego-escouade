/* ==========================================================================
   Règles — résolution du tir
   Décisions pures : la probabilité de toucher et l'angle du projectile.
   La poussée de balle et les effets restent orchestrés dans la boucle.
   ========================================================================== */

/* précision d'un tir : part de l'accuracy de la classe, modulée par la
   distance, le mouvement, la suppression, le guet et la protection de la cible */
export function hitChance({ c, d, moving, supp, watching, cover = 1, targetRunning = false }) {
  let acc = c.acc;
  acc *= Math.min(1, Math.max(0.15, 1 - Math.max(0, d - c.ideal) / c.fall));
  if (moving) acc *= c.movePen;
  if (supp > 50) acc *= 0.5;
  if (watching && !moving) acc *= 1.2;   // posté, l'arme déjà en position
  acc *= cover;
  if (targetRunning) acc *= 1.2;
  return acc;
}

/* angle du projectile : dispersion autour de l'axe ; un raté part franchement
   à côté. Consomme rng dans l'ordre : dispersion, [direction, amplitude]. */
export function shotAngle(base, spread, hit, rng) {
  let a = base + (-spread + rng() * 2 * spread);
  if (!hit) a = base + (rng() < 0.5 ? -1 : 1) * (0.045 + rng() * 0.085);
  return a;
}
