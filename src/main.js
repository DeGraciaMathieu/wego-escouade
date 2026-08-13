"use strict";
/* ==========================================================================
   ESCOUADE — jeu de stratégie WEGO à échelle réduite
   Un ordre = un déplacement ET un tir, posés en même temps que l'IA,
   puis résolus simultanément pendant 4,5 s de temps réel.
   ========================================================================== */

import {
  W, H, TILE, COLS, ROWS, RESOLVE, MAXTURN, WINPTS, DT_MAX, SUBSTEP,
  C, T, TI, TC, CLS, ROSTER, HALLZ,
  VIEW, RUN, NOISE_R, NOISE_EVERY, WATCH_CONE, WATCH_DELAY,
  ASTAR_HEURISTIC, MOVE_SUPP_PENALTY, SUPP_DECAY, SUPP_ENDTURN_MULT,
  BULLET_SUPP_R, BULLET_IMPACT_R,
  EXPLOSION_R, EXPLOSION_SUPP_R_MULT, NADE_RANGE, NADE_ARC_DUR,
  SMOKE_R, SMOKE_TURNS, SMOKE_RANGE,
  MAP_ATTEMPTS, MAP_PASS_MIN, MAP_FLOOR_MIN, MAP_REACH_MIN,
  REC_HZ, UF, BF,
  ARCHETYPES, ARCHETYPE_ORDER,
} from './config.js';
import { createRng } from './rng.js';
import { idx, inMap, inZone, inAnyZone, zoneCenter } from './rules/geometry.js';
import { isWallT, tcost, tcostPx, solid, blocksSight } from './rules/terrain.js';
import { coverMul, isCovered } from './rules/cover.js';
import { los } from './rules/los.js';
import { findPath, trimPath } from './rules/pathfind.js';
import { zoneControl, roundPoint, victoryOutcome, timeUpOutcome } from './rules/victory.js';
import { hitChance, shotAngle } from './rules/combat.js';
import { threatTiles } from './rules/threat.js';
import { sfx, audio } from './audio/audio.js';
import { generateMap } from './state/mapgen.js';
import { aiPlan } from './ai/plan.js';

const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
const terrainCv=document.createElement('canvas'); terrainCv.width=W; terrainCv.height=H;
const tctx=terrainCv.getContext('2d');
const decalCv=document.createElement('canvas'); decalCv.width=W; decalCv.height=H;
const dctx=decalCv.getContext('2d');

/* ---------- utilitaires ---------- */
const rnd=(a,b)=>a+Math.random()*(b-a);           // aléa cosmétique (particules, écran, textures)
let rng=createRng(1);                             // aléa de jeu, seedé — réamorcé à chaque partie
const grnd=(a,b)=>a+rng()*(b-a);                  // flottant de jeu
const rint=(a,b)=>Math.floor(grnd(a,b+1));        // entier de jeu (buildMap, IA) — seedé
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const dist=(a,b,c,d)=>Math.hypot(a-c,b-d);

/* ---------- état ---------- */
let grid, indoor, rooms, units, bullets, parts, nades, smokes, smokeGrid;
let turn, phase, rt, shake, hitstop, scoreB, scoreR, over;
let sel=null, mode='auto', hover={x:-999,y:-999}, hoverPath=null, speed=1;
let showThreat=false;                   // overlay de menace (touche A)
let archetypeKey='maison';              // type de terrain choisi pour la partie
let playerSquad=ROSTER.slice();         // 4 classes choisies par le joueur (une par emplacement)
let mem={};           // mémoire du joueur : dernière position connue des ennemis
let aiMem={};         // mémoire de l'IA
let zones=[];                           // zones de contrôle du tirage courant

/* ==========================================================================
   CARTE
   ========================================================================== */
function genMap(){
  ({grid,indoor,rooms,zones}=generateMap(rng,ARCHETYPES[archetypeKey]));
  mapSeed=(Math.random()*4294967296)>>>0;
  drawTerrain();
}

/* ==========================================================================
   RENDU DU TERRAIN — pré-calculé une fois par carte
   ========================================================================== */
function rr(c,x,y,w,h,r){
  c.beginPath();
  c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath();
}
function eachTile(v,fn){
  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++)
    if(grid[idx(x,y)]===v) fn(x,y,x*TILE,y*TILE);
}
/* fusionne les tuiles d'une même nature en une tache continue */
function blobLayer(v,color,grow,radius){
  tctx.fillStyle=color;
  eachTile(v,(x,y,px,py)=>{ rr(tctx,px-grow,py-grow,TILE+grow*2,TILE+grow*2,radius); tctx.fill(); });
}

let mapSeed=1, tseed=1;
/* aléa figé, réservé à la texture du terrain */
const trnd=(a,b)=>{ tseed=(tseed*1664525+1013904223)>>>0; return a+(tseed/4294967296)*(b-a); };

function drawTerrain(){
  tseed=mapSeed;   // décor identique à chaque redessin : pas de scintillement au replay
  // --- extérieur : le papier du plan ---
  tctx.fillStyle=C.paper; tctx.fillRect(0,0,W,H);
  for(let n=0;n<2600;n++){
    tctx.fillStyle=`rgba(80,80,60,${trnd(0,1)*0.045})`;
    tctx.fillRect(trnd(0,1)*W,trnd(0,1)*H,2,2);
  }
  tctx.strokeStyle=C.grid; tctx.lineWidth=1;
  tctx.beginPath();
  for(let x=0;x<=COLS;x++){tctx.moveTo(x*TILE+.5,0);tctx.lineTo(x*TILE+.5,H);}
  for(let y=0;y<=ROWS;y++){tctx.moveTo(0,y*TILE+.5);tctx.lineTo(W,y*TILE+.5);}
  tctx.stroke();

  // --- rue ---
  blobLayer(T.ROAD,TC.roadEdge,3,9);
  blobLayer(T.ROAD,TC.road,1,7);
  tctx.fillStyle='rgba(120,110,80,.30)';
  eachTile(T.ROAD,(x,y,px,py)=>{ for(let i=0;i<7;i++) tctx.fillRect(px+trnd(3,TILE-3),py+trnd(3,TILE-3),1.6,1.6); });

  // --- dalle intérieure : elle détache l'emprise du bâtiment ---
  const inside=(x,y)=>indoor[idx(x,y)]===1;
  tctx.fillStyle=TC.floor;
  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++)
    if(inside(x,y)) tctx.fillRect(x*TILE,y*TILE,TILE,TILE);
  tctx.strokeStyle=TC.floorLine; tctx.lineWidth=1; tctx.beginPath();
  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){
    if(!inside(x,y)) continue;
    const px=x*TILE, py=y*TILE;                      // lames de plancher
    for(let k=1;k<4;k++){ tctx.moveTo(px,py+k*TILE/4); tctx.lineTo(px+TILE,py+k*TILE/4); }
    tctx.moveTo(px+TILE/2,py); tctx.lineTo(px+TILE/2,py+TILE);
  }
  tctx.stroke();

  // --- plancher effondré ---
  tctx.fillStyle=TC.broke;
  eachTile(T.MARSH,(x,y,px,py)=>tctx.fillRect(px,py,TILE,TILE));
  tctx.strokeStyle=TC.brokeDark; tctx.lineWidth=1.4;
  eachTile(T.MARSH,(x,y,px,py)=>{
    tctx.beginPath();
    for(let i=0;i<3;i++){
      let lx=px+trnd(2,10), ly=py+trnd(2,TILE-4);
      tctx.moveTo(lx,ly);
      for(let k=0;k<4;k++){ lx+=trnd(5,10); ly+=trnd(-6,6); tctx.lineTo(lx,ly); }
    }
    tctx.stroke();
  });

  // --- gravats ---
  blobLayer(T.RUBBLE,'rgba(120,110,85,.20)',2,5);
  blobLayer(T.RUBBLE,TC.rubble,0,4);
  eachTile(T.RUBBLE,(x,y,px,py)=>{
    for(let i=0;i<9;i++){
      tctx.save();
      tctx.translate(px+trnd(5,TILE-5),py+trnd(5,TILE-5)); tctx.rotate(trnd(0,3.14));
      tctx.fillStyle=trnd(0,1)<.5?TC.rubbleDark:'#a99e85';
      const w=trnd(3,8); tctx.fillRect(-w/2,-1.6,w,3.2);
      tctx.restore();
    }
  });

  // --- mobilier haut : armoires et rayonnages, dessinés en plan ---
  eachTile(T.WOOD,(x,y,px,py)=>{
    tctx.fillStyle='rgba(20,25,20,.18)'; rr(tctx,px+5,py+7,TILE-9,TILE-12,2); tctx.fill();
    tctx.fillStyle=TC.clut; tctx.strokeStyle=TC.clutEdge; tctx.lineWidth=1.3;
    rr(tctx,px+4,py+5,TILE-9,TILE-12,2); tctx.fill(); tctx.stroke();
    tctx.strokeStyle='rgba(60,55,42,.45)'; tctx.lineWidth=1; tctx.beginPath();
    for(let k=1;k<3;k++){ tctx.moveTo(px+5,py+5+k*(TILE-12)/3); tctx.lineTo(px+TILE-5,py+5+k*(TILE-12)/3); }
    tctx.stroke();
  });

  // --- mobilier bas : tables, comptoirs, murets ---
  const isLow=(x,y)=>inMap(x,y)&&grid[idx(x,y)]===T.WALL;
  eachTile(T.WALL,(x,y,px,py)=>{
    if(inside(x,y)){                                 // meuble, dessiné en plan
      tctx.fillStyle='rgba(20,25,20,.14)'; rr(tctx,px+7,py+9,TILE-12,TILE-15,3); tctx.fill();
      tctx.fillStyle=TC.furn; tctx.strokeStyle=TC.furnEdge; tctx.lineWidth=1.3;
      rr(tctx,px+6,py+7,TILE-12,TILE-15,3); tctx.fill(); tctx.stroke();
      tctx.strokeStyle='rgba(90,82,66,.4)'; tctx.lineWidth=1;
      tctx.beginPath(); tctx.moveTo(px+9,py+10); tctx.lineTo(px+TILE-9,py+TILE-11); tctx.stroke();
    } else {                                         // muret de clôture, élément linéaire
      const h=isLow(x-1,y)||isLow(x+1,y), v=isLow(x,y-1)||isLow(x,y+1);
      const cx=px+TILE/2, cy=py+TILE/2, th=15;
      const band=(w,hh,ox,oy)=>{ rr(tctx,cx-w/2+ox,cy-hh/2+oy,w,hh,4); tctx.fill(); };
      tctx.fillStyle='rgba(20,25,20,.15)';
      if(h||!v) band(h?TILE+1:19,th,2,3); if(v) band(th,v?TILE+1:19,2,3);
      tctx.fillStyle=C.cover;
      if(h||!v) band(h?TILE+1:19,th,0,0); if(v) band(th,v?TILE+1:19,0,0);
      tctx.strokeStyle='rgba(70,68,52,.5)'; tctx.lineWidth=1; tctx.beginPath();
      for(let i=0;i<5;i++){
        if(h||!v){ const lx=px+5+i*7.5; tctx.moveTo(lx,cy-5); tctx.lineTo(lx-3,cy+5); }
        if(v){ const ly=py+5+i*7.5; tctx.moveTo(cx-5,ly); tctx.lineTo(cx+5,ly-3); }
      }
      tctx.stroke();
    }
  });

  // --- zone de contrôle ---
  tctx.save();
  for(const z of zones){
    const ox=z.x0*TILE, oy=z.y0*TILE, ow=(z.x1-z.x0+1)*TILE, oh=(z.y1-z.y0+1)*TILE;
    tctx.fillStyle='rgba(201,162,39,.13)'; tctx.fillRect(ox,oy,ow,oh);
    tctx.strokeStyle='rgba(150,120,20,.6)'; tctx.lineWidth=2; tctx.setLineDash([9,7]);
    tctx.strokeRect(ox+1,oy+1,ow-2,oh-2); tctx.setLineDash([]);
    tctx.fillStyle='rgba(110,88,14,.75)'; tctx.font='bold 10px "Arial Narrow",sans-serif';
    tctx.fillText('◈ '+z.n,ox+7,oy+14);
  }
  tctx.restore();

  // --- murs : les tuiles voisines forment un seul mur, contour extérieur seulement ---
  const isW=(x,y)=>inMap(x,y)&&(isWallT(grid[idx(x,y)])||grid[idx(x,y)]===T.WIN);
  const isB=(x,y)=>inMap(x,y)&&grid[idx(x,y)]===T.BLD;
  tctx.fillStyle='rgba(20,25,20,.24)';
  eachTile(T.BLD,(x,y,px,py)=>tctx.fillRect(px+3,py+4,TILE,TILE));
  tctx.fillStyle='rgba(20,25,20,.14)';
  eachTile(T.PART,(x,y,px,py)=>tctx.fillRect(px+2,py+3,TILE,TILE));
  tctx.fillStyle=C.wall;
  eachTile(T.BLD,(x,y,px,py)=>tctx.fillRect(px,py,TILE,TILE));
  tctx.fillStyle=TC.part;                          // cloison : plus claire, la grenade l'ouvre
  eachTile(T.PART,(x,y,px,py)=>tctx.fillRect(px,py,TILE,TILE));

  // --- fenêtres : une trouée claire dans l'épaisseur du mur ---
  eachTile(T.WIN,(x,y,px,py)=>{
    const h=isW(x-1,y)||isW(x+1,y);
    tctx.fillStyle='rgba(20,25,20,.24)'; tctx.fillRect(px+3,py+4,TILE,TILE);
    tctx.fillStyle=C.wall; tctx.fillRect(px,py,TILE,TILE);
    tctx.fillStyle=TC.win;
    if(h) tctx.fillRect(px,py+5,TILE,TILE-10); else tctx.fillRect(px+5,py,TILE-10,TILE);
    tctx.strokeStyle='rgba(250,255,255,.75)'; tctx.lineWidth=1.4;
    tctx.beginPath();
    if(h){                                        // appui, linteau et petit bois
      tctx.moveTo(px,py+5.5); tctx.lineTo(px+TILE,py+5.5);
      tctx.moveTo(px,py+TILE-5.5); tctx.lineTo(px+TILE,py+TILE-5.5);
      tctx.moveTo(px+TILE/2,py+6); tctx.lineTo(px+TILE/2,py+TILE-6);
    } else {
      tctx.moveTo(px+5.5,py); tctx.lineTo(px+5.5,py+TILE);
      tctx.moveTo(px+TILE-5.5,py); tctx.lineTo(px+TILE-5.5,py+TILE);
      tctx.moveTo(px+6,py+TILE/2); tctx.lineTo(px+TILE-6,py+TILE/2);
    }
    tctx.stroke();
  });

  tctx.strokeStyle='#1b1f19'; tctx.lineWidth=2; tctx.beginPath();
  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){
    if(!isW(x,y)) continue;
    const px=x*TILE, py=y*TILE;
    if(!isW(x,y-1)){ tctx.moveTo(px,py+1); tctx.lineTo(px+TILE,py+1); }
    if(!isW(x,y+1)){ tctx.moveTo(px,py+TILE-1); tctx.lineTo(px+TILE,py+TILE-1); }
    if(!isW(x-1,y)){ tctx.moveTo(px+1,py); tctx.lineTo(px+1,py+TILE); }
    if(!isW(x+1,y)){ tctx.moveTo(px+TILE-1,py); tctx.lineTo(px+TILE-1,py+TILE); }
  }
  tctx.stroke();
  tctx.fillStyle=C.wallTop;                          // arête éclairée des murs
  eachTile(T.BLD,(x,y,px,py)=>{ if(!isB(x,y-1)&&!isW(x,y-1)) tctx.fillRect(px,py,TILE,4); });

  // --- noms des pièces, à la manière d'un plan d'architecte ---
  tctx.save();
  tctx.textAlign='center'; tctx.font='9px "Arial Narrow",sans-serif';
  for(const r of rooms){
    tctx.strokeStyle='rgba(241,236,225,.8)'; tctx.lineWidth=3; tctx.strokeText(r.n,r.x,r.y+3);
    tctx.fillStyle='rgba(96,102,92,.9)'; tctx.fillText(r.n,r.x,r.y+3);
  }
  tctx.restore(); tctx.textAlign='left';

  // --- repères ---
  tctx.fillStyle='rgba(40,50,40,.35)'; tctx.font='10px ui-monospace,monospace';
  for(let x=0;x<COLS;x+=5) tctx.fillText(String(x).padStart(2,'0'),x*TILE+3,11);
  for(let y=5;y<ROWS;y+=5) tctx.fillText(String(y).padStart(2,'0'),3,y*TILE+11);

  dctx.clearRect(0,0,W,H);
}

