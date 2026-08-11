/* ==========================================================================
   IA — pose ses ordres en même temps que le joueur
   aiPlan(world, rng) lit l'état (world) et écrit les ordres sur les unités
   (u.mv / u.fire / u.wantRun). S'appuie sur la couche règles pour la vue, la
   couverture, le pathfinding ; l'aléa passe par le générateur seedé injecté.
   ========================================================================== */
import { W, H, TILE, COLS, ROWS, VIEW, RUN, T } from '../config.js';
import { idx, inAnyZone, zoneCenter } from '../rules/geometry.js';
import { solid } from '../rules/terrain.js';
import { los } from '../rules/los.js';
import { isCovered } from '../rules/cover.js';
import { findPath, trimPath } from '../rules/pathfind.js';

/* focus fire : cible prioritaire de l'escouade, la plus rentable à concentrer.
   enemies : [{id, hp, maxHp, cls, covered, seers}]. Renvoie l'id (départage par id). */
export function pickFocusTarget(enemies){
  let best=null, bs=-1e9;
  for(const e of enemies){
    const s=(e.maxHp-e.hp)*0.7 + e.seers*22 + (e.covered?-30:40) + (e.cls==='mit'?25:0);
    if(s>bs || (s===bs && (best===null || e.id<best))){ bs=s; best=e.id; }
  }
  return best;
}

