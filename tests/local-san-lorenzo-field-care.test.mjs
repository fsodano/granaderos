import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {actBattle,actionCosts,getReachable,teamCanSee,hasLineOfSight,interruptAvailable,stanceCost} from '../game/tactical.js';
import {sameCell,sameSurface} from '../game/tactical-space.js';
import {firstAidPlan} from '../game/first-aid.js';
import {localSanLorenzoOrder} from './local-san-lorenzo-driver.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const compressed=readFileSync(new URL('./fixtures/san-lorenzo-earned-wounded-commander.battle.json.gz',import.meta.url));
const proof=JSON.parse(readFileSync(new URL('./fixtures/san-lorenzo-earned-wounded-commander.provenance.json',import.meta.url)));
const raw=gunzipSync(compressed);
assert.equal(hash(compressed),proof.compressedSha256);assert.equal(hash(raw),proof.rawSha256);
const earned=JSON.parse(raw),state=order=>earned.states.find(row=>row.beforeOriginalOrder===order);
const actor=(battle,id)=>battle.units.find(unit=>unit.id===id);
const equipment=unit=>Object.fromEntries(['loaded','ammo','inventory','weapon','condition','medkits'].map(key=>[key,unit[key]]));
const publicView=(battle,unit)=>({...battle,units:battle.units.filter(other=>other.side===unit.side||teamCanSee(battle,unit.side,other)),npcs:battle.npcs.filter(other=>teamCanSee(battle,unit.side,other))});
const chargedClock=(before,after)=>{
 assert.equal(before.mode,'combat');assert.equal(before.roundTimeCharged,true);
 assert.equal(after.turn,before.turn);assert.equal(after.roundTimeCharged,true);
 assert.equal(after.elapsedSeconds,before.elapsedSeconds,'ordinary orders retain the already charged six-second combat round');
};

// Fixed original prefixes supply every wound, position, dressing, AP and seed.
// The original terminal defeat is retained. These controls apply only bounded
// paid care/defensive orders; no route, full fight or campaign settlement runs.
test('an earned wounded commander approaches a real field medic and receives one paid finite dressing',()=>{
 const row=state(25),battle=row.battle,before=structuredClone(battle),commander=actor(battle,'57');
 assert.equal(row.baselineOrder,null,'the bound prior controller admitted no commander order');
 assert.deepEqual([battle.turn,battle.phase,commander.hp,commander.bleeding,commander.medkits],[2,'interrupt',33,4,0]);
 assert.equal(interruptAvailable(battle,commander),true);
 const move=localSanLorenzoOrder(battle,commander,{avoidCivilians:true});assert.equal(move?.type,'move');
 const route=getReachable(publicView(battle,commander),commander).find(point=>sameCell(point,move));
 assert.ok(route?.path.length);assert.ok(route.cost<=Math.min(32,commander.ap-20));
 const approached=actBattle(battle,move),patient=actor(approached,'57'),medic=actor(approached,'113');
 assert.equal(approached.lastError,null);assert.equal(patient.ap,commander.ap-route.cost);
 chargedClock(battle,approached);assert.deepEqual(equipment(patient),equipment(commander));
 assert.ok(patient.hp>0);assert.ok(sameSurface(patient,medic));assert.ok(Math.hypot(patient.x-medic.x,patient.y-medic.y)<=1.5);
 assert.ok(hasLineOfSight(approached,medic,patient));assert.equal(interruptAvailable(approached,medic),true);
 const prepare=localSanLorenzoOrder(approached,medic,{avoidCivilians:true});
 assert.deepEqual(prepare,{type:'weapon',slot:'medical',unitId:medic.id});
 const prepared=actBattle(approached,prepare),ready=actor(prepared,medic.id),wounded=actor(prepared,patient.id);
 assert.equal(prepared.lastError,null);assert.equal(ready.ap,medic.ap-actionCosts(approached,medic).weapon);
 assert.equal(ready.medkits,medic.medkits);chargedClock(approached,prepared);
 const heal=localSanLorenzoOrder(prepared,ready,{avoidCivilians:true});
 assert.deepEqual(heal,{type:'heal',targetId:patient.id,unitId:medic.id});
 const plan=firstAidPlan(ready,wounded,{baseCost:actionCosts(prepared,ready).heal,budgetAP:ready.ap});assert.equal(plan.valid,true);
 const treated=actBattle(prepared,heal),doctorAfter=actor(treated,medic.id),patientAfter=actor(treated,patient.id);
 assert.equal(treated.lastError,null);assert.equal(doctorAfter.medkits,ready.medkits-plan.dressingsUsed);
 assert.equal(plan.dressingsUsed,1);assert.equal(patientAfter.hp,plan.hpAfter);assert.equal(patientAfter.bleeding,plan.bleedingAfter);
 assert.equal(patientAfter.bleeding,0);assert.equal(doctorAfter.ap,ready.ap-plan.paCost);chargedClock(prepared,treated);
 assert.deepEqual({...equipment(doctorAfter),medkits:ready.medkits},equipment(ready));
 assert.deepEqual(battle,before,'selection and native continuation cannot mutate the earned input');
});

test('the earned player-turn wound admits a paid defensive order after the former supported-ally return',()=>{
 const row=state(41),battle=row.battle,before=structuredClone(battle),unit=actor(battle,'57');
 assert.equal(row.baselineOrder,null);assert.deepEqual([battle.turn,battle.phase,unit.hp,unit.bleeding],[2,'player',33,4]);
 const action=localSanLorenzoOrder(battle,unit,{avoidCivilians:true});assert.ok(['move','stance'].includes(action?.type));
 const cost=action.type==='move'?getReachable(publicView(battle,unit),unit).find(point=>sameCell(point,action))?.cost:stanceCost(unit,action.stance);
 assert.ok(Number.isFinite(cost)&&cost>0&&cost<=unit.ap);
 if(action.type==='stance')assert.equal(action.stance,'prone');
 const next=actBattle(battle,action),after=actor(next,unit.id);assert.equal(next.lastError,null);
 assert.equal(after.ap,unit.ap-cost);chargedClock(battle,next);assert.deepEqual(equipment(after),equipment(unit));
 assert.deepEqual(battle,before);
});

test('the earned adjacent medic with no remaining AP cannot spend or prepare a dressing',()=>{
 const row=state(97),battle=row.battle,before=structuredClone(battle),medic=actor(battle,'113'),patient=actor(battle,'110');
 assert.deepEqual([battle.turn,battle.phase,medic.ap,medic.medkits,patient.bleeding],[4,'player',0,1,3]);
 assert.ok(sameSurface(medic,patient));assert.ok(Math.hypot(medic.x-patient.x,medic.y-patient.y)<=1.5);assert.ok(hasLineOfSight(battle,medic,patient));
 assert.equal(localSanLorenzoOrder(battle,medic,{avoidCivilians:true}),null);assert.deepEqual(battle,before);
});
