import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,weaponFor,bladeFor,hasFirearm,actionCosts,carriedWeight} from '../game/tactical.js';
import {FISTS,unarmedChance,unarmedImpact} from '../game/unarmed-combat.js';
import {seedCivilianHealth} from '../game/civilian-health.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {inventoryModel,orderDescriptors} from '../game/ja2-hud.js';
import {disarmedArrival} from './empty-hand-fixture.mjs';
import {saved,leave,visit,tactical} from './local-contract-fixture.mjs';
const fixture=(extra={})=>createBattle([{id:'p',x:1,y:1,weapon:0,blade:0,strength:100,dexterity:100,agility:100,...extra}],{width:10,height:8,enemies:[{id:'e',x:2,y:1,morale:100,energy:30,patrol:false,overwatch:false},{id:'far',x:9,y:7,patrol:false,overwatch:false}],seed:45});

test('a disarmed soldier uses a paid punch with small injury and separate breath loss instead of an unowned bayonet',()=>{
 const b=fixture();Object.assign(b.units[1],{horse:true,mounted:true,mount:{id:'target-horse',stamina:70,condition:100}});const before=structuredClone(b),n=actBattle(b,{type:'melee',unitId:'p',targetId:'e'});assert.equal(n.lastError,null);assert.equal(bladeFor(n.units[0]).id,FISTS.id);assert.equal(weaponFor(n.units[0]).name,'Puños');assert.equal(n.units[0].ap,88);assert.equal(n.units[1].hp,92);assert.equal(n.units[1].energy,0);assert.equal(n.units[1].unconscious,true);assert.equal(n.units[1].ap,0);assert.equal(n.units[1].maxAP,0);assert.equal(n.units[1].mounted,false);assert.equal(n.units[1].mount.stamina,70);assert.deepEqual(n.units[0].inventory,b.units[0].inventory);assert.deepEqual(b,before);assert.ok(validateBattleSnapshot(n));
 const loot=actBattle(n,{type:'loot',unitId:'p',targetId:'e',item:'weapon'});assert.equal(loot.lastError,null);assert.equal(loot.units[1].weaponDropped,true);assert.equal(bladeFor(loot.units[1]).id,0);assert.ok(actBattle(loot,{type:'loot',unitId:'p',targetId:'e',item:'weapon'}).lastError);
});
test('a lost primary and an empty selected secondary use fists while a retained selected blade keeps its actual definition',()=>{
 const b=fixture({weapon:1800,loaded:0,weaponDropped:true,blade:1809});const u=b.units[0];assert.equal(weaponFor(u).id,0);assert.equal(hasFirearm(u),false);assert.equal(actionCosts(b,u).melee,12);assert.equal(carriedWeight({...u,weapon:0,weaponDropped:false}),carriedWeight(u));
 const switched=actBattle(b,{type:'weapon',unitId:'p',slot:'blade'});assert.equal(switched.lastError,null);assert.equal(weaponFor(switched.units[0]).id,1809);assert.equal(bladeFor(switched.units[0]).id,1809);assert.equal(hasFirearm(switched.units[0]),false);
 u.weaponDropped=false;u.blade=0;u.activeSlot='blade';assert.equal(bladeFor(u).id,0);assert.equal(weaponFor(u).id,0);
});
test('a missed punch still spends its AP but cannot reduce health, breath or finite equipment',()=>{
 let b=fixture({strength:0,dexterity:0,agility:0,energy:20});Object.assign(b.units[1],{strength:100,dexterity:100,agility:100,energy:100});
 // Choose a declared seed with a failing first roll, not an assigned outcome.
 b.seed=1000;const n=actBattle(b,{type:'melee',unitId:'p',targetId:'e'});assert.equal(n.lastError,null);assert.equal(n.units[0].ap,88);assert.equal(n.units[1].hp,b.units[1].hp);assert.equal(n.units[1].energy,100);assert.notEqual(n.seed,b.seed);assert.match(n.log.at(-1),/falla el golpe/);
});
test('unarmed range, insufficient AP, brace and charge failures spend no resources or random roll',()=>{
 for(const [change,type]of [[b=>b.units[1].x=5,'melee'],[b=>b.units[0].ap=11,'melee'],[()=>{},'charge'],[()=>{},'brace']]){const b=fixture();change(b);const n=actBattle(b,{type,unitId:'p',targetId:'e'});assert.ok(n.lastError);assert.deepEqual(n.units,b.units);assert.equal(n.seed,b.seed);assert.equal(n.elapsedSeconds,b.elapsedSeconds);}
 const b=fixture(),controls=orderDescriptors(b,b.units[0]);assert.equal(controls.find(d=>d.id==='charge').disabled,true);assert.match(controls.find(d=>d.id==='melee').label,/manos vacías/);assert.equal(controls.find(d=>d.id==='melee').pa,12);
});
test('punch accuracy and impact depend on the declared attacker condition, attributes and defender awareness',()=>{
 const strong={strength:100,dexterity:100,agility:100,energy:100},weak={strength:20,dexterity:20,agility:20,energy:20},target={agility:75,dexterity:75,energy:100};assert.ok(unarmedChance(strong,target)>unarmedChance(weak,target));assert.ok(unarmedImpact(strong).breathLoss>unarmedImpact(weak).breathLoss);assert.ok(unarmedChance(weak,target,{aware:false})>unarmedChance(weak,target));assert.equal(unarmedChance(strong,{...target,unconscious:true}),95);
});
test('an actually disarmed paid arrival can recover, select the retained authored blade, save and return without restoring the primary',()=>{
 let p=disarmedArrival(),u=p.battle.units.find(u=>u.id==='111');assert.equal(u.weaponDropped,true);assert.equal(weaponFor(u).id,0);const weight=carriedWeight(u);p=tactical(p,{type:'weapon',unitId:'111',slot:'blade'});u=p.battle.units.find(u=>u.id==='111');assert.equal(weaponFor(u).name,'Sable conservado');assert.equal(weaponFor(u).art,'/art/weapon-1810.png');assert.equal(carriedWeight(u),weight);assert.ok(saved(p));
 p=visit(saved({campaign:leave(p)}).campaign);u=p.battle.units.find(u=>u.id==='111');assert.equal(u.weapon,0);assert.equal(hasFirearm(u),false);assert.equal(u.blade,1809);assert.equal(inventoryModel(p.battle,u).slots.blade.name,'Sable conservado');assert.ok(saved(p));
 p=disarmedArrival({secondary:false});assert.equal(p.battle.units.find(u=>u.id==='111').blade,0);assert.equal(weaponFor(p.battle.units.find(u=>u.id==='111')).id,0);assert.ok(saved(p));
});


