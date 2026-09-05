import test from 'node:test';
import assert from 'node:assert/strict';
import {returnAmmunition} from '../game/ammunition.js';
test('real corpse ammunition depletion credits looted rounds while conserving source total',()=>{
 const request={issuedCartridges:10,squad:[{id:3,loaded:1,ammo:9}],enemies:[{id:'enemy-0',ammo:12}]};const reports=[{id:3,hp:80,loaded:1,ammo:21}];const snapshot={units:[{id:'3',side:'player',loaded:1,ammo:21},{id:'enemy-0',side:'enemy',hp:0,ammo:0}]};assert.equal(returnAmmunition(request,reports,snapshot),22);
 snapshot.units[1].ammo=7;assert.equal(returnAmmunition(request,reports,snapshot),15);assert.equal(returnAmmunition(request,reports,null),10);
});
test('a report cannot manufacture ammunition beyond the actual tactical record',()=>{
 const request={issuedCartridges:10,squad:[{id:3,loaded:1,ammo:9}],enemies:[]},snapshot={units:[{id:'3',side:'player',loaded:1,ammo:9}]};assert.throws(()=>returnAmmunition(request,[{id:3,hp:80,loaded:1,ammo:999}],snapshot));
});
