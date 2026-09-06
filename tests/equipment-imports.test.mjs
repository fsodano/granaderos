import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,restoreCampaign} from '../game/campaign.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null);return n;};
test('imported personal rifles cannot be equipped before arrival and blockades delay them',()=>{
 let s=initialCampaign();const cash=s.resources.treasury;s=order(s,{type:'purchaseEquipment',item:1802,quantity:1});assert.equal(s.resources.treasury,cash-420);assert.equal(s.armory[1802],undefined);assert.ok(s.equipmentShipments[0].due>=72&&s.equipmentShipments[0].due<=120);
 s.blockade=true;s=order(s,{type:'wait',hours:120});assert.equal(s.armory[1802],undefined);assert.equal(s.equipmentShipments.length,1);
 s=restoreCampaign(JSON.stringify(s));s.blockade=false;s=order(s,{type:'wait',hours:1});assert.equal(s.armory[1802],1);assert.equal(s.equipmentShipments.length,0);
 s=order(s,{type:'wait',hours:1});assert.equal(s.armory[1802],1);
 s.equipmentShipments=[{item:1802,quantity:-1,due:10}];assert.throws(()=>restoreCampaign(JSON.stringify(s)),/pedidos de armas/);
});
