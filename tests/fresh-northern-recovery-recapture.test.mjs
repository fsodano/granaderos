import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {artilleryProfile} from '../game/artillery-definitions.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {reuniteFreshNorthernSquad,prepareFreshSaltaAssault,stabilizeNorthernRecapture} from './fresh-northern-recovery.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import {recoverRecapturedRoad} from './recovery-road-care.mjs';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';

const nativeDeaths=[10,4,121,112,1000];
function assertUrgentAid(recaptured,aid){
 assert.deepEqual(aid.urgent,[119]);assert.equal(aid.exactSavedReplay,true);assert.deepEqual(aid.actions,[{type:'weapon',unitId:'103',slot:'medical'},{type:'useItem',unitId:'103',targetId:'119'}]);
 assert.equal(aid.elapsedSeconds,3);assert.deepEqual(aid.untreated,[]);assert.deepEqual(aid.treatedIds,['119']);
 const medic=aid.before.find(u=>u.id==='103'),patient=aid.before.find(u=>u.id==='119');
 assert.deepEqual([medic.medical,medic.hp,medic.medkits,medic.energy,medic.x,medic.y,medic.tacticalLevel],[20,74,1,73,48,31,0]);assert.equal(medic.unconscious,false);
 assert.deepEqual([patient.hp,patient.bleeding,patient.bandaged,patient.x,patient.y,patient.tacticalLevel,patient.unconscious],[11,5,0,47,30,0,true]);
 assert.deepEqual([aid.campaign.operativeState[119].hp,aid.campaign.operativeState[119].bleeding,aid.campaign.operativeState[119].bandaged],[15,0,67]);assert.equal(aid.campaign.operativeState[103].medkits,0);
 assert.equal(aid.campaign.hour*3600+aid.campaign.secondOfHour,recaptured.hour*3600+recaptured.secondOfHour+3);assert.equal(aid.campaign.resources.treasury,recaptured.resources.treasury);assert.deepEqual(aid.campaign.contracts,recaptured.contracts);
 for(const id of nativeDeaths){assert.equal(aid.campaign.operativeState[id].alive,false);assert.equal(aid.campaign.operativeState[id].deathMinute,recaptured.operativeState[id].deathMinute);}
 for(const piece of recaptured.sectorStates.cordoba.artillery)assert.deepEqual(storedArtilleryRecord(aid.campaign.sectorStates.cordoba.artillery.find(g=>g.id===piece.id)),storedArtilleryRecord(piece));
}

// Replay the actual clinical actions, including each visible finite source
// debit and each paid hourly dressing. A rest assignment alone is not care.
function assertClinicalCare(start,recovered,events){
 let replay=decodeSave(encodeSave(start)).campaign,collected=0,consumed=0,healed=0;const pickups=[];
 for(let index=0;index<events.length;index++){
  const action=events[index].action;assert.ok(action,'the earned clinic has no hidden collection or unrecorded hire');const before=replay;
  if(action.type==='sectorInventory'&&action.direction==='take'){
   const row=sectorInventoryModel(before,'cordoba',rosterFor(before),action.operativeId).entries.find(row=>row.key===action.sourceKey&&row.expected===action.expected);assert.ok(row?.reachable);
   assert.equal(JSON.parse(row.expected).item,'medkits');assert.equal(action.operativeId,123);assert.equal(action.count,1);pickups.push({key:row.key,kind:row.kind,count:row.count});collected+=action.count;
  }
  replay=dispatchCampaign(replay,action);assert.equal(replay.lastError,null,replay.lastError);
  if(action.type==='sectorInventory'&&action.direction==='take'){
   assert.equal(replay.operativeState[123].medkits,before.operativeState[123].medkits+action.count);
   const row=sectorInventoryModel(replay,'cordoba',rosterFor(replay),action.operativeId).entries.find(row=>row.key===action.sourceKey);assert.equal(row?.count??0,pickups.at(-1).count-action.count);
  }
  if(action.type==='wait'){
   const spent=before.operativeState[123].medkits-replay.operativeState[123].medkits;consumed+=spent;healed+=replay.operativeState[119].hp-before.operativeState[119].hp;
   if(spent){assert.equal(spent,1);assert.equal(before.operativeState[123].assignment,'doctor');assert.equal(before.operativeState[119].assignment,'patient');assert.ok(before.operativeState[123].energy>10);assert.equal(replay.hour*3600+replay.secondOfHour-before.hour*3600-before.secondOfHour,3600);}
   assert.equal(replay.operativeState[119].alive,true);assert.equal(replay.operativeState[119].bleeding,0);
  }
  if(index===Math.floor(events.length/2))replay=decodeSave(encodeSave(replay)).campaign;
 }
 assert.deepEqual(replay,recovered);assert.equal(start.operativeState[119].hp,15);assert.equal(recovered.operativeState[119].hp,82);assert.equal(recovered.operativeState[119].bandaged,0);assert.equal(healed,67);
 assert.equal(collected,23);assert.equal(consumed,collected);assert.equal(pickups.filter(r=>r.kind==='body').length,15);assert.equal(pickups.filter(r=>r.kind==='container').length,8);
 assert.equal(start.operativeState[123].medkits,0);assert.equal(recovered.operativeState[123].medkits,0);assert.equal(recovered.hour*3600+recovered.secondOfHour-start.hour*3600-start.secondOfHour,23*3600);
 for(const id of nativeDeaths){assert.equal(recovered.operativeState[id].alive,false);assert.equal(recovered.operativeState[id].deathMinute,start.operativeState[id].deathMinute);}
 assert.deepEqual(decodeSave(encodeSave(recovered)).campaign,recovered);
}

