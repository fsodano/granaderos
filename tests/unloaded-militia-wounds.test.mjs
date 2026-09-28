import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign} from '../game/campaign.js';
import {DEFAULT_CARE_RULES} from '../game/campaign-care-rules.js';
import {militiaWoundLoss,militiaCarePatients} from '../game/garrison.js';
import {getReachable,actBattle} from '../game/tactical.js';
import {weaponSpecification} from '../game/weapon-definition.js';
import {order,saved,visit,leave,tactical} from './local-contract-fixture.mjs';
import {woundedGarrison,MILITIA_DOCTOR as D} from './militia-care-fixture.mjs';
const save=s=>saved({campaign:s}).campaign;
const patient=(s,id)=>s.garrisons.retiro.find(u=>u.id===id);
const body=(s,id)=>s.sectorStates.retiro.units.find(u=>Number(u.id)===id);
const rules=percent=>({...DEFAULT_CARE_RULES,bleedingDamagePercent:percent});

test('a real retained militia wound consumes authored hourly health equally through batched waits and saves',()=>{
 for(const percent of [0,25,50,100]){
  let {campaign:s,patientId:id}=woundedGarrison({careRules:rules(percent)});const before=structuredClone(patient(s,id)),loss=militiaWoundLoss(s,before);assert.equal(loss,Math.ceil(before.bleeding*percent/100));const batch=order(s,{type:'wait',hours:3});
  for(let i=0;i<3;i++)s=order(save(s),{type:'wait',hours:1});assert.deepEqual(patient(s,id),patient(batch,id));assert.equal(patient(s,id).hp,before.hp-3*loss);assert.equal(patient(s,id).bleeding,before.bleeding);assert.equal(patient(s,id).ammo,before.ammo);assert.deepEqual(s.sectors.retiro.militia,[3,0,0]);assert.ok(save(s));
 }
});

test('a strategic militia death leaves one actual corpse, finite recoverable equipment and no replacement on saved reentry',()=>{
 let {campaign:s,patientId:id}=woundedGarrison({passage:true});const before=structuredClone(patient(s,id)),position=structuredClone(body(s,id)),at=s.hour,deathHours=Math.ceil(before.hp/militiaWoundLoss(s,before));
 s=order(s,{type:'wait',hours:deathHours});assert.equal(patient(s,id),undefined);assert.deepEqual(s.sectors.retiro.militia,[2,0,0]);const corpse=body(s,id);assert.equal(corpse.hp,0);assert.equal(corpse.bleeding,0);assert.equal(corpse.energy,0);assert.equal(corpse.unconscious,false);assert.equal(corpse.ap,0);assert.equal(corpse.deathMinute,(at+deathHours)*60+Math.floor((s.secondOfHour??0)/60));assert.deepEqual([corpse.x,corpse.y],[position.x,position.y]);
 for(const key of ['weapon','blade','loaded','ammo','condition','inventory','priming','medkits'])assert.deepEqual(corpse[key],before[key],key);assert.equal(s.log.filter(e=>e.text.includes('fallece por sus heridas en')).length,1);s=order(save(s),{type:'wait',hours:2});assert.equal(s.log.filter(e=>e.text.includes('fallece por sus heridas en')).length,1);assert.ok(!militiaCarePatients(s,'retiro').some(u=>u.id===id));
 let p=visit(s);const dead=p.battle.units.find(u=>Number(u.id)===id),actor=p.battle.units.find(u=>Number(u.id)===1000);assert.equal(dead.hp,0);const spot=getReachable(p.battle,actor).filter(t=>Math.hypot(t.x-dead.x,t.y-dead.y)<=1.5).sort((a,b)=>a.cost-b.cost)[0];assert.ok(spot);if(spot.cost)p=tactical(p,{type:'move',unitId:actor.id,x:spot.x,y:spot.y});
 const ammo=dead.ammo;assert.ok(ammo>0);p=tactical(p,{type:'loot',unitId:actor.id,targetId:dead.id,item:'ammo'});assert.equal(p.battle.units.find(u=>u.id===dead.id).ammo,0);p=tactical(p,{type:'loot',unitId:actor.id,targetId:dead.id,item:'weapon'});const item=Object.values(p.battle.units.find(u=>u.id===actor.id).inventory).find(u=>u.weapon===dead.weapon);assert.ok(item);assert.deepEqual(weaponSpecification(item),weaponSpecification(dead));const cash=p.campaign.resources.treasury,issued=p.campaign.pendingBattle.issuedCartridges;
 s=save(leave(p));assert.equal(s.resources.treasury,cash+issued+ammo);p=visit(s);assert.equal(p.battle.units.find(u=>u.id===dead.id).ammo,0);assert.equal(p.battle.units.find(u=>u.id===dead.id).weaponDropped,true);assert.ok(actBattle(p.battle,{type:'loot',unitId:actor.id,targetId:dead.id,item:'weapon'}).lastError);s=save(leave(p));assert.equal(s.resources.treasury,cash+issued+ammo);assert.deepEqual(s.sectors.retiro.militia,[2,0,0]);
 const next=s.nextMilitiaId;s=order(s,{type:'militia',rank:0,trainerId:1000});s=order(s,{type:'wait',hours:s.militiaTraining[0].remaining});p=visit(save(s));assert.equal(p.battle.units.filter(u=>u.militia&&u.hp>0).length,5);assert.equal(p.battle.units.filter(u=>Number(u.id)===id).length,1);assert.equal(p.battle.units.find(u=>Number(u.id)===id).hp,0);assert.ok(p.campaign.pendingBattle.garrison.filter(u=>u.id>=next).length===3);assert.ok(saved(p));
});

