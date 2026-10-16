import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,getReachable,actionCosts,stanceCost,medicalUsePreview,artilleryContact,artilleryCrewPlan,artilleryCosts,teamCanSee} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {sameCell,spacePoint} from '../game/tactical-space.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';
import {recoveryPortSearchController} from './recovery-port-battery-driver.mjs';

// Fresh portable Native declarations. These are not an earned arsenal route,
// a captured failure, or evidence that the complete ending route succeeds.
const unit=(b,id)=>b.units.find(actor=>actor.id===id),flat=(w,h)=>Array.from({length:w*h},(_,i)=>({x:i%w,y:Math.floor(i/w),type:'grass',blocked:false,cover:0}));
const options={coordinateInfantry:true,coordinateRifleCover:true,coordinateSupportStaging:true,coordinateRearFormation:true};
function arena({doctor={},front={},screen={},players=[],patient=null,near=false,artillery=[],hidden=false}={}){
 return createBattle([
  {id:'doctor',name:'Médica de campo',x:6,y:8,facing:2,weapon:1800,blade:0,loaded:1,ammo:5,medical:93,medkits:2,marksmanship:80,energy:100,morale:90,...doctor},
  {id:'front',name:'Frente',x:10,y:8,facing:2,weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:80,...front},
  {id:'screen',name:'Apoyo',x:8,y:8,facing:2,weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:75,...screen},
  ...players,...(patient?[{id:'patient',name:'Herido',x:7,y:8,weapon:0,blade:0,loaded:0,ammo:0,hp:10,maxHp:100,bleeding:3,medical:0,medkits:0,...patient}]:[]),
 ],{id:'declared-field-physician-cover',width:40,height:18,tiles:flat(40,18),hour:12,seed:45,exploration:false,
  enemies:[{id:'contact',name:'Contacto',x:near?14:39,y:near?8:17,weapon:0,blade:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}],artillery,
  npcs:hidden?[{id:'hidden-resident',name:'Vecino',mission:'declared-static-speaker',x:38,y:16}]:[],
 });
}
const policy=b=>recoveryPortSearchController(b,{...options,fieldPhysicianIds:['doctor']});
function replay(start,orders){
 let direct=structuredClone(start),shown=structuredClone(start),stored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));
  shown=presentedActBattle(shown,JSON.parse(JSON.stringify(action))).state;assert.deepEqual(shown,direct);
  stored=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(stored,JSON.parse(JSON.stringify(action))))));assert.deepEqual(stored,direct);
 }
 return direct;
}
function goods(start,end){
 assert.deepEqual(end.artillery,start.artillery);assert.deepEqual(end.tiles,start.tiles);
 for(const actor of start.units){const next=unit(end,actor.id);assert.deepEqual(unitAmmunitionByType(next),unitAmmunitionByType(actor));for(const key of ['inventory','weapon','blade','condition','weaponInstanceId','weaponMetadata'])assert.deepEqual(next[key],actor[key],`${actor.id}: ${key}`);}
}
function equip(start,controller){
 const actor=unit(start,'doctor'),action=controller(start,actor);assert.deepEqual(action,{type:'weapon',unitId:actor.id,slot:'medical'});
 const after=replay(start,[action]);assert.equal(unit(after,actor.id).ap,actor.ap-actionCosts(start,actor).weapon);assert.equal(unit(after,actor.id).activeSlot,'medical');goods(start,after);return {after,action};
}

test('the empty field role and unqualified initial IDs retain the existing controller decisions',()=>{
 for(const doctor of [{},{medical:59},{medkits:0},{departure:{destination:'elsewhere'}}]){
  const start=arena({doctor,near:true}),before=structuredClone(start),legacy=recoveryPortSearchController(start,options),empty=recoveryPortSearchController(start,{...options,fieldPhysicianIds:[]});
  for(const actor of start.units.filter(actor=>actor.side==='player'))assert.deepEqual(empty(start,actor),legacy(start,actor));
  if(doctor.medical===59||doctor.medkits===0||doctor.departure)assert.deepEqual(policy(start)(start,unit(start,'doctor')),legacy(start,unit(start,'doctor')));
  assert.deepEqual(start,before);
 }
});

