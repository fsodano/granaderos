import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,planSwapHands,swapHandsPreview,actionCosts,weaponFor,canSee} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {handRecord,inventoryUsage} from '../game/tactical-inventory.js';
import {ammunitionByType,totalReserveAmmunition} from '../game/ammunition-types.js';
import {defaultContentPackage} from '../game/content-package.js';
import {weaponMetadata} from '../game/weapon-definition.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const spare={weapon:1806,count:1,weight:1.3,loaded:1,condition:100,instanceId:'owned-backup'};
const tiles=Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0}));
const enemy=s=>s.units.find(u=>u.id==='e');
const target=s=>s.units.find(u=>u.id==='p');
const restored=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
function field(patch={}){const s=createBattle([{id:'p',x:12,y:3,facing:6,loaded:0,ammo:0,experienceLevel:1}],{width:20,height:8,seed:45,tiles,enemies:[{id:'e',x:6,y:3,facing:2,weapon:1805,weaponInstanceId:'owned-empty',loaded:0,ammo:0,priming:0,medkits:0,patrol:false,marksmanship:100,condition:64,offHand:spare,...patch}]});target(s).ap=0;enemy(s).ap=patch.ap??14;return s;}
function supplies(u){return Object.fromEntries(['medkits','rations','torches','boleadoras'].map(k=>[k,u[k]]));}

test('an empty main gun uses one paid swap and a separate shot from its exact loaded other-hand gun',()=>{
 const s=field(),before=structuredClone(s),u=enemy(s),old=handRecord(u,'primary'),prepared=planSwapHands(u),source=handRecord(prepared,'primary'),ownTurn={...s,phase:'enemy'},preview=swapHandsPreview(ownTurn,u);
 assert.equal(preview.valid,true);assert.equal(preview.pa,4);assert.deepEqual(chooseEnemyAction(s,u),{type:'swapHands',unitId:'e'});assert.deepEqual(s,before);
 const n=endTurn(s),v=enemy(n);assert.equal(n.lastError,null);assert.equal(v.weaponInstanceId,'owned-backup');assert.equal(v.weapon,1806);assert.equal(v.loaded,source.loaded-1);assert.equal(v.condition,source.condition-1);assert.deepEqual(v.offHand,old);assert.equal(v.ap,2,'one four-AP swap then one eight-AP shot');assert.ok(target(n).hp<100);assert.equal(n.elapsedSeconds,6);assert.deepEqual(v.inventory,u.inventory);assert.deepEqual(ammunitionByType(v),ammunitionByType(u));assert.equal(totalReserveAmmunition(v),0);assert.deepEqual(supplies(v),supplies(u));assert.deepEqual([v.x,v.y,v.stance],[u.x,u.y,u.stance]);assert.equal(n.log.filter(l=>l.includes('prepara el arma de la otra mano')).length,1);assert.deepEqual(n,endTurn(restored(s)));assert.doesNotThrow(()=>restored(n));
});

test('the shared affordable shot gate does not swap when swap plus a useful shot cannot fit',()=>{
 for(const weaponReady of [false,true]){const enough=field({ap:10,weaponReady}),short=field({ap:9,weaponReady}),prepared=planSwapHands(enemy(enough));assert.equal(swapHandsPreview({...enough,phase:'enemy'},enemy(enough)).pa,4);assert.equal(prepared.weaponReady,undefined);assert.equal(actionCosts(enough,prepared,target(enough)).fire,6);assert.equal(chooseEnemyAction(enough,enemy(enough)).type,'swapHands');assert.notEqual(chooseEnemyAction(short,enemy(short))?.type,'swapHands');
 const before=structuredClone(short),n=endTurn(short);assert.equal(enemy(n).offHand.loaded,1);assert.equal(enemy(n).weaponInstanceId,'owned-empty');assert.deepEqual(short,before);}
});

test('empty, failed-ignition and broken other-hand guns cannot become ready backups',()=>{
 for(const change of [{loaded:0},{jammed:true},{condition:0}]){const s=field({offHand:{...spare,...change}}),before=structuredClone(s);assert.notEqual(chooseEnemyAction(s,enemy(s))?.type,'swapHands');const n=endTurn(s);assert.equal(n.lastError,null);assert.deepEqual(enemy(n).offHand,enemy(s).offHand);assert.equal(enemy(n).weaponInstanceId,'owned-empty');assert.deepEqual(s,before);}
});

test('missing or unsupported other-hand records never fabricate a weapon or charge',()=>{
 for(const record of [undefined,{...spare,weapon:1700},{count:1,weight:1,loaded:1},{...spare,count:0},{...spare,count:2}]){const s=field({offHand:undefined}),u=enemy(s);if(record)u.offHand=structuredClone(record);const before=structuredClone(s);assert.notEqual(chooseEnemyAction(s,u)?.type,'swapHands');assert.deepEqual(s,before);}
});

