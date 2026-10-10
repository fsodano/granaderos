import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {actBattle,actionCosts,getReachable,hasLineOfSight,interruptAvailable,teamCanSee} from '../game/tactical.js';
import {sameCell,sameSurface} from '../game/tactical-space.js';
import {criticalFirstAidNeeded,firstAidPlan} from '../game/first-aid.js';
import {localSanLorenzoOrder} from './local-san-lorenzo-driver.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const compressed=readFileSync(new URL('./fixtures/san-lorenzo-earned-critical-ally-rescue.battle.json.gz',import.meta.url));
const proof=JSON.parse(readFileSync(new URL('./fixtures/san-lorenzo-earned-critical-ally-rescue.provenance.json',import.meta.url)));
const raw=gunzipSync(compressed);
assert.equal(hash(compressed),proof.compressedSha256);assert.equal(hash(raw),proof.rawSha256);
const earned=JSON.parse(raw),state=name=>earned.states.find(row=>row.name===name);
const actor=(battle,id)=>battle.units.find(unit=>unit.id===id);
const supplies=unit=>Object.fromEntries(['loaded','ammo','inventory','weapon','condition','medkits'].map(key=>[key,unit[key]]));
const publicView=(battle,unit)=>({...battle,units:battle.units.filter(other=>other.side===unit.side||teamCanSee(battle,unit.side,other)),npcs:(battle.npcs??[]).filter(other=>teamCanSee(battle,unit.side,other))});
const clock=(before,after)=>{
 assert.equal(before.mode,'combat');assert.equal(before.roundTimeCharged,true);
 assert.equal(after.turn,before.turn);assert.equal(after.elapsedSeconds,before.elapsedSeconds);
};

// The witness is one exact replay of the original 166 combat and six
// postcombat orders, including campaign synchronization and both save points.
// This control branches only for three paid rescue orders; it stops there.
test('an earned medic reserves movement and treatment AP before offense to rescue the critical mission ally',()=>{
 const row=state('critical-before-reload'),input=row.battle,before=structuredClone(input);
 let battle=input,medic=actor(battle,'137'),patient=actor(battle,'57');
 assert.deepEqual(row.baselineOrder,{type:'reload',unitId:'137'});
 assert.deepEqual([battle.turn,battle.phase,battle.elapsedSeconds,patient.hp,patient.bleeding,medic.ap,medic.medkits],[6,'interrupt',51,5,2,100,1]);
 assert.equal(patient.unconscious,true);assert.equal(interruptAvailable(battle,medic),true);
 assert.equal(actor(battle,'110').hp,0,'the earned infantry death remains real');
 const move=localSanLorenzoOrder(battle,medic,{avoidCivilians:true});
 assert.deepEqual(move,{type:'move',x:49,y:41,tacticalLevel:0,unitId:'137'});
 const route=getReachable(publicView(battle,medic),medic).find(point=>sameCell(point,move));
 assert.ok(route?.path.length&&route.cost>0&&route.cost<=32);
 assert.ok(sameSurface(route,patient));assert.ok(Math.hypot(route.x-patient.x,route.y-patient.y)<=1.5);assert.ok(hasLineOfSight(battle,route,patient));
 const costs=actionCosts(battle,medic),reserved=firstAidPlan(medic,patient,{baseCost:costs.heal,budgetAP:medic.ap-route.cost-costs.weapon});
 assert.equal(reserved.valid,true);assert.ok(route.cost+costs.weapon+reserved.paCost<=medic.ap);
 const approached=actBattle(battle,move),arrived=actor(approached,'137');
 assert.equal(approached.lastError,null);assert.ok(sameCell(arrived,move));assert.equal(arrived.ap,medic.ap-route.cost);
 assert.deepEqual(supplies(arrived),supplies(medic));assert.equal(actor(approached,'57').hp,patient.hp);clock(battle,approached);
 battle=approached;medic=arrived;
 const prepare=localSanLorenzoOrder(battle,medic,{avoidCivilians:true});assert.deepEqual(prepare,{type:'weapon',slot:'medical',unitId:'137'});
 const prepared=actBattle(battle,prepare),ready=actor(prepared,'137');
 assert.equal(prepared.lastError,null);assert.equal(ready.ap,medic.ap-actionCosts(battle,medic).weapon);assert.deepEqual(supplies(ready),supplies(medic));clock(battle,prepared);
 const heal=localSanLorenzoOrder(prepared,ready,{avoidCivilians:true});assert.deepEqual(heal,{type:'heal',targetId:'57',unitId:'137'});
 const plan=firstAidPlan(ready,actor(prepared,'57'),{baseCost:actionCosts(prepared,ready).heal,budgetAP:ready.ap});assert.equal(plan.valid,true);
 const treated=actBattle(prepared,heal),afterDoctor=actor(treated,'137'),afterPatient=actor(treated,'57');
 assert.equal(treated.lastError,null);assert.equal(plan.dressingsUsed,1);assert.equal(afterDoctor.medkits,0);assert.equal(afterDoctor.ap,ready.ap-plan.paCost);
 assert.equal(afterPatient.hp,plan.hpAfter);assert.equal(afterPatient.bleeding,plan.bleedingAfter);assert.deepEqual([afterPatient.hp,afterPatient.bleeding,afterDoctor.ap],[11,0,61]);
 assert.equal(plan.partial,true);assert.equal(criticalFirstAidNeeded(afterPatient),true,'one finite dressing cannot promise complete recovery');
 assert.deepEqual({...supplies(afterDoctor),medkits:ready.medkits},supplies(ready));clock(prepared,treated);assert.equal(actor(treated,'110').hp,0);
 const exhausted=localSanLorenzoOrder(treated,afterDoctor,{avoidCivilians:true});assert.ok(!['heal','useItem'].includes(exhausted?.type));assert.notEqual(exhausted?.slot,'medical');
 assert.deepEqual(input,before,'selection and native continuation leave the earned input unchanged');
});

test('the earned zero-AP medic cannot move, prepare or spend his remaining dressing',()=>{
 const battle=state('critical-zero-AP').battle,before=structuredClone(battle),medic=actor(battle,'137'),patient=actor(battle,'57');
 assert.deepEqual([medic.ap,medic.medkits,patient.hp,patient.bleeding],[0,1,7,2]);
 assert.equal(localSanLorenzoOrder(battle,medic,{avoidCivilians:true}),null);assert.deepEqual(battle,before);
});

test('the earned healthy mission ally keeps his original formation decision',()=>{
 const row=state('healthy-initial'),battle=row.battle,before=structuredClone(battle),commander=actor(battle,'57');
 assert.deepEqual([commander.hp,commander.bleeding],[88,0]);
 assert.deepEqual(localSanLorenzoOrder(battle,commander,{avoidCivilians:true}),row.baselineOrder);assert.deepEqual(battle,before);
});

test('the original postcombat death remains an invalid rescue target',()=>{
 const row=state('original-postcombat-death'),battle=row.battle,before=structuredClone(battle),commander=actor(battle,'57'),medic=actor(battle,'137');
 assert.equal(row.firstDeathAfterOriginalOrder,169);assert.equal(commander.hp,0);assert.equal(criticalFirstAidNeeded(commander),false);
 const order=localSanLorenzoOrder(battle,medic,{avoidCivilians:true});assert.ok(!(['heal','useItem'].includes(order?.type)&&order.targetId===commander.id));assert.deepEqual(battle,before);
});
