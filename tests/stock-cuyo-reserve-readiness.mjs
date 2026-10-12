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
