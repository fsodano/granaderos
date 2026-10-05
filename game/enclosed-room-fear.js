import {CRITICAL_HEALTH} from './actor-condition.js';
import {DEFAULT_TERRACE_ELEVATION} from './buildings.js';
import {roomAt} from './tactical-visibility.js';
import {relativeBodyHeight} from './sight-geometry.js';
import {DEFAULT_SLAB_THICKNESS,surfaceAt,tacticalLevel} from './tactical-space.js';

// Granaderos tuning. This is ordinary shock, after the normal turn recovery.
export const ENCLOSED_ROOM_FEAR_SHOCK=2;
const fullWallHeight=relativeBodyHeight({stance:'standing'},'head');
const capable=unit=>unit&&Number.isFinite(unit.hp)&&unit.hp>=CRITICAL_HEALTH&&
 (unit.energy??100)>0&&!unit.unconscious&&!unit.asleep&&!unit.knockedDown&&
 !unit.routed&&!unit.fled&&!unit.captured&&!unit.captive&&!unit.bound&&!unit.detained&&
 !unit.entangled&&!unit.departure&&!unit.surrendered;
const canonical=unit=>Number.isSafeInteger(Number(unit?.id))&&Number(unit.id)>=0&&String(Number(unit.id))===String(unit.id);

// Only structural surfaces are read. Hidden occupants, furniture and contents
// cannot change a fear result. A room tag does not establish intact enclosure.
export function occupiedEnclosedRoom(state,unit){
 if(!state||!Number.isInteger(unit?.x)||!Number.isInteger(unit?.y))return false;
 const level=tacticalLevel(unit),room=roomAt(state,unit);
 const building=(state.buildings??[]).find(b=>(b.rooms??[]).includes(room));
 if(!room||!building)return false;
 const cells=(room.cells??[]).filter(cell=>(cell.tacticalLevel??room.tacticalLevel??0)===level);
 if(!cells.length||cells.length>state.width*state.height)return false;
 const floor=surfaceAt(state,unit),height=floor?.elevation??0;
 if(!floor||floor.type!=='floor'||floor.blocked||level>0&&floor.kind!=='platform')return false;
 const keys=new Set(cells.map(cell=>`${cell.x},${cell.y}`)),footprint=new Set(keys);
 let wallHeight=Infinity,defaultGroundWalls=true;
 for(const cell of cells){
  const point={x:cell.x,y:cell.y,tacticalLevel:level},support=surfaceAt(state,point);
  if(!support||support.type!=='floor'||support.blocked||support.buildingId!==building.id||
     (support.elevation??0)!==height||level>0&&support.kind!=='platform')return false;
  for(const [dx,dy]of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]){
   if(keys.has(`${cell.x+dx},${cell.y+dy}`))continue;
   footprint.add(`${cell.x+dx},${cell.y+dy}`);
   const edge=surfaceAt(state,{x:cell.x+dx,y:cell.y+dy,tacticalLevel:level});
   if(!edge||edge.buildingId!==building.id||(edge.elevation??0)!==height)return false;
   if(level===0){
    if(!(edge.type==='wall'&&edge.blocked&&(edge.obstacleHeight??2.5)>=fullWallHeight||edge.type==='door'||edge.type==='window'))return false;
    wallHeight=Math.min(wallHeight,edge.type==='wall'?edge.obstacleHeight??2.5:2.5);
    if(edge.obstacleHeight!==undefined)defaultGroundWalls=false;
   }else if(edge.kind!=='platform'||!edge.blocked||!Number.isFinite(edge.obstacleHeight)||edge.obstacleHeight<fullWallHeight)return false;
   else wallHeight=Math.min(wallHeight,edge.obstacleHeight);
  }
 }
 const ceilings=new Map();let physicalCeiling=false;
 for(const surface of state.upperSurfaces??[])if(tacticalLevel(surface)>level&&footprint.has(`${surface.x},${surface.y}`)){
  physicalCeiling=true;
  const key=`${surface.x},${surface.y}`,previous=ceilings.get(key);
  if(!previous||surface.elevation-(surface.slabThickness??DEFAULT_SLAB_THICKNESS)<previous.elevation-(previous.slabThickness??DEFAULT_SLAB_THICKNESS))ceilings.set(key,surface);
 }
 for(const cell of cells){
  // The nearest slab is authoritative. A farther valid roof cannot hide an
  // intervening floor that cuts through the occupied standing-body space.
  const surface=ceilings.get(`${cell.x},${cell.y}`);
  if(!surface){
   if(level>0||physicalCeiling||!['tile','thatch'].includes(building.roof))return false;
   continue;
  }
  const thickness=surface.slabThickness??DEFAULT_SLAB_THICKNESS,bottom=surface.elevation-thickness;
  if(surface.buildingId!==building.id)return false;
  // Native ground house terraces use a three-unit story with a .2 slab.
  // Their default 2.5 walls have an established .3 geometry gap. This exact
  // authored story is the sole exception; it is not an upper-room tolerance.
  const nativeTerrace=level===0&&building.architecture==='house'&&building.roof==='terrace'&&defaultGroundWalls&&
   surface.kind==='roof'&&surface.elevation===height+DEFAULT_TERRACE_ELEVATION&&thickness===DEFAULT_SLAB_THICKNESS;
  if(bottom<height+fullWallHeight||bottom>height+wallHeight&&!nativeTerrace)return false;
 }
 return true;
}

// `addedShock` uses the supplied shock. Prospective next-turn UI supplies
// shock/2; it is conditional on the actor and enclosure at the real boundary.
export function enclosedRoomFearStatus(state,unit){
 const result=(eligible,active,reason,addedShock=0)=>({eligible,active,reason,addedShock});
 if(!Array.isArray(unit?.abilities)||!unit.abilities.includes('enclosed_room_fear'))return result(false,false,'ability');
 if(unit.side!=='player'||unit.militia||unit.missionAlly||!canonical(unit)||!capable(unit)||
    !Number.isFinite(unit.shock??0)||(unit.shock??0)<0||(unit.shock??0)>20)return result(false,false,'incapable');
 if(!occupiedEnclosedRoom(state,unit))return result(true,false,'open');
 return result(true,true,'enclosed',Math.min(ENCLOSED_ROOM_FEAR_SHOCK,20-(unit.shock??0)));
}

export function applyEnclosedRoomFear(state,unit){
 if(state?.mode!=='combat'||state.status!=='active')return 0;
 const added=enclosedRoomFearStatus(state,unit).addedShock;
 if(added>0)unit.shock=(unit.shock??0)+added;
 return added;
}
