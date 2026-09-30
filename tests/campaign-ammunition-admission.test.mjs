import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeSave,decodeSave} from '../game/save.js';
import {woundedGarrison} from './militia-care-fixture.mjs';
import {ammunitionByType,addAmmunition} from '../game/ammunition-types.js';
import {syncUnitAmmunition} from '../game/tactical-ammunition.js';
import {normalizeAmmo} from '../game/ammo-types.js';
import {visit} from './local-contract-fixture.mjs';

const invalid=[{ammo:undefined,ammunition:{ammoShot:1}},{ammunition:{ammoFake:4}},{ammo:1,ammunition:{ammoShot:400}},{ammo:1,ammunition:{ammoShot:-4}},{ammo:1,ammunition:{ammoShot:1.5}},{ammunition:[]},{ammunition:null}];
test('campaign admission rejects malformed or inconsistent typed reserves in retained militia and pending deployment',()=>{
 const {campaign,patientId}=woundedGarrison(),entered=visit(campaign);
 for(const location of ['garrison','deployment'])for(const change of invalid){
  const wire=JSON.parse(encodeSave(location==='garrison'?campaign:entered.campaign));
  const records=location==='garrison'?wire.campaign.garrisons.retiro:wire.campaign.pendingBattle.garrison;
  Object.assign(records.find(u=>u.id===patientId),change);
  assert.throws(()=>decodeSave(JSON.stringify(wire)),/reserva|total/,`${location}: ${JSON.stringify(change)}`);
 }
});

test('campaign admission keeps physical mixed militia reserves stable across repeated saves',()=>{
 const {campaign,patientId}=woundedGarrison(),wire=JSON.parse(encodeSave(campaign)),u=wire.campaign.garrisons.retiro.find(u=>u.id===patientId);
 u.inventory=Object.fromEntries(Object.entries(u.inventory).filter(([,stack])=>stack.kind!=='ammunition'));
 addAmmunition(u,'musket_75',2);addAmmunition(u,'shot_16',3);syncUnitAmmunition(u);
 u.inventory.ammunition={name:'Estuche',count:1,weight:.1};
 const first=decodeSave(JSON.stringify(wire)),second=decodeSave(encodeSave(first.campaign)),restored=second.campaign.garrisons.retiro.find(u=>u.id===patientId);
 assert.deepEqual(ammunitionByType(restored),{musket_75:2,shot_16:3});
 assert.equal(restored.ammo,3,'scalar display counts only the held firearm family');
 assert.equal(restored.ammunition,undefined,'no second ammunition owner');
 assert.deepEqual(restored.inventory.ammunition,u.inventory.ammunition);
});

test('legacy militia reserves normalize once before modern campaign admission',()=>{
 for(const values of [{ammo:5},{ammo:5,ammunition:{ammoMusket:2,ammoShot:3}}]){
  const u={id:20000,militia:true,weapon:1804,inventory:{ammunition:{name:'Estuche',count:1,weight:.1}},...values};
  normalizeAmmo(u);const normalized=structuredClone(u);normalizeAmmo(u);
  assert.deepEqual(u,normalized);assert.equal(u.ammunition,undefined);assert.equal(u.ammunitionVersion,2);
  assert.deepEqual(ammunitionByType(u),values.ammunition?{musket_75:2,shot_16:3}:{shot_16:5});
  assert.deepEqual(u.inventory.ammunition,{name:'Estuche',count:1,weight:.1});
 }
});
