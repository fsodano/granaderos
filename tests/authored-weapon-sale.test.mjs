import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {resaleBreakdown,usedEquipmentBreakdown} from '../game/equipment.js';
import {equipmentKey} from '../game/equipment-catalog.js';
import {decodeSave,encodeSave} from '../game/save.js';

const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
test('selling an authored weapon uses its catalog identity and preserves the other variant of the same gun',()=>{
 const content=defaultContentPackage(),base=content.weapons.find(w=>w.template===1801);
 const variant={...structuredClone(base),id:'cuyo-musket',name:'Fusil de Cuyo',price:277};content.weapons.push(variant);
 let s=initialCampaign(8,content);
 for(const item of [base.id,variant.id])s=order(s,{type:'purchaseEquipment',item});
 const soldItem=structuredClone(s.armoryItems.find(item=>equipmentKey(item)===variant.id));
 const retained=structuredClone(s.armoryItems.find(item=>equipmentKey(item)===base.id));
 const cash=s.resources.treasury,merchantCash=s.merchants.retiro.cash,price=resaleBreakdown(soldItem,'retiro').total;
 s=order(s,{type:'sellEquipment',instanceId:soldItem.id});
 assert.equal(s.resources.treasury,cash+price);assert.equal(s.merchants.retiro.cash,merchantCash-price);
 assert.equal(s.armory[variant.id],0);assert.equal(s.armory[base.id],1);
 assert.deepEqual(s.armoryItems,[retained]);assert.deepEqual(s.merchants.retiro.usedItems,[soldItem]);
 assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);
 const repeated=dispatchCampaign(s,{type:'sellEquipment',instanceId:soldItem.id});assert.ok(repeated.lastError);assert.deepEqual({...repeated,lastError:null},s);
 const repurchase=usedEquipmentBreakdown(soldItem).total;
 s=order(s,{type:'purchaseUsedEquipment',sector:'retiro',instanceId:soldItem.id});
 assert.equal(s.resources.treasury,cash+price-repurchase);assert.equal(s.armory[variant.id],1);
 assert.deepEqual(s.armoryItems.find(item=>item.id===soldItem.id),soldItem);assert.deepEqual(s.merchants.retiro.usedItems,[]);
 assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);
});
