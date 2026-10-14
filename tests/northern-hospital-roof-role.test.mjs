import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,getReachable,climbPreview,medicalUsePreview,meleePreview,stanceCost,actionCosts,teamCanSee,hasLineOfSight} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {sameCell,sameSurface,spacePoint} from '../game/tactical-space.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';
import {coordinatedHospitalBattery,paidHospitalRoofWalkPreview} from './coordinated-hospital-battery.mjs';
import {northernHospitalCoverOrder} from './fresh-northern-recovery.mjs';
import {publicRouteView,usefulRouteRifleShot} from './route-infantry-progress.mjs';

// Fresh portable bodies/terrain/gear only. No failed campaign/result, authored
// victory, changed returned AP/HP/clock or hidden opponent is an action input.
const flat=(width=40,height=20)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
const actor=(b,id)=>b.units.find(u=>u.id===id);
function pursuitArena({ground=false}={}){
 const upperSurfaces=Array.from({length:9},(_,i)=>({id:`post:${i}`,x:7+i%3,y:3+Math.floor(i/3),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));
 return createBattle([{id:'guard',x:8,y:ground?6:5,tacticalLevel:ground?0:1,weapon:1800,loaded:0,ammo:0,blade:0,medical:0,medkits:0,stance:'standing',facing:4,energy:100,morale:90}],{
  id:'declared-clinic-roof-pursuit',width:40,height:20,tiles:flat(),upperSurfaces,hour:12,seed:45,
  climbLinks:[{id:'clinic-south-access',kind:'climb',from:{x:8,y:6,tacticalLevel:0},to:{x:8,y:5,tacticalLevel:1}}],
  enemies:[{id:'target',x:8,y:7,weapon:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}],
 });
}
function lateralArena(){
 const upperSurfaces=Array.from({length:20},(_,i)=>({id:`lateral-roof:${i}`,x:4+i%4,y:4+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}));
 return createBattle([
  {id:'guard',x:5,y:6,tacticalLevel:1,weapon:1800,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:90,stance:'standing',facing:0,energy:100,morale:90},
  {id:'front',x:5,y:4,tacticalLevel:1,weapon:0,loaded:0,ammo:0,medical:0,medkits:0,stance:'standing',facing:0,energy:100,morale:90},
 ],{id:'declared-lateral-clinic',width:40,height:20,tiles:flat(),upperSurfaces,hour:12,seed:45,
  enemies:[{id:'target',x:5,y:2,weapon:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}],
  artillery:[{id:'clinic-gun',type:'bronze4',side:'player',x:6,y:15,facing:0,loaded:true,ammo:2}],
 });
}
function medicalArena(){
 const upperSurfaces=Array.from({length:9},(_,i)=>({id:`clinic-roof:${i}`,x:8+i%3,y:7+Math.floor(i/3),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));
 return createBattle([
  {id:'doctor',x:8,y:7,tacticalLevel:1,weapon:1800,loaded:1,ammo:5,medical:90,medkits:3,stance:'crouched',facing:2,energy:100,morale:90},
  {id:'crew1',x:5,y:5,weapon:0,loaded:0,ammo:0,medical:0,medkits:0,stance:'crouched',energy:100,morale:90},
  {id:'patient',x:7,y:6,weapon:0,loaded:0,ammo:0,medical:0,medkits:0,hp:8,maxHp:100,bleeding:3,bandaged:89,stance:'crouched',energy:100,morale:90},
 ],{id:'declared-roof-medical-access',width:40,height:20,tiles:flat(),upperSurfaces,hour:12,seed:45,
  climbLinks:[{id:'clinic-west-access',kind:'climb',from:{x:8,y:6,tacticalLevel:0},to:{x:8,y:7,tacticalLevel:1}}],
  enemies:[{id:'target',x:35,y:17,weapon:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}],
  artillery:[{id:'clinic-gun',side:'player',type:'bronze4',x:6,y:5,facing:0,loaded:true,ammo:2}],
 });
}
function replay(start,orders){
 let direct=structuredClone(start),presented=structuredClone(start),saved=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));
  presented=presentedActBattle(presented,JSON.parse(JSON.stringify(action))).state;assert.deepEqual(presented,direct);
  saved=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(saved,JSON.parse(JSON.stringify(action))))));assert.deepEqual(saved,direct);
 }
 return direct;
}
function geometryAndGear(start,after,{conditionWear={}}={}){
 for(const key of ['tiles','upperSurfaces','climbLinks','artillery'])assert.deepEqual(after[key],start[key]);
 for(const u of start.units){const next=actor(after,u.id);assert.equal(next.condition,u.condition-(conditionWear[u.id]??0),`${u.id}: exact native condition wear`);for(const key of ['weapon','blade','inventory','weaponInstanceId','weaponMetadata','outfit','headwear','legwear'])assert.deepEqual(next[key],u[key]);}
}