test('an explicit field physician pays for medical hand and one protective posture instead of infantry fire',()=>{
 const start=arena({near:true,front:{y:6},screen:{y:10}}),before=structuredClone(start),controller=policy(start),doctor=unit(start,'doctor'),legacy=recoveryPortSearchController(start,options),ordinary=legacy(start,doctor);
 assert.equal(ordinary?.type,'stance');const rifleReady=actBattle(start,ordinary);assert.equal(rifleReady.lastError,null);assert.equal(legacy(rifleReady,unit(rifleReady,'doctor'))?.type,'fire','the unchanged ordinary branch has a real payable rifle shot');
 const {after:held,action:hand}=equip(start,controller),posture=controller(held,unit(held,'doctor'));assert.deepEqual(posture,{type:'stance',unitId:'doctor',stance:'prone'});
 const end=replay(start,[hand,posture]);assert.equal(unit(end,'doctor').ap,unit(held,'doctor').ap-stanceCost(unit(held,'doctor'),'prone'));assert.equal(end.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);
 assert.equal(controller(end,unit(end,'doctor')),null);assert.equal(controller.sharedFallback(end,unit(end,'doctor')),null);assert.equal(unit(end,'doctor').medkits,doctor.medkits);goods(start,end);assert.deepEqual(start,before);
});

test('the supplied medical role follows the actual second screen through a real bounded paid route',()=>{
 const start=arena({doctor:{x:3,y:2}}),before=structuredClone(start),controller=policy(start),{after:held,action:hand}=equip(start,controller),doctor=unit(held,'doctor'),move=controller(held,doctor);
 assert.equal(move?.type,'move');const route=getReachable(held,doctor).find(point=>sameCell(point,move));assert.ok(route&&route.cost>0&&route.cost<=16);assert.ok(route.path.every(point=>(point.tacticalLevel??0)===(doctor.tacticalLevel??0)));
 const screen=unit(held,'screen');assert.ok(Math.hypot(move.x-screen.x,move.y-screen.y)<Math.hypot(doctor.x-screen.x,doctor.y-screen.y));assert.ok(move.x<=screen.x);
 const end=replay(start,[hand,move]);assert.equal(unit(end,'doctor').ap,doctor.ap-route.cost);assert.ok(unit(end,'doctor').energy<doctor.energy);assert.equal(unit(end,'doctor').activeSlot,'medical');assert.equal(unit(end,'doctor').medkits,doctor.medkits);goods(start,end);assert.deepEqual(start,before);
});

test('adjacent critical care precedes rear posture and spends the actual finite dressing and Native AP',()=>{
 const start=arena({near:true,patient:{}}),before=structuredClone(start),controller=policy(start),{after:held,action:hand}=equip(start,controller),doctor=unit(held,'doctor'),patient=unit(held,'patient'),quote=medicalUsePreview(held,doctor,patient);
 assert.equal(quote.allowed,true,quote.reason);const aid=controller(held,doctor);assert.deepEqual(aid,{type:'useItem',unitId:'doctor',targetId:'patient'});
 const end=replay(start,[hand,aid]);assert.equal(unit(end,'doctor').ap,doctor.ap-quote.cost);assert.equal(unit(end,'doctor').medkits,doctor.medkits-quote.treatment.dressingsUsed);assert.equal(unit(end,'patient').hp,quote.treatment.hpAfter);assert.equal(unit(end,'patient').bleeding,quote.treatment.bleedingAfter);goods(start,end);assert.deepEqual(start,before);
});

