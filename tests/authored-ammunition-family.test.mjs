import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {compileWeaponDefinition,validateWeaponDefinition,weaponMetadata,weaponRecord} from '../game/weapon-definition.js';
import {AMMO_KEYS,ammoTypeFor,ammoCount,changeAmmo} from '../game/ammo-types.js';
import {createBattle,actBattle,reloadPlan} from '../game/tactical.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {buttstockField} from './buttstock-fixture.mjs';
import {saved,tactical} from './local-contract-fixture.mjs';
const original=()=>defaultContentPackage().weapons.find(w=>w.id==='firearm-1800');

test('authored firearm families issue and consume only the selected ammunition',()=>{
 for(const family of AMMO_KEYS){
  const gun={...original(),ammunitionFamily:family,alternativeLoads:original().alternativeLoads.filter(load=>load.family!==family)};
  let b=createBattle([{id:'p',weapon:1800,weaponMetadata:weaponMetadata(gun),loaded:0,ammo:3}],{width:8,height:8,exploration:true,enemies:[]});
  assert.equal(ammoTypeFor(b.units[0]),family);assert.equal(ammoTypeFor(compileWeaponDefinition(gun)),family);
  const other=AMMO_KEYS.find(key=>key!==family);changeAmmo(b.units[0],other,7);
  b=actBattle(b,{type:'reload',unitId:'p'});assert.equal(b.lastError,null);assert.equal(b.units[0].loaded,1);assert.equal(ammoCount(b.units[0],family),2);assert.equal(ammoCount(b.units[0],other),7);
 }
});

test('omitted family preserves old definitions and incompatible reserve cannot load an authored firearm',()=>{
 const old=compileWeaponDefinition(original());assert.equal(Object.hasOwn(old,'ammunitionFamily'),false);assert.doesNotThrow(()=>validateWeaponDefinition(old,1800));assert.equal(ammoTypeFor(old),'ammoMusket');
 const b=createBattle([{id:'p',weapon:1800,weaponMetadata:weaponMetadata({...original(),ammunitionFamily:'ammoRifle'}),loaded:0,ammo:0}],{width:8,height:8,exploration:true,enemies:[]});
 changeAmmo(b.units[0],'ammoMusket',3);assert.equal(reloadPlan(b.units[0],b).rounds,0);
 const denied=actBattle(b,{type:'reload',unitId:'p'});assert.match(denied.lastError,/cartuchos compatibles/);assert.deepEqual(denied.units,b.units);
});

test('invalid families, blade ammunition and changed pinned definitions are rejected',()=>{
 for(const family of ['unknown','constructor','',null,[],4]){
  const d=defaultContentPackage();d.weapons.find(w=>w.id==='firearm-1800').ammunitionFamily=family;
  assert.ok(validateContentPackage(d).length);assert.throws(()=>compileWeaponDefinition({...original(),ammunitionFamily:family}));
 }
 const d=defaultContentPackage();d.weapons.find(w=>w.id==='blade-1809').ammunitionFamily='ammoPistol';assert.ok(validateContentPackage(d).length);
 const p=buttstockField({stock:{ammunitionFamily:'ammoRifle'}}),wire=JSON.parse(encodeSave(p.campaign,p.battle)),u=wire.battle.units.find(u=>u.id==='110');
 u.weaponMetadata.contentWeapon={...weaponRecord(p.battle.units.find(u=>u.id==='110')).contentWeapon,ammunitionFamily:'ammoMusket'};
 assert.throws(()=>decodeSave(JSON.stringify(wire)),/arma/);
});

test('paid deployment and recovered weapons retain the authored family through full saves',()=>{
 let p=buttstockField({stock:{ammunitionFamily:'ammoRifle'}});const unit=()=>p.battle.units.find(u=>u.id==='110'),before=weaponRecord(unit());
 assert.equal(ammoTypeFor(unit()),'ammoRifle');assert.ok(ammoCount(unit(),'ammoRifle')>0);assert.equal(ammoCount(unit(),'ammoMusket'),0);
 const enemy=p.battle.units.find(u=>u.side==='enemy'&&u.weapon===1800);assert.ok(enemy);assert.equal(ammoTypeFor(enemy),'ammoRifle');assert.ok(ammoCount(enemy)>0);
 p=tactical(p,{type:'drop',unitId:'110',slot:'primary'});const dropped=p.battle.groundItems.find(g=>g.weapon===before.weapon&&g.count===1);assert.ok(dropped);assert.equal(ammoTypeFor(dropped),'ammoRifle');p=saved(p);
 p=tactical(p,{type:'loot',unitId:'110',groundId:dropped.id});p=saved(p);assert.equal(p.battle.groundItems.find(g=>g.id===dropped.id).count,0);const key=Object.keys(unit().inventory).find(k=>unit().inventory[k].weapon===before.weapon);assert.equal(ammoTypeFor(unit().inventory[key]),'ammoRifle');
 p=tactical(p,{type:'equipLoot',unitId:'110',inventoryKey:key});p=saved(p);assert.deepEqual(weaponRecord(unit()),before);assert.equal(ammoTypeFor(unit()),'ammoRifle');
});