test('the coordinated roof rifle role refuses an actual payable descent and ensuing ground pursuit',()=>{
 const start=pursuitArena(),before=structuredClone(start),guard=actor(start,'guard'),target=actor(start,'target'),view=publicRouteView(start,guard),policy=coordinatedHospitalBattery(start);
 assert.ok(guard.tacticalLevel>0);assert.ok(!sameSurface(guard,target));assert.equal(teamCanSee(start,'player',target),true);assert.equal(hasLineOfSight(view,guard,target),true);
 const ordinary=northernHospitalCoverOrder(start,guard);assert.deepEqual(ordinary,{type:'climb',unitId:'guard',linkId:'clinic-south-access'});
 const quote=climbPreview(view,guard,ordinary);assert.equal(quote.valid,true);assert.equal(quote.pa,15);assert.ok(sameCell(quote.destination,start.climbLinks[0].from));
 assert.equal(policy.roles.physicianId,null);assert.deepEqual(policy.roles.crews,[]);assert.equal(policy.controller(start,guard),null);
 const paid=replay(start,[ordinary]);assert.ok(sameCell(actor(paid,'guard'),quote.destination));assert.equal(actor(paid,'guard').ap,guard.ap-quote.pa);assert.ok(actor(paid,'guard').energy<guard.energy);assert.equal(paid.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);
 const groundWork=northernHospitalCoverOrder(paid,actor(paid,'guard'));assert.deepEqual(groundWork,{type:'melee',unitId:'guard',targetId:'target'});assert.equal(meleePreview(paid,actor(paid,'guard'),actor(paid,'target')).valid,true);
 for(let pass=0;pass<3;pass++)assert.equal(policy.controller(start,guard),null);assert.deepEqual(start,before);geometryAndGear(start,paid);assert.deepEqual(unitAmmunitionByType(actor(paid,'guard')),unitAmmunitionByType(guard));
});

test('a held roof rifle role still pays one same-roof safe lane and one finite rifle discharge',()=>{
 const start=lateralArena(),before=structuredClone(start),guard=actor(start,'guard'),view=publicRouteView(start,guard),policy=coordinatedHospitalBattery(start);
 assert.equal(usefulRouteRifleShot(view,guard),null);const move=policy.controller(start,guard);assert.equal(move?.type,'move');assert.ok(sameSurface(move,guard));
 const point=getReachable(view,guard,{stopAt:p=>sameCell(p,move)})[0],preview=point&&paidHospitalRoofWalkPreview(view,guard,point);assert.ok(preview);assert.ok(usefulRouteRifleShot(preview.view,preview.actor));assert.ok(point.cost>0&&point.cost<=20);
 const moved=replay(start,[move]),member=actor(moved,'guard');assert.ok(sameCell(member,move));assert.equal(member.ap,guard.ap-point.cost);assert.ok(member.energy<guard.energy);assert.equal(moved.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);
 const fire=policy.controller(moved,member);assert.deepEqual(fire,usefulRouteRifleShot(publicRouteView(moved,member),member));assert.equal(fire?.type,'fire');const cost=actionCosts(moved,member,actor(moved,fire.targetId));
 const after=replay(start,[move,fire]);assert.equal(actor(after,'guard').ap,member.ap-cost.fire-(fire.aim??0)*cost.aim);assert.equal(actor(after,'guard').loaded,member.loaded-1);assert.equal(after.elapsedSeconds,moved.elapsedSeconds);assert.equal(actor(after,'guard').tacticalLevel,1);
 const total=u=>Object.values(unitAmmunitionByType(u)).reduce((a,b)=>a+b,0);assert.equal(total(actor(after,'guard')),total(guard)-1);assert.equal(actor(after,'front').hp,actor(start,'front').hp);geometryAndGear(start,after,{conditionWear:{guard:1}});assert.deepEqual(start,before);
});

