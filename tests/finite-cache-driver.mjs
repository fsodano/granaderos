import assert from 'node:assert/strict';
import {FINITE_SECTOR_CACHES} from '../game/finite-sector-caches.js';
import {getReachable,lookPreview} from '../game/tactical.js';
import {tactical,saved,leave} from './local-contract-fixture.mjs';

// Normal visits only: approach/open, selected finite pickup, sync and save.
// A missing, hidden, blocked, exhausted or overflowing selection fails through
// the public tactical order. This helper creates no equipment or elapsed time.
export function takeFiniteCache(pair,operativeId,selections,{cacheId=FINITE_SECTOR_CACHES[pair.battle.sectorId]?.chest}={}){
 const unitId=String(operativeId);let p=pair;
 assert.ok(cacheId,'this sector has an authored finite cache');
 const chest=()=>p.battle.props.find(prop=>prop.id===cacheId&&prop.type==='chest');
 assert.ok(chest(),'the actual sector contains the authored chest');
 const actor=()=>p.battle.units.find(unit=>unit.id===unitId);
 const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
 for(let attempt=0;distance(actor(),chest())>1&&attempt<40;attempt++){
  const reach=getReachable(p.battle,actor()),approach=reach.filter(tile=>distance(tile,chest())===1).sort((a,b)=>a.cost-b.cost)[0];
  if(approach){const before={x:actor().x,y:actor().y};p=tactical(p,{type:'move',unitId,x:approach.x,y:approach.y});assert.notDeepEqual({x:actor().x,y:actor().y},before,'the ordinary cache approach must make actual progress');continue;}
  // A finite interior cache needs its real doorway. Open only an unlocked
  // reachable door through movement, looking and the ordinary door order.
  const doors=p.battle.tiles.filter(tile=>tile.type==='door'&&!tile.open&&!tile.locked).flatMap(door=>{
   const spot=reach.filter(tile=>distance(tile,door)===1).sort((a,b)=>a.cost-b.cost)[0];return spot?[{door,spot}]:[];
  }).sort((a,b)=>Number(b.door.buildingId===chest().buildingId)-Number(a.door.buildingId===chest().buildingId)||Math.hypot(a.door.x-chest().x,a.door.y-chest().y)-Math.hypot(b.door.x-chest().x,b.door.y-chest().y)||a.spot.cost-b.spot.cost);
  assert.ok(doors.length,'the actual carrier has a reachable ordinary doorway to the cache');
  const {door,spot}=doors[0];if(spot.cost){const before={x:actor().x,y:actor().y};p=tactical(p,{type:'move',unitId,x:spot.x,y:spot.y});assert.notDeepEqual({x:actor().x,y:actor().y},before,'the ordinary doorway approach must make actual progress');if(distance(actor(),door)>1)continue;}
  const doorId=door.doorId??`door:${door.x}:${door.y}`,currentDoor=()=>p.battle.tiles.find(tile=>tile.type==='door'&&(tile.doorId??`door:${tile.x}:${tile.y}`)===doorId);
  if(currentDoor().open)continue;
  if(lookPreview(p.battle,actor(),currentDoor()).valid)p=tactical(p,{type:'look',unitId,x:currentDoor().x,y:currentDoor().y});
  if(!currentDoor().open)p=tactical(p,{type:'door',unitId,doorId,open:true});
 }
 assert.ok(distance(actor(),chest())<=1,'the actual carrier has an open path to the chest');
 if(lookPreview(p.battle,actor(),chest()).valid)p=tactical(p,{type:'look',unitId,x:chest().x,y:chest().y});
 if(!chest().open)p=tactical(p,{type:'useItem',unitId,environment:{kind:'container',id:cacheId,verb:'open'}});
 for(const {count=1,...selector}of selections){
  assert.ok(Number.isSafeInteger(count)&&count>0);
  const index=chest().contents.findIndex(item=>Object.entries(selector).every(([key,value])=>item[key]===value));
  assert.ok(index>=0,`the cache still owns ${JSON.stringify(selector)}`);
  p=tactical(p,{type:'containerLoot',unitId,kind:'container',id:cacheId,index,count});
 }
 return saved(p);
}
export const leaveFiniteCache=pair=>saved({campaign:leave(saved(pair))}).campaign;
