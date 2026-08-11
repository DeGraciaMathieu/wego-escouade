/* ==========================================================================
   Règles — lecture du terrain
   Pures : reçoivent la grille, ne la mutent pas. Importent config + geometry.
   ========================================================================== */
import { T, TI, TILE } from '../config.js';
import { idx, inMap } from './geometry.js';

export const isWallT = v => v === T.BLD || v === T.PART;

/* coût de déplacement d'une tuile (le terrain fait varier ce que coûte un mètre) */
export const tcost = (grid, x, y) => inMap(x, y) ? (TI[grid[idx(x, y)]].cost || 1) : 1;
export const tcostPx = (grid, px, py) => tcost(grid, Math.floor(px / TILE), Math.floor(py / TILE));

/* tuile infranchissable / tuile qui masque la vue */
export const solid = (grid, x, y) => !inMap(x, y) || !TI[grid[idx(x, y)]].pass;
export const blocksSight = (grid, x, y) => !inMap(x, y) || isWallT(grid[idx(x, y)]);
