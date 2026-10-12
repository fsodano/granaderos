import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {livingNorthernReturnPlan,recoverLivingCreatedNorthernColumn} from './created-living-northern-route.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
function earned(){
 const stem='./fixtures/earned-expanded-capital-victory',proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url))),blob=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(blob);
 assert.equal(sha(blob),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);assert.equal(raw.length,proof.rawBytes);assert.equal(JSON.parse(raw).savedAt,proof.savedAt);
 const c=decodeSave(raw.toString()).campaign;assert.equal(sha(JSON.stringify(c)),proof.campaignSha256);assert.deepEqual([c.hour,c.secondOfHour,c.resources.treasury],[...proof.clock,proof.treasury]);return {campaign:c,proof};
}

test('the northern return derives all actual serving capital survivors and the reserve without restoring the five native casualties',()=>{
 const {campaign:c,proof}=earned(),before=structuredClone(c),plan=livingNorthernReturnPlan(c);
 assert.deepEqual(c,before);assert.deepEqual(plan.keepers,proof.livingKeepers);assert.deepEqual(plan.field,proof.fieldIds);assert.deepEqual(plan.patients,[117,107]);assert.equal(plan.rate,6);assert.equal(plan.healingDressings,24);assert.equal(plan.dailyService,483);
 assert.ok(plan.physicians.includes(10)&&plan.physicians.includes(122));for(const id of proof.newNativeDeaths){assert.equal(c.operativeState[id].alive,false);assert.ok(!plan.keepers.includes(id));}
});

test('the same public planner retains a different genuine living cohort without a seven-person or fixture-ID branch',()=>{
 const stem='./fixtures/earned-paid-coastal-care',proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url))),blob=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(blob);
 assert.equal(sha(blob),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);
 const c=decodeSave(raw.toString()).campaign,before=structuredClone(c),plan=livingNorthernReturnPlan(c),actual=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);
 assert.deepEqual(c,before);assert.deepEqual(plan.keepers,actual);assert.deepEqual(plan.field,actual.filter(id=>id!==57));assert.equal(plan.field.length,11);assert.deepEqual(plan.patients,[]);assert.equal(plan.healingDressings,0);
});

test('the complete real seven-person field and Córdoba commander finish finite paid care and physical return with all native losses retained',t=>{
 const {campaign:start,proof}=earned(),before=structuredClone(start),events=[],c=recoverLivingCreatedNorthernColumn(start,{report:e=>events.push(e)}),ready=events.find(e=>e.event==='livingNorthernCareReady');
 assert.deepEqual(start,before);assert.ok(ready);assert.deepEqual(ready.keepers,proof.livingKeepers);assert.deepEqual(ready.field,proof.fieldIds);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.blockade,false);assert.equal(c.defeated,false);assert.equal(c.completed,false);
 for(const id of proof.livingKeepers){const r=c.operativeState[id],expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(c.recruited.includes(id)&&r.alive&&!r.captured);assert.equal(r.location,'cordoba');assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);assert.ok(expiry===null||expiry>c.hour*3600+c.secondOfHour);}
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
 assert.ok(proof.livingKeepers.reduce((sum,id)=>sum+(c.operativeState[id].medkits??0),0)>=30);assert.ok(events.some(e=>e.event==='routeDressingsCollected'||e.event==='routeDressingDonation'));
 assert.ok(c.hour*3600+c.secondOfHour>start.hour*3600+start.secondOfHour);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 t.diagnostic(JSON.stringify({scope:'Whole earned capital-survivor finite care and actual Córdoba return only; north request/victory, both fresh endings and real48h remain open',inputRawSha256:proof.rawSha256,field:proof.fieldIds,keepers:proof.livingKeepers,patients:proof.patients,commander:'cordoba',preservedNativeDeaths:proof.newNativeDeaths,clock:[c.hour,c.secondOfHour],treasury:c.resources.treasury,carriedDressings:proof.livingKeepers.reduce((sum,id)=>sum+(c.operativeState[id].medkits??0),0),officialSave:true}));
});