test('local finite treatment precedes the wound clock and permits a stable paid promotion without a free heal',()=>{
 let {campaign:s,patientId:id}=woundedGarrison({careRules:rules(100)});const hp=patient(s,id).hp,stock=s.operativeState[D].medkits;s=order(s,{type:'assignCare',id:D,assignment:'militia_doctor'});s=order(s,{type:'wait',hours:1});assert.equal(patient(s,id).hp,hp);assert.equal(patient(s,id).bleeding,0);assert.equal(s.operativeState[D].medkits,stock-1);assert.match(dispatchCampaign(s,{type:'militia',rank:1,trainerId:1000}).lastError,/estables/);
 s=order(s,{type:'wait',hours:1});assert.equal(patient(s,id).hp,hp+6);assert.equal(s.operativeState[D].medkits,0);s=order(s,{type:'militia',rank:1,trainerId:1000});s=order(save(s),{type:'wait',hours:s.militiaTraining[0].remaining});assert.equal(patient(s,id).hp,hp+6);assert.equal(patient(s,id).militiaRank,1);assert.equal(patient(s,id).bleeding,0);assert.ok(save(s));
});

test('an untreated garrison keeps bleeding while its squad travels or another sector consumes tactical hours',()=>{
 let {campaign:s,patientId:id}=woundedGarrison();const before=structuredClone(patient(s,id)),at=s.hour,loss=militiaWoundLoss(s,before);s=order(s,{type:'travel',sector:'buenos_aires'});const hours=s.hour-at;
 assert.ok(hours>0&&hours<Math.ceil(before.hp/loss));assert.equal(patient(s,id).hp,before.hp-hours*loss);assert.equal(s.location,'buenos_aires');assert.ok(save(s));
 const hp=patient(s,id).hp;let p=visit(s),start=p.campaign.hour;while(patient(p.campaign,id))p=tactical(p,{type:'rest',seconds:600});assert.equal(p.campaign.hour,start+Math.ceil(hp/loss));assert.equal(body(p.campaign,id).deathMinute,(at+Math.ceil(before.hp/loss))*60+Math.floor((p.campaign.secondOfHour??0)/60));assert.ok(saved(p));
});

test('a loaded garrison is damaged only by tactical time and its actual casualty return',()=>{
 let {campaign:s,patientId:id}=woundedGarrison({careRules:rules(100)});const hp=patient(s,id).hp;let p=visit(s),start=p.campaign.hour;while(p.campaign.hour===start)p=tactical(p,{type:'rest',seconds:600});assert.equal(patient(p.campaign,id).hp,hp);assert.equal(p.battle.units.find(u=>Number(u.id)===id).hp,0);assert.equal(p.campaign.log.filter(e=>e.text.includes('fallece por sus heridas en')).length,0);s=save(leave(p));assert.equal(patient(s,id),undefined);assert.deepEqual(s.sectors.retiro.militia,[2,0,0]);s=order(s,{type:'wait',hours:2});assert.deepEqual(s.sectors.retiro.militia,[2,0,0]);assert.equal(s.log.filter(e=>e.text.includes('fallece por sus heridas en')).length,0);assert.ok(save(s));
});

test('older wounded records without a retained scene lose one soldier without inventing a body position',()=>{
 let {campaign:s,patientId:id}=woundedGarrison();delete s.sectorStates.retiro;s=save(s);const hp=patient(s,id).hp;s=order(s,{type:'wait',hours:hp});assert.equal(patient(s,id),undefined);assert.equal(s.sectorStates.retiro,undefined);assert.deepEqual(s.sectors.retiro.militia,[2,0,0]);s=save(s);const p=visit(s);assert.ok(!p.battle.units.some(u=>Number(u.id)===id));assert.equal(p.campaign.pendingBattle.garrison.length,2);assert.ok(saved(p));
});