/* une cloison cède : on repeint la tuile sur le calque de terrain, sans tout redessiner */
function breach(gx,gy){
  recEvent('breach',{gx,gy});
  grid[idx(gx,gy)]=T.RUBBLE;
  const px=gx*TILE, py=gy*TILE, ins=indoor[idx(gx,gy)];
  tctx.save();
  tctx.beginPath(); tctx.rect(px,py,TILE,TILE); tctx.clip();
  tctx.fillStyle=ins?TC.floor:C.paper; tctx.fillRect(px,py,TILE,TILE);
  if(ins){
    tctx.strokeStyle=TC.floorLine; tctx.lineWidth=1; tctx.beginPath();
    for(let k=1;k<4;k++){ tctx.moveTo(px,py+k*TILE/4); tctx.lineTo(px+TILE,py+k*TILE/4); }
    tctx.moveTo(px+TILE/2,py); tctx.lineTo(px+TILE/2,py+TILE); tctx.stroke();
  }
  tctx.fillStyle='rgba(20,25,20,.24)';           // ombres portées des murs voisins
  for(const [dx,dy] of [[-1,0],[0,-1],[-1,-1]]){
    const nx=gx+dx, ny=gy+dy;
    if(inMap(nx,ny)&&isWallT(grid[idx(nx,ny)])) tctx.fillRect(nx*TILE+3,ny*TILE+4,TILE,TILE);
  }
  tctx.fillStyle=TC.rubble; rr(tctx,px+1,py+1,TILE-2,TILE-2,5); tctx.fill();
  for(let i=0;i<12;i++){
    tctx.save();
    tctx.translate(px+trnd(5,TILE-5),py+trnd(5,TILE-5)); tctx.rotate(trnd(0,3.14));
    tctx.fillStyle=trnd(0,1)<.5?TC.rubbleDark:'#a99e85';
    const w=trnd(3,9); tctx.fillRect(-w/2,-1.8,w,3.6);
    tctx.restore();
  }
  tctx.restore();
  // le mur voisin montre maintenant sa tranche
  const isW=(x,y)=>inMap(x,y)&&(isWallT(grid[idx(x,y)])||grid[idx(x,y)]===T.WIN);
  tctx.strokeStyle='#1b1f19'; tctx.lineWidth=2; tctx.beginPath();
  if(isW(gx-1,gy)){ tctx.moveTo(px-1,py); tctx.lineTo(px-1,py+TILE); }
  if(isW(gx+1,gy)){ tctx.moveTo(px+TILE+1,py); tctx.lineTo(px+TILE+1,py+TILE); }
  if(isW(gx,gy-1)){ tctx.moveTo(px,py-1); tctx.lineTo(px+TILE,py-1); }
  if(isW(gx,gy+1)){ tctx.moveTo(px,py+TILE+1); tctx.lineTo(px+TILE,py+TILE+1); }
  tctx.stroke();
  for(let i=0;i<10;i++){
    const a=trnd(0,1)*6.283, sp=trnd(40,260);
    parts.push({x:px+TILE/2,y:py+TILE/2,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,g:220,drag:3,t:0,
      life:trnd(.3,.7),size:trnd(2,5),col:'#8A806C',type:'spark'});
  }
}




/* ==========================================================================
   PATHFINDING
   ========================================================================== */

/* ==========================================================================
   UNITÉS
   ========================================================================== */
let uid=1;
function mkUnit(side,cls,x,y){
  const c=CLS[cls]; c.cls=cls;
  return {id:uid++,side,cls,c,x,y,hp:c.hp,maxHp:c.hp,supp:0,alive:true,
    aim:side==='b'?0:Math.PI, cd:0, moving:false, walk:rnd(0,6.28), nades:c.nades||0, smoke:c.cls==='gre'?2:1,
    mv:null, fire:null, seen:false, flash:0, hurt:0};
}
function setupUnits(){
  units=[]; uid=1;
  const ys=[2,6,10,14];
  for(let i=0;i<ys.length;i++){
    units.push(mkUnit('b',playerSquad[i],1.5*TILE,(ys[i]+.5)*TILE));   // escouade du joueur
    units.push(mkUnit('r',ROSTER[i],(COLS-1.5)*TILE,(ROWS-1-ys[i]+.5)*TILE));  // IA : roster standard
  }
}
const alive=s=>units.filter(u=>u.alive&&u.side===s);
const byId=i=>units.find(u=>u.id===i);

/* ennemis connus du joueur : vus (position réelle) ou en mémoire récente (≤3 tours),
   avec leur portée de tir efficace — sert à l'affichage de menace et de couverture */
function knownEnemies(){
  const out=[];
  for(const u of units){
    if(u.side!=='r'||!u.alive) continue;
    const reach=u.c.ideal+u.c.fall;
    if(u.seen) out.push({x:u.x,y:u.y,reach});
    else { const m=mem[u.id]; if(m&&turn-m.turn<=3) out.push({x:m.x,y:m.y,reach}); }
  }
  return out;
}

/* visibilité : une unité voit à VIEW px avec ligne de vue */
function updateVision(){
  for(const u of units){
    if(u.side==='r'){
      u.seen=u.alive&&alive('b').some(o=>dist(o.x,o.y,u.x,u.y)<VIEW&&los(grid,smokeGrid,o.x,o.y,u.x,u.y));
      if(u.seen) mem[u.id]={x:u.x,y:u.y,turn};
    } else {
      u.seen=u.alive&&alive('r').some(o=>dist(o.x,o.y,u.x,u.y)<VIEW&&los(grid,smokeGrid,o.x,o.y,u.x,u.y));
      if(u.seen) aiMem[u.id]={x:u.x,y:u.y,turn};
    }
  }
}

/* ==========================================================================
   PHASE D'ORDRES — saisie joueur
   ========================================================================== */
