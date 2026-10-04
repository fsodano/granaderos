import {stockAndCarriedAmmo} from './ammunition-balance.mjs';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {isSupplied} from '../game/campaign.js';
import {merchantExchangeOffers,merchantExchangePreview} from '../game/merchant-exchange.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {withStoredGear,asLegacyMerchantGear,assertTradeRejected} from './commerce-gear-fixture.mjs';
const save=state=>decodeSave(encodeSave(state)).campaign;
function basket(state,choices){const offers=merchantExchangeOffers(state,isSupplied);return {type:'exchangeEquipment',sector:state.location,lines:choices.map(([key,quantity=1])=>{const offer=offers.find(offer=>offer.key===key);assert.ok(offer,key);return {key,quantity,receipt:offer.receipt};})};}
function stocked(){const state=withStoredGear(initialCampaign(),1803,3);return asLegacyMerchantGear(state,state.armoryItems[0].id);}

test('an unused cashless exchange quote cannot authorize a public swap of exact used weapons',()=>{
 const state=stocked();state.resources.treasury=0;state.merchants.retiro.cash=0;const goods=structuredClone(state.armoryItems),received=state.merchants.retiro.usedItems[0];
 const action=basket(state,[...goods.map(item=>[`sell:weapon:${item.id}`]),[`buy:weapon:${received.id}`]]),before=structuredClone(state),plan=merchantExchangePreview(state,action,isSupplied);
 assert.equal(plan.valid,true);assert.equal(plan.net,0);assert.deepEqual(state,before);for(let repeat=0;repeat<2;repeat++)assertTradeRejected(state,action);assert.deepEqual(save(state),state);
});
test('mixed new and used baskets reject before consuming cash or either custodian stock',()=>{
 const state=stocked(),id=state.armoryItems[0].id;const action=basket(state,[[`sell:weapon:${id}`],['buy:new:1804']]);
 for(const cash of [0,28,3200]){state.resources.treasury=cash;assertTradeRejected(state,action);}
 for(const edit of [a=>a.lines.push({...a.lines[0]}),a=>a.lines[1].quantity=99,a=>a.lines[1].receipt='forged',a=>a.sector='cordoba',a=>a.lines=[]]){const changed=structuredClone(action);edit(changed);assertTradeRejected(state,changed);}
});
test('exchanges preserve exact finite artillery loading and cannot turn a cannon into equipment or money',()=>{
 const state=initialCampaign(),gun={id:'barter-piece',type:'field8',side:'player',loaded:false,ammo:1,reloadProgress:.6};state.artilleryDepots={retiro:[gun]};state.resources.treasury=0;state.merchants.retiro.cash=120;
 const before=ownedArtilleryCount(state),action=basket(state,[[`sell:artillery:stored:${gun.id}`],['buy:new:1809',2]]);assertTradeRejected(state,action);assert.equal(ownedArtilleryCount(state),before);assert.deepEqual(save(state).artilleryDepots.retiro,[gun]);
});
test('full legacy merchant storage does not permit a capacity-neutral public exchange',()=>{
 const state=withStoredGear(initialCampaign(),1803),id=state.armoryItems[0].id;
 state.merchants.retiro.usedItems=Array.from({length:1000},(_,index)=>({id:`armory-${index+2}`,item:1803,condition:100,jammed:false}));state.nextArmoryItemId=1002;
 const restored=save(state),action=basket(restored,[[`sell:weapon:${id}`],['buy:weapon:armory-2']]);assertTradeRejected(restored,action);assert.equal(restored.merchants.retiro.usedItems.length,1000);
});
test('multiple owned undeployed cannons remain physical property after a refused exchange',()=>{
 const state=initialCampaign();state.armory.swivel=2;state.merchants.retiro.cash=300;const action=basket(state,[['sell:artillery:stock:swivel',2],['buy:new:1813']]);
 assertTradeRejected(state,action);assert.equal(ownedArtilleryCount(state),2);assert.equal(state.armory.swivel,2);assert.deepEqual(state.artilleryMerchants?.retiro?.guns??[],[]);assert.deepEqual(save(state),state);
});
test('a fitted loaded musket keeps exact metadata and finite ammunition after exchange rejection and restoration',()=>{
 const state=withStoredGear(initialCampaign(),1800),item=state.armoryItems[0];Object.assign(item,{condition:50,jammed:true,loaded:1,instanceId:'barter-musket',fittings:{bayonet:{weapon:1811,condition:25,instanceId:'barter-bayonet',fittingPattern:'india_socket'}}});
 const exact=structuredClone(item),ammo=stockAndCarriedAmmo(state);assertTradeRejected(state,basket(state,[[`sell:weapon:${item.id}`],['buy:new:1813']]));assert.deepEqual(save(state).armoryItems,[exact]);assert.equal(stockAndCarriedAmmo(state),ammo);
});
