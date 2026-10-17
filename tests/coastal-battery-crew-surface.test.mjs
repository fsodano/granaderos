import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,artilleryContact,artilleryCrewPlan,artilleryCosts,medicalUsePreview,teamCanSee} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {sameSurface} from '../game/tactical-space.js';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';

// Fresh native declarations only. No captured failure, returned state edits,
// gifted AP/clock/health/resources or fixed native victory is an action input.
const flat=()=>Array.from({length:320},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0}));
const roof=()=>Array.from({length:27},(_,i)=>({id:`roof:${i}`,x:5+i%9,y:3+Math.floor(i/9),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}));
const member=(battle,id)=>battle.units.find(unit=>unit.id===id);
const person=(id,x,y,extra={})=>({id,name:id,x,y,weapon:0,blade:0,loaded:0,ammo:0,medical:0,medkits:0,stance:'crouched',facing:2,energy:100,morale:90,...extra});
function arena({combat=false,roofOnly=false,care=false}={}){
 const people=[person('a-roof',6,4,{tacticalLevel:1,...(roofOnly?{weapon:1800,loaded:1,ammo:2,marksmanship:90}:{}),...(care?{medical:90,medkits:2,activeSlot:'medical'}:{})})];
 if(!roofOnly)people.push(person('b-ground',5,5),person('c-ground',5,6));
 if(care)people.push(person('roof-patient',7,4,{tacticalLevel:1,hp:8,maxHp:100,bleeding:2,bandaged:90}));
 return createBattle(people,{id:'declared-coastal-surface',sector:'declared-coastal-surface',width:20,height:16,tiles:flat(),upperSurfaces:roof(),hour:12,seed:45,exploration:!combat,
  artillery:[{id:'local-gun',type:'bronze4',side:'player',x:6,y:5,facing:0,loaded:true,ammo:2}],
  enemies:combat?[person('target',14,5,{side:'enemy',hp:100,maxHp:100,patrol:false,overwatch:false})]:[],
 });
}
function replay(start,orders){
 let direct=structuredClone(start),presented=structuredClone(start),stored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));
  presented=presentedActBattle(presented,JSON.parse(JSON.stringify(action))).state;assert.deepEqual(presented,direct);
  stored=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(stored,JSON.parse(JSON.stringify(action))))));assert.deepEqual(stored,direct);
 }
 return direct;
}
function finitePersonal(start,end){for(const unit of start.units){const next=member(end,unit.id);assert.deepEqual(unitAmmunitionByType(next),unitAmmunitionByType(unit));for(const key of ['inventory','weapon','blade','weaponInstanceId','weaponMetadata','outfit','headwear','legwear'])assert.deepEqual(next[key],unit[key]);}}

test('a nearer roof actor is not the ground gun leader; its two actual ground crew pay a real translated advance',()=>{
 const start=arena(),before=structuredClone(start),gun=start.artillery[0],upper=member(start,'a-roof'),ground=member(start,'b-ground'),helper=member(start,'c-ground');
 assert.equal(Math.hypot(upper.x-gun.x,upper.y-gun.y),1);assert.equal(sameSurface(upper,gun),false);assert.equal(artilleryContact(start,upper,gun),false);
 const cost=artilleryCosts(start,ground,gun).move;
 assert.ok(artilleryCrewPlan(start,upper,gun,cost).reason);const native=artilleryCrewPlan(start,ground,gun,cost);assert.equal(native.reason,null);assert.deepEqual(native.crew,['b-ground','c-ground']);
 const action=coastalBatteryController(start,{sharedArtillerySight:true})(start,ground);assert.equal(action?.type,'artilleryMove');assert.equal(action.unitId,ground.id);
 const moved=replay(start,[action]),next=moved.artillery[0],dx=next.x-gun.x,dy=next.y-gun.y;assert.equal(Math.abs(dx)+Math.abs(dy),1);
 for(const id of native.crew){assert.deepEqual([member(moved,id).x,member(moved,id).y],[member(start,id).x+dx,member(start,id).y+dy]);assert.equal(member(moved,id).ap,member(start,id).ap,'native exploration work charges clock instead of combat AP');}
 assert.deepEqual(member(moved,upper.id),upper);assert.equal(moved.elapsedSeconds,start.elapsedSeconds+Math.max(1,Math.ceil(cost*.06)));assert.equal(next.loaded,gun.loaded);assert.equal(next.ammo,gun.ammo);
 finitePersonal(start,moved);assert.deepEqual(moved.upperSurfaces,start.upperSurfaces);assert.deepEqual(moved.tiles,start.tiles);assert.deepEqual(start,before);
});

