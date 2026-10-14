import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,artilleryCrewPlan,artilleryCosts,stanceCost,medicalUsePreview} from '../game/tactical.js';
import {heavyContactCrewController} from './stable-crew-driver.mjs';

test('a prone three-person field-gun crew pays to rise, then fires its finite loaded charge',()=>{
 let battle=createBattle([{id:'leader',x:2,y:5,facing:2},{id:'helper-a',x:3,y:4,facing:2},{id:'helper-b',x:3,y:6,facing:2}],{
  width:24,height:12,hour:12,seed:45,
  tiles:Array.from({length:288},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass'})),
  enemies:[{id:'target',x:15,y:5,patrol:false,overwatch:false}],
  artillery:[{id:'field-gun',side:'player',type:'field8',x:3,y:5,facing:0,loaded:true,ammo:2}],
 });
 // Use the ordinary reducer to put all three living contact crew members prone.
 for(const id of ['leader','helper-a','helper-b']){
  battle=actBattle(battle,{type:'stance',unitId:id,stance:'prone'});assert.equal(battle.lastError,null);
 }
 const before=structuredClone(battle),controller=heavyContactCrewController({holdCommand:false}),leader=battle.units.find(u=>u.id==='leader');
 assert.ok(artilleryCrewPlan(battle,leader,battle.artillery[0],0).reason,'a prone crew cannot yet handle the gun');
 const actions=[];
 for(const id of ['leader','helper-a','helper-b']){
  const unit=battle.units.find(u=>u.id===id),action=controller(battle,unit),cost=stanceCost(unit,'crouched');
  assert.deepEqual(action,{type:'stance',unitId:id,stance:'crouched'});
  const next=actBattle(battle,action);assert.equal(next.lastError,null);assert.equal(next.units.find(u=>u.id===id).ap,unit.ap-cost);
  assert.equal(next.artillery[0].loaded,true);assert.equal(next.artillery[0].ammo,2);actions.push(action);battle=next;
  assert.notEqual(controller(battle,battle.units.find(u=>u.id===id))?.stance,'prone','an incomplete neighbouring heavy crew cannot make a member lie down again');
 }
 const gun=battle.artillery[0],gunner=battle.units.find(u=>u.id==='leader'),plan=artilleryCrewPlan(battle,gunner,gun,artilleryCosts(battle,gunner,gun).fire);
 assert.equal(plan.reason,null);assert.equal(plan.crew.length,3);
 const shot=controller(battle,gunner);assert.equal(shot?.type,'artillery');
 const fired=actBattle(battle,shot);assert.equal(fired.lastError,null);assert.equal(fired.artillery[0].loaded,false);assert.equal(fired.artillery[0].ammo,2);
 assert.ok(fired.units.find(u=>u.id==='target').hp<battle.units.find(u=>u.id==='target').hp);
 let replay=before;
 for(const action of [...actions,shot])replay=actBattle(replay,action);
 assert.deepEqual(replay,fired);assert.ok(before.units.filter(u=>u.side==='player').every(u=>u.stance==='prone'));
});

test('an actual supplied contact physician keeps finite adjacent aid ahead of heavy-gun posture and fire',()=>{
 let battle=createBattle([{id:'doctor',x:2,y:5,medical:85,medkits:2,facing:2},{id:'helper-a',x:3,y:4,facing:2},{id:'helper-b',x:3,y:6,facing:2},{id:'patient',x:2,y:4,hp:10,maxHp:80,bleeding:4}],{
  width:24,height:12,hour:12,seed:45,tiles:Array.from({length:288},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass'})),enemies:[{id:'target',x:15,y:5,patrol:false,overwatch:false}],artillery:[{id:'field-gun',side:'player',type:'field8',x:3,y:5,facing:0,loaded:true,ammo:2}],
 });
 battle=actBattle(battle,{type:'stance',unitId:'doctor',stance:'prone'});assert.equal(battle.lastError,null);const before=structuredClone(battle),controller=heavyContactCrewController({holdCommand:false}),doctor=()=>battle.units.find(u=>u.id==='doctor'),patient=()=>battle.units.find(u=>u.id==='patient');
 const activate=controller(battle,doctor());assert.deepEqual(activate,{type:'weapon',unitId:'doctor',slot:'medical'});battle=actBattle(battle,activate);assert.equal(battle.lastError,null);assert.equal(doctor().medkits,2);assert.equal(doctor().stance,'prone');
 const preview=medicalUsePreview(battle,doctor(),patient());assert.equal(preview.allowed,true);const aid=controller(battle,doctor());assert.deepEqual(aid,{type:'useItem',unitId:'doctor',targetId:'patient'});const oldAP=doctor().ap,oldHP=patient().hp,oldBleeding=patient().bleeding;
 battle=actBattle(battle,aid);assert.equal(battle.lastError,null);assert.equal(doctor().medkits,1);assert.equal(doctor().ap,oldAP-preview.cost);assert.ok(patient().hp>oldHP||patient().bleeding<oldBleeding);assert.equal(doctor().stance,'prone');assert.deepEqual(battle.artillery,before.artillery);
 assert.deepEqual(actBattle(actBattle(before,activate),aid),battle);assert.equal(before.units.find(u=>u.id==='doctor').medkits,2);
});
