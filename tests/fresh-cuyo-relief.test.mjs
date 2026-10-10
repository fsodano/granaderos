import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {hiringTravelHours} from '../game/hiring-arrivals.js';
import {routeHiringCeiling} from './funded-route-fixture.mjs';
import {operativeLocation} from '../game/squads.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {prepareFreshCuyoDefense,prepareFreshMendozaAssault,freshRouteServingIds} from './fresh-cuyo-route.mjs';
import {enterSector} from '../game/world.js';
import {artilleryTransportQuote,storedArtilleryRecord} from '../game/artillery-transport.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';

test('real northern losses require paid Cuyo field relief and a separate living battery reserve, with finite saved order replay',()=>{
 // The native prefix genuinely lost these soldiers. This earned input keeps
 // the actual deaths and all physical gear; it does not declare a new battle.
 const raw=gunzipSync(readFileSync(new URL('./fixtures/cuyo-northern-real-losses.save.json.gz',import.meta.url)));
 const metadata=JSON.parse(readFileSync(new URL('./fixtures/cuyo-northern-real-losses.provenance.json',import.meta.url)));
 assert.equal(createHash('sha256').update(raw).digest('hex'),metadata.sha256);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),events=[];
 assert.equal(start.hour,395);assert.equal(start.secondOfHour,99);assert.equal(start.phase,3);assert.equal(start.location,'tucuman');assert.deepEqual(start.squad,[11,0,8]);
 assert.deepEqual(freshRouteServingIds(start).sort((a,b)=>a-b),metadata.livingServingIds);
 assert.deepEqual(Object.entries(start.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id)).sort((a,b)=>a-b),metadata.priorDeadIds);
 const prepared=prepareFreshCuyoDefense(start,{report:event=>events.push({...event,campaign:undefined})});assert.deepEqual(start,before);
 const relief=events.filter(e=>e.event==='cuyoPaidRelief');assert.deepEqual(relief.map(e=>e.id),[100,130]);
 for(const event of relief){
  assert.equal(event.price,contractQuote(start,rosterFor(start).find(op=>op.id===event.id),'week').price);
  assert.equal(event.travelHours,0,'these are actual locally available recruits');assert.equal(event.bookedSeconds,event.arrivalSeconds);
  assert.equal(prepared.contracts[event.id].paid,event.price);assert.equal(prepared.contracts[event.id].term,'week');assert.equal(operativeLocation(prepared,event.id),'cordoba');
 }
 const five=events.find(e=>e.action?.type==='squad');assert.deepEqual(five.action.ids,[0,8,11,10,100]);assert.equal(five.action.ids.length,5);
 const defender=events.find(e=>e.event==='cuyoPaidDefender');assert.equal(defender.id,142);assert.equal(defender.price,7740);assert.equal(prepared.contracts[142].term,'day');
 const regulars=events.filter(e=>e.event==='cuyoPaidMendozaRegular');assert.deepEqual(regulars.map(e=>e.id),[102]);
 const regular=regulars[0];assert.equal(regular.price,280);assert.equal(regular.guarantee,0);assert.equal(regular.total,280);assert.equal(regular.dayPrice,40);assert.equal(regular.dayCeiling,180);
 assert.equal(regular.travelHours,0);assert.equal(regular.bookedSeconds,regular.arrivalSeconds);
 assert.equal(prepared.contracts[102].paid,280);assert.equal(prepared.contracts[102].term,'week');assert.equal(operativeLocation(prepared,102),'cordoba');assert.ok(contractExpiresSeconds(prepared.contracts[102])>prepared.hour*3600+prepared.secondOfHour);
 assert.equal(prepared.hour,406);assert.equal(prepared.secondOfHour,99);assert.equal(prepared.resources.treasury,112438);
 const forwarding=events.find(e=>e.event==='cuyoBatteryForwarded');assert.ok(forwarding);
 const originalGun=start.sectorStates.tucuman.artillery.find(gun=>gun.id==='arsenal:cordoba:1');assert.ok(originalGun);
 const quote=artilleryTransportQuote(start,'tucuman',originalGun.id,'cordoba','carts','field');assert.equal(quote.available,true);
 assert.equal(forwarding.id,originalGun.id);assert.equal(forwarding.cost,quote.cost);assert.equal(forwarding.cost,0);assert.equal(forwarding.dueAt,start.hour+quote.hours);assert.equal(forwarding.dueAt,413);
 assert.deepEqual(forwarding.record,storedArtilleryRecord(originalGun));assert.equal(forwarding.record.loaded,true);assert.equal(forwarding.record.ammo,1);
 assert.equal(start.resources.treasury-prepared.resources.treasury,relief.reduce((sum,e)=>sum+e.price,0)+defender.price+regular.total+20+quote.cost,'native hires, actual shipment and the two actual posta fees');
 assert.deepEqual(prepared.squad,[0,8,11,10,100,142]);assert.deepEqual(prepared.squads.find(q=>q.name==='Reserva de Cuyo').members,[130]);
 for(const id of freshRouteServingIds(prepared)){const r=prepared.operativeState[id];assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);assert.equal(operativeLocation(prepared,id),'cordoba');}
 for(const id of metadata.priorDeadIds){const a=start.operativeState[id],b=prepared.operativeState[id];assert.equal(b.alive,false);assert.equal(b.hp,a.hp);assert.equal(b.maxHp,a.maxHp);}
 assert.deepEqual(prepared.artilleryDepots,start.artilleryDepots,'the actual shipment has not reached its due hour');
 assert.deepEqual(prepared.artilleryTransfers,[...start.artilleryTransfers,{id:originalGun.id,from:'tucuman',to:'cordoba',mode:'carts',path:quote.path,departedAt:start.hour,dueAt:413,gun:storedArtilleryRecord(originalGun)}]);
 for(const [sector,scene]of Object.entries(start.sectorStates))assert.deepEqual(prepared.sectorStates[sector].artillery,scene.artillery.filter(gun=>gun.id!==originalGun.id),'only the exact forwarded field piece leaves its original custody');
 const takes=events.filter(e=>e.action?.type==='sectorInventory'&&e.action.direction==='take').map(e=>e.action);
 assert.deepEqual(takes.filter(a=>JSON.parse(a.expected).weapon).map(a=>[a.operativeId,a.sourceKey,JSON.parse(a.expected).weapon]),[[0,'drop:12',1800],[8,'drop:13',1800],[100,'drop:14',1801]]);
 const cartridges=takes.filter(a=>JSON.parse(a.expected).ammoType);
 assert.equal(cartridges.reduce((sum,a)=>sum+a.count,0),34,'thirty finite body musket rounds and four cache rifle rounds');
 const model=sectorInventoryModel(prepared,'cordoba',rosterFor(prepared),0);
 for(const key of new Set(cartridges.map(a=>a.sourceKey))){
  const taken=cartridges.filter(a=>a.sourceKey===key),initial=JSON.parse(taken[0].expected).count;
  assert.equal(model.entries.find(row=>row.key===key)?.count??0,initial-taken.reduce((sum,a)=>sum+a.count,0),'each finite source must retain its exact remainder');
 }
 for(const index of [12,13,14])assert.equal(prepared.sectorStates.cordoba.droppedWeapons[index].taken,true);
 // The new preparation is ordinary dispatch. Replaying its exact actions
 // through a real midpoint save must preserve costs, gear and arrivals.
 const actions=events.filter(e=>e.action).map(e=>e.action);let replay=decodeSave(encodeSave(start)).campaign;
 assert.equal(actions.some(a=>['buy','purchase','battleResult'].includes(a.type)),false);
 for(let i=0;i<actions.length;i++){
  if(actions[i].type==='recruitCivic'&&actions[i].id===102){
   const candidates=rosterFor(replay).filter(op=>{
    const r=replay.operativeState[op.id],day=contractQuote(replay,op,'day');
    return op.id>=100&&op.id<1000&&!replay.recruited.includes(op.id)&&!replay.hiringArrivals.some(a=>a.operativeId===op.id)&&r.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&r.morale>=50&&day.available&&day.price<=routeHiringCeiling(replay,30);
   });
   assert.deepEqual(candidates.map(op=>op.id),[102],'the fixed native regular rule admits one actual recruit, without a chosen force size');
   const week=contractQuote(replay,candidates[0],'week');assert.equal(week.available,true);assert.equal(week.total,regular.total);assert.ok(week.total<=replay.resources.treasury);assert.equal(hiringTravelHours(replay,102),regular.travelHours);
  }
  replay=dispatchCampaign(replay,actions[i]);assert.equal(replay.lastError,null,JSON.stringify(actions[i]));
  if(i===Math.floor(actions.length/2))replay=decodeSave(encodeSave(replay)).campaign;
 }
 assert.deepEqual(replay,prepared);assert.deepEqual(decodeSave(encodeSave(prepared)).campaign,prepared);
 // The two real rear reserves must receive compatible recovered weapons and
 // finite cartridges before joining the issued battery assault.
 const mendozaEvents=[],assault=prepareFreshMendozaAssault(prepared,{report:event=>mendozaEvents.push({...event,campaign:undefined})});assert.equal(assault.pendingBattle.sector,'mendoza');
 const delivered=mendozaEvents.find(e=>e.event==='mendozaBatteryDeliveryWait');assert.ok(delivered);assert.equal(delivered.id,originalGun.id);assert.equal(delivered.startHour,406);assert.equal(delivered.endHour,413);assert.equal(delivered.dueAt,413);assert.deepEqual(delivered.record,storedArtilleryRecord(originalGun));
 assert.equal(assault.hour,417);assert.equal(assault.secondOfHour,105);assert.equal(assault.resources.treasury,prepared.resources.treasury+8000-20,'only actual port income and the two further posta fares change cash');
 assert.equal(assault.sectors.cordoba.owner,'patriot');assert.equal(assault.pendingEncounter,null);assert.equal(assault.artilleryTransfers.length,0);
 assert.deepEqual(assault.pendingBattle.squad.map(u=>Number(u.id)).sort((a,b)=>a-b),[0,8,10,11,100,102,130,142]);
 const assaultTakes=mendozaEvents.filter(e=>e.action?.type==='sectorInventory'&&e.action.direction==='take').map(e=>e.action);
 assert.deepEqual(assaultTakes.filter(a=>JSON.parse(a.expected).weapon).map(a=>[a.operativeId,a.sourceKey,JSON.parse(a.expected).weapon]),[[130,'drop:16',1800],[102,'drop:17',1800]]);
 const assaultCartridges=assaultTakes.filter(a=>JSON.parse(a.expected).ammoType),ammunitionTotals={};
 for(const action of assaultCartridges){const type=JSON.parse(action.expected).ammoType;ammunitionTotals[type]=(ammunitionTotals[type]??0)+action.count;}
 assert.deepEqual(ammunitionTotals,{musket_75:27,rifle_62:1},'all eight primary guns use only the measured finite matching stock');
 const remaining=sectorInventoryModel(assault,'cordoba',rosterFor(assault),102);
 for(const key of new Set(assaultCartridges.map(a=>a.sourceKey))){
  const taken=assaultCartridges.filter(a=>a.sourceKey===key),initial=JSON.parse(taken[0].expected).count;
  assert.equal(remaining.entries.find(row=>row.key===key)?.count??0,initial-taken.reduce((sum,a)=>sum+a.count,0));
 }
 for(const index of [16,17])assert.equal(assault.sectorStates.cordoba.droppedWeapons[index].taken,true);
 assert.deepEqual(assault.operativeState[102].inventory['weapon:1804'],{count:1,weight:4,weapon:1804,loaded:1,condition:100,jammed:false},'the paid regular retains his exact original fowling piece after the real recovered musket is equipped');
 for(const id of [0,8,10,11,100,102,130,142]){
  const op=rosterFor(assault).find(op=>op.id===id),unit=carriedAmmunition(op,assault.operativeState[id]),family=ammoTypeFor({...unit,activeSlot:'primary'});
  assert.equal(unit.loaded+ammoCount(unit,family),12);assert.equal(assault.operativeState[id].hp,assault.operativeState[id].maxHp);assert.equal(assault.operativeState[id].bleeding,0);
 }
 for(const id of metadata.priorDeadIds)assert.equal(assault.operativeState[id].alive,false);
 const battle=enterSector(assault.pendingBattle,assault.sectorStates.mendoza);
 assert.deepEqual(assault.pendingBattle.artillery.map(gun=>storedArtilleryRecord(gun)),[storedArtilleryRecord(originalGun)],'the issued cannon retains exactly its two finite shots');
 assert.equal(battle.artillery.filter(gun=>gun.side==='player').length,1);
 for(const [sector,scene]of Object.entries(start.sectorStates))assert.deepEqual(assault.sectorStates[sector].artillery,scene.artillery.filter(gun=>gun.id!==originalGun.id),'other exhausted and occupied field guns remain unchanged');
 assert.deepEqual(decodeSave(encodeSave(assault,battle)),{campaign:assault,battle});
});
