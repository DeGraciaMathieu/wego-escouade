/* ==========================================================================
   Règles — carte de menace
   D'où un ennemi connu peut voir (donc tirer) chaque tuile. Pur : reçoit la
   grille, la fumée et la liste des ennemis connus, ne mute rien.
   ========================================================================== */
import { COLS, ROWS, TILE } from '../config.js';
import { idx } from './geometry.js';
import { los } from './los.js';

/* enemies : [{ x, y, reach }] — position (px) et portée de tir efficace (px).
   Retourne un Uint8Array : nombre d'ennemis qui menacent chaque tuile (0 = sûr). */
export function threatTiles(grid, smokeGrid, enemies) {
  const threat = new Uint8Array(COLS * ROWS);
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
      let n = 0;
      for (const e of enemies)
        if (Math.hypot(e.x - cx, e.y - cy) <= e.reach && los(grid, smokeGrid, e.x, e.y, cx, cy)) n++;
      threat[idx(x, y)] = n;
    }
  return threat;
}
