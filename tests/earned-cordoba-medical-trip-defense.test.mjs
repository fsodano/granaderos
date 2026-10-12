import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {rosterFor,dispatchCampaign} from '../game/campaign.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {collectRouteMedicalSupplies} from './finite-route-equipment.mjs';
import {prepareCordobaMedicalRear,resolveCordobaMedicalRearEncounter,stabilizeCordobaMedicalRear} from './cordoba-medical-rear-guard.mjs';

const stem='./fixtures/earned-original-cordoba-before-medical-trip',proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url))),bytes=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(bytes);
const sha=x=>createHash('sha256').update(x).digest('hex'),input=()=>decodeSave(raw.toString()).campaign,clock=s=>s.hour*3600+(s.secondOfHour??0);
assert.equal(sha(bytes),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);assert.equal(raw.length,proof.rawBytes);
let ready;

test('the actual depleted Cordoba rear gains paid guards, real coastal relief and finite arms without changing earned positions or prior losses',t=>{
 const start=input(),before=structuredClone(start),events=[];assert.deepEqual([start.hour,start.secondOfHour],[222,2346]);assert.equal(start.pendingEncounter,null);
 const gunCount=s=>sectorInventoryModel(s,'cordoba',rosterFor(s),146).entries.filter(row=>[1800,1801,1802].includes(JSON.parse(row.expected).weapon)).reduce((n,row)=>n+row.count,0);
 const guns=gunCount(start);ready=prepareCordobaMedicalRear(start,146,{report:e=>events.push(e)});const {campaign:c,receipt:r}=ready;
 assert.deepEqual(r.initialRear,[107,124,116,144,134]);assert.deepEqual(r.newIds,[139,130,100,102,133]);assert.deepEqual(r.relief,[113,141]);assert.equal(r.rear.length,12);
 assert.equal(r.hires.reduce((n,h)=>n+h.debited,0),292);assert.equal(r.activationCost,150);assert.equal(r.travelCost,10);assert.equal(r.treasuryBefore-r.treasuryAfter,452);
 assert.equal(r.endSeconds-r.startSeconds,4*3600+760);assert.equal(r.rearDressings,10);assert.equal(c.squads.length,start.squads.length);assert.ok(c.squads.length<=8);
 assert.equal(gunCount(c),guns-5,'only five observed long guns leave finite local property');
 for(const id of r.initialRear)assert.deepEqual(c.operativeState[id].residentPosition,start.operativeState[id].residentPosition);
 for(const id of [...r.newIds,...r.relief]){assert.equal(c.operativeState[id].residentPosition.tacticalLevel,1);assert.ok(carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]).loaded>0);assert.equal(c.operativeState[id].location,'cordoba');}
 for(const h of r.hires){assert.equal(h.quote.available,true);assert.equal(h.debited,h.quote.total);assert.equal(h.arrival.travelHours,0);assert.equal(c.contracts[h.id].expiresAt,h.arrival.dueAt+24);assert.equal(c.operativeState[h.id].medkits,2);}
 for(const [id,s]of Object.entries(start.operativeState)){assert.equal(c.operativeState[id].alive,s.alive);assert.equal(c.operativeState[id].captured,s.captured);if(!s.alive)assert.equal(c.operativeState[id].deathMinute,s.deathMinute);}
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({scope:'Actual222 pre-trip preparation only',hires:r.newIds,relief:r.relief,cost:452,elapsedSeconds:r.endSeconds-r.startSeconds,realRearDressings:r.rearDressings,oldPositionsPreserved:true}));
});

