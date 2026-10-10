import assert from 'node:assert/strict';
import {FINITE_SECTOR_CACHES} from '../game/finite-sector-caches.js';
import {getReachable,lookPreview} from '../game/tactical.js';
import {sameSurface,spacePoint} from '../game/tactical-space.js';
import {wallEdgeCells,wallEdgeId,wallMovementBlocked} from '../game/wall-geometry.js';
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
 const nearChest=point=>sameSurface(point,chest())&&distance(point,chest())<=1&&!wallMovementBlocked(p.battle,point,chest());
 const besideDoor=(point,door)=>wallEdgeCells(door).some(cell=>sameSurface(point,cell)&&distance(point,cell)===0);
 for(let attempt=0;!nearChest(actor())&&attempt<40;attempt++){
  const reach=getReachable(p.battle,actor()),approach=reach.filter(tile=>distance(tile,chest())===1&&nearChest(tile)).sort((a,b)=>a.cost-b.cost)[0];
  if(approach){const before=spacePoint(actor());p=tactical(p,{type:'move',unitId,...spacePoint(approach)});assert.notDeepEqual(spacePoint(actor()),before,'the ordinary cache approach must make actual progress');continue;}
  // A finite interior cache needs its real doorway. Open only an unlocked
  // reachable door through movement, looking and the ordinary door order.
  const doors=p.battle.wallEdges.filter(edge=>edge.type==='door'&&!edge.open&&!edge.locked&&!edge.jammed&&!edge.destroyed).flatMap(door=>{
   const spot=reach.filter(tile=>besideDoor(tile,door)).sort((a,b)=>a.cost-b.cost)[0];return spot?[{door,spot}]:[];
  }).sort((a,b)=>Number(b.door.buildingId===chest().buildingId)-Number(a.door.buildingId===chest().buildingId)||Math.hypot(a.door.x-chest().x,a.door.y-chest().y)-Math.hypot(b.door.x-chest().x,b.door.y-chest().y)||a.spot.cost-b.spot.cost);
  assert.ok(doors.length,'the actual carrier has a reachable ordinary doorway to the cache');
  const {door,spot}=doors[0];if(spot.cost){const before=spacePoint(actor());p=tactical(p,{type:'move',unitId,...spacePoint(spot)});assert.notDeepEqual(spacePoint(actor()),before,'the ordinary doorway approach must make actual progress');if(!besideDoor(actor(),door))continue;}
  const doorId=door.doorId??wallEdgeId(door),currentDoor=()=>p.battle.wallEdges.find(edge=>edge.type==='door'&&(edge.doorId??wallEdgeId(edge))===doorId);
  if(currentDoor().open)continue;
  const facingCell=wallEdgeCells(currentDoor()).find(cell=>distance(actor(),cell)>0);
  if(lookPreview(p.battle,actor(),facingCell).valid)p=tactical(p,{type:'look',unitId,...spacePoint(facingCell)});
  if(!currentDoor().open)p=tactical(p,{type:'door',unitId,doorId,open:true});
 }
 assert.ok(nearChest(actor()),'the actual carrier has an open path to the chest on its surface');
 if(lookPreview(p.battle,actor(),chest()).valid)p=tactical(p,{type:'look',unitId,...spacePoint(chest())});
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
