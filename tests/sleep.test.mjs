import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {playerKnownCampaign} from '../game/player-known-state.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const wait=(s,hours)=>order(s,{type:'wait',hours});
const sleep=(s,id,asleep=true)=>order(s,{type:'setSleep',operativeId:id,asleep});
const r=(s,id=3)=>s.operativeState[id];
const event=(s,code,id=3)=>s.assignmentAttention.notice?.events.find(e=>e.operativeId===id&&e.code===code);
const practice=()=>order(initialCampaign(),{type:'assignWork',operativeId:3,assignment:'practice',skill:'mechanical'});

test('manual sleep preserves the work order and wakes at full recovery before work resumes',()=>{
 let s=practice();Object.assign(r(s),{energy:76,fatigue:16});s=sleep(s,3);const credit=r(s).skillPractice?.mechanical??0;
 s=wait(s,8);assert.equal(s.hour,2);assert.ok(event(s,'sleep_complete'));assert.equal(r(s).asleep,false);assert.equal(r(s).energy,100);assert.equal(r(s).fatigue,0);assert.equal(r(s).assignment,'practice');assert.equal(r(s).trainingSkill,'mechanical');assert.equal(r(s).skillPractice?.mechanical??0,credit);
 s=wait(s,1);assert.equal(r(s).energy,97);assert.ok(r(s).skillPractice.mechanical>credit);
});
test('exhausted workers automatically sleep and stop the explicit wait before advancing',()=>{
 let s=practice();Object.assign(r(s),{energy:10,fatigue:60});s=wait(s,24);assert.equal(s.hour,0);assert.ok(event(s,'sleep_started'));assert.equal(r(s).asleep,true);assert.equal(r(s).energy,10);
 s=wait(s,24);assert.equal(s.hour,8);assert.ok(event(s,'sleep_complete'));assert.equal(r(s).energy,100);assert.equal(r(s).fatigue,0);assert.equal(r(s).skillPractice?.mechanical??0,0);
});
test('the productive hour that exhausts a worker does not also give sleep recovery',()=>{
 let s=practice();Object.assign(r(s),{energy:13,fatigue:78});s=wait(s,24);assert.equal(s.hour,1);assert.ok(event(s,'sleep_started'));assert.equal(r(s).energy,10);assert.equal(r(s).fatigue,80);const credit=r(s).skillPractice.mechanical;
 s=wait(s,1);assert.equal(r(s).energy,22);assert.equal(r(s).fatigue,72);assert.equal(r(s).skillPractice.mechanical,credit);
});
test('idle recovery is slower than sleep and does not heal wounds',()=>{
 let s=initialCampaign();Object.assign(r(s),{hp:30,bandaged:r(s).maxHp-30,energy:40,fatigue:40});let asleep=sleep(s,3);
 s=wait(s,4);asleep=wait(asleep,4);assert.equal(r(s).energy,52);assert.equal(r(asleep).energy,88);assert.equal(r(s).fatigue,36);assert.equal(r(asleep).fatigue,8);assert.equal(r(s).hp,30);
});
test('manual waking permits travel while sleeping squad members block voluntary deployment',()=>{
 let s=initialCampaign();r(s).energy=40;s=sleep(s,3);const saved=serializeCampaign(s);
 for(const a of [{type:'travel',sector:'ensenada'},{type:'visitSector'},{type:'attack',sector:'san_nicolas'}])assert.match(dispatchCampaign(s,a).lastError,/durmiendo/);
 assert.equal(serializeCampaign(s),saved);s=sleep(s,3,false);s=order(s,{type:'travel',sector:'ensenada'});assert.equal(r(s).energy,40);assert.equal(r(s).asleep,false);
});
test('sleep rejects fully rested, critical, unavailable and invalid requests without changing state',()=>{
 const s=initialCampaign(),saved=serializeCampaign(s);for(const a of [{operativeId:3,asleep:true},{operativeId:99999,asleep:true},{operativeId:3,asleep:'true'},{operativeId:3,asleep:false}])assert.ok(dispatchCampaign(s,{type:'setSleep',...a}).lastError);assert.equal(serializeCampaign(s),saved);
 r(s).hp=8;r(s).energy=0;assert.match(dispatchCampaign(s,{type:'setSleep',operativeId:3,asleep:true}).lastError,/crítico/);
});
test('sleeping patients and rest assignments receive only one hour of recovery',()=>{
 for(const assignment of ['patient','rest']){let s=initialCampaign();Object.assign(r(s),{energy:30,fatigue:40,hp:30,bandaged:r(s).maxHp-30});s=order(s,{type:'assignCare',operativeId:3,assignment});s=sleep(s,3);s=wait(s,1);assert.equal(r(s).energy,42);assert.equal(r(s).fatigue,32);assert.equal(r(s).hp,30);}
});
test('a sleeping doctor consumes no kits and resumes the same patient assignment after waking',()=>{
 let s=initialCampaign();Object.assign(r(s),{hp:30,bandaged:r(s).maxHp-30});s=order(s,{type:'assignCare',operativeId:3,assignment:'patient'});s=order(s,{type:'assignCare',operativeId:10,assignment:'doctor'});r(s,10).energy=88;s=sleep(s,10);
 s=wait(s,3);assert.equal(s.hour,0);assert.equal(r(s,10).medkits,2);s=wait(s,3);assert.equal(s.hour,1);assert.ok(event(s,'sleep_complete',10));assert.equal(r(s).hp,30);s=wait(s,1);assert.ok(r(s).hp>30);assert.equal(r(s,10).medkits,1);
});
test('militia instruction spends energy, pauses for sleep and retains its paid cohort',()=>{
 let s=order(initialCampaign(),{type:'militia',rank:0,trainerId:4});Object.assign(r(s,4),{energy:13,fatigue:78});const duration=s.militiaTraining[0].remaining,money=s.resources.treasury;
 s=wait(s,24);assert.equal(s.hour,1);assert.ok(event(s,'sleep_started',4));assert.equal(s.militiaTraining[0].remaining,duration-1);assert.equal(r(s,4).energy,10);
 s=wait(s,24);assert.ok(event(s,'sleep_complete',4));assert.equal(s.hour,11);assert.equal(s.militiaTraining[0].remaining,duration-1);assert.equal(s.resources.treasury,money);
 s=wait(s,1);assert.equal(s.militiaTraining[0].remaining,duration-2);assert.equal(r(s,4).energy,97);
});
test('forced defense wakes sleeping defenders and excludes strategic recovery during deployment',()=>{
 let s=initialCampaign();r(s).energy=40;s=sleep(s,3);launchEnemyGroup(s,'coast','retiro',{immediate:true});s=wait(s,1);assert.ok(s.pendingEncounter);s=order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'tactical'});assert.equal(r(s).asleep,false);assert.equal(s.pendingBattle.squad.find(u=>u.id===3).asleep,false);
 const energy=r(s).energy;s=order(s,{type:'syncTacticalTime',battleId:s.pendingBattle.id,elapsedSeconds:3600});assert.equal(r(s).energy,energy);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});
