import {secureArea} from './controlled-area-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,restoreCampaign} from '../game/campaign.js';
import {withStoredGear,assertTradeRejected} from './commerce-gear-fixture.mjs';
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
test('new imported rifles reject atomically while existing finite rifles remain owned through time and restoration',()=>{
 let state=withStoredGear(secureArea(initialCampaign(),'buenos_aires','ensenada'),1802),items=structuredClone(state.armoryItems),cash=state.resources.treasury;
 for(const blockade of [false,true]){state.blockade=blockade;assertTradeRejected(state,{type:'purchaseEquipment',item:1802,quantity:1});}
 state=order(state,{type:'wait',hours:120});assert.deepEqual(state.armoryItems,items);assert.equal(state.resources.treasury,cash);assert.deepEqual(state.equipmentShipments,[]);assert.deepEqual(restoreCampaign(JSON.stringify(state)),state);
});
test('already-paid finite legacy imports deliver once without new charging, restocking or new orders',()=>{
 let state=secureArea(initialCampaign(),'buenos_aires','ensenada');state.equipmentShipments=[{item:1802,quantity:1,due:72}];const cash=state.resources.treasury;assert.deepEqual(restoreCampaign(JSON.stringify(state)).equipmentShipments,state.equipmentShipments);
 state=restoreCampaign(JSON.stringify(state));state=order(state,{type:'wait',hours:120});assert.deepEqual(state.equipmentShipments,[]);assert.equal(state.armoryItems.length,1);assert.equal(state.armory[1802],1);assert.equal(state.resources.treasury,cash);const items=structuredClone(state.armoryItems);state=order(restoreCampaign(JSON.stringify(state)),{type:'wait',hours:24});assert.deepEqual(state.armoryItems,items);assertTradeRejected(state,{type:'purchaseEquipment',item:1802});
 state.equipmentShipments=[{item:1802,quantity:-1,due:10}];assert.throws(()=>restoreCampaign(JSON.stringify(state)),/pedidos de armas/);
});
