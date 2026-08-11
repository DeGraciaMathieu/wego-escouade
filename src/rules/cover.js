/* ==========================================================================
   Règles — protection de la cible
   coverMul : multiplicateur appliqué à la précision du tireur selon ce qui
   protège la cible. Pur : reçoit la grille, ne la mute pas.
   ========================================================================== */
import { T, TILE } from '../config.js';
import { idx, inMap } from './geometry.js';

export function coverMul(grid, sx, sy, tx, ty) {
  let m = 1;
  const gx = Math.floor(tx / TILE), gy = Math.floor(ty / TILE);
  const t = inMap(gx, gy) ? grid[idx(gx, gy)] : T.OPEN;
  if (t === T.WOOD) m = 0.55;
  else if (t === T.RUBBLE) m = 0.58;
  const d = Math.hypot(sx - tx, sy - ty);
  if (d > 12 && t !== T.WALL) {                    // à cheval sur la haie, on ne s'abrite pas derrière
    const ux = (sx - tx) / d, uy = (sy - ty) / d;
    for (let k = 16; k <= 56; k += 10) {
      const cx = Math.floor((tx + ux * k) / TILE), cy = Math.floor((ty + uy * k) / TILE);
      if (!inMap(cx, cy) || (cx === gx && cy === gy)) continue;
      const v = grid[idx(cx, cy)];
      if (v === T.WALL) { m = Math.min(m, 0.50); break; }
      if (v === T.WIN) { m = Math.min(m, 0.62); break; }   // embrasure : le tireur posté y est mieux loti
    }
  }
  if (m === 1) {
    if (t === T.WALL) m = 1.28;                     // en train d'enjamber : cible offerte
    else if (t === T.MARSH || t === T.ROAD) m = 1.16;
  }
  return m;
}

export const isCovered = (grid, sx, sy, tx, ty) => coverMul(grid, sx, sy, tx, ty) < 0.95;
