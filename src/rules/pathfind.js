/* ==========================================================================
   Règles — recherche de chemin (A*) et troncature au budget
   Pures : reçoivent la grille, ne la mutent pas.
   ========================================================================== */
import { COLS, TILE, ASTAR_HEURISTIC } from '../config.js';
import { idx, inMap } from './geometry.js';
import { solid, tcost, tcostPx } from './terrain.js';

export function findPath(grid, sx, sy, tx, ty) {
  const s = idx(sx, sy), t = idx(tx, ty);
  if (solid(grid, tx, ty)) return null;
  if (s === t) return [];
  const g = new Float32Array(grid.length).fill(1e9), came = new Int32Array(grid.length).fill(-1);
  const open = [s]; g[s] = 0;
  const hf = i => Math.hypot(i % COLS - tx, (i / COLS | 0) - ty);
  const f = new Float32Array(grid.length).fill(1e9); f[s] = hf(s);
  const closed = new Uint8Array(grid.length);
  let guard = 0;
  while (open.length && guard++ < 4000) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur === t) break;
    closed[cur] = 1;
    const cx = cur % COLS, cy = cur / COLS | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (!inMap(nx, ny) || solid(grid, nx, ny)) continue;
      if (dx && dy && (solid(grid, cx + dx, cy) || solid(grid, cx, cy + dy))) continue; // pas de diagonale entre deux blocs
      const n = idx(nx, ny); if (closed[n]) continue;
      const ng = g[cur] + (dx && dy ? 1.414 : 1) * tcost(grid, nx, ny);
      if (ng < g[n]) { g[n] = ng; came[n] = cur; f[n] = ng + hf(n) * ASTAR_HEURISTIC; if (!open.includes(n)) open.push(n); }
    }
  }
  if (came[t] === -1 && t !== s) return null;
  const out = []; let c = t;
  while (c !== s && c !== -1) { out.push({ x: (c % COLS) * TILE + TILE / 2, y: (c / COLS | 0) * TILE + TILE / 2 }); c = came[c]; }
  return out.reverse();
}

/* tronque un chemin au budget de déplacement — le terrain fait varier ce que coûte un mètre */
export function trimPath(grid, x, y, path, budget) {
  const out = []; let px = x, py = y, len = 0;
  for (const p of path) {
    const d = Math.hypot(px - p.x, py - p.y), c = d * tcostPx(grid, (px + p.x) / 2, (py + p.y) / 2);
    if (len + c > budget) {
      const r = (budget - len) / c;
      if (r > 0.05) out.push({ x: px + (p.x - px) * r, y: py + (p.y - py) * r });
      len = budget; break;
    }
    out.push(p); len += c; px = p.x; py = p.y;
  }
  return { pts: out, len };
}