function orderMove(u,mx,my,run){
  const gx=clamp(Math.floor(mx/TILE),0,COLS-1), gy=clamp(Math.floor(my/TILE),0,ROWS-1);
  const p=findPath(grid,Math.floor(u.x/TILE),Math.floor(u.y/TILE),gx,gy);
  if(!p){ sfx('deny'); return; }
  const t=trimPath(grid,u.x,u.y,p,u.c.move*(run?RUN:1));
  if(!t.pts.length){ u.mv=null; return; }
  u.mv={pts:t.pts,i:0,run:!!run,raw:p};
  if(run) u.fire=null;                       // on court, on ne tire pas
  sfx('pen');
}
/* poser un ordre de tir sur une unité lancée : elle repasse au pas */
function walkAgain(u){
  if(!u.mv||!u.mv.run) return;
  const t=trimPath(grid,u.x,u.y,u.mv.raw,u.c.move);
  u.mv=t.pts.length?{pts:t.pts,i:0,run:false,raw:u.mv.raw}:null;
}
function orderFireUnit(u,target){ walkAgain(u); u.fire={kind:'unit',id:target.id}; sfx('pen'); }
function orderFirePoint(u,x,y){ walkAgain(u); u.fire={kind:'point',x,y}; sfx('pen'); }
function orderWatch(u,x,y){
  if(dist(u.x,u.y,x,y)<12){ sfx('deny'); return; }
  walkAgain(u);
  u.fire={kind:'watch',ang:Math.atan2(y-u.y,x-u.x),x,y};
  sfx('pen');
}
function orderSmoke(u,x,y){
  if(u.smoke<=0){ sfx('deny'); return; }
  if(dist(u.x,u.y,x,y)>SMOKE_RANGE){ sfx('deny'); return; }
  walkAgain(u); u.fire={kind:'smoke',x,y}; sfx('pen');
}
function orderNade(u,x,y){
  if(u.nades<=0){ sfx('deny'); return; }
  if(dist(u.x,u.y,x,y)>NADE_RANGE){ sfx('deny'); return; }
  walkAgain(u); u.fire={kind:'nade',x,y}; sfx('pen');
}

/* ==========================================================================
   IA — pose ses ordres en même temps que le joueur
   ========================================================================== */

/* ==========================================================================
   RÉSOLUTION SIMULTANÉE
   ========================================================================== */
function beginResolve(){
  phase='resolve'; rt=0;
  aiPlan({units, zones, aiMem, grid, smokeGrid, turn, scoreB, scoreR}, rng);
  recBeginTurn();
  for(const u of units){ u.cd=grnd(0,u.c.cd); u.moving=!!u.mv; }
  sfx('go'); refreshUI();
}

function step(dt){
  rt+=dt;

  // --- déplacements ---
  for(const u of units){
    if(!u.alive||!u.mv) continue;
    const ox=u.x, oy=u.y;
    let sp=u.c.move*(u.mv.run?RUN:1)/RESOLVE*(u.supp>50?MOVE_SUPP_PENALTY:1)/tcostPx(grid,u.x,u.y);
    let budget=sp*dt;
    while(budget>0&&u.mv&&u.mv.i<u.mv.pts.length){
      const p=u.mv.pts[u.mv.i], d=dist(u.x,u.y,p.x,p.y);
      if(d<=budget){ u.x=p.x; u.y=p.y; budget-=d; u.mv.i++; }
      else{ u.x+=(p.x-u.x)/d*budget; u.y+=(p.y-u.y)/d*budget; budget=0; }
    }
    u.moving=u.mv&&u.mv.i<u.mv.pts.length;
    const dm=dist(ox,oy,u.x,u.y);
    u.walk+=dm*0.40;
    if(dm>0.02&&!u.fire){                       // sans cible, on regarde où l'on va
      const a=Math.atan2(u.y-oy,u.x-ox);
      let da=a-u.aim; while(da>Math.PI)da-=2*Math.PI; while(da<-Math.PI)da+=2*Math.PI;
      u.aim+=clamp(da,-9*dt,9*dt);
    }
    if(u.mv&&u.mv.run&&u.moving){                 // la course s'entend à travers les cloisons
      u.noise=(u.noise||0)-dt;
      if(u.noise<=0){ u.noise=NOISE_EVERY; noisePing(u); }
      if(Math.random()<dt*14) puff(u.x-Math.cos(u.aim)*10,u.y-Math.sin(u.aim)*10,1);
    }
    if(!u.moving&&Math.random()<dt*6) puff(u.x,u.y+8,1);
  }

  // --- tirs ---
  for(const u of units){
    if(!u.alive||!u.fire) continue;
    let tx,ty,tgt=null,watching=false;
    const kind=u.fire.kind;

    if(kind==='nade'||kind==='smoke'){            // engin lancé une seule fois
      if(u.fire.done) continue;
      if(rt>0.35){ throwNade(u,u.fire.x,u.fire.y,kind==='smoke'); u.fire.done=true; }
      continue;
    }
    if(kind==='watch'){                           // guet : on n'ouvre le feu que si ça entre dans le cône
      if(rt<WATCH_DELAY) continue;
      let best=null,bd=1e9;
      for(const e of units){
        if(!e.alive||e.side===u.side) continue;
        const d=dist(u.x,u.y,e.x,e.y);
        if(d>u.c.ideal+u.c.fall||d>VIEW) continue;
        let da=Math.atan2(e.y-u.y,e.x-u.x)-u.fire.ang;
        while(da>Math.PI)da-=2*Math.PI; while(da<-Math.PI)da+=2*Math.PI;
        if(Math.abs(da)>WATCH_CONE) continue;
        if(!los(grid,smokeGrid,u.x,u.y,e.x,e.y)) continue;
        if(d<bd){ bd=d; best=e; }
      }
      if(!best){                                  // rien en vue : on reste l'arme épaulée sur le cône
        let da=u.fire.ang-u.aim;
        while(da>Math.PI)da-=2*Math.PI; while(da<-Math.PI)da+=2*Math.PI;
        u.aim+=clamp(da,-5*dt,5*dt);
        u.cd=Math.max(u.cd,0.10);
        continue;
      }
      tgt=best; tx=best.x; ty=best.y; watching=true;
      if(!u.fire.seen){ u.fire.seen=true; sfx('spot'); }
    }
    else if(kind==='unit'){
      tgt=byId(u.fire.id);
      if(!tgt||!tgt.alive){ u.fire=null; continue; }
      const visible=dist(u.x,u.y,tgt.x,tgt.y)<VIEW&&los(grid,smokeGrid,u.x,u.y,tgt.x,tgt.y);
      const m=(u.side==='b'?mem:aiMem)[tgt.id];
      if(visible){ tx=tgt.x; ty=tgt.y; }
      else if(m){ tx=m.x; ty=m.y; tgt=null; }       // on arrose la dernière position connue
      else continue;
    }
    else { tx=u.fire.x; ty=u.fire.y; }              // suppression sur position

    const ang=Math.atan2(ty-u.y,tx-u.x);
    let da=ang-u.aim; while(da>Math.PI)da-=2*Math.PI; while(da<-Math.PI)da+=2*Math.PI;
    u.aim+=clamp(da,-7*dt,7*dt);

    const d=dist(u.x,u.y,tx,ty);
    if(d>u.c.ideal+u.c.fall) continue;
    if(!los(grid,smokeGrid,u.x,u.y,tx,ty)) continue;

    u.cd-=dt;
    if(u.cd<=0){
      u.cd+=u.c.cd;
      let hit=false;
      if(tgt){
        const cover=coverMul(grid,u.x,u.y,tgt.x,tgt.y);
        const targetRunning=!!(tgt.mv&&tgt.mv.run&&tgt.moving);
        const acc=hitChance({c:u.c,d,moving:u.moving,supp:u.supp,watching,cover,targetRunning});
        hit=rng()<acc;
      }
      fire(u,tx,ty,hit,tgt);
    }
  }

  // --- projectiles ---
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    const nx=b.x+b.vx*dt, ny=b.y+b.vy*dt;
    b.life-=dt;
    b.st-=dt;
    if(b.st<=0){ b.st=0.035; wake(b,b.trc?0.34:0.16); }
    // impact mur
    const gx=Math.floor(nx/TILE), gy=Math.floor(ny/TILE);
    if(!inMap(gx,gy)||b.life<=0){ bullets.splice(i,1); continue; }
    const gt=grid[idx(gx,gy)];
    if(isWallT(gt)){ wake(b,.5); impact(nx,ny,'#d8c98a'); sparks(nx,ny,'#d8c98a',7);
      decal(nx,ny,4,'rgba(30,30,25,.5)'); bullets.splice(i,1); continue; }
    if(gt===T.WOOD&&rng()<Math.hypot(b.vx,b.vy)*dt*0.0055){   // un tronc l'a pris
      wake(b,.4); sparks(nx,ny,'#6f8c4e',5); bullets.splice(i,1); continue; }
    // suppression au passage + impact
    for(const u of units){
      if(!u.alive||u.side===b.side) continue;
      const dd=dist(u.x,u.y,nx,ny);
      if(dd<BULLET_SUPP_R) u.supp=Math.min(100,u.supp+b.supp*dt*8);
      if(b.hit&&b.tid===u.id&&dd<BULLET_IMPACT_R){
        damage(u,b.dmg,b.side); u.supp=Math.min(100,u.supp+b.supp*2.2);
        wake(b,.55); impact(nx,ny,'#ff5f3a'); sparks(nx,ny,'#c0392b',9); shake=Math.max(shake,3);
        bullets.splice(i,1); b.dead=true; break;
      }
    }
    if(b.dead) continue;
    b.px=b.x; b.py=b.y; b.x=nx; b.y=ny;
    if(b.life<0.02||dist(b.x,b.y,b.tx,b.ty)<8&&!b.hit){
      wake(b,.35);
      if(!isWallT(grid[idx(clamp(gx,0,COLS-1),clamp(gy,0,ROWS-1))])){ puff(b.x,b.y,2); decal(b.x,b.y,3,'rgba(40,40,30,.35)'); }
      bullets.splice(i,1);
    }
  }

  // --- grenades ---
  for(let i=nades.length-1;i>=0;i--){
    const g=nades[i]; g.t+=dt;
    const k=Math.min(1,g.t/g.dur);
    g.x=g.sx+(g.tx-g.sx)*k; g.y=g.sy+(g.ty-g.sy)*k; g.z=Math.sin(k*Math.PI)*70;
    if(k>=1){ if(g.smoke) popSmoke(g.x,g.y); else explode(g.x,g.y,g.side); nades.splice(i,1); }
  }

  updateParts(dt);

  // --- décrue de la suppression ---
  while(curRec&&!replaying&&curRec.frames.length<Math.min(rt,RESOLVE)*REC_HZ) recFrame();
  for(const u of units) if(u.alive) u.supp=Math.max(0,u.supp-SUPP_DECAY*dt);
  shake=Math.max(0,shake-40*dt);
  for(const u of units){ u.flash=Math.max(0,u.flash-dt*7); u.hurt=Math.max(0,u.hurt-dt*4); }
  updateVision();
}