export function aiPlan(world, rng){
  const { units, zones, aiMem, grid, smokeGrid, turn, scoreB, scoreR } = world;
  const rint=(a,b)=>Math.floor(a+rng()*(b-a+1));
  const grnd=(a,b)=>a+rng()*(b-a);
  const clamp=(v,a,b)=>v<a?a:v>b?b:v;
  const dist=(a,b,c,d)=>Math.hypot(a-c,b-d);
  const alive=s=>units.filter(u=>u.alive&&u.side===s);
  const byId=i=>units.find(u=>u.id===i);
  function objCenter(u){
    if(!zones.length) return {x:W/2,y:H/2};
    if(!u) return zoneCenter(zones[0]);
    let best=zones[0], bd=1e9;
    for(const z of zones){ const c=zoneCenter(z), d=dist(u.x,u.y,c.x,c.y); if(d<bd){bd=d;best=z;} }
    return zoneCenter(best);
  }
  function lastKnownCenter(){
    const ks=Object.entries(aiMem).map(([k,v])=>({u:byId(+k),...v})).filter(m=>m.u&&m.u.alive&&turn-m.turn<=3);
    if(!ks.length) return null;
    return {x:ks.reduce((a,k)=>a+k.x,0)/ks.length,y:ks.reduce((a,k)=>a+k.y,0)/ks.length};
  }
    const foes=alive('b'), mine=alive('r');

    // pré-passe : qui voit qui, pour concentrer le feu (focus fire)
    const seen=new Map();
    for(const u of mine)
      for(const f of foes)
        if(dist(u.x,u.y,f.x,f.y)<VIEW&&los(grid,smokeGrid,u.x,u.y,f.x,f.y)){
          let rec=seen.get(f.id);
          if(!rec){ rec={foe:f,seers:0,covered:isCovered(grid,u.x,u.y,f.x,f.y)}; seen.set(f.id,rec); }
          rec.seers++;
        }
    const knownFoes=[...seen.values()].map(r=>r.foe);
    const focusId=seen.size
      ? pickFocusTarget([...seen.values()].map(r=>({id:r.foe.id,hp:r.foe.hp,maxHp:r.foe.maxHp,cls:r.foe.cls,covered:r.covered,seers:r.seers})))
      : null;

    for(const u of mine){
      u.mv=null; u.fire=null;
      const visible=foes.filter(f=>dist(u.x,u.y,f.x,f.y)<VIEW&&los(grid,smokeGrid,u.x,u.y,f.x,f.y));

      // sous le feu et à découvert : on se masque au fumigène
      if(u.smoke>0&&u.supp>45&&visible.length){
        const f=visible[0];
        const d=dist(u.x,u.y,f.x,f.y), k=Math.min(0.55,140/Math.max(1,d));
        u.fire={kind:'smoke',x:u.x+(f.x-u.x)*k,y:u.y+(f.y-u.y)*k};
      }
      // grenade sur un groupe ou sur un ennemi à couvert
      if(!u.fire&&u.nades>0&&visible.length){
        for(const f of visible){
          const near=visible.filter(o=>dist(o.x,o.y,f.x,f.y)<80).length;
          if(dist(u.x,u.y,f.x,f.y)<400&&(near>=2||isCovered(grid,u.x,u.y,f.x,f.y))){
            u.fire={kind:'nade',x:f.x+grnd(-14,14),y:f.y+grnd(-14,14)}; break;
          }
        }
      }
      // sinon : prendre à partie le plus intéressant
      if(!u.fire&&visible.length){
        let best=null,bs=-1e9;
        for(const f of visible){
          const d=dist(u.x,u.y,f.x,f.y);
          let s=200-Math.abs(d-u.c.ideal)*0.35 + (f.maxHp-f.hp)*0.7;
          if(isCovered(grid,u.x,u.y,f.x,f.y)) s-=45;
          if(f.cls==='mit') s+=25;
          if(f.id===focusId) s+=120;                  // focus fire : on concentre sur la cible prioritaire
          if(s>bs){bs=s;best=f;}
        }
        u.fire={kind:'unit',id:best.id};
      }
      // sinon : suppression sur la dernière position connue
      if(!u.fire){
        const known=Object.entries(aiMem).map(([k,v])=>({u:byId(+k),...v}))
          .filter(m=>m.u&&m.u.alive&&turn-m.turn<=3&&los(grid,smokeGrid,u.x,u.y,m.x,m.y)&&dist(u.x,u.y,m.x,m.y)<u.c.ideal+u.c.fall);
        if(known.length){ const k=known[0]; u.fire={kind:'point',x:k.x,y:k.y}; }
      }
      // fumée offensive : masquer un tireur ennemi connu pour progresser à découvert
      if((!u.fire||u.fire.kind==='point')&&u.smoke>0&&knownFoes.length){
        const obj=objCenter(u);
        if(dist(u.x,u.y,obj.x,obj.y)>u.c.ideal){        // encore loin de l'objectif : on veut avancer
          const threat=knownFoes.find(f=>dist(u.x,u.y,f.x,f.y)<f.c.ideal+f.c.fall&&los(grid,smokeGrid,f.x,f.y,u.x,u.y));
          if(threat){
            const d=dist(u.x,u.y,threat.x,threat.y), k=Math.min(0.6,120/Math.max(1,d));
            u.fire={kind:'smoke',x:u.x+(threat.x-u.x)*k,y:u.y+(threat.y-u.y)*k};
          }
        }
      }
      // plus rien à viser : guet sur l'axe d'où ça viendra
      if(!u.fire){
        const a=lastKnownCenter()||objCenter(u);
        u.fire={kind:'watch',ang:Math.atan2(a.y-u.y,a.x-u.x),x:a.x,y:a.y};
        u.wantRun=!visible.length&&!lastKnownCenter()&&dist(u.x,u.y,a.x,a.y)>u.c.move*1.2;
      } else u.wantRun=false;
      // couverture mutuelle : une unité qui peut tirer tient sa position pendant que d'autres avancent
      const overwatch = !!u.fire && (u.fire.kind==='unit'||u.fire.kind==='point');

      // déplacement : chercher une position couverte, en vue d'une cible, proche de l'objectif
      const tgt=u.fire&&u.fire.kind==='unit'?byId(u.fire.id):null;
      const anchor=tgt?{x:tgt.x,y:tgt.y}:lastKnownCenter()||objCenter(u);
      let bestP=null,bs=-1e9;
      const gx0=Math.floor(u.x/TILE), gy0=Math.floor(u.y/TILE);
      const R=Math.ceil(u.c.move/TILE);
      for(let n=0;n<64;n++){
        const gx=clamp(gx0+rint(-R,R),0,COLS-1), gy=clamp(gy0+rint(-R,R),0,ROWS-1);
        if(solid(grid,gx,gy)) continue;
        const px=gx*TILE+TILE/2, py=gy*TILE+TILE/2;
        if(dist(u.x,u.y,px,py)>u.c.move*(u.wantRun?RUN:1)*1.1) continue;
        const d=dist(px,py,anchor.x,anchor.y);
        let s=-Math.abs(d-u.c.ideal*0.85)*0.4;
        if(los(grid,smokeGrid,px,py,anchor.x,anchor.y)) s+=90; else s-=40;
        if(isCovered(grid,anchor.x,anchor.y,px,py)) s+=110;
        const tt=grid[idx(gx,gy)];                       // l'IA lit le terrain
        if(tt===T.RUBBLE) s+=70; else if(tt===T.WOOD) s+=55;
        else if(tt===T.MARSH) s-=110; else if(tt===T.WALL) s-=150; else if(tt===T.ROAD) s-=25;
        const inObj=inAnyZone(zones,gx,gy);
        if(inObj) s+=(scoreB>=scoreR?150:70);
        s-=dist(px,py,objCenter(u).x,objCenter(u).y)*0.06;
        if(u.supp>50) s+=los(grid,smokeGrid,px,py,anchor.x,anchor.y)?-60:60;   // sous le feu : se défiler
        if(overwatch){ if(gx===gx0&&gy===gy0) s+=160; else s-=dist(px,py,u.x,u.y)*0.25; }  // tient la position
        s+=grnd(-18,18);
        if(s>bs){bs=s;bestP={gx,gy};}
      }
      if(bestP){
        const p=findPath(grid,gx0,gy0,bestP.gx,bestP.gy);
        const run=u.wantRun;
        if(p&&p.length){
          const t=trimPath(grid,u.x,u.y,p,u.c.move*(run?RUN:1));
          if(t.pts.length){ u.mv={pts:t.pts,i:0,run,raw:p}; if(run) u.fire=null; }
        }
      }
    }
}
