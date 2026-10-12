import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {prepareCreatedCoastalAssault} from './created-ending-route.mjs';

const name='earned-stock-post-andes-coastal-clinic',file=suffix=>readFileSync(new URL(`./fixtures/${name}.${suffix}`,import.meta.url));
const proof=JSON.parse(file('provenance.json')),gzip=file('save.json.gz'),raw=gunzipSync(gzip),sha=value=>createHash('sha256').update(value).digest('hex');
assert.equal(sha(gzip),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);assert.equal(raw.length,proof.rawBytes);

test('the actual mountain survivors finish finite coast-clinic care through ordinary stable rest and exact paid service',t=>{
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),patients=[146,103,134,9,118],events=[];
 assert.deepEqual([start.hour,start.secondOfHour],proof.clock);assert.equal(start.resources.treasury,proof.treasury);
 assert.deepEqual(patients.map(id=>[id,start.operativeState[id].hp,start.operativeState[id].maxHp,start.operativeState[id].bleeding]),[[146,15,78,0],[103,19,76,0],[134,31,70,0],[9,34,92,0],[118,43,84,0]]);
 let boundary;
 // Stop the observer at this real clinic boundary. The remaining coast route
 // has its own unresolved journey/battle gates and is not accepted here.
 const captured=Error('Actual coastal clinic boundary captured');
 assert.throws(()=>prepareCreatedCoastalAssault(start,{report:event=>{
  const {campaign,...receipt}=event;events.push(receipt);
  if(event.event==='coastalClinicRestFinished'){boundary={campaign,receipt};throw captured;}
 }}),error=>error===captured);
 assert.ok(boundary);const end=boundary.campaign,receipt=boundary.receipt;
 assert.equal(receipt.completed,true);assert.equal(receipt.stoppedReason,null);
 assert.deepEqual(receipt.start,[1048,747]);assert.deepEqual(receipt.finish,[1396,747]);assert.equal(receipt.hours,348);assert.equal(receipt.boundHours,348);assert.equal(receipt.elapsedSeconds,348*3600);
 assert.equal(receipt.passiveHpGained,139);assert.equal(receipt.dressingsUsed,0);assert.equal(receipt.renewalCost,158278);
 assert.equal(receipt.cashBefore,59472);assert.equal(receipt.cashAfter,21194);assert.equal(receipt.income.length,15);assert.equal(receipt.income.reduce((sum,row)=>sum+row.amount,0),120000);
 assert.equal(receipt.cashAfter,receipt.cashBefore+120000-receipt.renewalCost);assert.deepEqual(receipt.encounters,[]);
 assert.ok(events.some(event=>event.event==='finiteDressingShortage'&&event.operativeId===8&&event.carried===0));
 assert.ok(events.some(event=>event.event==='routeDressingDonation'));assert.ok(events.some(event=>event.event==='routeDressingsCollected'));
 for(const id of patients){const r=end.operativeState[id];assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);assert.equal(r.alive,true);assert.ok(end.recruited.includes(id));}
 const freeLiving=start.recruited.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured);
 for(const id of freeLiving){assert.equal(end.operativeState[id].alive,true);assert.ok(end.recruited.includes(id));assert.equal(end.operativeState[id].location,start.operativeState[id].location);}
 assert.equal(freeLiving.reduce((sum,id)=>sum+start.operativeState[id].medkits,0),25);
 assert.equal(freeLiving.reduce((sum,id)=>sum+end.operativeState[id].medkits,0),2,'Only the actual 23 local dressings were spent; the two Córdoba dressings stay there.');
 assert.equal(end.operativeState[7].medkits,2);assert.equal(end.operativeState[7].location,'cordoba');
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(end.operativeState[id].alive,false);assert.equal(end.operativeState[id].deathMinute,r.deathMinute);}
 const guns=campaign=>[...Object.values(campaign.artilleryDepots).flat(),...Object.values(campaign.sectorStates).flatMap(state=>state.artillery??[])].map(({id,type,condition,loaded,ammo})=>({id,type,condition,loaded,ammo})).sort((a,b)=>a.id.localeCompare(b.id));
 assert.deepEqual(guns(end),guns(start));assert.equal(end.blockade,true);assert.equal(end.completed,false);assert.equal(end.pendingBattle,null);assert.equal(end.pendingEncounter,null);
 assert.deepEqual(decodeSave(encodeSave(end)).campaign,end);assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({scope:proof.scope,clinicDressingsSpent:23,passiveHours:348,passiveHp:139,renewals:158278,income:120000,clock:receipt.finish,treasury:21194,allFivePatientsRecovered:true,strictOfficialSave:true}));
});
