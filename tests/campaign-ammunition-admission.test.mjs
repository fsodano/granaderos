import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeSave,decodeSave} from '../game/save.js';
import {woundedGarrison} from './militia-care-fixture.mjs';
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

test('campaign admission keeps valid mixed militia reserves and legacy scalar records stable across repeated saves',()=>{
 const {campaign,patientId}=woundedGarrison(),wire=JSON.parse(encodeSave(campaign)),u=wire.campaign.garrisons.retiro.find(u=>u.id===patientId);
 u.ammunition={ammoMusket:2,ammoShot:3};u.ammo=5;
 const first=decodeSave(JSON.stringify(wire)),second=decodeSave(encodeSave(first.campaign));
 assert.deepEqual(second.campaign.garrisons.retiro.find(u=>u.id===patientId).ammunition,u.ammunition);
 assert.equal(second.campaign.garrisons.retiro.find(u=>u.id===patientId).ammo,5);
 delete u.ammunition;const legacy=decodeSave(JSON.stringify(wire));assert.equal(legacy.campaign.garrisons.retiro.find(u=>u.id===patientId).ammo,5);
});
