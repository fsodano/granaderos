import test from 'node:test';import assert from 'node:assert/strict';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign} from '../game/campaign.js';
import {resaleBreakdown,usedEquipmentBreakdown} from '../game/equipment.js';
import {equipmentKey} from '../game/equipment-catalog.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {withStoredGear,assertTradeRejected} from './commerce-gear-fixture.mjs';
test('closed trade preserves two authored variants of the same gun, exact catalog identities and their saved metadata',()=>{
 const content=defaultContentPackage(),base=content.weapons.find(weapon=>weapon.template===1801),variant={...structuredClone(base),id:'cuyo-musket',name:'Fusil de Cuyo',price:277};content.weapons.push(variant);
 let state=initialCampaign(8,content);for(const item of [base.id,variant.id])state=withStoredGear(state,item);
 const held=structuredClone(state.armoryItems),variantItem=held.find(item=>equipmentKey(item)===variant.id);assert.ok(resaleBreakdown(variantItem,'retiro').total>0);assert.ok(usedEquipmentBreakdown(variantItem).total>0);
 for(const action of [{type:'sellEquipment',instanceId:variantItem.id},{type:'purchaseUsedEquipment',sector:'retiro',instanceId:variantItem.id},{type:'purchaseEquipment',item:variant.id}])assertTradeRejected(state,action);
 assert.equal(state.armory[variant.id],1);assert.equal(state.armory[base.id],1);assert.deepEqual(state.armoryItems,held);assert.deepEqual(state.merchants.retiro.usedItems,[]);assert.deepEqual(decodeSave(encodeSave(state)).campaign,state);
});
