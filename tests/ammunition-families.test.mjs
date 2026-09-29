import test from 'node:test';
import assert from 'node:assert/strict';
import {AMMUNITION_FAMILIES,LEGACY_AMMUNITION,canonicalAmmunitionType,legacyWeaponAmmoType} from '../game/ammunition-families.js';

test('all nine firearms belong to exactly one of four gameplay families',()=>{
 assert.deepEqual(Object.keys(AMMUNITION_FAMILIES),['ammoMusket','ammoRifle','ammoPistol','ammoShot']);
 assert.deepEqual(Object.values(AMMUNITION_FAMILIES).flatMap(f=>f.weapons).sort((a,b)=>a-b),Array.from({length:9},(_,i)=>1800+i));
 for(const f of Object.values(AMMUNITION_FAMILIES)){
  assert.ok(Object.isFrozen(f)&&Object.isFrozen(f.weapons)&&Object.isFrozen(f.legacyTypes));
  assert.ok(f.art.endsWith('.webp'));assert.equal(f.legacyTypes.length,f.weapons.length);
  for(const weapon of f.weapons){const old=legacyWeaponAmmoType(weapon);assert.ok(f.legacyTypes.includes(old));assert.equal(canonicalAmmunitionType(old),f.type);assert.equal(LEGACY_AMMUNITION[old].weapon,weapon);}
 }
 assert.notEqual(canonicalAmmunitionType('musket_69'),canonicalAmmunitionType('pistol_69'));
 assert.equal(canonicalAmmunitionType('carbine_65'),canonicalAmmunitionType('musket_75'));
 assert.equal(canonicalAmmunitionType('scatter'),canonicalAmmunitionType('shot_16'));
 for(const value of [null,undefined,'constructor','__proto__','missing',1800])assert.equal(canonicalAmmunitionType(value),null);
 for(const value of [null,undefined,0,1809,'1800',{},NaN])assert.equal(legacyWeaponAmmoType(value),null);
});