test('a non-adjacent actual critical patient gets a paid approach and finite aid before healthy screen following',()=>{
 const start=arena({doctor:{x:3,y:8},patient:{x:6,y:8}}),before=structuredClone(start),controller=policy(start),{after:held,action:hand}=equip(start,controller),doctor=unit(held,'doctor'),patient=unit(held,'patient'),move=controller(held,doctor);
 assert.equal(move?.type,'move');assert.ok(Math.hypot(move.x-patient.x,move.y-patient.y)<=1.5);const route=getReachable(held,doctor).find(point=>sameCell(point,move));assert.ok(route&&route.cost>0&&route.cost<=16);assert.ok(route.cost+actionCosts(held,doctor).heal<=doctor.ap);
 const arrived=replay(start,[hand,move]),medic=unit(arrived,'doctor'),quote=medicalUsePreview(arrived,medic,unit(arrived,'patient'));assert.equal(quote.allowed,true,quote.reason);const aid=controller(arrived,medic);assert.deepEqual(aid,{type:'useItem',unitId:'doctor',targetId:'patient'});
 const end=replay(start,[hand,move,aid]);assert.equal(unit(end,'doctor').ap,medic.ap-quote.cost);assert.equal(unit(end,'doctor').medkits,medic.medkits-quote.treatment.dressingsUsed);assert.equal(unit(end,'patient').hp,quote.treatment.hpAfter);assert.equal(unit(end,'patient').bleeding,quote.treatment.bleedingAfter);goods(start,end);assert.deepEqual(start,before);
});

test('unseen opposing people and guns do not change a field physician public route',()=>{
 const doctor={x:3,y:2,facing:6,movementMode:'run',activeSlot:'medical'},start=arena({doctor}),before=structuredClone(start),action=policy(start)(start,unit(start,'doctor'));assert.equal(action?.type,'move');
 const hidden=arena({doctor,hidden:true,artillery:[{id:'hidden-gun',type:'swivel',side:'enemy',...spacePoint(action),loaded:true,ammo:9}]}),hiddenBefore=structuredClone(hidden);assert.equal(teamCanSee(hidden,'player',hidden.artillery[0]),false);assert.equal(teamCanSee(hidden,'player',hidden.npcs[0]),false);
 assert.deepEqual(policy(hidden)(hidden,unit(hidden,'doctor')),action);replay(start,[action]);const stopped=replay(hidden,[action]);assert.equal(sameCell(unit(stopped,'doctor'),hidden.artillery[0]),false,'Only actual Native movement detects the unseen physical gun.');goods(hidden,stopped);assert.deepEqual(start,before);assert.deepEqual(hidden,hiddenBefore);
});

test('medical support does not move or make a real charged gun helper prone, while adjacent aid remains legal',()=>{
 const artillery=[{id:'owned-gun',type:'bronze4',side:'player',x:6,y:7,loaded:true,ammo:2,facing:0}],players=[{id:'gunner',name:'Artillero',x:5,y:7,weapon:1800,loaded:1,ammo:5,medical:0,medkits:0}],start=arena({artillery,players,near:true}),before=structuredClone(start),controller=policy(start),{after:held,action:hand}=equip(start,controller),doctor=unit(held,'doctor'),gun=held.artillery[0];
 assert.equal(artilleryContact(held,doctor,gun),true);const quote=artilleryCrewPlan(held,unit(held,'gunner'),gun,artilleryCosts(held,unit(held,'gunner'),gun).fire);assert.equal(quote.reason,null);assert.ok(quote.crew.includes('doctor'));
 assert.equal(controller(held,doctor),null);assert.equal(controller.sharedFallback(held,doctor),null);assert.equal(doctor.stance,'standing');goods(start,held);assert.deepEqual(replay(start,[hand]),held);assert.deepEqual(start,before);
 const fire=controller(held,unit(held,'gunner'));assert.equal(fire?.type,'artillery');const fired=replay(start,[hand,fire]),cost=artilleryCosts(held,unit(held,'gunner'),gun).fire;assert.equal(Number(fired.artillery[0].loaded)+fired.artillery[0].ammo,Number(gun.loaded)+gun.ammo-1);
 for(const id of quote.crew){assert.equal(unit(fired,id).ap,unit(held,id).ap-cost);assert.deepEqual(unitAmmunitionByType(unit(fired,id)),unitAmmunitionByType(unit(held,id)));assert.equal(unit(fired,id).medkits,unit(held,id).medkits);}
 const injured=arena({artillery,players,patient:{}}),medical=policy(injured),{after:ready}=equip(injured,medical),aid=medical(ready,unit(ready,'doctor'));assert.deepEqual(aid,{type:'useItem',unitId:'doctor',targetId:'patient'});replay(ready,[aid]);
});