/* le bruit d'une course : il traverse les murs et met à jour la mémoire de l'adversaire */
function noisePing(u){
  const foeMem=u.side==='b'?aiMem:mem;
  let heardByPlayer=(u.side==='b');
  for(const e of units){
    if(!e.alive||e.side===u.side) continue;
    if(dist(e.x,e.y,u.x,u.y)>NOISE_R) continue;
    foeMem[u.id]={x:u.x,y:u.y,turn,heard:true};
    if(e.side==='b') heardByPlayer=true;
  }
  if(heardByPlayer)
    parts.push({type:'ping',x:u.x,y:u.y,vx:0,vy:0,g:0,drag:0,t:0,life:1.0,
      size:NOISE_R*0.42,col:u.side==='b'?'62,146,201':'222,98,71'});
}

function updateParts(dt){
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i]; p.t+=dt;
    if(p.t>=p.life){ parts.splice(i,1); continue; }
    if(p.type==='wake'||p.type==='pop'||p.type==='ping') continue;
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=1-p.drag*dt; p.vy*=1-p.drag*dt; p.vy+=p.g*dt;
  }
}

function fire(u,tx,ty,hit,tgt){
  const base=Math.atan2(ty-u.y,tx-u.x);
  const a=shotAngle(base,u.c.spread,hit,rng);
  const sp=1060, d=dist(u.x,u.y,tx,ty)+60;
  const bx=u.x+Math.cos(a)*17, by=u.y+Math.sin(a)*17;
  bullets.push({x:bx,y:by,px:bx,py:by,ox:bx,oy:by,wx:bx,wy:by,
    vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:d/sp+0.05,st:0,
    trc:Math.random()<(u.cls==='mit'||u.cls==='ecl'?0.42:1),   // une balle sur deux est traçante en rafale
    dmg:u.c.dmg,side:u.side,hit,tid:tgt?tgt.id:-1,supp:u.c.supp,tx,ty});
  u.flash=0.14; u.aim=a;
  // douille + fumée
  parts.push({x:u.x,y:u.y,vx:Math.cos(a+1.9)*rnd(50,90),vy:Math.sin(a+1.9)*rnd(50,90)-40,
    g:340,drag:1.2,t:0,life:rnd(.5,.8),size:2,col:'#c9a227',type:'case'});
  puff(u.x+Math.cos(a)*18,u.y+Math.sin(a)*18,1);
  sfx(u.cls==='mit'?'mg':u.cls==='ecl'?'smg':'rifle');
}

function throwNade(u,x,y,smoke){
  nades.push({sx:u.x,sy:u.y,tx:x,ty:y,x:u.x,y:u.y,z:0,t:0,dur:NADE_ARC_DUR,side:u.side,smoke:!!smoke});
  if(smoke) u.smoke--; else u.nades--;
  sfx('throw');
}

/* --- fumigène : un volume qui coupe la vue sans gêner le passage --- */
function popSmoke(x,y){
  smokes.push({x,y,r:SMOKE_R,t:0,turns:SMOKE_TURNS});
  rebuildSmoke(); recEvent('smoke',{x,y});
  for(let i=0;i<30;i++){
    const a=Math.random()*6.283, s=rnd(20,120);
    parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,g:-10,drag:1.5,t:0,life:rnd(.8,1.8),
      size:rnd(14,30),col:'rgba(158,158,150,.55)',type:'smoke'});
  }
  sfx('smoke');
}
function rebuildSmoke(){
  smokeGrid.fill(0);
  for(const s of smokes)
    for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++)
      if(dist(x*TILE+TILE/2,y*TILE+TILE/2,s.x,s.y)<s.r) smokeGrid[idx(x,y)]=1;
}

function explode(x,y,side){
  const R=EXPLOSION_R;
  for(const u of units){
    if(!u.alive) continue;
    const d=dist(u.x,u.y,x,y);
    if(d<R){
      const f=1-d/R;
      damage(u,Math.round(18+52*f*f),side);
      u.supp=Math.min(100,u.supp+70*f);
    } else if(d<R*EXPLOSION_SUPP_R_MULT) u.supp=Math.min(100,u.supp+25);
  }
  boomFx(x,y,R); recEvent('boom',{x,y,R});
  // brèche : les cloisons proches cèdent
  const cand=[];
  for(let gy=Math.floor((y-60)/TILE);gy<=Math.floor((y+60)/TILE);gy++)
    for(let gx=Math.floor((x-60)/TILE);gx<=Math.floor((x+60)/TILE);gx++){
      if(!inMap(gx,gy)) continue;
      const v=grid[idx(gx,gy)];
      if(v!==T.BLD&&v!==T.WIN&&v!==T.PART) continue;
      const dd=dist(gx*TILE+TILE/2,gy*TILE+TILE/2,x,y);
      if(dd<64&&rng()<(v===T.WIN?0.95:v===T.PART?0.9:0.45)) cand.push([dd,gx,gy]);
    }
  cand.sort((a,b)=>a[0]-b[0]);
  for(const [,gx,gy] of cand.slice(0,3)) breach(gx,gy);
}

/* la partie purement visuelle d'une explosion : le replay la rejoue telle quelle */
function boomFx(x,y,R){
  for(let i=0;i<34;i++){
    const a=Math.random()*6.283, s=rnd(60,420);
    parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,g:120,drag:3.4,t:0,life:rnd(.3,.75),
      size:rnd(2,5),col:i%3?'#ff8b1f':'#ffd166',type:'spark'});
  }
  for(let i=0;i<16;i++){
    const a=Math.random()*6.283, s=rnd(10,90);
    parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-20,g:-18,drag:1.1,t:0,life:rnd(.7,1.4),
      size:rnd(10,26),col:'rgba(90,88,80,.55)',type:'smoke'});
  }
  parts.push({x,y,vx:0,vy:0,g:0,drag:0,t:0,life:.42,size:R,col:'#fff',type:'ring'});
  for(let i=0;i<12;i++){
    const a=Math.random()*6.283, rr2=Math.random()*R*0.5;
    decal(x+Math.cos(a)*rr2,y+Math.sin(a)*rr2,rnd(10,24),'rgba(42,34,25,.12)');
  }
  shake=Math.max(shake,17); hitstop=Math.max(hitstop,0.07);
  sfx('boom');
}

function damage(u,dmg,side){
  u.hp-=dmg; u.hurt=1;
  if(u.hp<=0&&u.alive){
    u.alive=false; u.mv=null; u.fire=null;
    hitstop=Math.max(hitstop,0.09); shake=Math.max(shake,11);
    for(let i=0;i<20;i++){
      const a=Math.random()*6.283,s=rnd(30,200);
      parts.push({x:u.x,y:u.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,g:200,drag:3,t:0,life:rnd(.3,.7),
        size:rnd(2,4),col:side==='b'?'#DE6247':'#3E92C9',type:'spark'});
    }
    corpse(u); recEvent('death',{x:u.x,y:u.y,side:u.side});
    sfx('down');
  } else if(u.alive){
    bloodHit(u.x,u.y,side); shake=Math.max(shake,6);
    recEvent('hit',{x:u.x,y:u.y,side});
  }
}

/* segment rémanent : c'est lui qui rend la trajectoire lisible malgré la vitesse */
function wake(b,a){
  if(dist(b.wx,b.wy,b.x,b.y)<1.5) return;
  parts.push({type:'wake',x:b.wx,y:b.wy,ex:b.x,ey:b.y,t:0,life:0.22,a,
    vx:0,vy:0,g:0,drag:0,size:1,col:''});
  b.wx=b.x; b.wy=b.y;
}
/* éclat blanc bref au point d'impact */
function impact(x,y,col){
  parts.push({type:'pop',x,y,vx:0,vy:0,g:0,drag:0,t:0,life:0.16,size:13,col});
}

/* gerbe brève quand un tir touche sans tuer : rend l'impact lisible (live et replay) */
function bloodHit(x,y,side){
  const col=side==='b'?'#DE6247':'#3E92C9';
  impact(x,y,'#ffd9c2');
  for(let i=0;i<9;i++){
    const a=Math.random()*6.283,s=rnd(30,150);
    parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,g:160,drag:3.5,t:0,life:rnd(.2,.45),
      size:rnd(2,3.5),col,type:'spark'});
  }
}

function sparks(x,y,col,n){
  for(let i=0;i<n;i++){
    const a=Math.random()*6.283,s=rnd(40,240);
    parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,g:260,drag:4,t:0,life:rnd(.12,.3),
      size:rnd(1,2.6),col,type:'spark'});
  }
}
function puff(x,y,n){
  for(let i=0;i<n;i++)
    parts.push({x:x+rnd(-3,3),y:y+rnd(-3,3),vx:rnd(-16,16),vy:rnd(-26,-6),g:-8,drag:1.6,t:0,
      life:rnd(.25,.55),size:rnd(4,9),col:'rgba(120,118,100,.35)',type:'smoke'});
}
function decal(x,y,r,col){
  dctx.fillStyle=col; dctx.beginPath(); dctx.arc(x,y,r,0,6.283); dctx.fill();
}

/* fin de résolution */
function endResolve(){
  bullets.length=0; nades.length=0;
  for(const u of units){ u.mv=null; if(u.fire&&u.fire.kind==='nade') u.fire=null; u.fire=null; u.supp*=SUPP_ENDTURN_MULT; }
  for(let i=smokes.length-1;i>=0;i--){ if(--smokes[i].turns<=0) smokes.splice(i,1); }
  rebuildSmoke();
  // décompte : on tient une zone si l'on y est plus nombreux ; le point va à qui en tient le plus
  const {holders,zb,zr}=zoneControl(zones,units);
  zones.forEach((z,i)=>z.held=holders[i]);
  const pt=roundPoint(zb,zr);
  if(pt==='b') scoreB++; else if(pt==='r') scoreR++;

  const outcome=victoryOutcome({aliveR:alive('r').length,aliveB:alive('b').length,scoreB,scoreR});
  if(outcome) return finish(outcome.title,outcome.sub);
  turn++;
  if(turn>MAXTURN){ const o=timeUpOutcome(scoreB,scoreR); return finish(o.title,o.sub); }
  phase='plan'; sel=alive('b')[0]||null; mode='auto'; refreshUI();
}
function finish(t,s){
  phase='over'; over=true;
  document.getElementById('ovT').textContent=t;
  document.getElementById('ovS').textContent=s;
  document.getElementById('over').classList.add('on');
  refreshUI();
}

/* ==========================================================================
   ENREGISTREMENT ET REPLAY
   On n'essaie pas de rejouer la simulation : on enregistre 60 images par
   seconde de l'état (unités, projectiles, fumée) plus les événements
   ponctuels, et on repasse la bande. Fidélité exacte, aucun besoin de
   rendre le tir et l'IA déterministes.
   ========================================================================== */
let rec=[], curRec=null, replaying=false, rp=null, preRep=null;

function recEvent(k,d){ if(curRec&&!replaying) curRec.ev.push(Object.assign({t:rt,k},d)); }