test('same-floor finite roof aid remains first even while the capable ground crew and charged gun exist',()=>{
 const start=arena({care:true,combat:true}),before=structuredClone(start),doctor=member(start,'a-roof'),patient=member(start,'roof-patient'),preview=medicalUsePreview(start,doctor,patient);
 assert.equal(preview.allowed,true);assert.equal(sameSurface(doctor,start.artillery[0]),false);
 const action=coastalBatteryController(start,{sharedArtillerySight:true})(start,doctor);assert.deepEqual(action,{type:'useItem',unitId:doctor.id,targetId:patient.id});
 const result=replay(start,[action]);assert.equal(member(result,doctor.id).ap,doctor.ap-preview.cost);assert.equal(member(result,doctor.id).medkits,doctor.medkits-1);
 assert.equal(member(result,patient.id).hp,preview.treatment.hpAfter);assert.equal(member(result,patient.id).bleeding,preview.treatment.bleedingAfter);assert.ok(member(result,patient.id).hp>patient.hp||member(result,patient.id).bleeding<patient.bleeding);
 assert.deepEqual(result.artillery,start.artillery);finitePersonal(start,result);assert.deepEqual(start,before);
});

test('an opposite-surface actor alone never supplies a phantom ground crew or receives a gun order',()=>{
 const start=arena({roofOnly:true,combat:true}),before=structuredClone(start),unit=member(start,'a-roof'),gun=start.artillery[0];
 assert.equal(artilleryContact(start,unit,gun),false);assert.ok(artilleryCrewPlan(start,unit,gun,artilleryCosts(start,unit,gun).fire).reason);
 const ordinary=tucumanCombatOrder(start,unit),action=coastalBatteryController(start,{sharedArtillerySight:true})(start,unit);assert.deepEqual(action,ordinary);
 assert.ok(!['artillery','artilleryMove','artilleryPivot','artilleryReload'].includes(action?.type));assert.deepEqual(start,before);assert.deepEqual(start.artillery,[gun]);
 if(action){const result=replay(start,[action]);assert.deepEqual(result.artillery,start.artillery);}
});

test('real ground contact keeps a safe finite artillery shot and exact combat crew AP/replay',()=>{
 const start=arena({combat:true}),before=structuredClone(start),unit=member(start,'b-ground'),target=member(start,'target'),gun=start.artillery[0];assert.equal(teamCanSee(start,'player',target),true);
 const action=coastalBatteryController(start,{sharedArtillerySight:true})(start,unit);assert.equal(action?.type,'artillery');assert.equal(action.artilleryId,gun.id);
 const cost=artilleryCosts(start,unit,gun).fire,native=artilleryCrewPlan(start,unit,gun,cost);assert.equal(native.reason,null);assert.deepEqual(native.crew,['b-ground','c-ground']);
 const result=replay(start,[action]);for(const id of native.crew)assert.equal(member(result,id).ap,member(start,id).ap-cost);assert.equal(result.artillery[0].loaded,false);assert.equal(result.artillery[0].ammo,gun.ammo);
 assert.equal(Number(result.artillery[0].loaded)+result.artillery[0].ammo,Number(gun.loaded)+gun.ammo-1);finitePersonal(start,result);assert.equal(member(result,'a-roof').hp,member(start,'a-roof').hp);assert.deepEqual(start,before);
});
