import {BUILDING_TYPES,BUILDING_FOOTPRINTS,sectorBuildingType} from './building-types.js';
import {placeBuilding} from './buildings.js';
import {propPlacementError,placePulperiaCart} from './props.js';
import {applyRegionalTerrain} from './regional-terrain.js';

export const TACTICAL_SIZE=Object.freeze({width:64,height:48});
export const LEGACY_SIZE=Object.freeze({width:20,height:16});
const DY=16;
const rural=new Set(['uspallata','los_patos','humahuaca']);
const coast=new Set(['ensenada','san_nicolas','santa_fe','san_lorenzo']);
export function physicalEntryAnchor(edge,anchor,width,height,sectorId){
 if(width===20&&height===16)return {...anchor};
 const dx=Math.floor((width-20)/2)+(coast.has(sectorId)?10:0),dy=Math.floor((height-16)/2);
 return {x:edge==='W'?0:edge==='E'?width-1:anchor.x+dx,y:edge==='N'?0:edge==='S'?height-1:anchor.y+dy};
}

// Retain the authored landmark and its stable IDs in a larger neighbourhood.
// Saved compact sectors continue to use their original layout when revisited.
export function expandSectorMap(core,boundaryRoads=core.tiles.filter(t=>t.type==='road'&&(t.x===0||t.x===19||t.y===0||t.y===15))){
 const {width,height}=TACTICAL_SIZE,id=core.sceneId??core.sector;
 const DX=coast.has(id)?32:22;
 const shift=p=>({...p,x:p.x+DX,y:p.y+DY});
 const shiftReinforcement=(p,index)=>shift({...p,x:p.x??1+Math.floor(index/14),y:p.y??1+index%14});
 const waterX=DX+(id==='santa_fe'?17:18);
 const tiles=Array.from({length:width*height},(_,i)=>{
  const x=i%width,y=Math.floor(i/width);
  if(x>=DX&&x<DX+20&&y>=DY&&y<DY+16)return shift(core.tiles[(y-DY)*20+x-DX]);
  const water=coast.has(id)&&x>=waterX;
  const cliff=rural.has(id)&&(y<DY+4||y>=DY+12);
  return {x,y,type:water?'water':cliff?'stone':'grass',blocked:water||cliff,cover:water||cliff?40:0};
 });
 const map={...core,width,height,tiles,wallEdges:(core.wallEdges??[]).map(shift),wallGeometryVersion:2,buildings:core.buildings.map(b=>({...shift(b),walls:(b.walls??[]).map(shift),rooms:b.rooms.map(r=>({...r,cells:r.cells.map(shift)}))})),groundItems:(core.groundItems??[]).map(shift),props:core.props.map(shift),lights:core.lights.map(shift),decor:core.decor.map(shift),npcs:(core.npcs??[]).map(shift),squad:core.squad.map(shift),enemies:core.enemies.map(shift),artillery:core.artillery.map(shift),garrison:(core.garrison??[]).map((p,i)=>shiftReinforcement(p,core.squad.length+i)),missionAllies:(core.missionAllies??[]).map((p,i)=>shiftReinforcement(p,core.squad.length+(core.garrison?.length??0)+i))};
 if(core.upperSurfaces!==undefined)map.upperSurfaces=core.upperSurfaces.map(shift);
 if(core.climbLinks!==undefined)map.climbLinks=core.climbLinks.map(link=>({...link,from:shift(link.from),to:shift(link.to)}));
 const road=(x,y)=>{const t=tiles[y*width+x];if(t&&!t.blocked&&!t.buildingId)Object.assign(t,{type:'road',cover:0});};
 // Continue each authored road to the new boundary. Coast and cliffs win.
 for(const p of boundaryRoads){
  if(p.x===0)for(let x=0;x<DX;x++)road(x,p.y+DY);
  if(p.x===19)for(let x=DX+20;x<width;x++)road(x,p.y+DY);
  if(p.y===0)for(let y=0;y<DY;y++)road(p.x+DX,y);
  if(p.y===15)for(let y=DY+16;y<height;y++)road(p.x+DX,y);
 }
 // The old Jujuy south-facing house ended against the cliff. Extend its
 // doorstep through that narrow strip so the retained interior is accessible.
 if(id==='jujuy')for(let y=DY+14;y<=DY+15;y++)Object.assign(tiles[y*width+DX+10],{type:'road',blocked:false,blocksSight:false,cover:0});
 // Place complete plans with two clear cells between façades. Large plans
 // are packed first, so a church cannot be replaced by a narrow leftover lot.
 // The central mission area remains reserved, including troop deployment.
 const target=core.worldCell?core.buildings.length:rural.has(id)?0:['san_lorenzo','yatasto'].includes(id)?6:20;
 const seed=[...id].reduce((n,c)=>n+c.charCodeAt(0),0);
 const firstIndex=map.buildings.length,needsBar=target===20&&!map.buildings.some(b=>b.purpose==='bar');
 const plans=Array.from({length:Math.max(0,target-firstIndex)},(_,i)=>{
  const index=firstIndex+i,bar=needsBar&&i===0;
  const architecture=bar?'pulperia':sectorBuildingType(id,index);
  const [w,h]=BUILDING_FOOTPRINTS[architecture];
  return {index,architecture,w,h,bar};
 }).sort((a,b)=>b.w*b.h-a.w*a.h||b.h-a.h||a.index-b.index);
 const canPlace=(x,y,w,h)=>{
  if(x<DX+22&&x+w>DX-2&&y<DY+18&&y+h>DY-2)return false;
  if(map.buildings.some(b=>!(x+w+2<=b.x||b.x+b.width+2<=x||y+h+2<=b.y||b.y+b.height+2<=y)))return false;
  for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++){
   const t=map.tiles[row*width+col];
   if(!t||t.blocked||t.buildingId||t.type==='road')return false;
  }
  const doorstep=map.tiles[(y+h)*width+x+Math.floor(w/2)];
  return doorstep&&!doorstep.blocked&&!doorstep.buildingId;
 };
 for(const {index,architecture,w,h,bar} of plans){
  let lot=null;
  for(let y=2;y+h<height&&!lot;y++)for(let i=2;i+w<width-1;i++){
   const x=seed%2?width-w-i:i;
   if(canPlace(x,y,w,h)){lot={x,y};break;}
  }
  if(!lot)throw Error(`El plano de ${id} no tiene espacio para ${BUILDING_TYPES[architecture].name} (${w}×${h}).`);
  const buildingId=`${id}:neighbourhood-${index}`;
  const result=placeBuilding(map.tiles,{id:buildingId,architecture,name:`${BUILDING_TYPES[architecture].name} · ${index+1}`,...lot,width:w,height:h,doors:[{x:lot.x+Math.floor(w/2),y:lot.y+h-1}],windows:[{x:lot.x,y:lot.y+Math.floor(h/2)}],material:'adobe'});
  // New neighbourhood shells share the editor's catalog renderer. Keep the
  // structural walls for entrance-relative details and the original save IDs.
  result.building.kind=architecture;map.wallEdges.push(...result.wallEdges);
  if(bar)Object.assign(result.building,{purpose:'bar',name:'Pulpería del barrio'});
  map.tiles=result.tiles;map.buildings.push(result.building);
  const prop={id:`${buildingId}:chest`,type:'chest',x:lot.x+1,y:lot.y+1,buildingId,roomId:result.building.rooms[0].id,footprint:{width:1,height:1},blocksMovement:true};
  if(!propPlacementError(map,prop))map.props.push(prop);
 }
 // Keep catalogue identities and save order stable after size-first placement.
 map.buildings.sort((a,b)=>{
  const index=b=>b.id.includes(':neighbourhood-')?Number(b.id.split(':neighbourhood-')[1]):core.buildings.findIndex(v=>v.id===b.id);
  return index(a)-index(b);
 });
 for(const b of map.buildings)placePulperiaCart(map,b);
 if(id==='buenos_aires'){
  // Continuous streets between the lots, with stone pavements beside the houses.
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
   if(x>=DX-1&&x<=DX+20&&y>=DY-1&&y<=DY+16)continue;
   const t=map.tiles[y*width+x];if(t.blocked||t.buildingId)continue;
   if(x%8===1||x%8===2||[9,10,17,18,25,26,33,34,40,41].includes(y))Object.assign(t,{type:'road',cover:0});
   else if(map.buildings.some(b=>x>=b.x-1&&x<=b.x+b.width&&y>=b.y-1&&y<=b.y+b.height))Object.assign(t,{type:'stone',cover:0});
  }
 }
 if(target===20&&map.buildings.length!==20)throw Error(`El plano de ${id} no tiene veinte solares accesibles.`);
 // Preserve the relative deployment around the authored landmark. New houses
 // cannot overlap it; arrivals are placed on the enlarged boundary by world.js.
 return applyRegionalTerrain(map,{x:DX,y:DY,width:20,height:16});
}
