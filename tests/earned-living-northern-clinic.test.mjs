import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {livingNorthernReliefPlan,recoverLivingNorthernClinic} from './created-living-northern-relief.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex'),clock=c=>c.hour*3600+(c.secondOfHour??0);
const input=()=>{const stem='./fixtures/earned-living-northern-tucuman-victory',proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url))),packed=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(packed);assert.equal(sha(packed),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);assert.equal(raw.length,proof.rawBytes);assert.equal(JSON.parse(raw).savedAt,proof.savedAt);const c=decodeSave(raw.toString()).campaign;assert.equal(sha(JSON.stringify(c)),proof.campaignSha256);return {c,proof};};
const guns=c=>[...Object.values(c.artilleryDepots??{}).flat(),...Object.values(c.sectorStates??{}).flatMap(s=>s.artillery??[]),...Object.values(c.sceneStates??{}).flatMap(s=>s.artillery??[]),...(c.artilleryTransfers??[]).map(t=>t.gun)].map(storedArtilleryRecord);
const knownKits=(c,id)=>sectorInventoryModel(c,c.operativeState[id].location,rosterFor(c),id).entries.filter(r=>r.reachable&&JSON.parse(r.expected).item==='medkits').reduce((sum,r)=>sum+r.count,0);

test('the actual two-person northern return quotes its real qualified clinic and only willing living replacement candidates',()=>{
 const {c}=input(),before=structuredClone(c),p=livingNorthernReliefPlan(c);
 assert.deepEqual(p.keepers,[57,101,107]);assert.deepEqual(p.field,[101,107]);assert.deepEqual(p.patients,[101]);assert.deepEqual(p.clinics,[{sector:'tucuman',patients:[101],doctorId:107,rate:6,dressings:11}]);assert.equal(knownKits(c,107),48);
 assert.deepEqual(p.candidates.map(r=>r.id).sort((a,b)=>a-b),[106,118,130,142,147]);
 for(const row of p.candidates){assert.equal(row.day.available,true);assert.equal(row.week.available,true);assert.equal(row.arrivalReason,null);assert.equal(row.arrivalHours,0);assert.equal(c.operativeState[row.id].serviceEquipmentReturn,undefined);assert.ok(c.operativeState[row.id].alive&&!c.operativeState[row.id].captured);}
 assert.deepEqual(Object.fromEntries(p.candidates.map(r=>[r.id,r.day.price])),{106:8280,118:9438,130:40,142:7740,147:6840});
 assert.equal(c.operativeState[101].hp,15);assert.equal(c.operativeState[107].hp,80);assert.equal(c.operativeState[57].location,'cordoba');assert.deepEqual(c,before);
});

test('the complete actual northern survivor clinic consumes real local dressings and time while preserving deaths, service and the live enemy schedule',t=>{
 const {c:start,proof}=input(),before=structuredClone(start),events=[],oldGuns=guns(start),p=livingNorthernReliefPlan(start),pool=knownKits(start,107),carried=start.operativeState[101].medkits+start.operativeState[107].medkits;
 const c=recoverLivingNorthernClinic(start,{report:e=>events.push(e)});assert.deepEqual(start,before);
 assert.deepEqual(c.recruited,start.recruited);assert.deepEqual(c.enemyGroups,start.enemyGroups);assert.deepEqual(c.enemyReserves,start.enemyReserves);assert.equal(c.blockade,true);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);assert.deepEqual(guns(c),oldGuns);
 for(const id of p.keepers){const r=c.operativeState[id];assert.ok(r.alive&&!r.captured);assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);assert.equal(r.location,start.operativeState[id].location);const expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(expiry===null||expiry>clock(c));}
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}for(const id of proof.newNativeDeaths)assert.equal(c.operativeState[id].hp,0);
 const picked=events.filter(e=>e.event==='routeDressingsCollected').reduce((sum,e)=>sum+e.count,0),afterCarried=c.operativeState[101].medkits+c.operativeState[107].medkits;
 assert.equal(picked,3);assert.equal(knownKits(c,107),pool-picked);assert.equal(carried+picked-afterCarried,11);assert.equal(c.operativeState[101].medkits,start.operativeState[101].medkits);assert.equal(c.operativeState[107].medkits,0);
 const elapsed=clock(c)-clock(start);assert.ok(elapsed>0&&elapsed<=p.maxCareHours*3600);assert.equal(events.filter(e=>e.event==='livingNorthernClinicRenewal').length,0);assert.deepEqual(c.contracts,start.contracts);assert.ok(c.resources.treasury>=start.resources.treasury);
 for(const receipt of events.filter(e=>e.event==='livingNorthernClinicOrder'))if(receipt.action.type!=='wait')assert.equal(receipt.startSeconds,receipt.endSeconds);
 const official=encodeSave(c);assert.deepEqual(decodeSave(official).campaign,c);
 t.diagnostic(JSON.stringify({scope:'Actual two-survivor local clinical care and willing paid replacement quotes only; no hire/north request/ending proof',inputRawSha:proof.rawSha256,keepers:p.keepers,patients:p.patients,doctor:p.clinics[0].doctorId,picked,consumed:11,elapsedSeconds:elapsed,clock:[c.hour,c.secondOfHour],treasury:c.resources.treasury,currentQuotes:livingNorthernReliefPlan(c).candidates,canonicalCampaignSha:sha(JSON.stringify(c))}));
});