function recBeginTurn(){
  curRec={turn,grid:grid.slice(),ev:[],frames:[],orders:units.map(u=>({
    side:u.side, alive:u.alive, x:u.x, y:u.y,
    mv:u.mv?u.mv.pts.map(p=>[p.x,p.y]):null, run:!!(u.mv&&u.mv.run),
    fk:u.fire?u.fire.kind:null,
    fx:u.fire?(u.fire.x||0):0, fy:u.fire?(u.fire.y||0):0,
    fid:u.fire&&u.fire.kind==='unit'?u.fire.id:0,
    fang:u.fire&&u.fire.ang!==undefined?u.fire.ang:0,
    range:u.c.ideal+u.c.fall,
  }))};
  rec.push(curRec);
}
function recFrame(){
  const U=new Float32Array(units.length*UF);
  units.forEach((u,i)=>{ const o=i*UF;
    U[o]=u.x; U[o+1]=u.y; U[o+2]=u.aim; U[o+3]=u.hp; U[o+4]=u.supp; U[o+5]=u.flash;
    U[o+6]=(u.alive?1:0)|(u.moving?2:0)|(u.seen?4:0);
  });
  const B=new Float32Array(bullets.length*BF);
  bullets.forEach((b,i)=>{ const o=i*BF;
    B[o]=b.x; B[o+1]=b.y; B[o+2]=b.ox; B[o+3]=b.oy; B[o+4]=b.vx; B[o+5]=b.vy; B[o+6]=b.trc?1:0;
  });
  curRec.frames.push({U,B,S:smokes.map(s=>[s.x,s.y,s.r])});
}
function applyFrame(f){
  units.forEach((u,i)=>{ const o=i*UF;
    u.x=f.U[o]; u.y=f.U[o+1]; u.aim=f.U[o+2]; u.hp=f.U[o+3]; u.supp=f.U[o+4]; u.flash=f.U[o+5];
    const fl=f.U[o+6];
    u.alive=!!(fl&1); u.moving=!!(fl&2); u.wasSeen=!!(fl&4); u.seen=true;   // au replay, on voit tout
  });
  bullets.length=0;
  for(let i=0;i<f.B.length;i+=BF)
    bullets.push({x:f.B[i],y:f.B[i+1],ox:f.B[i+2],oy:f.B[i+3],vx:f.B[i+4],vy:f.B[i+5],trc:!!f.B[i+6]});
  smokes=f.S.map(a=>({x:a[0],y:a[1],r:a[2],turns:9}));
}

function startReplay(){
  if(!rec.length) return;
  preRep={grid:grid.slice(),
    u:units.map(u=>({x:u.x,y:u.y,aim:u.aim,hp:u.hp,supp:u.supp,alive:u.alive,seen:u.seen}))};
  replaying=true; phase='replay';
  rp={ti:0,t:0,ev:0,speed:1,playing:true};
  document.getElementById('over').classList.remove('on');
  document.getElementById('rpbar').classList.add('on');
  loadReplayTurn(0);
  refreshUI();
}
function loadReplayTurn(i){
  rp.ti=clamp(i,0,rec.length-1); rp.t=0; rp.ev=0;
  const r=rec[rp.ti];
  grid.set(r.grid);
  drawTerrain(); dctx.clearRect(0,0,W,H);
  parts.length=0; bullets.length=0; nades.length=0; smokes=[];
  if(r.frames.length) applyFrame(r.frames[0]);
  rebuildSmoke();
  updateReplayUI();
}
function stepReplay(dt){
  const r=rec[rp.ti];
  if(rp.playing) rp.t+=dt*rp.speed;
  const fi=Math.min(r.frames.length-1,Math.floor(rp.t*REC_HZ));
  if(r.frames.length) applyFrame(r.frames[fi]);
  while(rp.ev<r.ev.length&&r.ev[rp.ev].t<=rp.t){
    const e=r.ev[rp.ev++];
    if(e.k==='boom') boomFx(e.x,e.y,e.R);
    else if(e.k==='death'){ corpse({x:e.x,y:e.y,side:e.side}); sfx('down'); }
    else if(e.k==='hit') bloodHit(e.x,e.y,e.side);
    else if(e.k==='breach') breach(e.gx,e.gy);
    else if(e.k==='smoke') sfx('smoke');
  }
  updateParts(dt);
  shake=Math.max(0,shake-40*dt);
  if(rp.t>=RESOLVE+0.6){
    if(rp.ti<rec.length-1) loadReplayTurn(rp.ti+1);
    else { rp.playing=false; rp.t=RESOLVE; }
  }
}
function quitReplay(){
  replaying=false; phase='over';
  grid.set(preRep.grid);
  units.forEach((u,i)=>Object.assign(u,preRep.u[i]));
  drawTerrain(); dctx.clearRect(0,0,W,H);
  for(const u of units) if(!u.alive) corpse(u);
  parts.length=0; bullets.length=0; smokes=[]; rebuildSmoke();
  document.getElementById('rpbar').classList.remove('on');
  document.getElementById('over').classList.add('on');
  refreshUI();
}
function updateReplayUI(){
  document.getElementById('rpInfo').textContent=`Tour ${rec[rp.ti].turn} / ${rec[rec.length-1].turn}`;
  document.getElementById('rpPlay').textContent=rp.playing?'Pause':'Lecture';
  document.getElementById('rpSpeed').textContent='×'+String(rp.speed).replace('.',',');
}

/* les ordres des deux camps, superposés : c'est là qu'on voit les plans se percuter */
function drawRecOrders(){
  const r=rec[rp.ti];
  ctx.save(); ctx.globalAlpha=0.55;
  r.orders.forEach((o,i)=>{
    if(!o.alive) return;
    const col=o.side==='b'?C.blue:C.red;
    if(o.mv&&o.mv.length){
      ctx.strokeStyle=col; ctx.lineWidth=o.run?2.8:1.6;
      ctx.setLineDash(o.run?[12,4]:[6,5]); ctx.lineJoin='round';
      ctx.beginPath(); ctx.moveTo(o.x,o.y);
      for(const p of o.mv) ctx.lineTo(p[0],p[1]);
      ctx.stroke(); ctx.setLineDash([]);
      const e=o.mv[o.mv.length-1], b=o.mv[o.mv.length-2]||[o.x,o.y];
      const a=Math.atan2(e[1]-b[1],e[0]-b[0]);
      ctx.fillStyle=col; ctx.beginPath();
      ctx.moveTo(e[0]+Math.cos(a)*8,e[1]+Math.sin(a)*8);
      ctx.lineTo(e[0]+Math.cos(a+2.5)*8,e[1]+Math.sin(a+2.5)*8);
      ctx.lineTo(e[0]+Math.cos(a-2.5)*8,e[1]+Math.sin(a-2.5)*8);
      ctx.closePath(); ctx.fill();
    }
    const ex=o.mv&&o.mv.length?{x:o.mv[o.mv.length-1][0],y:o.mv[o.mv.length-1][1]}:{x:o.x,y:o.y};
    if(o.fk==='watch'){
      const R=Math.min(o.range,VIEW), rgb=o.side==='b'?'29,78,110':'168,50,42';
      ctx.fillStyle=`rgba(${rgb},.10)`;
      ctx.beginPath(); ctx.moveTo(ex.x,ex.y);
      ctx.arc(ex.x,ex.y,R,o.fang-WATCH_CONE,o.fang+WATCH_CONE); ctx.closePath(); ctx.fill();
    } else if(o.fk){
      let tx=o.fx, ty=o.fy;
      if(o.fk==='unit'){ const t=byId(o.fid); if(t){ tx=t.x; ty=t.y; } }
      ctx.strokeStyle=o.fk==='nade'?'#7a5c1f':o.fk==='smoke'?'#5f6a6d':col;
      ctx.lineWidth=1.2; ctx.setLineDash([2,6]);
      ctx.beginPath(); ctx.moveTo(ex.x,ex.y); ctx.lineTo(tx,ty); ctx.stroke(); ctx.setLineDash([]);
      const rr3=o.fk==='nade'||o.fk==='smoke'?22:9;
      ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(tx,ty,rr3,0,6.283); ctx.stroke();
    }
  });
  ctx.restore();
}

/* ==========================================================================
   RENDU
   ========================================================================== */
function draw(){
  ctx.save();
  if(shake>0.2){ const s=shake; ctx.translate(rnd(-s,s),rnd(-s,s)); }
  ctx.drawImage(terrainCv,0,0);
  ctx.drawImage(decalCv,0,0);
  if(phase==='plan'&&showThreat) drawThreat();

  for(const z of zones){                       // à qui la zone est-elle acquise ?
    if(!z.held) continue;
    const ox=z.x0*TILE, oy=z.y0*TILE, ow=(z.x1-z.x0+1)*TILE;
    ctx.fillStyle=z.held==='b'?'rgba(29,78,110,.85)':'rgba(168,50,42,.85)';
    rr(ctx,ox+ow-30,oy+5,24,12,2); ctx.fill();
    ctx.fillStyle='#F1ECE1'; ctx.font='bold 8px ui-monospace,monospace'; ctx.textAlign='center';
    ctx.fillText(z.held==='b'?'NOUS':'ENN',ox+ow-18,oy+14); ctx.textAlign='left';
  }
  drawSmoke();
  if(phase==='replay') drawRecOrders();
  if(phase==='plan') drawOrders();

  // portée de l'unité sélectionnée
  if(phase==='plan'&&sel&&sel.alive){
    ctx.save();
    ctx.strokeStyle='rgba(29,78,110,.22)'; ctx.lineWidth=1.5; ctx.setLineDash([3,6]);
    ctx.beginPath(); ctx.arc(sel.x,sel.y,sel.c.ideal+sel.c.fall,0,6.283); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
  }
  if(phase==='plan'&&hover.x>=0) drawCoverHint();

  if(phase==='resolve') for(const u of units) if(u.alive&&u.side==='b') drawWatchCone(u,0.62,true);
  drawGhosts();
  for(const u of units) if(u.alive) drawUnit(u);

  // projectiles
  ctx.lineCap='round';
  for(const b of bullets){
    const sp=Math.hypot(b.vx,b.vy)||1, ux=b.vx/sp, uy=b.vy/sp;
    const L=Math.min(b.trc?96:52,dist(b.ox,b.oy,b.x,b.y));
    if(L<2) continue;
    const tx=b.x-ux*L, ty=b.y-uy*L, k=b.trc?1:0.5;
    const seg=(w,rgb,aEnd,from,aMid)=>{
      const sx=b.x-ux*L*from, sy=b.y-uy*L*from;
      const g=ctx.createLinearGradient(sx,sy,b.x,b.y);
      g.addColorStop(0,`rgba(${rgb},0)`);
      g.addColorStop(0.42,`rgba(${rgb},${aMid})`);
      g.addColorStop(1,`rgba(${rgb},${aEnd})`);
      ctx.strokeStyle=g; ctx.lineWidth=w;
      ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(b.x,b.y); ctx.stroke();
    };
    // liseré sombre : c'est lui qui détache la traçante du papier clair
    seg(5.4,'85,42,12',0.36*k,1,0.20*k);
    // corps de la traçante
    seg(3.0,'255,150,40',0.95*k,1,0.52*k);
    // cœur incandescent, sur la dernière moitié
    seg(1.4,'255,248,225',0.95*k,0.5,0.30*k);
    // tête
    ctx.fillStyle=`rgba(255,205,110,${0.30*k})`;
    ctx.beginPath(); ctx.arc(b.x,b.y,5.2,0,6.283); ctx.fill();
    ctx.fillStyle=`rgba(255,255,245,${0.95*k})`;
    ctx.beginPath(); ctx.arc(b.x,b.y,2.1,0,6.283); ctx.fill();
  }
  // grenades
  for(const g of nades){
    ctx.fillStyle='rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(g.x,g.y,5,3,0,0,6.283); ctx.fill();
    ctx.fillStyle='#3b4a35'; ctx.beginPath(); ctx.arc(g.x,g.y-g.z,4.5,0,6.283); ctx.fill();
    ctx.strokeStyle='rgba(60,70,55,.35)'; ctx.lineWidth=1; ctx.setLineDash([2,4]);
    ctx.beginPath(); ctx.moveTo(g.tx,g.ty-6); ctx.lineTo(g.tx,g.ty+6);
    ctx.moveTo(g.tx-6,g.ty); ctx.lineTo(g.tx+6,g.ty); ctx.stroke(); ctx.setLineDash([]);
  }
  // particules
  for(const p of parts){
    const k=1-p.t/p.life;
    if(p.type==='ping'){
      const e=1-k;
      for(let n=0;n<2;n++){
        const f=e-n*0.22; if(f<0||f>1) continue;
        ctx.strokeStyle=`rgba(${p.col},${(1-f)*0.5*k})`; ctx.lineWidth=2.2-f;
        ctx.beginPath(); ctx.arc(p.x,p.y,10+p.size*f,0,6.283); ctx.stroke();
      }
    } else if(p.type==='wake'){
      const a=k*k*p.a;
      ctx.strokeStyle=`rgba(88,45,14,${a*0.45})`; ctx.lineWidth=4;
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.ex,p.ey); ctx.stroke();
      ctx.strokeStyle=`rgba(255,168,60,${a})`; ctx.lineWidth=1.9;
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.ex,p.ey); ctx.stroke();
    } else if(p.type==='pop'){
      const e=1-k;
      ctx.strokeStyle=`rgba(255,255,235,${k*0.9})`; ctx.lineWidth=2.4*k+0.6;
      ctx.beginPath(); ctx.arc(p.x,p.y,3+p.size*e,0,6.283); ctx.stroke();
      ctx.fillStyle=`rgba(255,255,255,${k*0.8})`;
      ctx.beginPath(); ctx.arc(p.x,p.y,3.4*k,0,6.283); ctx.fill();
    } else if(p.type==='ring'){
      ctx.strokeStyle=`rgba(255,220,150,${k*0.9})`; ctx.lineWidth=3+18*(1-k);
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size*(1-k*k)*1.1+8,0,6.283); ctx.stroke();
      ctx.fillStyle=`rgba(255,150,40,${k*0.5})`;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size*0.55*k,0,6.283); ctx.fill();
    } else if(p.type==='smoke'){
      ctx.fillStyle=p.col.replace(/[\d.]+\)$/,(k*0.45)+')');
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size*(1.6-k*0.6),0,6.283); ctx.fill();
    } else {
      ctx.globalAlpha=clamp(k*1.4,0,1); ctx.fillStyle=p.col;
      ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size); ctx.globalAlpha=1;
    }
  }
  ctx.restore();

  if(phase==='plan') drawTerrainTip();

  // bandeau de phase
  if(phase==='resolve'||phase==='replay'){
    const k=phase==='replay'?Math.min(1,rp.t/RESOLVE):rt/RESOLVE;
    ctx.fillStyle='rgba(15,20,15,.55)'; ctx.fillRect(0,0,W,3);
    ctx.fillStyle=C.gold; ctx.fillRect(0,0,W*k,3);
  }
  if(phase==='replay'){
    ctx.save();
    ctx.fillStyle='rgba(26,32,26,.82)'; rr(ctx,W-152,12,140,26,3); ctx.fill();
    ctx.fillStyle=C.gold; ctx.font='bold 12px "Arial Narrow",sans-serif';
    ctx.fillText('REPLAY',W-142,29);
    ctx.fillStyle='#9aa39a'; ctx.font='11px "Arial Narrow",sans-serif';
    ctx.fillText(`tour ${rec[rp.ti].turn}`,W-84,29);
    ctx.restore();
  }
}

