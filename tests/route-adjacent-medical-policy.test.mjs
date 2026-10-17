import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,actionCosts,itemUsePreview,medicalUsePreview,hasLineOfSight} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {criticalFirstAidNeeded} from '../game/first-aid.js';
import {medicalPatientAvailable} from '../game/medical-patient.js';
import {sameSurface} from '../game/tactical-space.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {combatOrder,openingControlWindow} from './opening-driver.mjs';

const unit=(b,id)=>b.units.find(u=>u.id===id),doctor=b=>unit(b,'doctor'),patient=b=>unit(b,'patient');
function field({person={},medic={}}={}){
 const width=16,height=8,tiles=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:i%width===8?'wall':'grass',blocked:i%width===8,blocksSight:i%width===8,cover:0,...(i%width===8?{material:'stone'}:{})}));
 return createBattle([
  {id:'doctor',name:'Médico',x:1,y:2,facing:2,maxHp:100,hp:100,agility:100,dexterity:100,strength:100,wisdom:100,experienceLevel:10,medical:60,medkits:2,weapon:1800,loaded:1,ammo:3,marksmanship:60,activeSlot:'primary',...medic},
  {id:'patient',name:'Herido',x:2,y:2,maxHp:100,hp:10,bleeding:3,routed:true,medical:0,medkits:0,weapon:0,ammo:0,loaded:0,...person},
 ],{id:'declared-adjacent-medical',width,height,tiles,seed:45,hour:12,enemies:[{id:'enemy',x:13,y:6,weapon:1800,loaded:1,ammo:3,patrol:false,overwatch:false}]});
}

// The former adjacent-care seam, followed by the unchanged Native chooser.
// This isolates the old handoff without copying a complete route controller.
function formerAdjacentOrder(b,u){
 const cost=actionCosts(b,u),p=b.units.filter(v=>v.side===u.side&&v.hp>0&&!v.departure&&!v.surrendered&&!v.routed&&(v.bleeding>0||criticalFirstAidNeeded(v))&&sameSurface(u,v)&&Math.hypot(u.x-v.x,u.y-v.y)<=1.5&&hasLineOfSight(b,u,v)).sort((a,b)=>a.hp-b.hp)[0];
 if(p&&u.medkits>0&&u.medical>0){if(u.activeSlot==='medical'&&u.ap>=cost.heal)return {type:'useItem',unitId:u.id,targetId:p.id};if(u.activeSlot!=='medical'&&u.ap>=cost.heal+cost.weapon)return {type:'weapon',unitId:u.id,slot:'medical'};}
 if(['medical','tool','supply'].includes(u.activeSlot)&&u.weapon&&!u.weaponDropped&&u.ap>=cost.weapon)return {type:'weapon',unitId:u.id,slot:'primary'};
 return chooseEnemyAction(b,u);
}
function apply(b,action){const n=actBattle(b,action);assert.equal(n.lastError,null,JSON.stringify(action)+': '+n.lastError);return n;}
function replay(start,orders){
 let direct=start,presented=start;
 for(const [i,action]of orders.entries()){
  direct=apply(direct,action);const shown=presentedActBattle(presented,action);assert.equal(shown.state.lastError,null);presented=shown.state;assert.deepEqual(presented,direct);
  if(i===Math.floor(orders.length/2)){direct=validateBattleSnapshot(JSON.parse(JSON.stringify(direct)));presented=validateBattleSnapshot(JSON.parse(JSON.stringify(presented)));}
 }
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(direct))),direct);return direct;
}
function physical(u){return Object.fromEntries(['weapon','loaded','ammo','inventory','condition','weaponFittings','weaponDropped','maxHp'].map(k=>[k,u[k]]));}

test('unconscious routed adjacent care replaces the former eight paid hand oscillations with one actual finite treatment and exact saved/presented replay',()=>{
 const start=field(),before=structuredClone(start),cost=actionCosts(start,doctor(start));assert.equal(doctor(start).ap,100);assert.equal(patient(start).unconscious,true);assert.equal(medicalPatientAvailable(patient(start)),true);
 let old=start;const oldOrders=[];
 for(let i=0;i<16;i++){const action=formerAdjacentOrder(old,doctor(old));assert.deepEqual(action,{type:'weapon',unitId:'doctor',slot:i%2?'primary':'medical'});oldOrders.push(action);old=apply(old,action);}
 assert.equal(doctor(old).ap,doctor(start).ap-16*cost.weapon);assert.equal(doctor(old).medkits,2);assert.equal(patient(old).hp,10);assert.equal(patient(old).bleeding,3);assert.equal(old.elapsedSeconds,6);assert.deepEqual(old,replay(start,oldOrders));
 const hand=combatOrder(start,doctor(start));assert.deepEqual(hand,{type:'weapon',unitId:'doctor',slot:'medical'});const prepared=apply(start,hand);assert.equal(doctor(prepared).ap,doctor(start).ap-cost.weapon);
 const proposal=combatOrder(prepared,doctor(prepared));assert.deepEqual(proposal,{type:'useItem',unitId:'doctor',targetId:'patient'});const quote=itemUsePreview(prepared,doctor(prepared),patient(prepared)),medical=medicalUsePreview(prepared,doctor(prepared),patient(prepared));assert.equal(quote.valid,true);assert.equal(quote.movePa,0);assert.equal(medical.allowed,true);
 const treated=apply(prepared,proposal);assert.equal(doctor(treated).ap,doctor(prepared).ap-medical.cost);assert.equal(doctor(treated).medkits,1);assert.equal(patient(treated).hp,medical.treatment.hpAfter);assert.equal(patient(treated).hp,15);assert.equal(patient(treated).bleeding,0);assert.equal(patient(treated).routed,true);assert.equal(patient(treated).unconscious,false);assert.equal(patient(treated).ap,0);assert.equal(treated.elapsedSeconds,6);assert.equal(treated.turn,start.turn);
 for(const id of ['doctor','patient'])assert.deepEqual(physical(unit(treated,id)),physical(unit(start,id)));
 assert.deepEqual(combatOrder(treated,doctor(treated)),{type:'weapon',unitId:'doctor',slot:'primary'});assert.deepEqual(treated,replay(start,[hand,proposal]));
 const window=openingControlWindow(start);assert.equal(window.orders.filter(a=>a.type==='weapon'&&a.slot==='medical').length,1);assert.equal(window.orders.filter(a=>a.type==='useItem'&&a.targetId==='patient').length,1);assert.equal(patient(window.battle).routed,true);assert.equal(patient(window.battle).ap,0);assert.deepEqual(window.battle,replay(start,window.orders));assert.deepEqual(start,before);
});