test('a ready main gun and immediate blade keep their existing priority',()=>{
 const loaded=field({loaded:1});assert.equal(chooseEnemyAction(loaded,enemy(loaded)).type,'fire');
 const melee=field({blade:1813,activeSlot:'blade'});target(melee).x=7;assert.equal(chooseEnemyAction(melee,enemy(melee)).type,'melee');
});

test('a valid other-hand double barrel retains real capacity, unrelated ammunition and incomplete displaced work',()=>{
 const s=field({offHand:{...spare,weapon:1808,loaded:2,instanceId:'owned-double'},reloadProgress:.375}),u=enemy(s);u.inventory['ammo:musket_75']={kind:'ammunition',ammoType:'musket_75',count:3,weight:.04,name:'Cartuchos de mosquete'};const old=handRecord(u,'primary'),before=structuredClone(s),n=endTurn(s),v=enemy(n);
 assert.equal(n.lastError,null);assert.equal(weaponFor(v).capacity,2);assert.equal(v.loaded,1);assert.equal(v.weaponInstanceId,'owned-double');assert.deepEqual(v.offHand,old);assert.deepEqual(ammunitionByType(v),ammunitionByType(u));assert.equal(totalReserveAmmunition(v),3);assert.deepEqual(supplies(v),supplies(u));assert.deepEqual(n,endTurn(restored(s)));assert.deepEqual(s,before);
});

test('a two-handed displaced gun still needs real pack capacity before the paid swap',()=>{
 const s=field({weapon:1800,activeSlot:'primary',ammo:60,inventory:Object.fromEntries(Array.from({length:4},(_,i)=>['long-'+i,{weapon:1800,count:1,weight:4,loaded:0}]))}),u=enemy(s);for(const slot of inventoryUsage(u).slots.filter(slot=>!slot.entry))u.inventory['full-'+slot.id]={count:1,weight:.1};assert.equal(inventoryUsage(u).used,12);assert.equal(inventoryUsage(u).overloaded,false);assert.doesNotThrow(()=>restored(s));assert.throws(()=>planSwapHands(u));assert.equal(swapHandsPreview({...s,phase:'enemy'},u).valid,false);const before=structuredClone(s);assert.notEqual(chooseEnemyAction(s,u)?.type,'swapHands');assert.deepEqual(s,before);
});

test('a paid other-hand swap and shot survive a nested saved player interruption without repetition',()=>{
 const s=field({experienceLevel:5,ap:14});Object.assign(target(s),{ap:24,agility:30,experienceLevel:1});s.units.push({...structuredClone(target(s)),id:'observer',x:12,y:5,facing:2,loaded:1,ap:20,agility:100,experienceLevel:10});const paused=actBattle(s,{type:'move',unitId:'p',x:11,y:3});assert.equal(paused.lastError,null);assert.equal(paused.phase,'interrupt');assert.equal(paused.interrupt.returnTo,'reaction');assert.ok(paused.interrupt.unitIds.includes('observer'));assert.equal(enemy(paused).weaponInstanceId,'owned-backup');assert.equal(enemy(paused).loaded,0);assert.equal(enemy(paused).ap,4);const n=endTurn(restored(paused));assert.deepEqual(n,endTurn(paused));assert.equal(n.elapsedSeconds,6);assert.equal(n.turn,1);assert.equal(n.phase,'player');assert.equal(enemy(n).weaponInstanceId,'owned-backup');assert.equal(enemy(n).loaded,0);assert.equal(enemy(n).ap,4);assert.equal(n.log.filter(l=>l.includes('prepara el arma de la otra mano')).length,1);assert.doesNotThrow(()=>restored(n));
});


test('a healthy charged backup can replace a jammed main gun without spending its priming stock',()=>{
 const s=field({loaded:1,jammed:true,priming:2,weaponReady:false}),u=enemy(s),old=handRecord(u,'primary'),before=structuredClone(s);
 assert.deepEqual(chooseEnemyAction(s,u),{type:'swapHands',unitId:'e'});
 const n=endTurn(s),v=enemy(n);assert.equal(n.lastError,null);assert.deepEqual(v.offHand,old);assert.equal(v.offHand.jammed,true);assert.equal(v.offHand.loaded,1);assert.equal(v.priming,u.priming);assert.equal(v.loaded,0);assert.equal(v.ap,2);assert.deepEqual(s,before);
});

test('a full legal pack does not prevent swapping two held pistols',()=>{
 const s=field({ammo:240,priming:0,flints:0,medkits:0,rations:0,torches:0,boleadoras:0}),u=enemy(s),before=structuredClone(s);
 assert.equal(inventoryUsage(u).free,0);assert.equal(inventoryUsage(u).overloaded,false);assert.doesNotThrow(()=>restored(s));
 assert.deepEqual(chooseEnemyAction(s,u),{type:'swapHands',unitId:'e'});
 const n=endTurn(s),v=enemy(n);assert.equal(n.lastError,null);assert.deepEqual(v.inventory,u.inventory);assert.deepEqual(ammunitionByType(v),ammunitionByType(u));assert.equal(totalReserveAmmunition(v),240);assert.equal(inventoryUsage(v).overloaded,false);assert.deepEqual(v.offHand,handRecord(u,'primary'));assert.equal(v.loaded,0);assert.equal(v.ap,2);assert.deepEqual(s,before);
});