test('the real medical trip wins its native294 interruption, buys finite urgent aid, retains casualties and returns the actual debited linen with exact saves',t=>{
 assert.ok(ready);const start=ready.campaign,before=structuredClone(start),events=[];let clinicInput,defense;
 const report=e=>{events.push(e);if(e.event==='cordobaMedicalRearClinicInput')clinicInput=structuredClone(e.campaign);if(e.event==='cordobaMedicalRearDefense')defense=structuredClone(e);};
 const cacheKits=s=>s.sectorStates.retiro.props.find(p=>p.id==='retiro:armory-cache').contents.filter(x=>x.item==='medkits').reduce((n,x)=>n+x.count,0);
 const stock=cacheKits(start),result=collectRouteMedicalSupplies(start,146,12,{report,resolveEncounter:s=>{
  assert.equal(s.pendingEncounter.sector,'cordoba');assert.equal(s.pendingEncounter.groupId,'enemy-group-2');assert.equal(s.hour,294);
  assert.throws(()=>prepareCordobaMedicalRear(s,146),/null|equal/,'rear formation cannot skip an actual pending encounter');
  return resolveCordobaMedicalRearEncounter(s,{restoreSquad:true,report});
 }}),c=result.campaign;
 assert.ok(defense);assert.equal(defense.summary.status,'victory');assert.equal(defense.summary.turns,27);assert.equal(defense.summary.actions,234);assert.equal(defense.summary.elapsedSeconds,661);
 assert.equal(c.enemyGroups.find(g=>g.id===defense.groupId).status,'defeated');assert.equal(c.sectors.cordoba.owner,'patriot');assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);assert.equal(c.defeated,false);
 const nativeDeaths=defense.summary.units.filter(u=>u.side==='player'&&u.hp===0&&start.operativeState[u.id]?.alive).map(u=>Number(u.id));assert.deepEqual(nativeDeaths,[113,141,144,134,139,130,100,133]);
 for(const id of nativeDeaths)assert.equal(c.operativeState[id].alive,false);for(const [id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
 const care=defense.care;assert.deepEqual(care.patients,[107,102]);assert.equal(care.hire.id,135);assert.equal(care.hire.debited,7020);assert.equal(care.hire.debited,care.hire.quote.total);assert.equal(care.hire.arrival.travelHours,0);assert.equal(care.dressingsSpent,2);assert.equal(care.endSeconds-care.startSeconds,7200);assert.deepEqual(care.otherDeaths,[9],'the separately wounded non-serving civilian keeps his native loss');
 assert.deepEqual(care.ticks.map(t=>t.patients),[[{id:107,hp:19,bleeding:0},{id:102,hp:12,bleeding:0}],[{id:107,hp:19,bleeding:0},{id:102,hp:18,bleeding:0}]]);
 const replay=stabilizeCordobaMedicalRear(decodeSave(encodeSave(clinicInput)).campaign),restoredSelection=dispatchCampaign(replay.campaign,{type:'selectSquad',id:defense.campaign.activeSquadId});assert.equal(restoredSelection.lastError,null);assert.deepEqual(restoredSelection,defense.campaign,'the paid clinical orders replay from the official native settlement save');assert.deepEqual(replay.receipt,care);
 assert.equal(result.collected,6);assert.equal(cacheKits(c),stock-6);assert.equal(c.operativeState[146].medkits,6);assert.equal(c.operativeState[146].location,'cordoba');assert.equal(c.operativeState[146].alive,true);
 for(const id of care.local){assert.equal(c.operativeState[id].alive,true);assert.equal(c.operativeState[id].bleeding,0);assert.ok(c.operativeState[id].hp>=15);}
 assert.ok(clock(c)>clock(start));assert.ok(c.resources.treasury>=0);assert.equal(c.activeSquadId,start.activeSquadId);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);assert.deepEqual(start,before);
 const trip=events.find(e=>e.event==='finiteMedicalCourier');assert.equal(trip.source,'retiro');assert.equal(trip.mode,'march');assert.equal(trip.quantity,6);assert.ok(events.some(e=>e.event==='medicalCourierRenewal'));
 t.diagnostic(JSON.stringify({scope:'Earned222 preparation, actual courier interruption/defense, native losses, two-hour paid finite care and courier return; no later-route completion claim',nativeDeaths,turns:defense.summary.turns,actions:defense.summary.actions,fieldSeconds:661,clinicalSeconds:7200,clinicalDressings:2,doctorCost:7020,returnedDressings:6,clock:[c.hour,c.secondOfHour],treasury:c.resources.treasury}));
});
