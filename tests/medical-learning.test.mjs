import test from 'node:test';
import assert from 'node:assert/strict';
import {rosterFor} from '../game/campaign.js';
import {order,saved} from './local-contract-fixture.mjs';
import {preparedCare,assignedCare,DOCTOR,PATIENT} from './medical-care-fixture.mjs';
import {woundedGarrison,MILITIA_DOCTOR} from './militia-care-fixture.mjs';

const medicine=(s,id)=>rosterFor(s).find(op=>op.id===id).medical;
const credited=s=>{s.operativeState[DOCTOR].practiceSeed=0;s.operativeState[DOCTOR].skillPractice={medical:39};return saved({campaign:s}).campaign;};

test('actual doctor treatment uses Wisdom-dependent learning without extra healing, supplies or campaign randomness',()=>{
 const run=wisdom=>{
  const before=credited(assignedCare({doctorWisdom:wisdom}));
  const after=order(before,{type:'wait',hours:1});
  assert.equal(after.operativeState[PATIENT].hp,before.operativeState[PATIENT].hp);
  assert.equal(after.operativeState[PATIENT].bleeding,0);
  assert.equal(after.operativeState[DOCTOR].medkits,before.operativeState[DOCTOR].medkits-1);
  assert.deepEqual(saved({campaign:after}).campaign,after);
  return after;
 };
 const quick=run(100),slow=run(10);
 assert.equal(medicine(quick,DOCTOR),81);assert.equal(medicine(slow,DOCTOR),80);
 assert.equal(quick.operativeState[DOCTOR].skillPractice.medical,0);
 assert.equal(slow.operativeState[DOCTOR].skillPractice.medical,39);
 assert.equal(quick.operativeState[DOCTOR].practiceSeed,slow.operativeState[DOCTOR].practiceSeed);
 assert.equal(quick.seed,slow.seed);
});

test('medical skill35 can learn from care while34 can still treat without gaining practice',()=>{
 for(const value of [34,35]){
  const before=credited(assignedCare({doctorMedical:value,doctorWisdom:100}));
  const after=order(before,{type:'wait',hours:1});
  assert.equal(after.operativeState[PATIENT].bleeding,0);
  assert.equal(after.operativeState[DOCTOR].medkits,before.operativeState[DOCTOR].medkits-1);
  assert.equal(medicine(after,DOCTOR),value===35?36:34);
  if(value===34){assert.equal(after.operativeState[DOCTOR].practiceSeed,0);assert.deepEqual(after.operativeState[DOCTOR].skillPractice,before.operativeState[DOCTOR].skillPractice);}
 }
});

test('a doctor gains no practice for waiting without an assigned patient or finite dressings',()=>{
 let idle=credited(preparedCare({doctorWisdom:100}));idle=order(idle,{type:'assignCare',id:DOCTOR,assignment:'doctor'});
 const before=structuredClone(idle.operativeState[DOCTOR]);idle=order(idle,{type:'wait',hours:1});
 assert.equal(idle.operativeState[DOCTOR].practiceSeed,before.practiceSeed);
 assert.deepEqual(idle.operativeState[DOCTOR].skillPractice,before.skillPractice);
 assert.equal(idle.operativeState[DOCTOR].medkits,before.medkits);
 let empty=credited(assignedCare({doctorWisdom:100}));empty.operativeState[DOCTOR].medkits=0;empty=saved({campaign:empty}).campaign;
 const waiting=order(empty,{type:'wait',hours:1});assert.equal(waiting.operativeState[DOCTOR].practiceSeed,0);
 assert.deepEqual(waiting.operativeState[DOCTOR].skillPractice,empty.operativeState[DOCTOR].skillPractice);
});

test('real militia treatment earns a medical chance and keeps the same patient and finite cost',()=>{
 let {campaign:s,patientId}=woundedGarrison();const before=medicine(s,MILITIA_DOCTOR);
 s.operativeState[MILITIA_DOCTOR].practiceSeed=1972;s.operativeState[MILITIA_DOCTOR].skillPractice={medical:39};
 s=order(saved({campaign:s}).campaign,{type:'assignCare',id:MILITIA_DOCTOR,assignment:'militia_doctor'});
 const dressings=s.operativeState[MILITIA_DOCTOR].medkits,hp=s.garrisons.retiro.find(u=>u.id===patientId).hp;
 s=order(s,{type:'wait',hours:1});
 assert.equal(medicine(s,MILITIA_DOCTOR),before+1);
 assert.equal(s.operativeState[MILITIA_DOCTOR].medkits,dressings-1);
 assert.equal(s.garrisons.retiro.find(u=>u.id===patientId).hp,hp);
 assert.equal(s.garrisons.retiro.find(u=>u.id===patientId).bleeding,0);
 assert.deepEqual(saved({campaign:s}).campaign,s);
});
