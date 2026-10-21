import test from 'node:test';
import assert from 'node:assert/strict';
import {rosterFor} from '../game/campaign.js';
import {synchronizeCampaignPresence} from '../game/campaign-presence.js';
import {advanceMedicalCare,doctorRate} from '../game/medical-care.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {getReachable} from '../game/tactical.js';
import {preparedCare,DOCTOR,PATIENT} from './medical-care-fixture.mjs';
import {order,saved,visit,leave,tactical} from './local-contract-fixture.mjs';

const record=s=>s.operativeState[PATIENT];
const inventory=s=>sectorInventoryModel(s,'retiro',rosterFor(s),PATIENT);
function wounded({hp=14,energy=100}={}){
 const s=preparedCare(),r=record(s);
 // Declared critical wounds reproduce the valid derived flag held by a
 // rescued prisoner; recovery below must use paid treatment or ordinary rest.
 Object.assign(r,{hp,energy,bleeding:0,bandaged:r.maxHp-hp,unconscious:hp<15||energy<=0});
 synchronizeCampaignPresence(s);
 return saved({campaign:s}).campaign;
}

test('paid tactical stabilization returns a conscious operative who can collect equipment after saving',()=>{
 let p=visit(wounded()),doctor=p.battle.units.find(u=>u.id===String(DOCTOR)),patient=p.battle.units.find(u=>u.id===String(PATIENT));
 assert.equal(patient.hp,14);assert.equal(patient.unconscious,true);
 const spot=getReachable(p.battle,doctor).find(point=>Math.hypot(point.x-patient.x,point.y-patient.y)<=1.5);
 assert.ok(spot);
 if(spot.cost)p=tactical(p,{type:'move',unitId:doctor.id,x:spot.x,y:spot.y});
 p=tactical(p,{type:'weapon',unitId:doctor.id,slot:'medical'});
 const dressings=p.battle.units.find(u=>u.id===doctor.id).medkits;
 p=tactical(p,{type:'heal',unitId:doctor.id,targetId:patient.id});
 patient=p.battle.units.find(u=>u.id===patient.id);
 assert.equal(patient.hp,15);assert.equal(patient.unconscious,false);
 assert.equal(p.battle.units.find(u=>u.id===doctor.id).medkits,dressings-1);
 let s=leave(p);
 assert.equal(record(s).hp,15);assert.equal(record(s).energy,patient.energy);assert.equal(record(s).unconscious,false);
 s=saved({campaign:s}).campaign;
 assert.equal(inventory(s).carriedReason,null);assert.equal(inventory(s).reason,null);
 const rations=record(s).rations,keys=new Set(inventory(s).entries.map(row=>row.key));
 s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:PATIENT,direction:'drop',item:'rations',count:1});
 assert.equal(record(s).rations,rations-1);
 const row=inventory(s).entries.find(row=>!keys.has(row.key)&&JSON.parse(row.expected).item==='rations');
 assert.ok(row?.reachable);
 s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:PATIENT,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
 assert.equal(record(s).rations,rations);assert.equal(record(s).hp,15);assert.equal(record(s).unconscious,false);
 assert.deepEqual(saved({campaign:s}).campaign,s);
});

test('a strategic doctor clears the critical flag only after finite treatment crosses fifteen health',()=>{
 let s=wounded({hp:8});
 s=order(s,{type:'assignCare',id:DOCTOR,assignment:'doctor'});s=order(s,{type:'assignCare',id:PATIENT,assignment:'patient'});
 const rate=doctorRate(rosterFor(s).find(op=>op.id===DOCTOR),s),dressings=s.operativeState[DOCTOR].medkits;
 assert.equal(rate,6);
 s=order(s,{type:'wait',hours:1});assert.equal(record(s).hp,14);assert.equal(record(s).unconscious,true);assert.equal(s.operativeState[DOCTOR].medkits,dressings-1);
 s=order(saved({campaign:s}).campaign,{type:'wait',hours:1});
 assert.equal(record(s).hp,20);assert.equal(record(s).unconscious,false);assert.equal(s.operativeState[DOCTOR].medkits,dressings-2);
 assert.equal(inventory(s).carriedReason,null);assert.deepEqual(saved({campaign:s}).campaign,s);
});

test('ordinary rest clears exhaustion without healing a critical operative or changing paid supplies',()=>{
 for(const hp of [14,18]){
  const s=wounded({hp,energy:0});record(s).assignment='rest';
  const before=structuredClone(s),stock=s.operativeState[DOCTOR].medkits;
  advanceMedicalCare(s,rosterFor(s));
  assert.ok(record(s).energy>0);assert.equal(record(s).hp,hp);assert.equal(record(s).unconscious,hp<15);
  assert.equal(s.operativeState[DOCTOR].medkits,stock);assert.deepEqual(s.resources,before.resources);assert.equal(s.hour,before.hour);
 }
});

test('older saved unconscious flags follow health and breath without changing wounds, time or equipment',()=>{
 for(const {hp,energy,unconscious}of [{hp:18,energy:100,unconscious:false},{hp:14,energy:100,unconscious:true},{hp:18,energy:0,unconscious:true}]){
  const s=wounded({hp,energy});record(s).unconscious=true;
  const before=structuredClone(s),restored=saved({campaign:s}).campaign;
  assert.equal(record(restored).unconscious,unconscious);
  record(before).unconscious=unconscious;
  assert.deepEqual(restored,before);assert.equal(record(s).unconscious,true);
 }
});