/* infobulle : ce que vaut la tuile survolée */
function drawTerrainTip(){
  const gx=Math.floor(hover.x/TILE), gy=Math.floor(hover.y/TILE);
  if(!inMap(gx,gy)) return;
  const info=TI[grid[idx(gx,gy)]];
  const l1=info.n.toUpperCase(), l2=info.d;
  const l3=info.pass
    ? (info.cost===1?'coût de déplacement normal':`coûte ${info.cost.toFixed(2).replace(/\.?0+$/,'').replace('.',',')} fois un terrain découvert`)
    : 'infranchissable';
  ctx.save();
  ctx.font='11px "Arial Narrow",sans-serif';
  const w=Math.max(ctx.measureText(l1).width,ctx.measureText(l2).width,ctx.measureText(l3).width)+16;
  let x=hover.x+18, y=hover.y+16;
  if(x+w>W-6) x=hover.x-w-14;
  if(y+46>H-6) y=hover.y-52;
  ctx.fillStyle='rgba(26,32,26,.88)'; rr(ctx,x,y,w,44,3); ctx.fill();
  ctx.fillStyle='#EFEDE2'; ctx.font='bold 11px "Arial Narrow",sans-serif';
  ctx.fillText(l1,x+8,y+13);
  ctx.fillStyle='#9aa39a'; ctx.font='10px "Arial Narrow",sans-serif';
  ctx.fillText(l2,x+8,y+25);
  ctx.fillStyle='#C9A227';
  ctx.fillText(l3,x+8,y+37);
  ctx.restore();
}

/* corps au sol : marque durable sur le terrain */
function corpse(u){
  dctx.save(); dctx.globalAlpha=0.42;
  dctx.fillStyle=u.side==='b'?'#123A52':'#5E2018';
  dctx.beginPath(); dctx.arc(u.x,u.y,10,0,6.283); dctx.fill();
  dctx.fillStyle='rgba(90,30,24,.28)';
  dctx.beginPath(); dctx.ellipse(u.x,u.y+2,14,9,0,0,6.283); dctx.fill();
  dctx.globalAlpha=1; dctx.restore();
}

function drawSmoke(){
  for(const s of smokes){
    const R=s.r*1.16;
    const g=ctx.createRadialGradient(s.x,s.y,s.r*0.2,s.x,s.y,R);
    g.addColorStop(0,'rgba(158,158,150,.92)');
    g.addColorStop(0.72,'rgba(168,168,160,.84)');
    g.addColorStop(0.88,'rgba(176,176,168,.45)');
    g.addColorStop(1,'rgba(182,182,174,0)');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(s.x,s.y,R,0,6.283); ctx.fill();
    if(Math.random()<0.5)
      parts.push({x:s.x+rnd(-s.r*.6,s.r*.6),y:s.y+rnd(-s.r*.6,s.r*.6),
        vx:rnd(-8,8),vy:rnd(-8,8),g:-4,drag:1.2,t:0,life:rnd(.8,1.6),
        size:rnd(10,22),col:'rgba(175,175,167,.40)',type:'smoke'});
  }
}

function drawUnit(u){
  const isB=u.side==='b';
  const col=isB?C.blue:C.red, colL=isB?C.blueL:C.redL;
  if(!(isB||u.seen)) return;

  ctx.save(); ctx.translate(u.x,u.y);
  ctx.fillStyle='rgba(30,35,25,.20)';
  ctx.beginPath(); ctx.ellipse(2,4,13,9,0,0,6.283); ctx.fill();
  if(u.supp>50&&Math.random()<0.3) puff(u.x+rnd(-12,12),u.y+rnd(-10,10),1);

  // arme, orientée vers la cible ou vers la marche
  ctx.rotate(u.aim);
  ctx.strokeStyle=C.ink; ctx.lineWidth=3.5; ctx.lineCap='butt';
  ctx.beginPath(); ctx.moveTo(4,0); ctx.lineTo(u.cls==='mit'?21:17,0); ctx.stroke();
  if(u.flash>0){
    const f=u.flash/0.14;
    ctx.fillStyle=`rgba(255,225,140,${f})`;
    ctx.beginPath();
    ctx.moveTo(18,0); ctx.lineTo(18+16*f,-6*f); ctx.lineTo(18+22*f,0); ctx.lineTo(18+16*f,6*f);
    ctx.closePath(); ctx.fill();
  }
  ctx.rotate(-u.aim);

  // pion
  ctx.fillStyle=col; ctx.strokeStyle='#1a1e18'; ctx.lineWidth=1.6;
  ctx.beginPath(); ctx.arc(0,0,11,0,6.283); ctx.fill(); ctx.stroke();
  ctx.fillStyle=colL; ctx.beginPath(); ctx.arc(-2,-2,5.5,0,6.283); ctx.fill();
  if(u.hurt>0){
    ctx.fillStyle=`rgba(255,255,255,${u.hurt*0.55})`;
    ctx.beginPath(); ctx.arc(0,0,11,0,6.283); ctx.fill();
    ctx.strokeStyle=`rgba(220,60,50,${u.hurt})`; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(0,0,11+6*(1-u.hurt),0,6.283); ctx.stroke();
  }
  ctx.fillStyle='#fff'; ctx.font='bold 8px ui-monospace,monospace'; ctx.textAlign='center';
  ctx.fillText(u.c.tag,0,2.8); ctx.textAlign='left';

  // barre de vie et jauge de suppression
  const hw=24, hp=Math.max(0,u.hp/u.maxHp);
  ctx.fillStyle='rgba(20,25,20,.45)'; ctx.fillRect(-hw/2,-20,hw,3.5);
  ctx.fillStyle=hp>.5?'#7bb661':hp>.25?'#d8a13a':'#c0392b';
  ctx.fillRect(-hw/2,-20,hw*hp,3.5);
  if(u.supp>4){
    ctx.fillStyle='rgba(201,162,39,.85)';
    ctx.fillRect(-hw/2,-15.5,hw*(u.supp/100),2);
  }

  if(phase==='replay'&&u.side==='r'&&!u.wasSeen){
    ctx.strokeStyle='rgba(168,50,42,.55)'; ctx.lineWidth=1.4; ctx.setLineDash([3,4]);
    ctx.beginPath(); ctx.arc(0,0,15,0,6.283); ctx.stroke(); ctx.setLineDash([]);
  }
  if(sel===u&&phase==='plan'){
    ctx.strokeStyle=C.gold; ctx.lineWidth=1.8; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.arc(0,0,17,0,6.283); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}

/* ennemis non vus : dernière position connue, au crayon gras */
function drawGhosts(){
  for(const u of units){
    if(u.side!=='r'||!u.alive||u.seen) continue;
    const m=mem[u.id]; if(!m||turn-m.turn>3) continue;
    ctx.save(); ctx.globalAlpha=0.42;
    ctx.strokeStyle=C.red; ctx.lineWidth=1.6; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.arc(m.x,m.y,11,0,6.283); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle=C.red; ctx.font='9px ui-monospace,monospace';
    ctx.fillText(`${m.heard?'ENTENDU':'VU'} T-${turn-m.turn}`,m.x-20,m.y+23);
    ctx.restore();
  }
}

/* cône de guet : le secteur qu'une unité tient sous son arme */
function drawWatchCone(u,alpha,active){
  if(!u.fire||u.fire.kind!=='watch') return;
  const ex=(phase==='plan'&&u.mv&&u.mv.pts.length)?u.mv.pts[u.mv.pts.length-1]:u;
  const R=Math.min(u.c.ideal+u.c.fall,VIEW), a=u.fire.ang;
  const col=u.side==='b'?'29,78,110':'168,50,42';
  ctx.save(); ctx.globalAlpha=alpha;
  const g=ctx.createRadialGradient(ex.x,ex.y,10,ex.x,ex.y,R);
  g.addColorStop(0,`rgba(${col},.20)`); g.addColorStop(1,`rgba(${col},.02)`);
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.moveTo(ex.x,ex.y);
  ctx.arc(ex.x,ex.y,R,a-WATCH_CONE,a+WATCH_CONE); ctx.closePath(); ctx.fill();
  ctx.strokeStyle=active?`rgba(${col},.75)`:`rgba(${col},.45)`;
  ctx.lineWidth=1.6; ctx.setLineDash([6,5]);
  ctx.beginPath();
  ctx.moveTo(ex.x+Math.cos(a-WATCH_CONE)*R,ex.y+Math.sin(a-WATCH_CONE)*R);
  ctx.lineTo(ex.x,ex.y);
  ctx.lineTo(ex.x+Math.cos(a+WATCH_CONE)*R,ex.y+Math.sin(a+WATCH_CONE)*R);
  ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}

/* chevrons de franchissement : là où le chemin paie le terrain au prix fort */
function drawCrossings(sx,sy,pts,alpha){
  let px=sx, py=sy;
  ctx.save(); ctx.globalAlpha=alpha; ctx.lineCap='round';
  for(const p of pts){
    const c=tcostPx(grid,p.x,p.y);
    if(c>=2){
      const a=Math.atan2(p.y-py,p.x-px);
      ctx.strokeStyle=c>=3?'#A9761A':'#5E8378';
      ctx.lineWidth=2.2;
      for(let k=0;k<2;k++){
        const ox=p.x-Math.cos(a)*(k*5-2), oy=p.y-Math.sin(a)*(k*5-2);
        ctx.beginPath();
        ctx.moveTo(ox+Math.cos(a+2.35)*6.5,oy+Math.sin(a+2.35)*6.5);
        ctx.lineTo(ox,oy);
        ctx.lineTo(ox+Math.cos(a-2.35)*6.5,oy+Math.sin(a-2.35)*6.5);
        ctx.stroke();
      }
    }
    px=p.x; py=p.y;
  }
  ctx.restore();
}

/* calques d'ordres — annotations au crayon gras sur l'acétate */
/* overlay de menace : tuiles d'où un ennemi connu peut voir/tirer (touche A) */
function drawThreat(){
  const enemies=knownEnemies();
  if(!enemies.length) return;
  const threat=threatTiles(grid,smokeGrid,enemies);
  ctx.save();
  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){
    const n=threat[idx(x,y)];
    if(!n) continue;
    ctx.fillStyle=`rgba(168,50,42,${Math.min(0.34,0.12+n*0.10)})`;
    ctx.fillRect(x*TILE,y*TILE,TILE,TILE);
  }
  ctx.restore();
}

