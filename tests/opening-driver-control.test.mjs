import test from 'node:test';
import assert from 'node:assert/strict';
import {fight} from './opening-driver.mjs';
test('the route controller leaves higher-skilled militia to their autonomous phase',()=>{
 const stop=new Error('first hired order reached');let reached=false;
 assert.throws(()=>fight({sector:'tucuman',squad:[{id:'hired-test',marksmanship:10},{id:'militia-test',militia:true,marksmanship:100}],enemies:[{id:'enemy-test'}]},null,{controller:(battle,unit)=>{
  assert.equal(unit.militia,undefined);assert.equal(unit.id,'hired-test');assert.ok(battle.units.some(u=>u.militia));reached=true;throw stop;
 }}),error=>error===stop);
 assert.equal(reached,true);
});
