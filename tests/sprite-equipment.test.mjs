import test from 'node:test';
import assert from 'node:assert/strict';
import {spriteEquipment,spriteUsesEquipmentVariant} from '../game/sprite-equipment.js';

test('authored weapons select their actual main-hand silhouette',()=>{
 for(const weapon of [1800,1801,1802,1803,1804,1807])assert.equal(spriteEquipment({weapon}),'long-gun');
 for(const weapon of [1805,1806,1808])assert.equal(spriteEquipment({weapon}),'short-gun');
 for(const weapon of [1809,1810,1811,1812,1813])assert.equal(spriteEquipment({weapon}),'blade');
 const unit={weapon:1808,blade:1813};
 assert.equal(spriteEquipment(unit),'short-gun');
 assert.equal(spriteEquipment({...unit,activeSlot:'blade'}),'blade');
 for(const activeSlot of ['unarmed','medical','tool','supply','item'])assert.equal(spriteEquipment({...unit,activeSlot}),'unarmed');
 assert.equal(spriteEquipment({...unit,weaponDropped:true}),'unarmed');
 assert.equal(spriteEquipment({...unit,weaponDropped:true,activeSlot:'blade'}),'blade');
 assert.equal(spriteEquipment({weapon:{id:1808,capacity:2}}),'short-gun');
 assert.equal(spriteEquipment({weapon:{capacity:1}}),'long-gun');
 assert.equal(spriteEquipment({}),'unarmed');
});

test('equipment variants apply to living standing, crouched and mounted poses only',()=>{
 for(const stance of ['standing','crouched'])assert.equal(spriteUsesEquipmentVariant({hp:100,stance}),true);
 assert.equal(spriteUsesEquipmentVariant({hp:100,mounted:true,stance:'prone'}),true);
 for(const unit of [{hp:100,stance:'prone'},{hp:100,movementMode:'prone'},{hp:0},{hp:100,unconscious:true}])assert.equal(spriteUsesEquipmentVariant(unit),false);
});
