import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,getReachable,climbPreview,medicalUsePreview,stanceCost,actionCosts,artilleryContact,teamCanSee} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {sameCell,sameSurface,spacePoint} from '../game/tactical-space.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {medicalPatientAvailable} from '../game/medical-patient.js';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';
import {coordinatedHospitalBattery} from './coordinated-hospital-battery.mjs';
import {publicRouteView} from './route-infantry-progress.mjs';

// Fresh authored portable declarations only. No campaign failure or earned
// state is an input. createBattle performs every body/space/AP admission.
function arena({away=false,marginal=false,blocked=false,ground=false,noKits=false,routed=false,hidden=0}={}){
 const doctor={id:'doctor',x:ground?8:away?10:8,y:ground?6:7,tacticalLevel:ground?0:1,weapon:1800,loaded:1,ammo:5,medical:90,medkits:noKits?0:3,stance:'crouched',facing:2,energy:marginal?8:100,morale:90,...(marginal?{hp:20,maxHp:20,agility:1,dexterity:1,experienceLevel:1}:{})};
 const roof=Array.from({length:9},(_,i)=>({id:`clinic-roof:${i}`,x:8+i%3,y:7+Math.floor(i/3),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));
 return createBattle([doctor,
  {id:'crew1',x:5,y:5,weapon:0,loaded:0,ammo:0,medkits:0,medical:0,stance:'crouched',energy:100,morale:90},
  {id:'patient',x:7,y:6,weapon:0,loaded:0,ammo:0,medkits:0,medical:0,hp:routed?30:8,maxHp:100,bleeding:3,bandaged:routed?67:89,routed,stance:'crouched',energy:100,morale:90},
  ...(blocked?[{id:'landing-holder',x:8,y:6,weapon:0,loaded:0,ammo:0,medical:0,medkits:0,stance:'standing',energy:100,morale:90}]:[]),
 ],{id:'declared-roof-medical-access',width:40,height:20,hour:12,seed:45,
  tiles:Array.from({length:800},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass',blocked:false,cover:0})),upperSurfaces:roof,
  climbLinks:[{id:'clinic-west-access',kind:'climb',from:{x:8,y:6,tacticalLevel:0},to:{x:8,y:7,tacticalLevel:1}}],
  enemies:[{id:'target',x:hidden===2?38:35,y:17,weapon:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}],
  artillery:[{id:'clinic-gun',side:'player',type:'bronze4',x:6,y:5,facing:0,loaded:true,ammo:2},...(hidden?[{id:'hidden-piece',side:'enemy',type:'swivel',x:hidden===2?38:35,y:18,loaded:true,ammo:9}]:[])],
  npcs:hidden?[{id:'hidden-resident',x:hidden===2?38:35,y:19,hp:100}]:[],
 });
}
const actor=(b,id)=>b.units.find(u=>u.id===id),clock=b=>b.startSeconds+b.elapsedSeconds;
function replay(start,orders){
 let direct=start,presented=start,saved=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  assert.ok(action);direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));
  presented=presentedActBattle(presented,action).state;assert.deepEqual(presented,direct);
  saved=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(saved,action))));assert.deepEqual(saved,direct);
 }
 return direct;
}
function medicalTrip(start){
 const before=structuredClone(start),policy=coordinatedHospitalBattery(start),orders=[];let b=start;
 assert.equal(policy.roles.physicianId,'doctor');assert.equal(medicalPatientAvailable(actor(b,'patient')),true);
 for(let pass=0;pass<12&&actor(b,'patient').bleeding>0;pass++){
  const action=policy.controller(b,actor(b,'doctor'));assert.ok(action,'the actual route must progress through real paid native orders');orders.push(action);b=replay(start,orders);
 }
 assert.equal(actor(b,'patient').bleeding,0);assert.ok(actor(b,'patient').hp>=15);assert.deepEqual(replay(start,orders),b);assert.deepEqual(start,before);return {battle:b,orders};
}
function unchangedGoods(before,after){
 assert.deepEqual(after.artillery,before.artillery);assert.deepEqual(after.tiles,before.tiles);assert.deepEqual(after.upperSurfaces,before.upperSurfaces);assert.deepEqual(after.climbLinks,before.climbLinks);
 for(const u of before.units){const later=actor(after,u.id);assert.deepEqual(unitAmmunitionByType(later),unitAmmunitionByType(u));for(const key of ['inventory','weapon','blade','condition','weaponInstanceId','weaponMetadata'])assert.deepEqual(later[key],u[key]);}
 assert.equal(after.units.filter(u=>u.side==='player').reduce((n,u)=>n+u.medkits,0),before.units.filter(u=>u.side==='player').reduce((n,u)=>n+u.medkits,0)-1);
}

