/* ==========================================================================
   CARTE — génération procédurale d'une maison, vue en plan
   generateMap(rng) est pur : à graine fixe, il rend la même carte. Il compose
   sur la moitié gauche puis retourne à 180°, et ne retente que tant que la
   maison n'est pas jouable (mapValid).
   ========================================================================== */
import { T, TI, COLS, ROWS, TILE, W, H, HALLZ, MAP_ATTEMPTS, MAP_PASS_MIN, MAP_FLOOR_MIN, MAP_REACH_MIN, ARCHETYPES } from '../config.js';
import { idx, inMap, inAnyZone } from '../rules/geometry.js';
import { isWallT, solid } from '../rules/terrain.js';

/* --- génération d'une maison, vue en plan.
       1 l'emprise (corps principal, aile, patio) · 2 le mur d'enceinte ·
       3 le couloir de distribution · 4 le cloisonnement récursif ·
       5 les portes, posées par arbre couvrant puis bouclées ·
       6 les pièces typées et meublées · 7 fenêtres, dégâts, rue et cour.
       Tout est composé sur la moitié gauche, puis retourné à 180°. --- */
export function generateMap(rng, arch = ARCHETYPES.maison){
  let grid, indoor, rooms, zones;
  const rint=(a,b)=>Math.floor(a+rng()*(b-a+1));

  function buildMap(){
    grid=new Uint8Array(COLS*ROWS);
    indoor=new Uint8Array(COLS*ROWS);
    rooms=[];
    const HALF=COLS/2, HALLX=11;
    const put=(x,y,v)=>{ if(inMap(x,y)&&x<HALF) grid[idx(x,y)]=v; };
    const at=(x,y)=>inMap(x,y)?grid[idx(x,y)]:T.BLD;
    const bx0=rint(3,5), by0=rint(1,2), by1=ROWS-1-by0;
  
    /* 1 — emprise : le corps principal, parfois une aile, parfois un patio */
    const fill=(x0,y0,x1,y1)=>{ for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++)
      if(inMap(x,y)&&x<HALF){ grid[idx(x,y)]=T.FLOOR; indoor[idx(x,y)]=1; } };
    fill(bx0,by0,HALF-1,by1);
    let aile=null;
    if(rng()<arch.wing){                       // aile en avancée sur la cour
      const h=rint(3,5), y=rint(by0+1,by1-h), w=rint(2,3);
      aile=[Math.max(2,bx0-w),y,bx0-1,y+h-1];
      fill(aile[0],aile[1],aile[2],aile[3]);
    }
    let patio=null;
    if(rng()<arch.patio){                       // patio à ciel ouvert
      const w=rint(2,3), h=rint(2,3);
      const x=rint(bx0+2,HALLX-2-w), y=rint(by0+2,by1-2-h);
      patio=[x,y,x+w-1,y+h-1];
      for(let j=y;j<=y+h-1;j++) for(let i=x;i<=x+w-1;i++){ put(i,j,T.OPEN); indoor[idx(i,j)]=0; }
    }
  
    /* 2 — mur d'enceinte : toute dalle qui touche l'extérieur */
    const dedans=(x,y)=> x>=HALF ? (y>=by0&&y<=by1) : (inMap(x,y)&&indoor[idx(x,y)]===1);
    const ring=[];
    for(let y=0;y<ROWS;y++) for(let x=0;x<HALF;x++){
      if(!dedans(x,y)) continue;
      if(!dedans(x-1,y)||!dedans(x+1,y)||!dedans(x,y-1)||!dedans(x,y+1)) ring.push([x,y]);
    }
    for(const [x,y] of ring) put(x,y,T.BLD);
  
    /* 3 — couloir de distribution, de la porte d'entrée au hall */
    const cy=rint(by0+4,by1-4);
    for(let x=bx0;x<HALLX;x++) put(x,cy,T.FLOOR);
    put(bx0,cy,T.FLOOR);                          // porte d'entrée
  
    /* 4 — cloisonnement des deux blocs, de part et d'autre du couloir */
    const wallCol=(c,y0,y1)=>{ for(let y=y0;y<=y1;y++) if(at(c,y)===T.FLOOR) put(c,y,T.PART); };
    const wallRow=(r,x0,x1)=>{ for(let x=x0;x<=x1;x++) if(at(x,r)===T.FLOOR) put(x,r,T.PART); };
    const split=(x0,y0,x1,y1,d)=>{
      const w=x1-x0+1, h=y1-y0+1;
      const canV=w>=5, canH=h>=5;
      if(d>=4||(!canV&&!canH)||(w<=6&&h<=6&&rng()<arch.partitionStop)) return;
      if(canV&&(!canH||w>=h)){ const c=rint(x0+2,x1-2); wallCol(c,y0,y1);
        split(x0,y0,c-1,y1,d+1); split(c+1,y0,x1,y1,d+1); }
      else { const r=rint(y0+2,y1-2); wallRow(r,x0,x1);
        split(x0,y0,x1,r-1,d+1); split(x0,r+1,x1,y1,d+1); }
    };
    wallRow(cy-1,bx0+1,HALLX-1);                  // le couloir est bordé de cloisons,
    wallRow(cy+1,bx0+1,HALLX-1);                  // les pièces s'y ouvriront par des portes
    split(bx0+1,by0+1,HALLX-1,cy-2,0);
    split(bx0+1,cy+2,HALLX-1,by1-1,0);
    wallCol(HALLX,by0+1,by1-1);                   // cloison du hall
    if(aile) wallCol(bx0,aile[1],aile[3]);        // l'aile devient une pièce à part
  
    /* 5 — les portes : un arbre couvrant sur les pièces, puis quelques boucles */
    const reg=new Int32Array(COLS*ROWS).fill(-1);
    const regs=[];
    for(let y=0;y<ROWS;y++) for(let x=0;x<HALF;x++){
      if(reg[idx(x,y)]>=0||isWallT(at(x,y))||at(x,y)===T.WIN) continue;
      const id=regs.length, cells=[]; const q=[[x,y]]; reg[idx(x,y)]=id;
      let touchesEdge=false;
      while(q.length){
        const [cx,cyy]=q.pop(); cells.push([cx,cyy]);
        if(cx<=1) touchesEdge=true;
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const nx=cx+dx, ny=cyy+dy;
          if(!inMap(nx,ny)||nx>=HALF||reg[idx(nx,ny)]>=0) continue;
          if(isWallT(at(nx,ny))||at(nx,ny)===T.WIN) continue;
          reg[idx(nx,ny)]=id; q.push([nx,ny]);
        }
      }
      regs.push({id,cells,outside:touchesEdge,
        inside:cells.some(c=>indoor[idx(c[0],c[1])]===1)});
    }
    const par=regs.map((_,i)=>i);
    const find=i=>par[i]===i?i:(par[i]=find(par[i]));
    const uni=(a,b)=>{ a=find(a); b=find(b); if(a===b) return false; par[a]=b; return true; };
    const doors=[];
    for(let y=1;y<ROWS-1;y++) for(let x=1;x<HALF-1;x++){
      if(at(x,y)!==T.PART&&at(x,y)!==T.BLD) continue;
      for(const [dx,dy] of [[1,0],[0,1]]){
        const a=reg[idx(x-dx,y-dy)], b=reg[idx(x+dx,y+dy)];
        if(a<0||b<0||a===b) continue;
        if(!regs[a].inside&&!regs[b].inside) continue;
        doors.push({x,y,a,b,ext:at(x,y)===T.BLD});
      }
    }
    doors.sort(()=>rng()-.5);
    doors.sort((p,q)=>(p.ext?1:0)-(q.ext?1:0));   // on perce les cloisons avant les murs porteurs
    const extra=[];
    for(const d of doors){
      if(uni(d.a,d.b)) put(d.x,d.y,T.FLOOR); else extra.push(d);
    }
    for(const d of extra) if(!d.ext&&rng()<arch.loop) put(d.x,d.y,T.FLOOR);   // quelques boucles
    for(const d of doors)                                                        // quelques baies larges
      if(at(d.x,d.y)===T.FLOOR&&!d.ext&&rng()<arch.wideBay){
        const [ox,oy]=rng()<.5?[0,1]:[1,0];
        if(at(d.x+ox,d.y+oy)===T.PART) put(d.x+ox,d.y+oy,T.FLOOR);
      }
  
    /* 6 — chaque pièce reçoit une fonction, et le mobilier qui va avec */
    const cands=[];
    const GRAND=['SALON','SÉJOUR','ATELIER'], MOYEN=['CHAMBRE','CUISINE','BUREAU'],
          PETIT=['CHAMBRE',"SALLE D'EAU",'CELLIER'], MINUS=['CELLIER',"SALLE D'EAU",'DÉBARRAS'];
    const pick=a=>a[rint(0,a.length-1)];
    for(const r of regs){
      if(!r.inside||r.outside) continue;
      const cells=r.cells.filter(c=>indoor[idx(c[0],c[1])]===1&&at(c[0],c[1])===T.FLOOR);
      const n=cells.length;
      if(n<2) continue;
      const contreMur=(x,y)=>[[1,0],[-1,0],[0,1],[0,-1]].some(d=>isWallT(at(x+d[0],y+d[1])));
      const isCorridor=cells.every(c=>c[1]===cy)||n>=6&&cells.filter(c=>c[1]===cy).length===n;
      const type=isCorridor?'COULOIR':n>=18?pick(GRAND):n>=10?pick(MOYEN):n>=5?pick(PETIT):pick(MINUS);
      const poser=(f,p,mur)=>{ for(const [x,y] of cells)
        if(at(x,y)===T.FLOOR&&rng()<p*arch.furniture&&(mur===undefined||contreMur(x,y)===mur)) put(x,y,f); };
      if(type==='SALON'||type==='SÉJOUR'){ poser(T.WALL,0.20,false); poser(T.WOOD,0.16,true); }
      else if(type==='CUISINE'){ poser(T.WALL,0.55,true); poser(T.WOOD,0.18,true); }
      else if(type==='CHAMBRE'){ poser(T.WALL,0.30,true); poser(T.WOOD,0.22,true); }
      else if(type==='BUREAU'){ poser(T.WOOD,0.36,true); poser(T.WALL,0.14,false); }
      else if(type==='ATELIER'){ poser(T.WALL,0.22,false); poser(T.RUBBLE,0.12); }
      else if(type==='CELLIER'||type==='DÉBARRAS'){ poser(T.WOOD,0.42); }
      else if(type==="SALLE D'EAU"){ poser(T.WALL,0.25,true); }
      const dansHall=cells.some(c=>c[0]>=HALLZ.x0-1&&c[1]>=HALLZ.y0&&c[1]<=HALLZ.y1);
      if(type!=='COULOIR'&&!dansHall&&n>=5&&n<=22){   // candidate au rôle d'objectif
        let x0=99,y0=99,x1=-1,y1=-1;
        for(const [a,b] of cells){ x0=Math.min(x0,a); y0=Math.min(y0,b); x1=Math.max(x1,a); y1=Math.max(y1,b); }
        if(x1<HALLZ.x0-1&&x0>=3) cands.push({x0,y0,x1,y1,n:type,area:n});
      }
      if(type!=='COULOIR'&&!dansHall&&n>=4){
        let sx=0,sy=0; for(const c of cells){ sx+=c[0]; sy+=c[1]; }
        rooms.push({n:type,x:(sx/n+0.5)*TILE,y:(sy/n+0.5)*TILE});
      }
    }
    if(patio) rooms.push({n:'PATIO',x:((patio[0]+patio[2])/2+0.5)*TILE,y:((patio[1]+patio[3])/2+0.5)*TILE});
  
    /* 7 — fenêtres, dégâts, rue et cour */
    for(const [x,y] of ring){
      if(at(x,y)!==T.BLD) continue;
      if(x===bx0&&y===cy) continue;
      if(rng()<arch.window){
        put(x,y,T.WIN);
        const [dx,dy]=(at(x-1,y)===T.BLD||at(x+1,y)===T.BLD)?[1,0]:[0,1];
        if(rng()<arch.windowDouble&&at(x+dx,y+dy)===T.BLD) put(x+dx,y+dy,T.WIN);
      }
    }
    for(let s=0;s<arch.shells;s++) if(rng()<arch.shellP){   // des obus sont tombés
      const ex=rint(bx0+1,HALF-2), ey=rint(by0+1,by1-1);
      for(let j=-1;j<=1;j++) for(let i=-1;i<=1;i++){
        const v=at(ex+i,ey+j);
        if(isWallT(v)&&rng()<0.55) put(ex+i,ey+j,T.RUBBLE);
        else if(v!==T.OPEN&&!isWallT(v)&&rng()<0.7)
          put(ex+i,ey+j,rng()<0.5?T.RUBBLE:T.MARSH);
      }
    }
    for(let y=0;y<ROWS;y++) put(1,y,T.ROAD);
    for(let x=2;x<bx0;x++) if(at(x,cy)===T.OPEN) put(x,cy,T.ROAD);   // allée
    for(let k=0;k<rint(2,3);k++){                                    // muret de cour
      let x=rint(2,Math.max(2,bx0-1)), y=rint(1,ROWS-3), n2=rint(2,4), dv=rng()<0.65;
      while(n2-->0){ if(at(x,y)===T.OPEN) put(x,y,T.WALL); if(dv) y++; else x++; }
    }
    for(let k=0;k<rint(1,3);k++){
      const x=rint(2,Math.max(2,bx0-1)), y=rint(1,ROWS-2);
      if(at(x,y)===T.OPEN) put(x,y,T.RUBBLE);
    }
  
    /* --- symétrie 180° --- */
    for(let y=0;y<ROWS;y++) for(let x=0;x<HALF;x++){
      grid[idx(COLS-1-x,ROWS-1-y)]=grid[idx(x,y)];
      indoor[idx(COLS-1-x,ROWS-1-y)]=indoor[idx(x,y)];
    }
    for(const r of rooms.slice()) rooms.push({n:r.n,x:W-r.x,y:H-r.y});
  
    /* --- les objectifs : le hall, plus une pièce et son symétrique --- */
    zones=[{x0:HALLZ.x0,y0:HALLZ.y0,x1:HALLZ.x1,y1:HALLZ.y1,n:'HALL'}];
    if(cands.length){
      cands.sort((a,b)=>Math.abs(a.area-11)-Math.abs(b.area-11));
      const c=cands[rint(0,Math.min(2,cands.length-1))];
      zones.push({x0:c.x0,y0:c.y0,x1:c.x1,y1:c.y1,n:c.n});
      zones.push({x0:COLS-1-c.x1,y0:ROWS-1-c.y1,x1:COLS-1-c.x0,y1:ROWS-1-c.y0,n:c.n});
    }
    rooms=rooms.filter(r=>!inAnyZone(zones,Math.floor(r.x/TILE),Math.floor(r.y/TILE)));
  
    /* --- déploiement dégagé, la rue conservée --- */
    for(let y=0;y<ROWS;y++) for(let x=0;x<2;x++){
      if(grid[idx(x,y)]!==T.ROAD) grid[idx(x,y)]=T.OPEN;
      if(grid[idx(COLS-1-x,y)]!==T.ROAD) grid[idx(COLS-1-x,y)]=T.OPEN;
    }
    /* --- le hall central reste praticable --- */
    const mir=(x,y,v)=>{ grid[idx(x,y)]=v; grid[idx(COLS-1-x,ROWS-1-y)]=v; };
    for(let y=HALLZ.y0;y<=HALLZ.y1;y++) for(let x=HALLZ.x0;x<=(HALLZ.x0+HALLZ.x1)>>1;x++)
      if(grid[idx(x,y)]===T.MARSH) mir(x,y,T.FLOOR);
    const ox2=(HALLZ.x0+HALLZ.x1)>>1, oy2=(HALLZ.y0+HALLZ.y1)>>1;
    mir(ox2,oy2,T.FLOOR);
    for(const [dx,dy] of [[-2,-1],[-1,2]]){
      const x=ox2+dx, y=oy2+dy;
      if(inMap(x,y)&&grid[idx(x,y)]===T.FLOOR&&rng()<0.8)
        mir(x,y,rng()<.5?T.WALL:T.RUBBLE);
    }
  }

  function mapValid(){
    const seen=new Uint8Array(COLS*ROWS);
    const start=idx(1,ROWS>>1);
    if(solid(grid,1,ROWS>>1)) return false;
    const q=[start]; seen[start]=1;
    while(q.length){
      const c=q.pop(), x=c%COLS, y=c/COLS|0;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
        const nx=x+dx, ny=y+dy;
        if(!inMap(nx,ny)||solid(grid,nx,ny)) continue;
        const n=idx(nx,ny); if(seen[n]) continue;
        seen[n]=1; q.push(n);
      }
    }
    const ys=[2,6,10,14];
    for(const y of ys){ if(!seen[idx(1,y)]||!seen[idx(COLS-2,ROWS-1-y)]) return false; }
    for(const z of zones){                       // chaque zone doit être atteignable
      let ok=false;
      for(let y=z.y0;y<=z.y1&&!ok;y++) for(let x=z.x0;x<=z.x1&&!ok;x++)
        if(seen[idx(x,y)]) ok=true;
      if(!ok) return false;
    }
    let pass=0, floor=0, reach=0;
    for(let i=0;i<grid.length;i++){
      if(TI[grid[i]].pass) pass++;
      if(grid[i]===T.FLOOR) floor++;
      if(seen[i]&&indoor[i]) reach++;
    }
    // toutes les pièces doivent être atteignables, sinon la maison a une poche morte
    let ins=0; for(let i=0;i<grid.length;i++) if(indoor[i]&&TI[grid[i]].pass) ins++;
    return pass>grid.length*MAP_PASS_MIN && floor>grid.length*MAP_FLOOR_MIN && reach>ins*MAP_REACH_MIN;
  }

  for(let attempt=0;attempt<MAP_ATTEMPTS;attempt++){ buildMap(); if(mapValid()) break; }
  return { grid, indoor, rooms, zones };
}
