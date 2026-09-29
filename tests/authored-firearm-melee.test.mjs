import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,bladeFor,actionCosts,carriedWeight} from '../game/tactical.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {compileWeaponDefinition,validateWeaponDefinition,weaponMetadata,weaponRecord} from '../game/weapon-definition.js';
import {orderDescriptors} from '../game/ja2-hud.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {saved,tactical} from './local-contract-fixture.mjs';
import {buttstockField} from './buttstock-fixture.mjs';
const weapon=()=>defaultContentPackage().weapons.find(w=>w.id==='firearm-1800');

test('stock attributes drive actual melee costs, damage and contact reach without changing the firearm mechanism',()=>{
 const gun={...weapon(),stockAP:23,stockDamage:9,stockReach:1},b=createBattle([{id:'p',x:1,y:1,weapon:1800,weaponMetadata:weaponMetadata(gun)}],{width:10,height:8,enemies:[{id:'e',x:2,y:1,weapon:1800,morale:100},{id:'far',x:9,y:7,patrol:false}]});
 const record=weaponRecord(b.units[0]),weight=carriedWeight(b.units[0]);assert.equal(orderDescriptors(b,b.units[0]).find(d=>d.id==='melee').pa,23);const n=actBattle(b,{type:'melee',unitId:'p',targetId:'e'});assert.equal(n.lastError,null);assert.equal(n.units[0].ap,77);assert.equal(n.units[1].hp,91);assert.deepEqual(weaponRecord(n.units[0]),record);assert.equal(carriedWeight(n.units[0]),weight);
 b.units[1].y=2;const denied=actBattle(b,{type:'melee',unitId:'p',targetId:'e'});assert.ok(denied.lastError);assert.deepEqual(denied.units,b.units);assert.equal(denied.seed,b.seed);
});
test('omitted stock attributes preserve older inline definitions and partial overrides do not invent authored values',()=>{
 const old=compileWeaponDefinition(weapon());for(const key of ['stockAP','stockDamage','stockReach'])assert.equal(Object.hasOwn(old,key),false);assert.doesNotThrow(()=>validateWeaponDefinition(old,1800));
 const b=createBattle([{id:'p',weapon:1800,weaponMetadata:weaponMetadata({...weapon(),stockDamage:11})}],{exploration:true,enemies:[]});assert.equal(actionCosts(b,b.units[0]).melee,16);assert.equal(bladeFor(b.units[0]).damage,11);assert.equal(bladeFor(b.units[0]).reach,1.5);
 const p=buttstockField(),wire=JSON.parse(encodeSave(p.campaign,p.battle));wire.battle.units.find(u=>u.id==='110').weaponMetadata.contentWeapon=weaponRecord(p.battle.units.find(u=>u.id==='110')).contentWeapon;assert.ok(decodeSave(JSON.stringify(wire)));
});
test('invalid stock costs, force, range and forged definition keys cannot launch or enter saves',()=>{
 for(const [key,value]of [['stockAP',0],['stockAP',1.5],['stockAP',101],['stockDamage',0],['stockDamage',101],['stockDamage',null],['stockReach',0],['stockReach',2],['stockReach','1'],['stockReach',Infinity]]){
  const d=defaultContentPackage();d.weapons.find(w=>w.id==='firearm-1800')[key]=value;assert.ok(validateContentPackage(d).length);assert.throws(()=>compileWeaponDefinition({...weapon(),[key]:value}));
 }
 assert.throws(()=>validateWeaponDefinition({...compileWeaponDefinition(weapon()),stockFree:true},1800));
 const p=buttstockField({stock:{stockAP:23,stockDamage:9,stockReach:1}}),wire=JSON.parse(encodeSave(p.campaign,p.battle)),u=wire.battle.units.find(u=>u.id==='110');u.weaponMetadata.contentWeapon={...weaponRecord(p.battle.units.find(u=>u.id==='110')).contentWeapon,stockDamage:10};assert.throws(()=>decodeSave(JSON.stringify(wire)),/arma/);
});
test('a paid authored gun keeps its stock profile after a real strike, drop, recovery, equip and full campaign saves',()=>{
 let p=buttstockField({stock:{stockAP:23,stockDamage:9,stockReach:1}});const target=p.target,record=weaponRecord(p.battle.units.find(u=>u.id==='110'));p=tactical(p,{type:'melee',unitId:'110',targetId:target});assert.equal(p.battle.units.find(u=>u.id==='110').ap,77);p=saved(p);
 p=tactical(p,{type:'drop',unitId:'110',slot:'primary'});assert.equal(p.battle.droppedWeapons[0].contentWeapon.stockDamage,9);p=saved(p);p=tactical(p,{type:'loot',unitId:'110',dropIndex:0});p=saved(p);const key=Object.keys(p.battle.units.find(u=>u.id==='110').inventory).find(k=>k.includes('drop0'));p=tactical(p,{type:'equipLoot',unitId:'110',inventoryKey:key});p=saved(p);const u=p.battle.units.find(u=>u.id==='110');assert.deepEqual(weaponRecord(u),record);assert.equal(actionCosts(p.battle,u).melee,23);assert.equal(bladeFor(u).reach,1);
});
