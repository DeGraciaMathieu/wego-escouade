/* ==========================================================================
   Règles — ligne de vue
   Les bâtiments coupent net ; le bois et le fumigène masquent à partir de
   deux tuiles traversées. Pur : reçoit la grille et la grille de fumée.
   ========================================================================== */
import { T, TILE } from '../config.js';
import { idx, inMap } from './geometry.js';
import { blocksSight } from './terrain.js';

export function los(grid, smokeGrid, ax, ay, bx, by) {
  let x0 = Math.floor(ax / TILE), y0 = Math.floor(ay / TILE);
  const x1 = Math.floor(bx / TILE), y1 = Math.floor(by / TILE);
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, guard = 0, wood = 0;
  while (guard++ < 200) {
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
    if (x0 === x1 && y0 === y1) return true;
    if (blocksSight(grid, x0, y0)) return false;
    if (inMap(x0, y0) && (grid[idx(x0, y0)] === T.WOOD || smokeGrid[idx(x0, y0)]) && ++wood >= 2) return false;
  }
  return true;
}
