import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {prepareGarrison} from '../game/garrison.js';
import {advanceMedicalCare,doctorRate} from '../game/medical-care.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
// Established garrison and starting wounds isolate medical rules, not conquest.
export function militiaPatients(){const s=initialCampaign();s.sectors.retiro.militia=[3,0,0];prepareGarrison(s,'retiro');for(const u of s.garrisons.retiro)Object.assign(u,{hp:30,bleeding:0,bandaged:30,energy:40,fatigue:30,unconscious:false});return s;}
const assign=s=>order(s,{type:'assignCare',operativeId:10,assignment:'militia_doctor'});
test('militia doctor pays for one local patient each hour and preserves equipment and rank',()=>{
 let s=assign(militiaPatients());const before=structuredClone(s.garrisons.retiro),rate=doctorRate(rosterFor(s).find(o=>o.id===10));
 s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[10].medkits,1);assert.equal(s.garrisons.retiro[0].hp,30+rate);
 assert.deepEqual(s.garrisons.retiro.slice(1),before.slice(1));
 for(const key of ['id','militiaRank','weapon','loaded','inventory'])assert.deepEqual(s.garrisons.retiro[0][key],before[0][key]);
 assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);
});
test('militia triage stabilizes bleeding before healing and two doctors cannot duplicate treatment',()=>{
 let s=militiaPatients();Object.assign(s.garrisons.retiro[2],{hp:8,bleeding:8,bandaged:0,energy:0,unconscious:true});s=assign(s);s=order(s,{type:'assignCare',operativeId:4,assignment:'militia_doctor'});
 const before=s.garrisons.retiro.map(u=>u.hp);s=order(s,{type:'wait',hours:1});assert.equal(s.garrisons.retiro[2].hp,8);assert.equal(s.garrisons.retiro[2].bleeding,0);assert.equal(s.garrisons.retiro[2].unconscious,true);
 assert.equal(s.garrisons.retiro.filter((u,i)=>u.hp>before[i]).length,1);assert.equal(s.operativeState[10].medkits,1);assert.equal(s.operativeState[4].medkits,1);
});
test('militia care cannot treat a remote, occupied, deployed or travelling group',()=>{
 for(const kind of ['remote','occupied','deployed','traveling','unsafe']){
  const s=assign(militiaPatients());const before=structuredClone(s.garrisons.retiro),kits=s.operativeState[10].medkits;
  if(kind==='remote'){s.squads[0].members=s.squads[0].members.filter(id=>id!==10);s.operativeState[10].location='ensenada';}
  if(kind==='occupied')s.sectors.retiro.owner='royalist';
  if(kind==='deployed')s.pendingBattle={sector:'retiro',squad:[],garrison:structuredClone(before)};
  advanceMedicalCare(s,rosterFor(s),kind==='traveling'?{traveling:[10]}:kind==='unsafe'?{unsafe:[10]}:{});
  assert.deepEqual(s.garrisons.retiro,before,kind);assert.equal(s.operativeState[10].medkits,kits,kind);
 }
});
test('treatment survives save continuation and is present on the next real deployment',()=>{
 let s=order(militiaPatients(),{type:'visitSector'});const field=enterSector(s.pendingBattle);
 s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:field,survivors:field.units.filter(u=>u.side==='player')});
 s=assign(s);s=order(s,{type:'wait',hours:1});const saved=decodeSave(encodeSave(s)).campaign;
 const next=order(s,{type:'wait',hours:1}),replay=order(saved,{type:'wait',hours:1});assert.deepEqual(next,replay);
 s=order(next,{type:'assignCare',operativeId:10,assignment:'active'});s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle,s.sectorStates.retiro);
 for(const u of next.garrisons.retiro)assert.equal(b.units.find(v=>v.id===String(u.id)).hp,u.hp);
});
test('finished or empty militia care stops without spending supplies and saves its notice',()=>{
 let s=militiaPatients();for(const u of s.garrisons.retiro)Object.assign(u,{hp:u.maxHp,bandaged:0});s=assign(s);
 s=order(s,{type:'wait',hours:1});assert.equal(s.hour,0);assert.equal(s.operativeState[10].medkits,2);
 assert.ok(s.assignmentAttention.notice.events.some(e=>e.assignment==='militia_doctor'&&e.code==='no_militia_patients'));
 assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);
});
test('supply exhaustion interrupts a long wait, survives a save and resumes after paid resupply',()=>{
 let s=assign(militiaPatients());s.operativeState[10].medkits=1;
 s=order(s,{type:'wait',hours:6});assert.equal(s.hour,1);assert.equal(s.operativeState[10].medkits,0);
 assert.ok(s.assignmentAttention.notice.events.some(e=>e.assignment==='militia_doctor'&&e.code==='no_medkits'));
 s=decodeSave(encodeSave(s)).campaign;const before=structuredClone(s.garrisons.retiro);
 s=order(s,{type:'wait',hours:1});assert.deepEqual(s.garrisons.retiro,before);assert.equal(s.operativeState[10].medkits,0);
 const money=s.resources.treasury;s=order(s,{type:'purchaseMedicalSupplies',operativeId:10,quantity:1});assert.equal(s.resources.treasury,money-30);
 s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[10].medkits,0);assert.ok(s.garrisons.retiro.some((u,i)=>u.hp>before[i].hp));
 assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);
});
test('sleep suspends militia treatment and retains the job for waking',()=>{
 let s=assign(militiaPatients());s.operativeState[10].energy=50;
 s=order(s,{type:'setSleep',operativeId:10,asleep:true});const before=structuredClone(s.garrisons.retiro);
 s=order(s,{type:'wait',hours:1});assert.deepEqual(s.garrisons.retiro,before);assert.equal(s.operativeState[10].medkits,2);
 s=decodeSave(encodeSave(s)).campaign;s=order(s,{type:'setSleep',operativeId:10,asleep:false});
 assert.equal(s.operativeState[10].assignment,'militia_doctor');s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[10].medkits,1);
 assert.ok(s.garrisons.retiro.some((u,i)=>u.hp>before[i].hp));
});
test('trainees remain in their course until cancellation makes them available for treatment',()=>{
 let s=order(militiaPatients(),{type:'militia',rank:1,trainerId:4});const trainees=structuredClone(s.militiaTraining[0].trainees);
 s=assign(s);s=order(s,{type:'wait',hours:1});assert.equal(s.hour,0);assert.equal(s.operativeState[10].medkits,2);assert.deepEqual(s.militiaTraining[0].trainees,trainees);
 s=decodeSave(encodeSave(s)).campaign;s=order(s,{type:'cancelMilitia',sector:'retiro'});s=order(s,{type:'wait',hours:1});
 assert.equal(s.operativeState[10].medkits,1);assert.equal(s.garrisons.retiro.length,3);assert.ok(s.garrisons.retiro.some((u,i)=>u.hp>trainees[i].hp));
 assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);
});
