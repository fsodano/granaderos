import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle} from '../game/tactical.js';
import {inspectEquipmentItem} from '../game/item-inspection.js';
import {handSlots} from '../game/ja2-hud.js';
const soldier=()=>createBattle([{id:'p',weapon:1805,loaded:1,ammo:27,blade:0,priming:0,flints:0,rations:0,medkits:0,boleadoras:0,torches:0,pocketOrder:[{slotId:'small-1',item:'inventory:ammo:pistol_69',index:0,count:13},{slotId:'small-2',item:'inventory:ammo:pistol_69',index:1,count:14}]}],{exploration:true,enemies:[]}).units[0];
test('item inspection shows the selected physical ammunition stack and its own weight',()=>{
 const unit=soldier(),before=structuredClone(unit);
 const first=inspectEquipmentItem(unit,'inventory:ammo:pistol_69','small-1');
 const second=inspectEquipmentItem(unit,'inventory:ammo:pistol_69','small-2');
 assert.equal(first.count,13);assert.equal(second.count,14);assert.equal(first.stackLimit,20);
 assert.equal(first.totalWeight,.52);assert.match(first.help,/combinarlos/);assert.deepEqual(unit,before);
});
test('empty physical slots do not display the stale inspected item',()=>{
 assert.equal(inspectEquipmentItem(soldier(),'primary','large-4'),null);
});
test('weapon inspection retains loaded quantity and model capacity',()=>{
 const item=inspectEquipmentItem(soldier(),'primary','hand:right');
 assert.equal(item.weapon,1805);assert.equal(item.loaded,1);assert.equal(item.capacity,1);assert.equal(item.count,1);
});
test('blade details show condition while firearm hands retain their ammunition count',()=>{
 const battle=createBattle([{id:'p',weapon:1805,loaded:1,blade:1813,leftHandItem:'blade'}],{exploration:true,enemies:[]}),unit=battle.units[0];
 const hands=handSlots(battle,unit);assert.equal(hands[0].loaded,1);assert.equal(hands[1].loaded,undefined);assert.equal(hands[1].condition,100);
 const blade=inspectEquipmentItem(unit,'blade','hand:left');assert.equal(blade.loaded,undefined);assert.equal(blade.condition,100);assert.equal(blade.capacity,undefined);
});