test('a knocked-down medical role pays the legal standing preparation before taking its real medical hand',()=>{
 const start=arena({doctor:{knockedDown:true,stance:'prone'},patient:{}}),before=structuredClone(start),controller=policy(start),doctor=unit(start,'doctor'),stand=controller(start,doctor);
 assert.deepEqual(stand,{type:'stance',unitId:'doctor',stance:'standing'});const stood=replay(start,[stand]);assert.equal(unit(stood,'doctor').ap,doctor.ap-stanceCost(doctor,'standing'));assert.equal(unit(stood,'doctor').knockedDown,false);
 const {after:held,action:hand}=equip(stood,controller),aid=controller(held,unit(held,'doctor'));assert.deepEqual(aid,{type:'useItem',unitId:'doctor',targetId:'patient'});replay(start,[stand,hand,aid]);assert.deepEqual(start,before);
});

test('a distant acute patient cannot draw essential current charged gun crew away from its real finite shot',()=>{
 const start=arena({doctor:{activeSlot:'medical'},near:true,patient:{x:15,y:13},players:[{id:'gunner',name:'Artillero',x:5,y:7,weapon:1800,loaded:1,ammo:5,medical:0,medkits:0}],artillery:[{id:'owned-gun',type:'bronze4',side:'player',x:6,y:7,loaded:true,ammo:2,facing:0}]}),before=structuredClone(start),controller=policy(start),doctor=unit(start,'doctor'),patient=unit(start,'patient'),gun=start.artillery[0],gunner=unit(start,'gunner'),cost=artilleryCosts(start,gunner,gun).fire,crew=artilleryCrewPlan(start,gunner,gun,cost);
 assert.equal(crew.reason,null);assert.ok(crew.crew.includes(doctor.id));assert.equal(artilleryContact(start,doctor,gun),true);assert.equal(medicalUsePreview(start,doctor,patient).allowed,false);
 assert.ok(getReachable(start,doctor).some(point=>point.cost>0&&point.cost<=16&&Math.hypot(point.x-patient.x,point.y-patient.y)<Math.hypot(doctor.x-patient.x,doctor.y-patient.y)),'A real affordable approach exists, so the charged-contact hold is the deciding guard.');
 assert.equal(controller(start,doctor),null);const fire=controller(start,gunner);assert.equal(fire?.type,'artillery');const end=replay(start,[fire]);assert.equal(Number(end.artillery[0].loaded)+end.artillery[0].ammo,Number(gun.loaded)+gun.ammo-1);
 for(const id of crew.crew){assert.equal(unit(end,id).ap,unit(start,id).ap-cost);assert.deepEqual(spacePoint(unit(end,id)),spacePoint(unit(start,id)));assert.deepEqual(unitAmmunitionByType(unit(end,id)),unitAmmunitionByType(unit(start,id)));assert.equal(unit(end,id).medkits,unit(start,id).medkits);}
 assert.equal(unit(end,'patient').hp,patient.hp);assert.equal(unit(end,'patient').bleeding,patient.bleeding);assert.deepEqual(start,before);
});


// Independent fresh declarations: no route capture, post-factory wound,
// AP, equipment, geometry or resource assignment is used by these controls.
function proneMedicalArena({adjacent=false}={}){
 const healthy={maxHp:100,hp:100,bleeding:0,bandaged:0,energy:100,fatigue:0,shock:0,morale:90};
 return createBattle([
  {...healthy,id:'doctor',name:'Médica móvil',x:3,y:8,facing:2,weapon:1800,blade:0,loaded:1,ammo:5,medical:93,medkits:2,marksmanship:80,activeSlot:'medical',stance:'prone',movementMode:'prone'},
  {...healthy,id:'front',name:'Frente',x:12,y:8,facing:2,weapon:1800,blade:0,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:80},
  {...healthy,id:'screen',name:'Apoyo',x:10,y:8,facing:2,weapon:1800,blade:0,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:75},
  {...healthy,id:'patient',name:'Paciente',x:adjacent?4:7,y:8,facing:2,weapon:0,blade:0,loaded:0,ammo:0,medical:0,medkits:0,hp:10,bleeding:3},
 ],{id:'declared-prone-field-physician',width:40,height:18,tiles:flat(40,18),hour:12,seed:45,exploration:false,
  enemies:[{...healthy,id:'contact',name:'Contacto distante',x:39,y:17,weapon:0,blade:0,loaded:0,ammo:0,medical:0,medkits:0,patrol:false,overwatch:false}],artillery:[],npcs:[]});
}

