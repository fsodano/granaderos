import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {sameCell,spaceKey,spacePoint} from '../game/tactical-space.js';
import {operativeLocation} from '../game/squads.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {AMMUNITION_FAMILIES} from '../game/ammunition-families.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {handRecord} from '../game/tactical-inventory.js';
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
 const rank=id=>priority.includes(id)?priority.indexOf(id):priority.length+state.recruited.indexOf(id),assigned=new Map(),claimed=new Set(),overflow=[];
 for(const [buildingId,ids]of groups){
  ids.sort((a,b)=>rank(a)-rank(b));const cells=scene.upperSurfaces.filter(cell=>cell.buildingId===buildingId&&!cell.blocked&&cell.kind==='roof').sort((a,b)=>b.x-a.x||b.y-a.y);
  // Keep the established priority posts when that building has room. Separate
  // quiet squad visits can leave more residents than one actual roof holds.
  // Reserve every group's own cells before moving only its excess elsewhere.
  for(const id of ids){const cell=cells.find(point=>!claimed.has(spaceKey(point)));if(cell){claimed.add(spaceKey(cell));assigned.set(id,cell);}else overflow.push(id);}
 }
 const roofs=scene?.upperSurfaces?.filter(cell=>!cell.blocked&&cell.kind==='roof')??[];
 for(const id of overflow){
  const origin=state.operativeState[id].residentPosition,cell=roofs.filter(point=>!claimed.has(spaceKey(point))).sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y)||b.x-a.x||b.y-a.y)[0];
  assert.ok(cell,'The actual reserve needs enough distinct authored roof cells.');claimed.add(spaceKey(cell));assigned.set(id,cell);
 }
 return [...groups.values()].flatMap(ids=>ids.map(id=>({id,...spacePoint(assigned.get(id))})));
}

