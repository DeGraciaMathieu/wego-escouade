/* ==========================================================================
   Règles — contrôle des zones et conditions de victoire
   Pures : décident, ne mutent rien. La boucle applique la décision (z.held,
   scores, fin de partie).
   ========================================================================== */
import { TILE, WINPTS } from '../config.js';
import { inZone } from './geometry.js';

/* on tient une zone si l'on y est plus nombreux ; renvoie le tenant de chaque zone */
export function zoneControl(zones, units) {
  const holders = zones.map(z => {
    const cnt = s => units.filter(u => u.alive && u.side === s
      && inZone(z, Math.floor(u.x / TILE), Math.floor(u.y / TILE))).length;
    const b = cnt('b'), r = cnt('r');
    return b > r ? 'b' : r > b ? 'r' : null;
  });
  const zb = holders.filter(h => h === 'b').length;
  const zr = holders.filter(h => h === 'r').length;
  return { holders, zb, zr };
}

/* le point du tour va à qui tient le plus de zones */
export const roundPoint = (zb, zr) => zb > zr ? 'b' : zr > zb ? 'r' : null;

/* fin de partie par élimination ou par contrôle des zones (null = la partie continue) */
export function victoryOutcome({ aliveR, aliveB, scoreB, scoreR }) {
  if (!aliveR) return { title: 'Objectif atteint', sub: 'Escouade adverse neutralisée' };
  if (!aliveB) return { title: 'Escouade perdue', sub: 'Plus aucune unité en état de combattre' };
  if (scoreB >= WINPTS) return { title: 'Objectifs tenus', sub: 'Contrôle des zones assuré' };
  if (scoreR >= WINPTS) return { title: 'Objectifs perdus', sub: "L'ennemi contrôle les zones" };
  return null;
}

/* fin de partie au temps imparti : la victoire va au plus de points */
export const timeUpOutcome = (scoreB, scoreR) => ({
  title: scoreB > scoreR ? 'Victoire aux points' : scoreB < scoreR ? 'Défaite aux points' : 'Match nul',
  sub: 'Fin du temps imparti',
});