test('a prone field physician pays the Native rise inside its bounded walk, then reaches and treats the real patient with finite linen',()=>{
 const start=proneMedicalArena(),before=structuredClone(start),controller=policy(start),actions=[];let battle=start;
 for(let step=0;step<2;step++){
  const doctor=unit(battle,'doctor'),action=controller(battle,doctor);assert.equal(action?.type,'move');assert.equal(action.movement,step===0?'walk':undefined);
  const rise=action.movement==='walk'?stanceCost(doctor,'standing'):0,walking=action.movement==='walk'?{...doctor,stance:'standing',movementMode:'walk',ap:doctor.ap-rise}:doctor;
  const planning={...battle,units:battle.units.map(actor=>actor.id===doctor.id?walking:actor)},route=getReachable(planning,walking,{stopAt:point=>sameCell(point,action)})[0];
  assert.ok(route&&route.cost>0&&rise+route.cost<=16);assert.ok(route.path.every(point=>(point.kind===undefined||point.kind==='move')&&(point.tacticalLevel??0)===(doctor.tacticalLevel??0)));
  const moved=replay(battle,[action]),actual=unit(moved,'doctor');assert.equal(actual.stance,'standing');assert.equal(actual.movementMode,'walk');assert.equal(actual.ap,doctor.ap-rise-route.cost);assert.ok(actual.energy<doctor.energy);assert.equal(actual.medkits,doctor.medkits);
  assert.equal(actual.activeSlot,'medical');assert.deepEqual(unitAmmunitionByType(actual),unitAmmunitionByType(doctor));assert.ok(Math.hypot(actual.x-7,actual.y-8)<Math.hypot(doctor.x-7,doctor.y-8));actions.push(action);battle=moved;
 }
 const doctor=unit(battle,'doctor'),patient=unit(battle,'patient'),quote=medicalUsePreview(battle,doctor,patient);assert.equal(quote.allowed,true,quote.reason);const aid=controller(battle,doctor);assert.deepEqual(aid,{type:'useItem',unitId:'doctor',targetId:'patient'});
 const end=replay(battle,[aid]);assert.equal(unit(end,'doctor').ap,doctor.ap-quote.cost);assert.equal(unit(end,'doctor').medkits,doctor.medkits-quote.treatment.dressingsUsed);assert.equal(unit(end,'patient').hp,quote.treatment.hpAfter);assert.equal(unit(end,'patient').bleeding,quote.treatment.bleedingAfter);
 assert.equal(end.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);goods(start,end);assert.deepEqual(replay(start,[...actions,aid]),end);assert.deepEqual(start,before);
});

test('actual adjacent critical aid remains first while prone and does not pay an unnecessary rise or walking step',()=>{
 const start=proneMedicalArena({adjacent:true}),before=structuredClone(start),controller=policy(start),doctor=unit(start,'doctor'),patient=unit(start,'patient'),quote=medicalUsePreview(start,doctor,patient);assert.equal(quote.allowed,true,quote.reason);
 const aid=controller(start,doctor);assert.deepEqual(aid,{type:'useItem',unitId:'doctor',targetId:'patient'});const end=replay(start,[aid]),actual=unit(end,'doctor');
 assert.equal(actual.stance,'prone');assert.equal(actual.movementMode,'prone');assert.ok(sameCell(actual,doctor));assert.equal(actual.ap,doctor.ap-quote.cost);assert.equal(actual.medkits,doctor.medkits-quote.treatment.dressingsUsed);assert.equal(unit(end,'patient').hp,quote.treatment.hpAfter);assert.equal(unit(end,'patient').bleeding,quote.treatment.bleedingAfter);goods(start,end);assert.deepEqual(start,before);
});