test('backup scoring sees observed targets and does not read their hidden bodies or private supplies',()=>{
 const s=field(),other=structuredClone(s);Object.assign(target(other),{energy:2,ammo:500,medical:99,inventory:{secret:{count:1,weight:1}}});
 other.units.push({...structuredClone(target(other)),id:'hidden',x:0,y:7,hp:100});assert.equal(canSee(other,enemy(other),other.units.at(-1)),false);
 const before=structuredClone(other);assert.deepEqual(chooseEnemyAction(other,enemy(other)),chooseEnemyAction(s,enemy(s)));other.units.reverse();assert.deepEqual(chooseEnemyAction(other,enemy(other)),chooseEnemyAction(s,enemy(s)));other.units.reverse();assert.deepEqual(other,before);
 const unseen=field({ammo:1});target(unseen).x=0;target(unseen).y=7;assert.equal(canSee(unseen,enemy(unseen),target(unseen)),false);assert.notEqual(chooseEnemyAction(unseen,enemy(unseen))?.type,'swapHands','serviceable main gun with no observed contact does not cause a spare swap');
 const blocked=field({ap:10});blocked.units.push({...structuredClone(enemy(blocked)),id:'friend',x:9,y:3,offHand:undefined,weaponInstanceId:'friend-gun'});assert.notEqual(chooseEnemyAction(blocked,enemy(blocked))?.type,'swapHands','an admitted friendly body blocks the useful shot');
});

test('an owned other-hand option competes deterministically with the existing prepared pack option',()=>{
 const s=field({inventory:{z:{...spare,instanceId:'pack-z'},a:{...spare,instanceId:'pack-a'}}}),before=structuredClone(s);
 const choice=chooseEnemyAction(s,enemy(s));assert.deepEqual(choice,{type:'equipLoot',unitId:'e',inventoryKey:'a'},'the pack option keeps the charged left gun for a useful paired shot');enemy(s).inventory={a:enemy(s).inventory.a,z:enemy(s).inventory.z};assert.deepEqual(chooseEnemyAction(s,enemy(s)),choice);assert.deepEqual(chooseEnemyAction(before,enemy(before)),choice);enemy(s).ap=10;assert.deepEqual(chooseEnemyAction(s,enemy(s)),{type:'swapHands',unitId:'e'},'only the four-AP swap leaves enough AP for a shot');
});

test('the paid swap retains authored gun data, owned fittings and typed reserves exactly',()=>{
 const definition={...defaultContentPackage().weapons.find(w=>w.template===1808),id:'owned-double-variant',name:'Pistola personal',capacity:2};
 const s=field({weapon:1800,activeSlot:'primary',loaded:0,reloadProgress:.375,weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'owned-bayonet',condition:57}},weaponMetadata:{provenance:{owner:'Compañía 1'}},offHand:{...spare,weapon:1808,loaded:2,...weaponMetadata(definition),ammunitionChoice:'ammoPistol',provenance:{owner:'Oficial'},name:'Marca propia'},ap:16}),u=enemy(s),old=handRecord(u,'primary'),incoming=handRecord(u,'offhand'),planned=planSwapHands(u);
 u.inventory['ammo:musket_75']={kind:'ammunition',ammoType:'musket_75',count:3,weight:.04,name:'Cartuchos de mosquete'};const input=structuredClone(s);
 assert.deepEqual(handRecord(planned,'primary'),incoming);assert.equal(planned.weaponReady,undefined);assert.deepEqual(Object.values(planned.inventory).find(r=>r.instanceId==='owned-empty'),old);assert.deepEqual(chooseEnemyAction(s,u),{type:'swapHands',unitId:'e'});
 const n=endTurn(s),v=enemy(n),after=handRecord(v,'primary');assert.equal(n.lastError,null);assert.equal(after.loaded,incoming.loaded-1);assert.equal(after.condition,incoming.condition-1);assert.deepEqual({...after,loaded:incoming.loaded,condition:incoming.condition},incoming);assert.deepEqual(Object.values(v.inventory).find(r=>r.instanceId==='owned-empty'),old);assert.deepEqual(ammunitionByType(v),ammunitionByType(u));assert.equal(totalReserveAmmunition(v),3);assert.equal(v.offHand,undefined);assert.deepEqual(s,input);assert.deepEqual(n,endTurn(restored(s)));assert.doesNotThrow(()=>restored(n));
});