test('the genuine recaptured critical survivor receives one carried dressing before the meeting and real finite clinical care',()=>{
 const raw=gunzipSync(readFileSync(new URL('./fixtures/earned-lost-cordoba-before-meeting.json.gz',import.meta.url))),metadata=JSON.parse(readFileSync(new URL('./fixtures/earned-lost-cordoba-before-meeting.provenance.json',import.meta.url)));
 assert.equal(createHash('sha256').update(raw).digest('hex'),metadata.sha256);assert.equal(raw.length,metadata.rawBytes);
 const captured=JSON.parse(raw),start=decodeSave(encodeSave(captured.campaign)).campaign,before=structuredClone(start),events=[];
 assert.deepEqual([start.hour,start.secondOfHour,start.location],[350,2134,'cordoba']);assert.deepEqual([captured.status,captured.turns,captured.actions,captured.orders],['victory',30,362,412]);
 assert.deepEqual([start.operativeState[119].hp,start.operativeState[119].bleeding],[11,5]);const nativePatient=start.sectorStates.cordoba.units.find(u=>u.id==='119');assert.equal(nativePatient.routed,true);assert.equal(nativePatient.unconscious,true);
 const aided=stabilizeNorthernRecapture(start,{report:event=>events.push(event)});assert.deepEqual(start,before);assertUrgentAid(start,events[0]);assert.deepEqual(aided,events[0].campaign);
 const meeting=meetRecruits(aided,['quiroga','paz'],123);assert.equal(meeting.operativeState[119].alive,true);assert.deepEqual([meeting.operativeState[119].hp,meeting.operativeState[119].bleeding],[15,0]);assert.ok(meeting.recruited.includes(9)&&meeting.recruited.includes(11));assert.ok(meeting.hour*3600+meeting.secondOfHour>aided.hour*3600+aided.secondOfHour);
 const recovered=recoverRecapturedRoad(meeting);assertClinicalCare(meeting,recovered.campaign,recovered.events);
});

