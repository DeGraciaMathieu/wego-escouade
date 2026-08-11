/* ==========================================================================
   ESCOUADE — configuration
   Toutes les valeurs nommées du jeu : dimensions, timings, portées, rayons,
   seuils, tables de terrain et de classes, couleurs liées aux règles.
   Aucun import : ce module ne dépend de rien.
   ========================================================================== */

/* ---------- dimensions ---------- */
export const W = 1200, H = 680, TILE = 40, COLS = 30, ROWS = 17;

/* ---------- durée de partie ---------- */
export const RESOLVE = 4.5;                 // durée d'une résolution, en secondes
export const MAXTURN = 12, WINPTS = 5;

/* ---------- boucle ---------- */
export const DT_MAX = 0.05;                 // plafond de dt pour éviter les sauts (50 ms)
export const SUBSTEP = 1 / 120;             // pas de simulation interne (120 Hz effectif)

/* ---------- couleurs liées aux règles ---------- */
export const C = {paper:'#E4E0D2',open:'#DCD8C8',wall:'#4A4E47',wallTop:'#5C6058',cover:'#A79E86',
  grid:'rgba(40,50,40,.09)',blue:'#1D4E6E',blueL:'#3E92C9',red:'#A8322A',redL:'#DE6247',
  gold:'#C9A227',ink:'#2a2f28'};

/* ---------- natures de terrain ----------
   chaque nature pèse sur une variable différente : vitesse, vue, protection. */
export const T = {OPEN:0,BLD:1,WALL:2,WOOD:3,MARSH:4,ROAD:5,RUBBLE:6,FLOOR:7,WIN:8,PART:9};
export const TI = {
  0:{n:'Extérieur',        d:'à découvert, rien pour s\'abriter',      cost:1,   pass:true },
  1:{n:'Mur porteur',      d:'infranchissable, il faut beaucoup pour l\'ouvrir',cost:0,  pass:false},
  2:{n:'Mobilier bas',     d:'table, comptoir : on l\'escalade, on s\'abrite derrière',cost:3,pass:true },
  3:{n:'Mobilier haut',    d:'armoires, rayonnages : masque la vue',    cost:1.7, pass:true },
  4:{n:'Plancher effondré',d:'très lent, aucune protection',            cost:2.4, pass:true },
  5:{n:'Rue',              d:'rapide, mais totalement exposé',          cost:0.62,pass:true },
  6:{n:'Gravats',          d:'protège qui s\'y tient, ralentit',        cost:1.45,pass:true },
  7:{n:'Pièce',            d:'sol dégagé, à l\'intérieur',              cost:1,   pass:true },
  8:{n:'Fenêtre',          d:'on voit et on tire au travers ; s\'y poster protège un peu',cost:0,pass:false},
  9:{n:'Cloison',          d:'infranchissable, mais une grenade la perce sans peine',cost:0,pass:false},
};
export const TC = {part:'#7E8478',road:'#D6CAA6',roadEdge:'#B8AB86',floor:'#F1ECE1',floorLine:'#DED3BE',
  furn:'#C7BCA2',furnEdge:'#7E7462',clut:'#A3977C',clutEdge:'#6E6552',
  broke:'#B3A78F',brokeDark:'#7E7460',rubble:'#C6BA9E',rubbleDark:'#8A806C',win:'#A9D2DD'};

/* ---------- classes d'unité ---------- */
export const CLS = {
  ecl:{name:'Éclaireur',tag:'ÉCL',hp:70, move:270, dmg:9,  cd:0.10, ideal:150, fall:200, acc:0.56, supp:3, movePen:0.55, spread:0.055},
  fus:{name:'Fusilier', tag:'FUS',hp:90, move:210, dmg:20, cd:0.60, ideal:330, fall:370, acc:0.70, supp:6, movePen:0.45, spread:0.02},
  mit:{name:'Mitrailleur',tag:'MIT',hp:100,move:145, dmg:11, cd:0.13, ideal:300, fall:300, acc:0.32, supp:9, movePen:0.22, spread:0.05},
  gre:{name:'Grenadier',tag:'GRE',hp:85, move:200, dmg:15, cd:0.45, ideal:230, fall:260, acc:0.56, supp:5, movePen:0.45, spread:0.03, nades:2},
};
export const ROSTER = ['ecl','fus','mit','gre'];

/* ---------- zone du hall central ---------- */
export const HALLZ = {x0:12,y0:6,x1:17,y1:10};   // le hall, toujours en jeu

/* ---------- vision, course, guet ---------- */
export const VIEW = 580;                     // portée de vision, en pixels
export const RUN = 1.7, NOISE_R = 300, NOISE_EVERY = 0.45;   // course : multiplicateur, portée et cadence du bruit
export const WATCH_CONE = 0.35, WATCH_DELAY = 0.22;         // demi-angle du cône de guet (~40°) et délai de réaction

/* ---------- déplacement / pathfinding ---------- */
export const ASTAR_HEURISTIC = 0.62;         // facteur heuristique A*
export const MOVE_SUPP_PENALTY = 0.72;       // pénalité de vitesse sous suppression forte

/* ---------- suppression ---------- */
export const SUPP_DECAY = 14;                // vitesse de décrue de la suppression pendant la résolution (par seconde)
export const SUPP_ENDTURN_MULT = 0.45;       // décrue de la suppression entre les tours

/* ---------- balles ---------- */
export const BULLET_SUPP_R = 44;             // rayon de suppression d'une balle au passage, en pixels
export const BULLET_IMPACT_R = 13;           // rayon d'impact d'une balle sur la cible, en pixels

/* ---------- grenade / fumigène ---------- */
export const EXPLOSION_R = 95;               // rayon de dégâts d'une grenade, en pixels
export const EXPLOSION_SUPP_R_MULT = 1.8;    // le rayon de suppression vaut EXPLOSION_R * ce facteur
export const NADE_RANGE = 420;               // portée de lancer de la grenade (joueur), en pixels
export const NADE_ARC_DUR = 1.0;             // durée de vol d'une grenade, en secondes
export const SMOKE_R = 80;                   // rayon du volume de fumée, en pixels
export const SMOKE_TURNS = 3;                // nombre de tours pendant lesquels un fumigène persiste
export const SMOKE_RANGE = 380;              // portée de lancer du fumigène (joueur), en pixels

/* ---------- génération de carte ---------- */
export const MAP_ATTEMPTS = 40;              // nombre d'essais de génération valide
export const MAP_PASS_MIN = 0.5;             // proportion de tuiles franchissables requise
export const MAP_FLOOR_MIN = 0.26;           // proportion de tuiles FLOOR requise
export const MAP_REACH_MIN = 0.94;           // proportion des tuiles intérieures devant être atteignables

/* ---------- replay ---------- */
export const REC_HZ = 60;                    // fréquence d'enregistrement du replay (images/seconde)
export const UF = 7, BF = 7;                 // nombre de floats par unité / par balle dans une image de replay
