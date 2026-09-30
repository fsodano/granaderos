import test from 'node:test';
import assert from 'node:assert/strict';
import {AMMO_KEYS,ammoStock,ammoCount,normalizeAmmo,changeAmmo,validateAmmo} from '../game/ammo-types.js';
import {ammunitionByType,weaponAmmoType} from '../game/ammunition-types.js';
import {initializeUnitAmmunition,consumeWeaponAmmunition} from '../game/tactical-ammunition.js';

const saved=()=>({weapon:1800,loaded:1,condition:62,jammed:true,ammo:26,ammunition:{ammoMusket:17,ammoRifle:3,ammoPistol:2,ammoShot:4},inventory:{letter:{name:'Carta',count:1,weight:0}},pocketOrder:[{slotId:'small-2',item:'ammoShot',index:0,count:4}]});
test('published family saves acquire physical pockets once without converting or duplicating reserves',()=>{
 const actor=saved(),original=structuredClone(actor);normalizeAmmo(actor);
 assert.equal(actor.ammunitionVersion,2);assert.equal(actor.ammunition,undefined);assert.equal(actor.ammo,17);
 assert.deepEqual(ammunitionByType(actor),{musket_75:17,rifle_62:3,pistol_69:2,shot_16:4});
 assert.deepEqual(ammoStock(actor),original.ammunition);
 for(const field of ['loaded','condition','jammed'])assert.equal(actor[field],original[field]);
 assert.deepEqual(actor.inventory.letter,original.inventory.letter);
 assert.equal(actor.pocketOrder[0].slotId,'small-2');assert.equal(actor.pocketOrder[0].count,4);
 const hint=actor.pocketOrder[0].item.slice('inventory:'.length);assert.equal(actor.inventory[hint].ammoType,'shot_16');
 const once=structuredClone(actor);normalizeAmmo(actor);assert.deepEqual(actor,once);
 const restored=JSON.parse(JSON.stringify(actor));validateAmmo(restored);assert.deepEqual(restored,once);
});

test('alternate loads use the selected physical family and preserve other weapon reserves',()=>{
 for(const weapon of [1800,1801,1803,1805,1806,1808]){
  const actor={...saved(),weapon,ammunitionChoice:'ammoShot'};normalizeAmmo(actor);
  assert.equal(weaponAmmoType(actor),'shot_16');assert.equal(actor.ammo,4);
  consumeWeaponAmmunition(actor,weapon,2);assert.equal(actor.ammo,2);
  assert.deepEqual(ammoStock(actor),{ammoMusket:17,ammoRifle:3,ammoPistol:2,ammoShot:2});
  changeAmmo(actor,'ammoRifle',-1);assert.equal(actor.ammo,2);assert.equal(ammoCount(actor,'ammoRifle'),2);
 }
 const authored={...saved(),weaponMetadata:{contentWeapon:{template:1800,ammunitionFamily:'ammoPistol',alternativeLoads:[{family:'ammoRifle',damage:30,range:12,pattern:'single'}]}},ammunitionChoice:'ammoRifle'};
 normalizeAmmo(authored);assert.equal(authored.ammo,3);assert.equal(weaponAmmoType(authored),'rifle_62');
 consumeWeaponAmmunition(authored,1800,1);assert.equal(authored.ammo,2);
});

test('ambiguous or forged ammunition ownership rejects without changing the actor',()=>{
 for(const patch of [
  {ammo:27},
  {ammunition:{ammoMusket:-1}},
  {ammunition:{unknown:26}},
  {inventory:{physical:{kind:'ammunition',ammoType:'musket_75',count:2,weight:.04,name:'Cartuchos de mosquete'}}},
  {ammunitionVersion:2},
 ]){
  const actor={...saved(),...patch},before=structuredClone(actor);
  assert.throws(()=>initializeUnitAmmunition(actor));assert.deepEqual(actor,before);
 }
});