// Prepare the actual reserve before the crew leaves. Each supplied post is
// public map geometry, checked through the present soldier's legal movement.
// Single-person visits reuse that soldier's home slot: other squad members
// cannot block a narrow roof, and no extra squad capacity is required.
export function prepareStockCuyoBatteryReserve(start,posts,{report=()=>{}}={}){
 const before=structuredClone(start),ids=posts.map(post=>post.id),journal=[],positions=[];
 assert.equal(new Set(ids).size,ids.length);assert.equal(new Set(posts.map(spaceKey)).size,posts.length,'Every actual reserve needs a distinct post.');assert.equal(start.pendingBattle,null);assert.equal(start.pendingEncounter,null);
 let c=decodeSave(encodeSave(start)).campaign;const active=c.activeSquadId;
 const issue=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);journal.push({kind:'campaign',action:structuredClone(action)});};
 for(const id of ids){
  assert.ok(c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured);
  assert.equal(operativeLocation(c,id),'cordoba');assert.ok(!start.squad.includes(id),'The gun crew keeps its original soldiers.');
  if(c.operativeState[id].weaponDropped)c=recoverRoutePrimary(c,id,{report});
 }
 const short=ids.filter(id=>{const unit=carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]),family=ammoTypeFor({...unit,activeSlot:'primary'});return family&&unit.loaded+ammoCount(unit,family)<2;});
 const equipmentStart=decodeSave(encodeSave(c)).campaign,supplyOrders=[],donations=[],needs=new Map();
 for(const id of short){const u=carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]),family=ammoTypeFor({...u,activeSlot:'primary'});if(!needs.has(family))needs.set(family,[]);needs.get(family).push(id);}
 // Share only a measured local shortage. An accessible living carrier can
 // leave off-primary-family cartridges through the ordinary inventory order;
 // its loaded primary and all compatible primary cartridges stay intact.
 // The established thirteen-person preparation needs no donation orders.
 for(const [family,recipients]of needs){
  const wanted=recipients.reduce((n,id)=>{const u=carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]);return n+Math.max(0,10-u.loaded-ammoCount(u,family));},0);
  const pool=()=>{const rows=new Map();for(const id of recipients)for(const row of sectorInventoryModel(c,'cordoba',rosterFor(c),id).entries){const stack=JSON.parse(row.expected);if(row.reachable&&stack.kind==='ammunition'&&stack.ammoType===AMMUNITION_FAMILIES[family].type)rows.set(row.key,row.count);}return (c.ammunitionStores.cordoba?.[family]??0)+[...rows.values()].reduce((n,count)=>n+count,0);};
  let missing=Math.max(0,wanted-pool());
  for(const donor of c.recruited){
   if(!missing)break;
   const r=c.operativeState[donor];if(!r.alive||r.captured||operativeLocation(c,donor)!=='cordoba')continue;
   const model=sectorInventoryModel(c,'cordoba',rosterFor(c),donor);if(model.operativeId!==donor||model.reason)continue;
   const unit=carriedAmmunition(rosterFor(c).find(op=>op.id===donor),r),primaryFamily=ammoTypeFor({...unit,activeSlot:'primary'}),row=model.carried.find(row=>row.item===family);
   if(!primaryFamily||primaryFamily===family||!row?.count)continue;
   const count=Math.min(missing,row.count),primary=structuredClone(handRecord(model.personal,'primary')),compatible=unit.loaded+ammoCount(unit,primaryFamily),stock=ammoCount(unit,family),poolBefore=pool(),cash=c.resources.treasury,time=[c.hour,c.secondOfHour??0],contracts=structuredClone(c.contracts);
   const action={type:'sectorInventory',sector:'cordoba',operativeId:donor,direction:'drop',item:row.item,count};
   c=dispatchCampaign(c,action);assert.equal(c.lastError,null);supplyOrders.push(structuredClone(action));
   const after=carriedAmmunition(rosterFor(c).find(op=>op.id===donor),c.operativeState[donor]);
   assert.equal(ammoCount(after,family),stock-count);assert.equal(after.loaded+ammoCount(after,primaryFamily),compatible);assert.deepEqual(handRecord(sectorInventoryModel(c,'cordoba',rosterFor(c),donor).personal,'primary'),primary);
   assert.equal(pool(),poolBefore+count);assert.equal(c.resources.treasury,cash);assert.deepEqual([c.hour,c.secondOfHour??0],time);assert.deepEqual(c.contracts,contracts);
   const donation={event:'stockCuyoReserveDonation',donor,family,count,poolBefore,poolAfter:pool(),action:structuredClone(action)};donations.push(donation);report(donation);missing-=count;
  }
 }
 const ammunition=supplyRouteAmmunition(c,short,{target:10,report});c=ammunition.campaign;
 supplyOrders.push(...ammunition.transactions.map(transaction=>structuredClone(transaction.action)));
 const equipmentReady=decodeSave(encodeSave(c)).campaign;
 for(const post of posts){
  const {id}=post,home=c.squads.find(squad=>squad.members.includes(id)),assignment=c.operativeState[id].assignment;
  assert.ok(home&&!home.journey&&home.location==='cordoba');const members=[...home.members];
  issue({type:'selectSquad',id:home.id});issue({type:'squad',ids:[id]});
  if(c.operativeState[id].asleep)issue({type:'setSleep',operativeId:id,asleep:false});
  issue({type:'assignCare',operativeId:id,assignment:'active'});issue({type:'visitSector'});
  let battle=enterSector(c.pendingBattle,c.sectorStates.cordoba);journal.push({kind:'enter'});
  let unit=battle.units.find(unit=>unit.id===String(id));const destination={x:post.x,y:post.y,tacticalLevel:post.tacticalLevel},posture=unit?.stance,reach=()=>getReachable(battle,unit,{stopAt:point=>sameCell(point,destination)}).find(point=>sameCell(point,destination));
  // A second roof needs its real descent and ascent. Preview the same path in
  // a standing posture, then pay that posture through the native order before
  // querying and executing the actual movement. Same-roof legacy posts keep
  // their original orders and clock.
  if(unit&&!reach()&&unit.stance!=='standing'){
   const standing={...unit,stance:'standing',movementMode:'walk'},preview={...battle,units:battle.units.map(other=>other.id===unit.id?standing:other)},path=getReachable(preview,standing,{stopAt:point=>sameCell(point,destination)}).find(point=>sameCell(point,destination));
   if(path?.path.some(step=>step.kind==='climb')){const action={type:'stance',unitId:unit.id,stance:'standing'};battle=actBattle(battle,action);assert.equal(battle.lastError,null);journal.push({kind:'battle',action});unit=battle.units.find(other=>other.id===unit.id);}
  }
  assert.ok(unit&&reach(),'The actual reserve post must be reachable.');
  if(!sameCell(unit,destination)){
   const action={type:'move',unitId:String(id),...destination};battle=actBattle(battle,action);assert.equal(battle.lastError,null);journal.push({kind:'battle',action});
  }
  if(battle.units.find(other=>other.id===String(id)).stance!==posture){const action={type:'stance',unitId:String(id),stance:posture};battle=actBattle(battle,action);assert.equal(battle.lastError,null);journal.push({kind:'battle',action});}
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
 const preparation={event:'stockCuyoReserveReady',ids,positions,journal,equipmentStart,supplyOrders,donations,equipmentReady,ammunition:ammunition.transactions,startClock:[start.hour,start.secondOfHour??0],endClock:[c.hour,c.secondOfHour??0],elapsedSeconds:(c.hour-start.hour)*3600+(c.secondOfHour??0)-(start.secondOfHour??0)};
 report(preparation);return {campaign:c,preparation};
}
