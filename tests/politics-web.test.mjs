import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,restoreCampaign} from '../game/campaign.js';
import {tradeQuote} from '../game/politics.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null);return n;};
test('actual import orders use reputation prices and retain shipping delay',()=>{
 let s=initialCampaign();s.reputation.foreign=60;const cash=s.resources.treasury;
 s=order(s,{type:'purchaseEquipment',item:1802});assert.equal(cash-s.resources.treasury,336);assert.ok(s.equipmentShipments[0].due>=72&&s.equipmentShipments[0].due<=120);
 assert.equal(tradeQuote({...s,reputation:{foreign:0}},250),300);
});
test('national contribution is payable once per period and neglect loses support',()=>{
 let s=order(initialCampaign(),{type:'wait',hours:168});const before=s.reputation.directory;
 const paid=order(s,{type:'policy',kind:'tax'});assert.equal(paid.reputation.directory,before+8);assert.equal(paid.resources.treasury,s.resources.treasury-120);
 assert.ok(dispatchCampaign(paid,{type:'policy',kind:'tax'}).lastError);
 s=order(s,{type:'wait',hours:168});assert.equal(s.reputation.directory,before-8);
 const continued=order(paid,{type:'wait',hours:168});assert.equal(continued.reputation.directory,before+8);
 assert.equal(restoreCampaign(JSON.stringify(paid)).politics.taxPaidPeriod,1);
});
test('cash cannot be requisitioned repeatedly and frontier betrayal breaks the pact',()=>{
 let s=initialCampaign();s=order(s,{type:'diplomacy',kind:'requisition'});assert.ok(dispatchCampaign(s,{type:'diplomacy',kind:'requisition'}).lastError);
 s=initialCampaign();s.location='mendoza';s.squads[0].location='mendoza';s.sectors.mendoza.owner='patriot';s.flags.parliament=true;
 s=order(s,{type:'policy',kind:'frontierRequisition'});assert.equal(s.flags.parliament,false);assert.equal(s.resources.treasury,3360);assert.equal(s.reputation.indigenous,-35);
 const restored=restoreCampaign(JSON.stringify(s));assert.equal(restored.politics.requisitionAfter,336);
 s=order(s,{type:'wait',hours:168});assert.ok(s.sectors.mendoza.damageUntil>s.hour);assert.ok(s.log.some(e=>e.text.includes('partida de frontera')));
});
test('neglect of emancipation and commissions has a weekly political consequence',()=>{
 let s=initialCampaign();s=order(s,{type:'wait',hours:168});assert.equal(s.reputation.pardos,7);
 s=order(s,{type:'diplomacy',kind:'emancipation'});s=order(s,{type:'diplomacy',kind:'commission'});const support=s.reputation.pardos;
 s=order(s,{type:'wait',hours:168});assert.equal(s.reputation.pardos,support);
});
test('policy save validation rejects invalid future tax periods',()=>{
 const s=initialCampaign();s.politics={taxPaidPeriod:100};assert.throws(()=>restoreCampaign(JSON.stringify(s)),/políticas/);
});