test('a crouched supplied roof physician pays standing, authored descent and finite adjacent medical aid',()=>{
 const start=arena(),doctor=actor(start,'doctor'),patient=actor(start,'patient'),policy=coordinatedHospitalBattery(start),view=publicRouteView(start,doctor);
 assert.equal(doctor.stance,'crouched');assert.ok(!sameSurface(doctor,patient));assert.equal(climbPreview(view,doctor,{linkId:'clinic-west-access'}).valid,false);assert.ok(!getReachable(view,doctor).some(p=>sameSurface(p,patient)));assert.equal(artilleryContact(start,doctor,start.artillery[0]),false);
 const stand=policy.controller(start,doctor);assert.deepEqual(stand,{type:'stance',unitId:'doctor',stance:'standing'});
 const stood=replay(start,[stand]);assert.equal(actor(stood,'doctor').ap,doctor.ap-stanceCost(doctor,'standing'));assert.equal(actor(stood,'doctor').stance,'standing');assert.equal(stood.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);
 const climb=policy.controller(stood,actor(stood,'doctor')),quote=climbPreview(publicRouteView(stood,actor(stood,'doctor')),actor(stood,'doctor'),{linkId:'clinic-west-access'});assert.deepEqual(climb,{type:'climb',unitId:'doctor',linkId:'clinic-west-access'});assert.equal(quote.valid,true);assert.equal(quote.pa,15);
 const descended=replay(start,[stand,climb]);assert.ok(sameCell(actor(descended,'doctor'),start.climbLinks[0].from));assert.equal(actor(descended,'doctor').ap,actor(stood,'doctor').ap-quote.pa);assert.ok(actor(descended,'doctor').energy<actor(stood,'doctor').energy);assert.equal(descended.elapsedSeconds,stood.elapsedSeconds,'ordinary same-round steps do not add an invented second clock charge');assert.equal(artilleryContact(descended,actor(descended,'doctor'),descended.artillery[0]),false);
 const equip=policy.controller(descended,actor(descended,'doctor'));assert.deepEqual(equip,{type:'weapon',unitId:'doctor',slot:'medical'});const held=replay(start,[stand,climb,equip]),aid=policy.controller(held,actor(held,'doctor')),medical=medicalUsePreview(held,actor(held,'doctor'),actor(held,'patient'));assert.equal(medical.allowed,true);assert.deepEqual(aid,{type:'useItem',unitId:'doctor',targetId:'patient'});
 const final=replay(start,[stand,climb,equip,aid]);assert.equal(actor(final,'doctor').ap,actor(held,'doctor').ap-medical.cost);assert.equal(actor(final,'doctor').medkits,doctor.medkits-1);assert.equal(actor(final,'patient').hp,medical.treatment.hpAfter);assert.equal(actor(final,'patient').bleeding,medical.treatment.bleedingAfter);assert.equal(actor(final,'doctor').activeSlot,'medical');unchangedGoods(start,final);
});

