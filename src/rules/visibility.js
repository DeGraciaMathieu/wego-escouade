/* ==========================================================================
   Règles — champ de vision (brouillard de guerre)
   Quelles tuiles un groupe d'observateurs voit réellement : à portée de vision
   et avec ligne de vue dégagée. Pur : reçoit la grille, la fumée et les
   observateurs, ne mute rien.
   ========================================================================== */
import { COLS, ROWS, TILE } from '../config.js';
import { idx } from './geometry.js';
import { los } from './los.js';

/* viewers : [{ x, y }] positions (px) des unités qui observent ; view : portée
   de vision (px). Retourne un Uint8Array : 1 si le centre de la tuile est vu par
   au moins un observateur, 0 sinon. */
export function visibleTiles(grid, smokeGrid, viewers, view) {
  const vis = new Uint8Array(COLS * ROWS);
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
      for (const v of viewers)
        if (Math.hypot(v.x - cx, v.y - cy) <= view && los(grid, smokeGrid, v.x, v.y, cx, cy)) {
          vis[idx(x, y)] = 1;
          break;
        }
    }
  return vis;
}