test('unsafe sleep wakes without recovery and reports the interruption',()=>{
 let s=initialCampaign();r(s).energy=40;s=sleep(s,3);s.sectors.retiro.owner='royalist';s=wait(s,4);assert.equal(s.hour,0);assert.ok(event(s,'sleep_disturbed'));assert.equal(r(s).asleep,false);assert.equal(r(s).energy,40);
});
test('sleeping service records are cleared on dismissal and death',()=>{
 let s=initialCampaign();r(s).energy=40;s=sleep(s,3);s=order(s,{type:'dismiss',id:3});assert.equal(r(s).asleep,false);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
 s=initialCampaign();Object.assign(r(s),{energy:40,hp:15,bleeding:80,bandaged:0});s=sleep(s,3);s=wait(s,1);assert.equal(r(s).alive,false);assert.equal(r(s).asleep,false);
});
test('sleep and its wait notice survive save and reload with deterministic continuation',()=>{
 let s=practice();r(s).energy=10;s=wait(s,24);const restored=decodeSave(encodeSave(s)).campaign;assert.deepEqual(restored,s);assert.deepEqual(wait(restored,24),wait(s,24));assert.equal(playerKnownCampaign(s).operatives.find(o=>o.id===3).asleep,true);
 for(const value of [null,1,'yes']){const bad=structuredClone(s);r(bad).asleep=value;assert.throws(()=>restoreCampaign(serializeCampaign(bad)));}
 const bad=structuredClone(s);bad.assignmentAttention.notice.events[0].code='repair_complete';assert.throws(()=>restoreCampaign(serializeCampaign(bad)));
});
test('paired training retains its teacher and credit while either participant sleeps',()=>{
 let s=order(initialCampaign(),{type:'assignWork',operativeId:10,assignment:'instructor',skill:'mechanical'});s=order(s,{type:'assignWork',operativeId:3,assignment:'student',skill:'mechanical',instructorId:10});r(s,10).energy=76;s=sleep(s,10);
 s=wait(s,8);assert.equal(s.hour,0);s=wait(s,8);assert.ok(event(s,'sleep_complete',10));assert.equal(s.hour,2);assert.equal(r(s).instructorId,10);assert.equal(r(s).skillPractice?.mechanical??0,0);assert.equal(r(s).energy,100);
 s=wait(s,1);assert.ok(r(s).skillPractice.mechanical>0);assert.equal(r(s).energy,97);assert.equal(r(s,10).energy,97);
});
test('sleeping contract expiration clears the state before any further recovery',()=>{
 let s=initialCampaign();r(s).energy=40;s=sleep(s,3);s.contracts[3]={kind:'paid',term:'day',started:0,expiresAt:1,paid:100};s=wait(s,2);assert.ok(!s.recruited.includes(3));assert.equal(r(s).asleep,false);assert.equal(r(s).energy,40);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});
test('sleep natural healing cannot heal critical injuries or stop bleeding',()=>{
 let s=initialCampaign();Object.assign(r(s),{hp:30,bandaged:r(s).maxHp-30,energy:10,fatigue:80});s=sleep(s,3);s=wait(s,6);assert.equal(r(s).hp,31);assert.equal(r(s).recoveryHours,0);
 s=initialCampaign();Object.assign(r(s),{hp:15,bandaged:0,bleeding:4,energy:40});s=sleep(s,3);s=wait(s,6);assert.equal(s.hour,5);assert.ok(event(s,'sleep_complete'));s=wait(s,1);assert.equal(r(s).hp,9);assert.equal(r(s).bleeding,4);
});