test('conscious routed, captured, captive, detained, surrendered, fled, departed and dead people remain unavailable for adjacent military aid',()=>{
 for(const person of [{hp:40,routed:true},{captured:true},{captive:true},{detention:{freed:false}},{surrendered:true},{fled:true},{departure:{edge:'E'}},{hp:0}]){
  const start=field({person,medic:{activeSlot:'medical'}}),before=structuredClone(start);assert.equal(medicalPatientAvailable(patient(start)),false);
  const quote=itemUsePreview(start,doctor(start),patient(start));assert.equal(quote.valid,false);const proposal=combatOrder(start,doctor(start));assert.deepEqual(proposal,{type:'weapon',unitId:'doctor',slot:'primary'});
  const refused=actBattle(start,{type:'useItem',unitId:'doctor',targetId:'patient'});assert.ok(refused.lastError);assert.deepEqual(refused.units,start.units);assert.equal(refused.elapsedSeconds,start.elapsedSeconds);assert.equal(refused.seed,start.seed);assert.deepEqual(start,before);
 }
});

test('ordinary adjacent bleeding care keeps the same paid priority and cannot create medical stock or patient AP',()=>{
 const start=field({person:{hp:40,routed:false,bleeding:4}}),before=structuredClone(start),first=combatOrder(start,doctor(start));assert.deepEqual(first,{type:'weapon',unitId:'doctor',slot:'medical'});
 const prepared=apply(start,first),second=combatOrder(prepared,doctor(prepared));assert.deepEqual(second,{type:'useItem',unitId:'doctor',targetId:'patient'});assert.deepEqual(second,formerAdjacentOrder(prepared,doctor(prepared)));
 const next=apply(prepared,second);assert.equal(patient(next).hp,40);assert.equal(patient(next).bleeding,0);assert.equal(doctor(next).medkits,1);assert.equal(doctor(next).ap,doctor(start).ap-actionCosts(start,doctor(start)).weapon-actionCosts(prepared,doctor(prepared)).heal);assert.equal(patient(next).ap,patient(start).ap);assert.deepEqual(next,replay(start,[first,second]));assert.deepEqual(start,before);
});

test('one available dressing funds only one critical stroke and the driver cannot oscillate back into an empty medical hand',()=>{
 const start=field({person:{hp:1,bleeding:10},medic:{medkits:1}}),before=structuredClone(start),window=openingControlWindow(start),next=window.battle;
 assert.equal(window.orders.filter(a=>a.type==='useItem'&&a.targetId==='patient').length,1);assert.equal(window.orders.filter(a=>a.type==='weapon'&&a.slot==='medical').length,1);assert.equal(doctor(next).medkits,0);assert.ok(patient(next).hp>1&&patient(next).hp<15);assert.equal(patient(next).unconscious,true);assert.equal(patient(next).routed,true);assert.equal(patient(next).ap,0);
 assert.deepEqual(next,replay(start,window.orders));assert.deepEqual(start,before);
});

test('an adjacent patient does not waive real hand/aid AP and a healthy squad retains its ordinary firearm work',()=>{
 let short=field(),actions=[];for(let i=0;i<18;i++){const action={type:'weapon',unitId:'doctor',slot:i%2?'primary':'medical'};short=apply(short,action);actions.push(action);}
 assert.equal(doctor(short).ap,28);const before=structuredClone(short),proposal=combatOrder(short,doctor(short));assert.ok(!(proposal?.type==='weapon'&&proposal.slot==='medical'));assert.ok(!(proposal?.type==='useItem'&&proposal.targetId==='patient'));assert.deepEqual(short,before);
 const healthy=field({person:{hp:100,bleeding:0,routed:false},medic:{loaded:0,ammo:3}}),original=structuredClone(healthy),order=combatOrder(healthy,doctor(healthy));assert.deepEqual(order,{type:'reload',unitId:'doctor'});const n=apply(healthy,order);assert.ok(doctor(n).loaded>0);assert.equal(doctor(n).medkits,doctor(healthy).medkits);assert.equal(patient(n).hp,100);assert.deepEqual(healthy,original);assert.deepEqual(n,replay(healthy,[order]));
});