test('a punch against a civilian uses the existing incident and breath model with intentional attribution',()=>{
 const b=fixture();b.npcs.push(seedCivilianHealth({id:'civil',name:'Habitante',x:2,y:2},{hp:100,maxHp:100,energy:30}));const n=actBattle(b,{type:'melee',unitId:'p',targetId:'civil'});assert.equal(n.lastError,null);const npc=n.npcs[0];assert.equal(npc.hp,92);assert.equal(npc.energy,0);assert.equal(npc.unconscious,true);assert.equal(npc.bleedSource.attackerId,'p');assert.equal(npc.bleedSource.intentional,true);assert.ok(validateBattleSnapshot(n));
});


test('choosing empty hands preserves an owned firearm, partial load, condition and carried weight then permits its paid return',()=>{
 const b=fixture({weapon:1800,loaded:0,reloadProgress:.4,condition:37,jammed:true,blade:1809,weaponReady:true});const weight=carriedWeight(b.units[0]);let n=actBattle(b,{type:'weapon',unitId:'p',slot:'unarmed'});assert.equal(n.lastError,null);assert.equal(n.units[0].activeSlot,'unarmed');assert.equal(n.units[0].ap,96);assert.equal(hasFirearm(n.units[0]),false);assert.equal(weaponFor(n.units[0]).id,0);assert.equal(n.units[0].weaponReady,undefined);assert.equal(carriedWeight(n.units[0]),weight);assert.ok(validateBattleSnapshot(n));
 n=actBattle(n,{type:'weapon',unitId:'p',slot:'primary'});assert.equal(n.lastError,null);assert.equal(n.units[0].ap,92);assert.equal(n.units[0].weapon,1800);assert.equal(n.units[0].loaded,0);assert.equal(n.units[0].reloadProgress,.4);assert.equal(n.units[0].condition,37);assert.equal(n.units[0].jammed,true);assert.equal(carriedWeight(n.units[0]),weight);assert.ok(validateBattleSnapshot(n));
});
test('a refused or repeated empty-hand selection preserves equipment, AP and random state',()=>{
 const b=fixture({weapon:1800});b.units[0].ap=3;const denied=actBattle(b,{type:'weapon',unitId:'p',slot:'unarmed'});assert.ok(denied.lastError);assert.deepEqual(denied.units,b.units);assert.equal(denied.seed,b.seed);
 b.units[0].ap=100;const ready=actBattle(b,{type:'weapon',unitId:'p',slot:'unarmed'});for(const slot of ['unarmed','unknown']){const n=actBattle(ready,{type:'weapon',unitId:'p',slot});assert.ok(n.lastError);assert.deepEqual(n.units,ready.units);assert.equal(n.seed,ready.seed);}
});
test('exploration can put the firearm away and restore it for one second each without spending AP or charges',()=>{
 let b=createBattle([{id:'p',weapon:1800,loaded:1}],{width:8,height:8,exploration:true,enemies:[]});b.units[0].ap=0;const start=b.elapsedSeconds;for(const slot of ['unarmed','primary']){b=actBattle(b,{type:'weapon',unitId:'p',slot});assert.equal(b.lastError,null);assert.equal(b.units[0].ap,0);assert.equal(b.units[0].loaded,1);}assert.equal(b.elapsedSeconds,start+2);assert.ok(validateBattleSnapshot(b));
});
