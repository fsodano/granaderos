import test from 'node:test';import assert from 'node:assert/strict';
import {AMMUNITION_TYPES,ammunitionByType,totalReserveAmmunition} from '../game/ammunition-types.js';
import {LEGACY_AMMUNITION} from '../game/ammunition-families.js';
import {groupAmmunitionResources,groupAmmunitionCounts,groupSceneAmmunition} from '../game/ammunition-family-migration.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {initializeUnitAmmunition} from '../game/tactical-ammunition.js';
import {migrateCampaignAmmunition,migrateBattleAmmunition,unitAmmunitionByType} from '../game/campaign-ammunition.js';
const oldStack=(ammoType,count,extra={})=>({kind:'ammunition',ammoType,count,name:LEGACY_AMMUNITION[ammoType].name,weight:.04,...extra});

test('old lots, both hands, pocket partitions and cursor custody survive family grouping',()=>{
 const u={ammunitionVersion:1,weapon:1801,ammo:3,loaded:1,activeSlot:'item',activeItem:'inventory:lot-a',leftHandItem:'inventory:lot-a',pocketOrder:[{slotId:'small-4',item:'inventory:lot-a',index:0,count:1},{slotId:'small-6',item:'inventory:lot-b',index:0,count:5}],inventory:{'lot-a':oldStack('musket_69',3),'lot-b':oldStack('carbine_65',5,{name:'Lote de María',lot:{seal:9}}),'lot-c':oldStack('musket_75',2),'foreign':oldStack('pistol_50',4),musket_69:{name:'Documento',count:1,weight:0}},equipmentCursor:{sourceId:'small-7',stack:{item:'inventory:cursor',...oldStack('pistol_54',2)}}};
 const before=structuredClone(u);initializeUnitAmmunition(u);
 assert.equal(u.ammunitionVersion,2);assert.equal(u.loaded,1);assert.equal(u.ammo,10);assert.deepEqual(ammunitionByType(u),{musket_75:10,pistol_69:4});
 assert.deepEqual(Object.keys(u.inventory),Object.keys(before.inventory));assert.equal(u.inventory['lot-a'].name,AMMUNITION_TYPES.musket_75.name);assert.deepEqual(u.inventory['lot-b'],{...before.inventory['lot-b'],ammoType:'musket_75'});assert.deepEqual(u.inventory.musket_69,before.inventory.musket_69);
 assert.equal(u.activeItem,before.activeItem);assert.equal(u.leftHandItem,before.leftHandItem);assert.deepEqual(u.pocketOrder,before.pocketOrder);
 assert.equal(u.equipmentCursor.stack.item,before.equipmentCursor.stack.item);assert.equal(u.equipmentCursor.stack.ammoType,'pistol_69');assert.equal(u.equipmentCursor.stack.count,2);assert.equal(totalReserveAmmunition(u),14);
 const once=structuredClone(u);initializeUnitAmmunition(u);assert.deepEqual(u,once);
});

test('physical field lots and sparse settlement receipts group without moving owners or changing totals',()=>{
 const scene={groundItems:[{id:'ground',item:'inventory:ammo:carbine_65',...oldStack('carbine_65',4)}],props:[{contents:[oldStack('pistol_50',3)]}],tiles:[{questGifts:[oldStack('scatter',2)]}],npcs:[{questGifts:[oldStack('musket_69',5)]}],issuedAmmunition:{musket_75:4,musket_69:3,carbine_65:2},fieldAmmunition:{pistol_50:3,pistol_54:2},returnLedger:{creditedAmmunition:{shot_16:2,scatter:4}},ammunitionSources:[{ammunitionByType:{musket_69:2,carbine_65:1}}]};
 groupSceneAmmunition(scene);assert.equal(scene.groundItems[0].item,'inventory:ammo:carbine_65');assert.equal(scene.groundItems[0].count,4);assert.equal(scene.groundItems[0].ammoType,'musket_75');assert.equal(scene.props[0].contents[0].ammoType,'pistol_69');assert.equal(scene.tiles[0].questGifts[0].ammoType,'shot_16');assert.equal(scene.npcs[0].questGifts[0].count,5);
 assert.deepEqual(scene.issuedAmmunition,{musket_75:9});assert.deepEqual(scene.fieldAmmunition,{pistol_69:5});assert.deepEqual(scene.returnLedger.creditedAmmunition,{shot_16:6});assert.deepEqual(scene.ammunitionSources[0].ammunitionByType,{musket_75:3});
});
