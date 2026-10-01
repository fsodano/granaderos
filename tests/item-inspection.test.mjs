import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle} from '../game/tactical.js';
import {inspectEquipmentItem} from '../game/item-inspection.js';
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