/* aperçu de couverture : la tuile survolée est-elle sûre, à couvert, ou exposée ? */
function drawCoverHint(){
  const gx=Math.floor(hover.x/TILE), gy=Math.floor(hover.y/TILE);
  if(!inMap(gx,gy)) return;
  const enemies=knownEnemies();
  if(!enemies.length) return;
  const cx=gx*TILE+TILE/2, cy=gy*TILE+TILE/2;
  let threatened=false, best=1;
  for(const e of enemies){
    if(Math.hypot(e.x-cx,e.y-cy)<=e.reach&&los(grid,smokeGrid,e.x,e.y,cx,cy)){
      threatened=true; best=Math.min(best,coverMul(grid,e.x,e.y,cx,cy));
    }
  }
  let txt,col;
  if(!threatened){ txt='SÛR'; col='#3E8F4E'; }
  else if(best<0.95){ txt='À COUVERT'; col='#C9A227'; }
  else { txt='EXPOSÉ'; col='#DE6247'; }
  ctx.save(); ctx.font='10px "Arial Narrow",sans-serif'; ctx.fillStyle=col;
  ctx.textAlign='left'; ctx.fillText(txt,hover.x+14,hover.y-10); ctx.restore();
}

function drawOrders(){
  ctx.save();
  for(const u of units){
    if(!u.alive||u.side!=='b') continue;
    const on=(sel===u);
    ctx.globalAlpha=on?1:0.5;
    if(u.mv&&u.mv.pts.length){
      if(u.mv.run){                              // course : trait plein doublé, il claque
        ctx.strokeStyle='rgba(29,78,110,.22)'; ctx.lineWidth=on?7:5; ctx.lineJoin='round';
        ctx.beginPath(); ctx.moveTo(u.x,u.y);
        for(const p of u.mv.pts) ctx.lineTo(p.x,p.y);
        ctx.stroke();
      }
      ctx.strokeStyle=C.blue; ctx.lineWidth=on?2.6:1.8;
      ctx.setLineDash(u.mv.run?[12,4]:[7,5]); ctx.lineJoin='round';
      ctx.beginPath(); ctx.moveTo(u.x,u.y);
      for(const p of u.mv.pts) ctx.lineTo(p.x,p.y);
      ctx.stroke(); ctx.setLineDash([]);
      const e=u.mv.pts[u.mv.pts.length-1], b=u.mv.pts[u.mv.pts.length-2]||u;
      const a=Math.atan2(e.y-b.y,e.x-b.x);
      ctx.fillStyle=C.blue; ctx.beginPath();
      ctx.moveTo(e.x+Math.cos(a)*9,e.y+Math.sin(a)*9);
      ctx.lineTo(e.x+Math.cos(a+2.5)*9,e.y+Math.sin(a+2.5)*9);
      ctx.lineTo(e.x+Math.cos(a-2.5)*9,e.y+Math.sin(a-2.5)*9);
      ctx.closePath(); ctx.fill();
      if(u.mv.run&&on){
        ctx.fillStyle=C.blue; ctx.font='9px "Arial Narrow",sans-serif';
        ctx.fillText('COURSE',e.x+12,e.y-10);
      }
      drawCrossings(u.x,u.y,u.mv.pts,on?1:0.5);
    }
    if(u.fire&&u.fire.kind==='watch'){ drawWatchCone(u,on?1:0.55,false); ctx.globalAlpha=1; continue; }
    if(u.fire){
      let tx,ty,lbl;
      if(u.fire.kind==='unit'){ const t=byId(u.fire.id); if(!t) {ctx.globalAlpha=1;continue;}
        const m=mem[t.id]; tx=t.seen?t.x:(m?m.x:t.x); ty=t.seen?t.y:(m?m.y:t.y); lbl='PRISE À PARTIE'; }
      else if(u.fire.kind==='point'){ tx=u.fire.x; ty=u.fire.y; lbl='SUPPRESSION'; }
      else { tx=u.fire.x; ty=u.fire.y; lbl='GRENADE'; }
      const ex=u.mv&&u.mv.pts.length?u.mv.pts[u.mv.pts.length-1]:u;
      // la ligne de tir est-elle praticable, d'ici ou d'où l'on arrivera ?
      const nade=u.fire.kind==='nade', rng=u.c.ideal+u.c.fall;
      const okFrom=(ax,ay)=>dist(ax,ay,tx,ty)<=rng&&los(grid,smokeGrid,ax,ay,tx,ty);
      const ko=!nade&&!okFrom(u.x,u.y)&&!okFrom(ex.x,ex.y);
      if(ko) lbl=dist(ex.x,ex.y,tx,ty)>rng?'HORS DE PORTÉE':'PAS DE LIGNE DE TIR';
      else if(u.fire.kind==='unit'){          // estimation de la chance de toucher, depuis la position de tir prévue
        const acc=hitChance({c:u.c,d:dist(ex.x,ex.y,tx,ty),moving:false,supp:u.supp,watching:false,
          cover:coverMul(grid,ex.x,ex.y,tx,ty),targetRunning:false});
        lbl+=` ~${Math.round(acc*100)}%`;
      }
      const fc=nade?'#7a5c1f':ko?'#71766D':C.red;
      ctx.strokeStyle=fc; ctx.lineWidth=on?1.8:1.2;
      ctx.setLineDash([2,6]);
      ctx.beginPath(); ctx.moveTo(ex.x,ex.y); ctx.lineTo(tx,ty); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle=fc; ctx.lineWidth=1.8;
      const r=nade?26:11;
      ctx.beginPath(); ctx.arc(tx,ty,r,0,6.283); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tx-r-5,ty); ctx.lineTo(tx-r+4,ty);
      ctx.moveTo(tx+r-4,ty); ctx.lineTo(tx+r+5,ty);
      ctx.moveTo(tx,ty-r-5); ctx.lineTo(tx,ty-r+4);
      ctx.moveTo(tx,ty+r-4); ctx.lineTo(tx,ty+r+5); ctx.stroke();
      if(ko){                                    // réticule barré : le tir ne partira pas
        ctx.beginPath();
        ctx.moveTo(tx-r*0.72,ty-r*0.72); ctx.lineTo(tx+r*0.72,ty+r*0.72);
        ctx.stroke();
      }
      if(on){ ctx.fillStyle=fc; ctx.font='9px "Arial Narrow",sans-serif';
        ctx.fillText(lbl,tx+r+8,ty-r-2); }
    }
    ctx.globalAlpha=1;
  }
  // aperçu du chemin survolé
  if(sel&&hoverPath&&hoverPath.length&&mode!=='fire'&&mode!=='nade'){
    ctx.strokeStyle='rgba(29,78,110,.35)'; ctx.lineWidth=1.6; ctx.setLineDash([4,6]);
    ctx.beginPath(); ctx.moveTo(sel.x,sel.y);
    for(const p of hoverPath) ctx.lineTo(p.x,p.y);
    ctx.stroke(); ctx.setLineDash([]);
    drawCrossings(sel.x,sel.y,hoverPath,0.75);
  }
  ctx.restore();
}


/* ==========================================================================
   ENTRÉES
   ========================================================================== */