test('the earned lost-Córdoba return uses finite joined recapture, recorded saved replay, casualty care and physical cannon custody',()=>{
 // This is an unchanged earned save from the native full recovery prefix.
 // The companion metadata records its source and capture provenance.
 const raw=gunzipSync(readFileSync(new URL('./fixtures/northern-reunite-lost-cordoba.save.json.gz',import.meta.url)));
 const metadata=JSON.parse(readFileSync(new URL('./fixtures/northern-reunite-lost-cordoba.provenance.json',import.meta.url)));
 assert.equal(createHash('sha256').update(raw).digest('hex'),metadata.sha256);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),events=[];
 assert.equal(start.hour,306);assert.equal(start.secondOfHour,2959);assert.equal(start.location,'buenos_aires');assert.deepEqual(start.squad,[121,112,1000,10,4]);
 assert.equal(start.sectors.cordoba.owner,'royalist');assert.equal(start.enemyGroups.find(g=>g.id==='enemy-group-3').status,'stationed');
 const c=reuniteFreshNorthernSquad(start,{report:event=>{events.push(event);if(event.campaign){const {campaign,...context}=event;recordRouteStrategicEvidence({helper:'lost-Cordoba-reunion',stage:'route-checkpoint',campaign,context});}}});assert.deepEqual(start,before);
 const rested=events.find(e=>e.event==='northernReturnRested').campaign;
 assert.equal(rested.hour,316);assert.equal(rested.secondOfHour,2959);assert.equal(rested.resources.treasury,97698);assert.deepEqual(rested.squad,[10,4,121,112,1000]);
 const rejected=dispatchCampaign(rested,{type:'travel',sector:'cordoba'});
 assert.equal(rejected.lastError,metadata.rejectedReturn.error);assert.deepEqual({...rejected,lastError:null},rested,'the original route refusal must remain atomic');
 const cartridges=events.filter(e=>e.action?.type==='sectorInventory'&&e.family==='ammoPistol');
 assert.equal(cartridges.reduce((sum,e)=>sum+e.quantity,0),20);assert.deepEqual(cartridges.map(e=>[e.action.operativeId,e.quantity,e.sourceKind]),[[10,10,'body'],[4,10,'container']]);
 const shipment=events.find(e=>e.event==='routeBatteryShipment');assert.equal(shipment.id,'arsenal:buenos_aires:1');assert.equal(shipment.from,'buenos_aires');assert.equal(shipment.to,'san_nicolas');assert.equal(shipment.record.loaded,true);assert.equal(shipment.record.ammo,6);
 const ready=events.find(e=>e.event==='northernReturnRecaptureReady').campaign;
 assert.deepEqual(ready.pendingBattle.squad.map(u=>u.id),[10,4,121,112,1000,123,119,103]);assert.deepEqual(ready.pendingBattle.occupationGroupIds,['enemy-group-3']);
 const gun=ready.pendingBattle.artillery.find(g=>g.id===shipment.id);assert.equal(gun.loaded,true);assert.equal(gun.ammo,6);assert.equal(artilleryProfile(ready,gun).crew,2);
 const recaptured=events.find(e=>e.event==='northernReturnRecaptured');assert.equal(recaptured.status,'victory');assert.equal(recaptured.exactSavedReplay,true);assert.ok(recaptured.actions>0&&recaptured.orders>recaptured.actions);
 const actualDeaths=recaptured.units.filter(u=>u.side==='player'&&u.hp<=0&&before.operativeState[Number(u.id)]?.alive).map(u=>Number(u.id));assert.deepEqual(actualDeaths.sort((a,b)=>a-b),[...nativeDeaths].sort((a,b)=>a-b));
 for(const id of actualDeaths)assert.equal(c.operativeState[id].alive,false,'native recapture losses stay permanent');
 const aid=events.find(e=>e.event==='northernRecaptureFirstAid');assertUrgentAid(recaptured.campaign,aid);
 const meeting=events.find(e=>e.event==='northernRoadMeeting'),care=events.find(e=>e.event==='northernRoadRecovered');assertClinicalCare(meeting.campaign,care.campaign,care.careEvents);
 const careRested=events.find(e=>e.event==='northernRoadCareRested').campaign;assert.equal(care.campaign.operativeState[123].asleep,true);
 assert.equal(careRested.hour*3600+careRested.secondOfHour-care.campaign.hour*3600-care.campaign.secondOfHour,8*3600);
 const restRenewals=events.filter(e=>e.event==='northernReunionRenewal'&&e.hour>=care.campaign.hour&&e.hour<=careRested.hour);assert.ok(restRenewals.some(e=>e.id===119));
 for(const row of restRenewals){assert.equal(row.quote.available,true);assert.equal(row.cost,row.quote.price);assert.equal(row.afterExpiry,row.beforeExpiry+24*3600);}
 assert.equal(careRested.resources.treasury,care.campaign.resources.treasury-restRenewals.reduce((sum,e)=>sum+e.cost,0));
 for(const id of careRested.squad){const r=careRested.operativeState[id];assert.equal(r.asleep,false);assert.equal(r.fatigue,0);assert.equal(r.energy,100);assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);}
 assert.equal(c.location,'tucuman');assert.equal(c.sectors.cordoba.owner,'patriot');assert.ok(c.squad.includes(1));assert.ok(c.recruited.includes(9)&&c.recruited.includes(11));
 for(const id of c.recruited.filter(id=>c.operativeState[id].alive)){assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);assert.equal(c.operativeState[id].location,'tucuman');}
 for(const [id,r]of Object.entries(before.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 const captured=recaptured.campaign.sectorStates.cordoba.artillery.find(g=>g.id==='arsenal:cordoba:2'),delivered=c.artilleryDepots.tucuman.find(g=>g.id===captured.id);
 assert.equal(captured.side,'player');for(const key of ['id','type','side','loaded','ammo'])assert.deepEqual(delivered[key],captured[key]);
 // The unchanged native infantry policy fires one charge and reloads. Keep
 // that actual finite debit and its remaining six charges through all care.
 const nativeBattery=recaptured.campaign.sectorStates.cordoba.artillery.find(g=>g.id===shipment.id),remaining=c.sectorStates.cordoba.artillery.find(g=>g.id===shipment.id);
 assert.equal(nativeBattery.loaded,true);assert.equal(nativeBattery.ammo,5);assert.equal(gun.ammo+Number(gun.loaded)-nativeBattery.ammo-Number(nativeBattery.loaded),1);
 assert.deepEqual(storedArtilleryRecord(remaining),storedArtilleryRecord(nativeBattery));
 assert.equal(c.enemyGroups.find(g=>g.id==='enemy-group-3').status,'defeated');assert.equal(c.enemyGroups.find(g=>g.id==='enemy-group-4').status,'marching','the next real northern raid remains unresolved campaign state');
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 // Preparation selects that exact physically delivered two-person bronze gun.
 // It does not require an absent swivel or create another cannon or cartridge.
 const prepared=prepareFreshSaltaAssault(c);assert.equal(prepared.pendingBattle.sector,'salta');
 const deployed=prepared.pendingBattle.artillery.find(g=>g.side==='player');assert.equal(deployed.id,delivered.id);assert.equal(deployed.type,'bronze4');assert.equal(deployed.loaded,delivered.loaded);assert.equal(deployed.ammo,delivered.ammo);
 for(const id of actualDeaths)assert.equal(prepared.operativeState[id].alive,false);
 const battle=enterSector(prepared.pendingBattle,prepared.sectorStates.salta);assert.deepEqual(decodeSave(encodeSave(prepared,battle)),{campaign:prepared,battle});
});
