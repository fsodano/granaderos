import {placeBuilding} from './buildings.js';
import {propPlacementError} from './props.js';

export const TACTICAL_SIZE=Object.freeze({width:64,height:48});
export const LEGACY_SIZE=Object.freeze({width:20,height:16});
const DY=16;
const rural=new Set(['uspallata','los_patos','humahuaca']);
const coast=new Set(['ensenada','san_nicolas','santa_fe','san_lorenzo']);
// Retain the authored landmark and its stable IDs in a larger neighbourhood.
// Saved compact sectors continue to use their original layout when revisited.
export function expandSectorMap(core){
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
 const map={...core,width,height,tiles,buildings:core.buildings.map(b=>({...shift(b),walls:(b.walls??[]).map(shift),rooms:b.rooms.map(r=>({...r,cells:r.cells.map(shift)}))})),groundItems:(core.groundItems??[]).map(shift),props:core.props.map(shift),lights:core.lights.map(shift),decor:core.decor.map(shift),npcs:(core.npcs??[]).map(shift),squad:core.squad.map(shift),enemies:core.enemies.map(shift),artillery:core.artillery.map(shift),garrison:(core.garrison??[]).map((p,i)=>shiftReinforcement(p,core.squad.length+i)),missionAllies:(core.missionAllies??[]).map((p,i)=>shiftReinforcement(p,core.squad.length+(core.garrison?.length??0)+i))};
 const road=(x,y)=>{const t=tiles[y*width+x];if(t&&!t.blocked&&!t.buildingId)Object.assign(t,{type:'road',cover:0});};
 // Continue each authored road to the new boundary. Coast and cliffs win.
 for(let y=0;y<16;y++){
  if(core.tiles[y*20].type==='road')for(let x=0;x<DX;x++)road(x,y+DY);
  if(core.tiles[y*20+19].type==='road')for(let x=DX+20;x<width;x++)road(x,y+DY);
 }
 for(let x=0;x<20;x++){
  if(core.tiles[x].type==='road')for(let y=0;y<DY;y++)road(x+DX,y);
  if(core.tiles[15*20+x].type==='road')for(let y=DY+16;y<height;y++)road(x+DX,y);
 }
 // The old Jujuy south-facing house ended against the cliff. Extend its
 // doorstep through that narrow strip so the retained interior is accessible.
 if(id==='jujuy')for(let y=DY+14;y<=DY+15;y++)Object.assign(tiles[y*width+DX+10],{type:'road',blocked:false,blocksSight:false,cover:0});
 // Town blocks have 2–3 clear squares between five-square houses.
 // Missions retain their open fields; passes remain undeveloped.
 const target=rural.has(id)?0:['san_lorenzo','yatasto'].includes(id)?6:20;
 const lots=[];
 for(const y of [3,11,19,27,35,42])for(let x=3;x<=width-7;x+=8)lots.push({x,y});
 // Rotate plot priority per place, deterministically, for distinct neighbourhoods.
 const seed=[...id].reduce((n,c)=>n+c.charCodeAt(0),0);
 lots.sort((a,b)=>((a.x*17+a.y*31+seed*7)%97)-((b.x*17+b.y*31+seed*7)%97)||a.y-b.y||a.x-b.x);
 for(const lot of lots){
  if(map.buildings.length>=target)break;
  const w=5,h=5;
  // Protect the complete authored landmark, its courtyards and approaches.
  if(lot.x<DX+22&&lot.x+w>DX-2&&lot.y<DY+18&&lot.y+h>DY-2)continue;
  let clear=true;
  for(let y=lot.y-1;y<=lot.y+h;y++)for(let x=lot.x-1;x<=lot.x+w;x++){const t=map.tiles[y*width+x];if(!t||t.blocked||t.buildingId||t.type==='road')clear=false;}
  if(!clear)continue;
  const index=map.buildings.length,buildingId=`${id}:neighbourhood-${index}`;
  const result=placeBuilding(map.tiles,{id:buildingId,name:`${id==='retiro'?'Barraca':id==='ensenada'?'Almacén':'Casa'} del barrio ${index+1}`,...lot,width:w,height:h,doors:[{x:lot.x+2,y:lot.y+4}],windows:[{x:lot.x,y:lot.y+2}],material:'adobe',roof:index%4===0?'thatch':'tile'});
  if(target===20&&!map.buildings.some(b=>b.purpose==='bar'))Object.assign(result.building,{purpose:'bar',name:'Pulpería del barrio'});
  map.tiles=result.tiles;map.buildings.push(result.building);
  const prop={id:`${buildingId}:chest`,type:'chest',x:lot.x+1,y:lot.y+1,buildingId,roomId:result.building.rooms[0].id,footprint:{width:1,height:1},blocksMovement:true};
  if(!propPlacementError(map,prop))map.props.push(prop);
 }
 if(target===20&&map.buildings.length!==20)throw Error(`El plano de ${id} no tiene veinte solares accesibles.`);
 // Preserve the relative deployment around the authored landmark. New houses
 // cannot overlap it.
 return map;
}
