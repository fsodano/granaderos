import test from 'node:test';
import assert from 'node:assert/strict';
import {captiveServiceHours,restoredCaptiveContract,prisonerStatus} from '../game/prisoner-custody.js';
const record=()=>({captured:true,capturedSector:'tucuman',capturedAt:18,hp:11,maxHp:80,bleeding:2,capturedContract:{kind:'paid',term:'day',started:0,expiresAt:24,paid:20,departurePending:true}});
test('captivity retains only unused paid service and releases a fresh copy without pending departure',()=>{
 const r=record(),before=structuredClone(r);assert.equal(captiveServiceHours(r),6);
 for(const hour of [18,72,500]){const c=restoredCaptiveContract(r,hour);assert.equal(c.expiresAt,hour+6);assert.equal(c.paid,20);assert.equal(c.started,0);assert.equal(c.departurePending,undefined);}
 assert.deepEqual(r,before);
});
test('expired service is not renewed for free and permanent service remains permanent',()=>{
 for(const expiresAt of [10,18]){const r=record();r.capturedContract.expiresAt=expiresAt;assert.equal(captiveServiceHours(r),0);assert.equal(restoredCaptiveContract(r,100),null);}
 const r=record();Object.assign(r.capturedContract,{kind:'patriot',expiresAt:null});assert.equal(captiveServiceHours(r),null);assert.equal(restoredCaptiveContract(r,100).expiresAt,null);
 assert.throws(()=>restoredCaptiveContract({...r,captured:false},100));
});
test('prisoner status shows known wounds and elapsed detention without reducing paused service or mutating custody',()=>{
 const s={hour:72,operativeState:{112:record()}},before=structuredClone(s),op={id:112,name:'Médico',maxHp:80};
 const p=prisonerStatus(s,op);assert.equal(p.heldHours,54);assert.equal(p.serviceHours,6);assert.equal(p.needsCare,true);assert.equal(p.critical,true);assert.equal(p.hp,11);assert.deepEqual(s,before);
 s.operativeState[112].captured=false;assert.equal(prisonerStatus(s,op),null);
});
test('capture preserves the final paid minute and release carries it across an hour boundary',()=>{
 const r=record();r.capturedAt=24;r.capturedAtSecond=900;r.capturedContract.expiresAt=24;r.capturedContract.expiresSecond=960;
 const before=structuredClone(r);assert.equal(captiveServiceHours(r),1/60);
 const restored=restoredCaptiveContract(r,500,3590);
 assert.equal(restored.expiresAt,501);assert.equal(restored.expiresSecond,50);assert.equal(restored.paid,20);assert.deepEqual(r,before);
 const status=prisonerStatus({hour:25,secondOfHour:920,operativeState:{112:r}},{id:112,maxHp:80});
 assert.equal(status.heldHours,3620/3600);assert.equal(status.serviceHours,1/60);
});
test('fractional capture removes exactly elapsed service and never restores an expired second',()=>{
 const r=record();r.capturedAt=24;r.capturedAtSecond=3590;r.capturedContract.expiresAt=25;r.capturedContract.expiresSecond=30;
 assert.equal(captiveServiceHours(r),40/3600);
 const restored=restoredCaptiveContract(r,500,15);assert.equal(restored.expiresAt,500);assert.equal(restored.expiresSecond,55);
 r.capturedAt=25;r.capturedAtSecond=30;assert.equal(captiveServiceHours(r),0);assert.equal(restoredCaptiveContract(r,500,15),null);
});
