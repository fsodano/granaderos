import assert from 'node:assert/strict';
import {FINITE_SECTOR_CACHES} from '../packages/game/finite-sector-caches.js';
import {getReachable,lookPreview} from '../packages/game/tactical.js';
import {sameSurface,spacePoint} from '../packages/game/tactical-space.js';
import {wallEdgeCells,wallEdgeId,wallMovementBlocked} from '../packages/game/wall-geometry.js';
import {tactical,saved,leave} from './local-contract-fixture.mjs';

// Choose a physical opener before committing to a carrier. A healthy soldier
// can still be enclosed when another real soldier occupies the open doorway.
export function finiteCacheCarrier(pair,ids=pair.battle.units.filter(unit=>unit.side==='player').map(unit=>unit.id),cacheId=FINITE_SECTOR_CACHES[pair.battle.sectorId]?.chest){
 const battle=pair.battle,chest=battle.props.find(prop=>prop.id===cacheId&&prop.type==='chest');if(!chest)return null;
 const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y),near=point=>sameSurface(point,chest)&&distance(point,chest)<=1&&!wallMovementBlocked(battle,point,chest);
 const candidates=ids.flatMap(id=>{
  const unit=battle.units.find(unit=>unit.id===String(id));if(!unit||unit.hp<15||unit.unconscious||unit.routed||unit.departure||unit.surrendered||unit.asleep||unit.energy<=10)return [];
  if(near(unit))return [{id,cost:0}];
  const reach=getReachable(battle,unit),approach=reach.filter(near).sort((a,b)=>a.cost-b.cost)[0];if(approach)return [{id,cost:approach.cost}];
  const doors=battle.wallEdges.filter(edge=>edge.type==='door'&&!edge.open&&!edge.locked&&!edge.jammed&&!edge.destroyed);
  const spot=reach.filter(point=>doors.some(door=>wallEdgeCells(door).some(cell=>sameSurface(point,cell)&&distance(point,cell)===0))).sort((a,b)=>a.cost-b.cost)[0];
  return spot?[{id,cost:spot.cost+10000}]:[];
 }).sort((a,b)=>a.cost-b.cost);
 return candidates[0]?.id??null;
}

// Normal visits only: approach/open, selected finite pickup, sync and save.
// A missing, hidden, blocked, exhausted or overflowing selection fails through
// the public tactical order. This helper creates no equipment or elapsed time.
export function takeFiniteCache(pair,operativeId,selections,{cacheId=FINITE_SECTOR_CACHES[pair.battle.sectorId]?.chest,onApproach,beforeOrder,onOrder}={}){
 const unitId=String(operativeId);let p=pair;
 assert.ok(beforeOrder===undefined||typeof beforeOrder==='function');assert.ok(onOrder===undefined||typeof onOrder==='function');
 const perform=action=>{beforeOrder?.({pair:p,action});const before=p;p=tactical(p,action);onOrder?.({before,pair:p,action});};
 assert.ok(cacheId,'this sector has an authored finite cache');
 const chest=()=>p.battle.props.find(prop=>prop.id===cacheId&&prop.type==='chest');
 assert.ok(chest(),'the actual sector contains the authored chest');
 const actor=()=>p.battle.units.find(unit=>unit.id===unitId);
 const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
 const nearChest=point=>sameSurface(point,chest())&&distance(point,chest())<=1&&!wallMovementBlocked(p.battle,point,chest());
 const besideDoor=(point,door)=>wallEdgeCells(door).some(cell=>sameSurface(point,cell)&&distance(point,cell)===0);
 for(let attempt=0;!nearChest(actor())&&attempt<40;attempt++){
  onApproach?.({pair:structuredClone(p),operativeId,cacheId,attempt});
  const reach=getReachable(p.battle,actor()),approach=reach.filter(tile=>distance(tile,chest())===1&&nearChest(tile)).sort((a,b)=>a.cost-b.cost)[0];
  if(approach){const before=spacePoint(actor());perform({type:'move',unitId,...spacePoint(approach)});assert.notDeepEqual(spacePoint(actor()),before,'the ordinary cache approach must make actual progress');continue;}
  // A finite interior cache needs its real doorway. Open only an unlocked
  // reachable door through movement, looking and the ordinary door order.
  const doors=p.battle.wallEdges.filter(edge=>edge.type==='door'&&!edge.open&&!edge.locked&&!edge.jammed&&!edge.destroyed).flatMap(door=>{
   const spot=reach.filter(tile=>besideDoor(tile,door)).sort((a,b)=>a.cost-b.cost)[0];return spot?[{door,spot}]:[];
  }).sort((a,b)=>Number(b.door.buildingId===chest().buildingId)-Number(a.door.buildingId===chest().buildingId)||Math.hypot(a.door.x-chest().x,a.door.y-chest().y)-Math.hypot(b.door.x-chest().x,b.door.y-chest().y)||a.spot.cost-b.spot.cost);
  assert.ok(doors.length,`the actual carrier has a reachable ordinary doorway to the cache: ${JSON.stringify({carrier:unitId,hp:actor().hp,energy:actor().energy,asleep:actor().asleep,unconscious:actor().unconscious,routed:actor().routed,position:spacePoint(actor()),chest:spacePoint(chest()),reachable:reach.length,closedDoors:p.battle.wallEdges.filter(edge=>edge.type==='door'&&!edge.open).length})}`);
  const {door,spot}=doors[0];if(spot.cost){const before=spacePoint(actor());perform({type:'move',unitId,...spacePoint(spot)});assert.notDeepEqual(spacePoint(actor()),before,'the ordinary doorway approach must make actual progress');if(!besideDoor(actor(),door))continue;}
  const doorId=door.doorId??wallEdgeId(door),currentDoor=()=>p.battle.wallEdges.find(edge=>edge.type==='door'&&(edge.doorId??wallEdgeId(edge))===doorId);
  if(currentDoor().open)continue;
  const facingCell=wallEdgeCells(currentDoor()).find(cell=>distance(actor(),cell)>0);
  if(lookPreview(p.battle,actor(),facingCell).valid)perform({type:'look',unitId,...spacePoint(facingCell)});
  if(!currentDoor().open)perform({type:'door',unitId,doorId,open:true});
 }
 assert.ok(nearChest(actor()),'the actual carrier has an open path to the chest on its surface');
 if(lookPreview(p.battle,actor(),chest()).valid)perform({type:'look',unitId,...spacePoint(chest())});
 if(!chest().open)perform({type:'useItem',unitId,environment:{kind:'container',id:cacheId,verb:'open'}});
 for(const {count=1,...selector}of selections){
  assert.ok(Number.isSafeInteger(count)&&count>0);
  const index=chest().contents.findIndex(item=>Object.entries(selector).every(([key,value])=>item[key]===value));
  assert.ok(index>=0,`the cache still owns ${JSON.stringify(selector)}`);
  perform({type:'containerLoot',unitId,kind:'container',id:cacheId,index,count});
 }
 return saved(p);
}
export const leaveFiniteCache=pair=>saved({campaign:leave(saved(pair))}).campaign;
