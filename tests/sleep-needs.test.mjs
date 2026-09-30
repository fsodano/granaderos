import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign as dispatch,rosterFor,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {sleepNeed,sleepRecovery,sleepNeedStatus,SLEEP_PROFILES} from '../game/sleep-needs.js';
import {advanceMedicalCare} from '../game/medical-care.js';
import {finishSleepHour} from '../game/sleep.js';
const order=(s,a)=>{const n=dispatch(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const wait=(s,hours=1)=>order(s,{type:'wait',hours});
const person=(s,id)=>({...rosterFor(s).find(o=>o.id===id),...s.operativeState[id]});
const hire=(s,id)=>order(s,{type:'recruitCivic',id,term:'week'});
const sleep=(s,id)=>order(s,{type:'setSleep',operativeId:id,asleep:true});

test('profile and night-training differences give actual hired soldiers distinct recovery rates',()=>{
 let s=hire(hire(initialCampaign(),103),113);for(const id of [103,113]){Object.assign(s.operativeState[id],{energy:40,fatigue:40});s=sleep(s,id);}
 assert.deepEqual(sleepRecovery(person(s,103)),{base:6,wounds:0,nightTraining:0,hours:6,fatigue:10,energy:16});assert.deepEqual(sleepRecovery(person(s,113)),{base:8,wounds:0,nightTraining:1,hours:7,fatigue:9,energy:13});
 const n=wait(s);assert.equal(n.operativeState[103].energy,56);assert.equal(n.operativeState[103].fatigue,30);assert.equal(n.operativeState[113].energy,53);assert.equal(n.operativeState[113].fatigue,31);
 assert.equal(n.resources.treasury,s.resources.treasury);assert.equal(n.operativeState[103].hp,s.operativeState[103].hp);assert.equal(n.operativeState[103].medkits,s.operativeState[103].medkits);
});
test('health quarters and trait reduction follow exact thresholds and stay bounded',()=>{
 for(const [hp,extra] of [[100,0],[75,0],[74,1],[50,1],[49,2],[25,2],[24,4],[0,4]]){const normal=sleepNeed({id:3,hp,maxHp:100}),night=sleepNeed({id:3,hp,maxHp:100,traits:['night_vision']});assert.equal(normal.wounds,extra);assert.equal(normal.hours,8+extra);assert.equal(night.hours,7+extra);}
 assert.equal(sleepNeed({id:109,hp:1,maxHp:100}).hours,12);assert.equal(sleepNeed({id:103,hp:100,maxHp:100,traits:['night_vision','night_vision']}).hours,5);assert.equal(sleepNeed({id:1000,hp:100,maxHp:100}).base,8);
 for(const id of Object.keys(SLEEP_PROFILES))assert.ok(rosterFor(initialCampaign()).some(op=>String(op.id)===id));
});
test('wounds slow an actual sleeping soldier without slowing unchanged healthy baseline recovery',()=>{
 let healthy=initialCampaign();Object.assign(healthy.operativeState[3],{energy:40,fatigue:40});healthy=sleep(healthy,3);let wounded=structuredClone(healthy);Object.assign(wounded.operativeState[3],{hp:23,bandaged:wounded.operativeState[3].maxHp-23});
 healthy=wait(healthy);wounded=wait(wounded);assert.equal(healthy.operativeState[3].energy,52);assert.equal(healthy.operativeState[3].fatigue,32);assert.equal(wounded.operativeState[3].energy,48);assert.equal(wounded.operativeState[3].fatigue,35);assert.equal(wounded.operativeState[3].hp,23);
});
test('rest, patient and sleeping-work roles receive exactly one personal recovery per hour',()=>{
 for(const assignment of ['rest','patient','active'])for(const asleep of [false,true]){
  if(assignment==='active'&&!asleep)continue;
  let s=hire(initialCampaign(),103);Object.assign(s.operativeState[103],{assignment,asleep,energy:40,fatigue:40});
  let n=wait(s);if(n.hour===s.hour){assert.ok(n.assignmentAttention.notice);n=wait(n);}assert.equal(n.hour,s.hour+1);assert.equal(n.operativeState[103].energy,56,`${assignment}/${asleep}`);assert.equal(n.operativeState[103].fatigue,30);assert.equal(n.operativeState[103].hp,s.operativeState[103].hp);
 }
});
test('medical improvement updates the need for sleep on the actual treated hour',()=>{
 let s=initialCampaign(),r=s.operativeState[3];Object.assign(r,{hp:47,bandaged:r.maxHp-47,energy:20,fatigue:50,assignment:'patient'});s.operativeState[10].assignment='doctor';const before=sleepRecovery(person(s,3));assert.equal(before.hours,10);
 s=wait(s);assert.equal(s.operativeState[3].hp,53);assert.equal(sleepRecovery(person(s,3)).hours,9);assert.equal(s.operativeState[3].energy,30);assert.equal(s.operativeState[3].fatigue,43);assert.equal(s.operativeState[10].medkits,1);
});
test('saved personal recovery stops at completion and resumes the same work without an extra productive hour',()=>{
 let s=hire(initialCampaign(),103);s=order(s,{type:'assignWork',operativeId:103,assignment:'practice',skill:'mechanical'});Object.assign(s.operativeState[103],{energy:52,fatigue:30});s=sleep(s,103);
 const loaded=restoreCampaign(serializeCampaign(s)),n=wait(loaded,10);assert.deepEqual(n,wait(s,10));assert.equal(n.hour,3);assert.equal(n.operativeState[103].energy,100);assert.equal(n.operativeState[103].fatigue,0);assert.equal(n.operativeState[103].asleep,false);assert.equal(n.operativeState[103].skillPractice?.mechanical??0,0);assert.equal(n.operativeState[103].trainingCredit,0);assert.ok(n.assignmentAttention.notice.events.some(e=>e.operativeId===103&&e.code==='sleep_complete'));
 const next=wait(n);assert.ok(next.operativeState[103].trainingCredit>0);assert.equal(next.operativeState[103].energy,97);
});
test('personal rates do not award recovery during travel or deployment',()=>{
 let s=hire(initialCampaign(),103);Object.assign(s.operativeState[103],{energy:40,fatigue:40,asleep:true});const before=structuredClone(s.operativeState[103]),roster=rosterFor(s);
 advanceMedicalCare(s,roster,{traveling:[103]});finishSleepHour(s,roster,{traveling:[103]});assert.equal(s.operativeState[103].energy,before.energy);assert.equal(s.operativeState[103].fatigue,before.fatigue);
 s.pendingBattle={squad:[{id:103}],sector:'retiro'};advanceMedicalCare(s,roster);finishSleepHour(s,roster);assert.equal(s.operativeState[103].energy,before.energy);assert.equal(s.operativeState[103].fatigue,before.fatigue);
});
test('status reports the same wound, training and hourly values as the rules',()=>{
 const unit={id:113,hp:24,maxHp:100,traits:['night_vision']},r=sleepRecovery(unit),text=sleepNeedStatus(unit);assert.equal(r.hours,11);assert.match(text,/11 h de referencia/);assert.match(text,/4 por heridas/);assert.match(text,/1 por entrenamiento nocturno/);assert.match(text,/\+8 energía\/h · −5 fatiga\/h/);
});