test('a physician away from access pays a same-roof prefix before the separate descent and one real dressing',()=>{
 const start=arena({away:true}),{battle,orders}=medicalTrip(start);assert.equal(orders[0].type,'stance');assert.equal(orders[0].stance,'standing');assert.equal(orders[1].type,'move');assert.equal(orders[1].tacticalLevel,1);assert.ok(orders.some(a=>a.type==='climb'&&a.linkId==='clinic-west-access'));
 const stood=replay(start,[orders[0]]),point=getReachable(publicRouteView(stood,actor(stood,'doctor')),actor(stood,'doctor')).find(p=>sameCell(p,orders[1]));assert.ok(point&&point.cost>0&&point.cost<=20);assert.ok(point.path.every(p=>sameSurface(p,actor(stood,'doctor'))));assert.ok(point.path.every(p=>p.kind==='move'));
 assert.equal(actor(replay(start,orders.slice(0,2)),'doctor').ap,actor(stood,'doctor').ap-point.cost);unchangedGoods(start,battle);
});

test('an actual low-AP physician holds instead of granting a standing/descent/medical budget',()=>{
 const start=arena({marginal:true}),before=structuredClone(start),doctor=actor(start,'doctor'),policy=coordinatedHospitalBattery(start);assert.ok(doctor.ap<stanceCost(doctor,'standing')+15+actionCosts(start,doctor).weapon+actionCosts(start,doctor).heal);
 const action=policy.controller(start,doctor);assert.ok(action?.type!=='climb'&&action?.type!=='move'&&!(action?.type==='stance'&&action.stance==='standing'));assert.deepEqual(start,before);
});

test('a real friendly body occupying the only authored landing does not authorize a medical rise or displacement',()=>{
 const start=arena({blocked:true}),before=structuredClone(start),policy=coordinatedHospitalBattery(start),doctor=actor(start,'doctor');assert.ok(sameCell(actor(start,'landing-holder'),start.climbLinks[0].from));
 const action=policy.controller(start,doctor);assert.ok(action?.type!=='climb'&&action?.type!=='move'&&!(action?.type==='stance'&&action.stance==='standing'));assert.deepEqual(start,before);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(start))),start);
});

test('same-surface adjacent care keeps native medical activation and one finite dressing before any access work',()=>{
 const start=arena({ground:true}),policy=coordinatedHospitalBattery(start),equip=policy.controller(start,actor(start,'doctor'));assert.deepEqual(equip,{type:'weapon',unitId:'doctor',slot:'medical'});
 const held=replay(start,[equip]),aid=policy.controller(held,actor(held,'doctor'));assert.deepEqual(aid,{type:'useItem',unitId:'doctor',targetId:'patient'});const after=replay(start,[equip,aid]);unchangedGoods(start,after);assert.ok(sameCell(actor(after,'doctor'),actor(start,'doctor')));
});

test('unseen distant people and guns cannot select or price the medical standing/access route',()=>{
 const a=arena({hidden:1}),b=arena({hidden:2}),beforeA=structuredClone(a),beforeB=structuredClone(b);
 for(const s of [a,b]){assert.equal(teamCanSee(s,'player',s.units.find(u=>u.side==='enemy')),false);assert.equal(teamCanSee(s,'player',s.npcs[0]),false);assert.equal(teamCanSee(s,'player',s.artillery[1]),false);}
 const first=coordinatedHospitalBattery(a).controller(a,actor(a,'doctor')),second=coordinatedHospitalBattery(b).controller(b,actor(b,'doctor'));assert.deepEqual(first,{type:'stance',unitId:'doctor',stance:'standing'});assert.deepEqual(second,first);assert.deepEqual(publicRouteView(a,actor(a,'doctor')),publicRouteView(b,actor(b,'doctor')));assert.deepEqual(a,beforeA);assert.deepEqual(b,beforeB);
});

test('absent carried linen and a conscious routed patient cannot authorize a new rescue route',()=>{
 for(const options of [{noKits:true},{routed:true}]){const start=arena(options),before=structuredClone(start),policy=coordinatedHospitalBattery(start),doctor=actor(start,'doctor');if(options.noKits)assert.equal(policy.roles.physicianId,null);else assert.equal(medicalPatientAvailable(actor(start,'patient')),false);const action=policy.controller(start,doctor);assert.ok(action?.type!=='climb'&&action?.type!=='move'&&!(action?.type==='stance'&&action.stance==='standing'));assert.deepEqual(start,before);}
});