test('actual physician standing and medical descent remain ahead of the rifle roof-role guard',()=>{
 const start=medicalArena(),before=structuredClone(start),doctor=actor(start,'doctor'),policy=coordinatedHospitalBattery(start,{coordinatePhysicianHold:true}),orders=[];assert.equal(policy.roles.physicianId,'doctor');
 const stand=policy.controller(start,doctor);assert.deepEqual(stand,{type:'stance',unitId:'doctor',stance:'standing'});orders.push(stand);const stood=replay(start,orders);assert.equal(actor(stood,'doctor').ap,doctor.ap-stanceCost(doctor,'standing'));
 const quote=climbPreview(publicRouteView(stood,actor(stood,'doctor')),actor(stood,'doctor'),{linkId:'clinic-west-access'}),climb=policy.controller(stood,actor(stood,'doctor'));assert.equal(quote.valid,true);assert.deepEqual(climb,{type:'climb',unitId:'doctor',linkId:'clinic-west-access'});orders.push(climb);const descended=replay(start,orders);assert.equal(actor(descended,'doctor').ap,actor(stood,'doctor').ap-quote.pa);assert.ok(sameCell(actor(descended,'doctor'),start.climbLinks[0].from));
 const hand=policy.controller(descended,actor(descended,'doctor'));assert.deepEqual(hand,{type:'weapon',unitId:'doctor',slot:'medical'});orders.push(hand);const held=replay(start,orders),preview=medicalUsePreview(held,actor(held,'doctor'),actor(held,'patient'));assert.equal(preview.allowed,true);
 const aid=policy.controller(held,actor(held,'doctor'));assert.deepEqual(aid,{type:'useItem',unitId:'doctor',targetId:'patient'});orders.push(aid);const after=replay(start,orders);assert.equal(actor(after,'doctor').ap,actor(held,'doctor').ap-preview.cost);assert.equal(actor(after,'doctor').medkits,doctor.medkits-1);assert.equal(actor(after,'patient').hp,preview.treatment.hpAfter);assert.equal(actor(after,'patient').bleeding,preview.treatment.bleedingAfter);assert.ok(actor(after,'patient').hp>actor(start,'patient').hp||actor(after,'patient').bleeding<actor(start,'patient').bleeding);
 assert.equal(after.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);for(const u of start.units)assert.deepEqual(unitAmmunitionByType(actor(after,u.id)),unitAmmunitionByType(u));geometryAndGear(start,after);assert.deepEqual(start,before);
});

test('ordinary ground same-floor defence and false-option defaults keep their actual native work',()=>{
 const start=pursuitArena({ground:true}),before=structuredClone(start),guard=actor(start,'guard'),target=actor(start,'target'),policy=coordinatedHospitalBattery(start),explicit=coordinatedHospitalBattery(start,{coordinateSpentCrew:false,coordinatePhysicianHold:false});assert.ok(sameSurface(guard,target));
 const ordinary=northernHospitalCoverOrder(start,guard),action=policy.controller(start,guard);assert.deepEqual(action,ordinary);assert.deepEqual(explicit.controller(start,guard),action);assert.deepEqual(explicit.roles,policy.roles);assert.equal(policy.controller.sharedFallback,undefined);assert.deepEqual(action,{type:'melee',unitId:'guard',targetId:'target'});
 const preview=meleePreview(start,guard,target);assert.equal(preview.valid,true);const after=replay(start,[action]);assert.equal(actor(after,'guard').ap,guard.ap-preview.pa);assert.equal(after.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);assert.deepEqual(unitAmmunitionByType(actor(after,'guard')),unitAmmunitionByType(guard));geometryAndGear(start,after);assert.deepEqual(start,before);
});
