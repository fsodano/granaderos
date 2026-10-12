import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {sameCell} from '../game/tactical-space.js';
import {operativeLocation} from '../game/squads.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {expandCellScene} from '../game/cell-scene-storage.js';

// Allocate the existing roof residents' real authored cells before departure.
// Keep the clinical patients and reserved physician behind the firing edge;
// dead, captured, offsite and travelling soldiers never receive a post.
export function stockCuyoBatteryReservePosts(state){
 const scene=expandCellScene(state.sectorStates.cordoba,state),priority=[108,104,102,146,119,133,101,121,117,116,107,130,9],groups=new Map();
 for(const id of state.recruited){
  const record=state.operativeState[id],home=state.squads.find(squad=>squad.members.includes(id)),point=record.residentPosition;
  if(!record.alive||record.captured||state.squad.includes(id)||operativeLocation(state,id)!=='cordoba'||!home||home.journey||!point||(point.tacticalLevel??0)===0)continue;
  const roof=scene?.upperSurfaces?.find(cell=>sameCell(cell,point));if(!roof?.buildingId)continue;
  if(!groups.has(roof.buildingId))groups.set(roof.buildingId,[]);groups.get(roof.buildingId).push(id);
 }
 const rank=id=>priority.includes(id)?priority.indexOf(id):priority.length+state.recruited.indexOf(id),posts=[];
 for(const [buildingId,ids]of groups){
  ids.sort((a,b)=>rank(a)-rank(b));const cells=scene.upperSurfaces.filter(cell=>cell.buildingId===buildingId&&!cell.blocked&&cell.kind==='roof').sort((a,b)=>b.x-a.x||b.y-a.y);
  assert.ok(cells.length>=ids.length,'The actual reserve needs enough distinct authored roof cells.');
  ids.forEach((id,index)=>posts.push({id,x:cells[index].x,y:cells[index].y,tacticalLevel:cells[index].tacticalLevel}));
 }
 return posts;
}

// Prepare the actual reserve before the crew leaves. Each supplied post is
// public map geometry, checked through the present soldier's legal movement.
// Single-person visits reuse that soldier's home slot: other squad members
// cannot block a narrow roof, and no extra squad capacity is required.
export function prepareStockCuyoBatteryReserve(start,posts,{report=()=>{}}={}){
 const before=structuredClone(start),ids=posts.map(post=>post.id),journal=[],positions=[];
 assert.equal(new Set(ids).size,ids.length);assert.equal(start.pendingBattle,null);assert.equal(start.pendingEncounter,null);
 let c=decodeSave(encodeSave(start)).campaign;const active=c.activeSquadId;
 const issue=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);journal.push({kind:'campaign',action:structuredClone(action)});};
 for(const id of ids){
  assert.ok(c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured);
  assert.equal(operativeLocation(c,id),'cordoba');assert.ok(!start.squad.includes(id),'The gun crew keeps its original soldiers.');
  if(c.operativeState[id].weaponDropped)c=recoverRoutePrimary(c,id,{report});
 }
 const short=ids.filter(id=>{const unit=carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]),family=ammoTypeFor({...unit,activeSlot:'primary'});return family&&unit.loaded+ammoCount(unit,family)<2;});
 const ammunition=supplyRouteAmmunition(c,short,{target:10,report});c=ammunition.campaign;
 const equipmentReady=decodeSave(encodeSave(c)).campaign;
 for(const post of posts){
  const {id}=post,home=c.squads.find(squad=>squad.members.includes(id)),assignment=c.operativeState[id].assignment;
  assert.ok(home&&!home.journey&&home.location==='cordoba');const members=[...home.members];
  issue({type:'selectSquad',id:home.id});issue({type:'squad',ids:[id]});
  if(c.operativeState[id].asleep)issue({type:'setSleep',operativeId:id,asleep:false});
  issue({type:'assignCare',operativeId:id,assignment:'active'});issue({type:'visitSector'});
  let battle=enterSector(c.pendingBattle,c.sectorStates.cordoba);journal.push({kind:'enter'});
  const unit=battle.units.find(unit=>unit.id===String(id)),destination={x:post.x,y:post.y,tacticalLevel:post.tacticalLevel};
  assert.ok(unit&&getReachable(battle,unit,{stopAt:point=>sameCell(point,destination)}).some(point=>sameCell(point,destination)),'The actual reserve post must be reachable.');
  if(!sameCell(unit,destination)){
   const action={type:'move',unitId:String(id),...destination};battle=actBattle(battle,action);assert.equal(battle.lastError,null);journal.push({kind:'battle',action});
  }
  const pair=syncBattleTime(c,battle);assert.equal(pair.error,null);c=pair.campaign;battle=pair.battle;journal.push({kind:'sync'});
  const action={type:'leaveSector',battleId:c.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(unit=>unit.side==='player')};
  c=dispatchCampaign(c,action);assert.equal(c.lastError,null);journal.push({kind:'leave',battleId:action.battleId});
  issue({type:'squad',ids:members});issue({type:'assignCare',operativeId:id,assignment});
  assert.deepEqual(c.operativeState[id].residentPosition,destination);positions.push({id,...destination});
 }
 issue({type:'selectSquad',id:active});
 assert.equal(c.squads.length,start.squads.length);assert.deepEqual(c.squads,start.squads);
 assert.equal(c.resources.treasury,start.resources.treasury);assert.deepEqual(c.contracts,start.contracts);
 for(const [id,record]of Object.entries(start.operativeState))for(const key of ['alive','hp','bleeding','medkits','captured','morale'])assert.deepEqual(c.operativeState[id][key],record[key],`${id}.${key} only changes through later native combat/care.`);
 assert.deepEqual(start,before);c=decodeSave(encodeSave(c)).campaign;assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 const preparation={event:'stockCuyoReserveReady',ids,positions,journal,equipmentReady,ammunition:ammunition.transactions,startClock:[start.hour,start.secondOfHour??0],endClock:[c.hour,c.secondOfHour??0],elapsedSeconds:(c.hour-start.hour)*3600+(c.secondOfHour??0)-(start.secondOfHour??0)};
 report(preparation);return {campaign:c,preparation};
}
