/* ==========================================================================
   Règles — géométrie de la grille et des zones
   Pures : ne dépendent que de config. Aucune lecture d'état, aucun aléa.
   ========================================================================== */
import { COLS, ROWS, TILE } from '../config.js';

export const idx = (x, y) => y * COLS + x;
export const inMap = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;

export const inZone = (z, x, y) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1;
export const inAnyZone = (zones, x, y) => zones.some(z => inZone(z, x, y));
export const zoneCenter = z => ({ x: (z.x0 + z.x1 + 1) / 2 * TILE, y: (z.y0 + z.y1 + 1) / 2 * TILE });