function mapPos(e){
  const r=cv.getBoundingClientRect();
  return {x:(e.clientX-r.left)/r.width*W, y:(e.clientY-r.top)/r.height*H};
}
function unitAt(x,y,side){
  return units.find(u=>u.alive&&u.side===side&&(side==='b'||u.seen)&&dist(u.x,u.y,x,y)<17);
}
cv.addEventListener('mousemove',e=>{
  const p=mapPos(e); hover=p;
  if(phase==='plan'&&sel&&sel.alive&&(mode==='auto'||mode==='move'||mode==='run')){
    const gx=clamp(Math.floor(p.x/TILE),0,COLS-1), gy=clamp(Math.floor(p.y/TILE),0,ROWS-1);
    const raw=findPath(grid,Math.floor(sel.x/TILE),Math.floor(sel.y/TILE),gx,gy);
    hoverPath=raw?trimPath(grid,sel.x,sel.y,raw,sel.c.move*(mode==='run'?RUN:1)).pts:null;
  } else hoverPath=null;
});
cv.addEventListener('mouseleave',()=>{ hover={x:-999,y:-999}; hoverPath=null; });
cv.addEventListener('contextmenu',e=>{
  e.preventDefault();
  if(phase==='plan'&&sel){ sel.mv=null; sel.fire=null; refreshUI(); }
});
cv.addEventListener('mousedown',e=>{
  audio();
  if(e.button!==0||phase!=='plan') return;
  const p=mapPos(e);
  const own=unitAt(p.x,p.y,'b');
  if(own){ sel=own; mode='auto'; refreshUI(); return; }
  if(!sel||!sel.alive) return;
  const foe=unitAt(p.x,p.y,'r');
  if(mode==='nade'){ orderNade(sel,p.x,p.y); mode='auto'; }
  else if(mode==='smoke'){ orderSmoke(sel,p.x,p.y); mode='auto'; }
  else if(mode==='watch'){ orderWatch(sel,p.x,p.y); mode='auto'; }
  else if(mode==='fire'||e.shiftKey){ foe?orderFireUnit(sel,foe):orderFirePoint(sel,p.x,p.y); mode='auto'; }
  else if(foe) orderFireUnit(sel,foe);
  else if(mode==='run') { orderMove(sel,p.x,p.y,true); mode='auto'; }
  else if(mode==='move'||mode==='auto') orderMove(sel,p.x,p.y);
  refreshUI();
});
window.addEventListener('keydown',e=>{
  if(phase==='replay'){
    if(e.code==='Space'){ e.preventDefault(); rp.playing=!rp.playing; updateReplayUI(); }
    if(e.key==='ArrowRight') loadReplayTurn(rp.ti+1);
    if(e.key==='ArrowLeft') loadReplayTurn(rp.t>1.2?rp.ti:rp.ti-1);
    if(e.key==='Escape') quitReplay();
    return;
  }
  if(e.code==='Space'){ e.preventDefault(); if(phase==='plan') beginResolve(); return; }
  if(e.code==='Tab'){ e.preventDefault(); cycleSel(); return; }
  if(e.key==='1') setMode('move');
  if(e.key==='2') setMode('run');
  if(e.key==='3') setMode('fire');
  if(e.key==='4') setMode('nade');
  if(e.key==='5') setMode('watch');
  if(e.key==='6') setMode('smoke');
  if(e.key==='a'||e.key==='A') showThreat=!showThreat;   // overlay de menace
  if(e.key==='Escape'){ mode='auto'; refreshUI(); }
});
function cycleSel(){
  const l=alive('b'); if(!l.length) return;
  const i=l.indexOf(sel); sel=l[(i+1)%l.length]; mode='auto'; refreshUI();
}
function setMode(m){ if(phase!=='plan'||!sel) return; mode=(mode===m?'auto':m); refreshUI(); }
document.querySelectorAll('.obtn[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
document.getElementById('bClear').onclick=()=>{ if(sel){sel.mv=null;sel.fire=null;refreshUI();} };
document.getElementById('go').onclick=()=>{ audio(); if(phase==='plan') beginResolve(); };
document.getElementById('ovB').onclick=()=>{ document.getElementById('over').classList.remove('on'); newGame(); };
document.getElementById('ovR').onclick=()=>{ audio(); startReplay(); };
/* choix du terrain : cliquer fait défiler les archétypes et relance une partie */
function updateTerrainLabel(){ document.getElementById('terrain').textContent='Terrain : '+ARCHETYPES[archetypeKey].name; }
document.getElementById('terrain').onclick=()=>{
  const i=ARCHETYPE_ORDER.indexOf(archetypeKey);
  archetypeKey=ARCHETYPE_ORDER[(i+1)%ARCHETYPE_ORDER.length];
  updateTerrainLabel(); newGame();
};
updateTerrainLabel();

/* ==========================================================================
   PAGE D'ACCUEIL — choix de l'escouade (4 emplacements) et du terrain
   ========================================================================== */
const TERRAIN_DESC={
  maison:'Cloisonné : couloirs, pièces et angles serrés.',
  ruines:'Éventré par les obus, gravats et longues lignes de vue.',
  ouvert:'Grands volumes, peu de murs, presque tout se voit.',
};
/* stats affichées dans chaque carte d'unité, normalisées sur le meilleur du roster */
const SQUAD_STATS=[{k:'hp',n:'Vie'},{k:'dmg',n:'Feu'},{k:'ideal',n:'Portée'},{k:'move',n:'Vitesse'}];
const statMax=Object.fromEntries(SQUAD_STATS.map(s=>[s.k,Math.max(...ROSTER.map(k=>CLS[k][s.k]))]));
function slotCard(cls,i){
  const c=CLS[cls];
  const bars=SQUAD_STATS.map(s=>
    `<div class="hstat"><span>${s.n}</span><i><b style="width:${Math.round(c[s.k]/statMax[s.k]*100)}%"></b></i></div>`).join('');
  return `<div class="hslot" data-slot="${i}">
    <div class="hslot-top"><span class="hslot-n">Unité ${i+1}</span>
      <div class="hslot-nav"><button class="hnav" data-dir="-1">‹</button><button class="hnav" data-dir="1">›</button></div></div>
    <div class="htoken" title="Changer de classe"><b>${c.tag}</b></div>
    <div class="hname">${c.name}</div>
    <div class="hstats">${bars}</div></div>`;
}
/* rendu (et re-rendu) des 4 emplacements ; chaque clic fait défiler la classe */
function renderSlots(){
  const el=document.getElementById('homeSlots');
  el.innerHTML=playerSquad.map(slotCard).join('');
  el.querySelectorAll('.hslot').forEach(card=>{
    const i=+card.dataset.slot;
    const cycle=dir=>{ playerSquad[i]=ROSTER[(ROSTER.indexOf(playerSquad[i])+dir+ROSTER.length)%ROSTER.length]; renderSlots(); };
    card.querySelectorAll('.hnav').forEach(b=>b.onclick=()=>cycle(+b.dataset.dir));
    card.querySelector('.htoken').onclick=()=>cycle(1);
  });
}
function buildHome(){
  renderSlots();
  document.getElementById('homeTerrains').innerHTML=ARCHETYPE_ORDER.map(k=>
    `<button class="hterr ${k===archetypeKey?'sel':''}" data-terr="${k}">
      <b>${ARCHETYPES[k].name}</b><small>${TERRAIN_DESC[k]||''}</small></button>`).join('');
  document.querySelectorAll('.hterr').forEach(b=>b.onclick=()=>{
    archetypeKey=b.dataset.terr;
    document.querySelectorAll('.hterr').forEach(x=>x.classList.toggle('sel',x===b));
  });
}
buildHome();
document.getElementById('homePlay').onclick=()=>{
  audio();
  document.getElementById('home').classList.remove('on');
  updateTerrainLabel(); newGame();
};

document.getElementById('rpQuit').onclick=()=>quitReplay();
document.getElementById('rpPlay').onclick=()=>{ rp.playing=!rp.playing; updateReplayUI(); };
document.getElementById('rpPrev').onclick=()=>loadReplayTurn(rp.t>1.2?rp.ti:rp.ti-1);
document.getElementById('rpNext').onclick=()=>loadReplayTurn(rp.ti+1);
document.getElementById('rpRestart').onclick=()=>loadReplayTurn(0);
document.getElementById('rpSpeed').onclick=()=>{
  rp.speed=rp.speed===1?0.5:rp.speed===0.5?0.25:rp.speed===0.25?2:1; updateReplayUI(); };

/* ==========================================================================
   INTERFACE
   ========================================================================== */
const squadEl=document.getElementById('squad');
function refreshUI(){
  document.getElementById('turnN').textContent=turn;
  document.getElementById('phase').textContent=
    phase==='plan'?"Phase d'ordres":phase==='resolve'?'Résolution simultanée'
      :phase==='replay'?'Replay':'Fin de partie';
  const pips=(n,c)=>Array.from({length:WINPTS},(_,i)=>`<div class="pip ${c} ${i<n?'on':''}"></div>`).join('');
  document.getElementById('scoreB').innerHTML=pips(scoreB,'b');
  document.getElementById('scoreR').innerHTML=pips(scoreR,'r');

  squadEl.innerHTML=units.filter(u=>u.side==='b').map(u=>{
    let ord='';
    if(!u.alive) ord='<span class="no">hors de combat</span>';
    else{
      if(u.mv) ord+=`<div class="mv">${u.mv.run?'course — arme basse':'déplacement'}</div>`;
      if(u.fire){
        const t=u.fire.kind==='unit'?`prise à partie · ${byId(u.fire.id)?.c.tag||'?'}`
          :u.fire.kind==='point'?'tir de suppression'
          :u.fire.kind==='watch'?'guet — cône couvert'
          :u.fire.kind==='smoke'?'fumigène':'grenade';
        ord+=`<div class="fr">${t}</div>`;
      }
      if(!ord) ord='<span class="no">en attente d\'ordre</span>';
    }
    return `<div class="card ${sel===u?'sel':''} ${u.alive?'':'dead'}" data-id="${u.id}">
      <div class="n"><b>${u.c.tag}</b><em>${u.c.name}${u.nades?' · '+u.nades+'gr':''}${u.smoke?' · '+u.smoke+'fum':''}</em></div>
      <div class="bar"><i style="width:${Math.max(0,u.hp/u.maxHp*100)}%"></i></div>
      <div class="bar supp"><i style="width:${u.supp}%"></i></div>
      <div class="ord">${ord}</div></div>`;
  }).join('');
  squadEl.querySelectorAll('.card').forEach(c=>c.onclick=()=>{
    const u=byId(+c.dataset.id); if(u&&u.alive){ sel=u; mode='auto'; refreshUI(); }
  });

  const busy=phase!=='plan';
  document.getElementById('go').classList.toggle('busy',busy);
  document.getElementById('go').textContent=busy?'Résolution…':'Exécuter';
  ['bMove','bRun','bFire','bNade','bWatch','bSmoke'].forEach(id=>{
    const b=document.getElementById(id);
    b.classList.toggle('on',mode===b.dataset.mode);
    b.disabled=busy||!sel||!sel.alive
      ||(id==='bNade'&&sel.nades<=0)||(id==='bSmoke'&&sel.smoke<=0);
  });
  document.getElementById('bClear').disabled=busy||!sel;
}

/* ==========================================================================
   BOUCLE
   ========================================================================== */
function newGame(){
  rng=createRng((Math.random()*4294967296)>>>0);   // le point d'entrée choisit la graine de jeu
  bullets=[]; parts=[]; nades=[]; smokes=[]; smokeGrid=new Uint8Array(COLS*ROWS);
  rec=[]; curRec=null; replaying=false; rp=null;
  turn=1; phase='plan'; rt=0; shake=0; hitstop=0; scoreB=0; scoreR=0; over=false; zones=[];
  mem={}; aiMem={};
  genMap(); dctx.clearRect(0,0,W,H); setupUnits(); updateVision();
  sel=alive('b')[0]; mode='auto';
  refreshUI();
}

let last=performance.now();
function loop(now){
  let dt=Math.min(DT_MAX,(now-last)/1000); last=now;
  if(phase==='replay'){
    if(hitstop>0) hitstop-=dt; else stepReplay(dt);
  } else if(phase==='resolve'){
    if(hitstop>0) hitstop-=dt;
    else{
      const sub=dt*speed;
      let rem=sub;
      while(rem>0){ const s=Math.min(SUBSTEP,rem); step(s); rem-=s; if(hitstop>0) break; }
      if(rt>=RESOLVE){ endResolve(); }
    }
  } else {
    updateParts(dt);
    shake=Math.max(0,shake-40*dt);
  }
  draw();
  requestAnimationFrame(loop);
}
newGame();
requestAnimationFrame(loop);

/* points d'entrée exposés pour le test de fumée headless (voir tests/smoke.test.js) */
export { newGame, beginResolve, step, endResolve, startReplay, stepReplay, draw };
export { units, bullets, parts, phase, turn, scoreB, scoreR, over };
