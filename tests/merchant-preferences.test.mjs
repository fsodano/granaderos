import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,isSupplied} from '../game/campaign.js';
import {resaleBreakdown,usedEquipmentBreakdown,EQUIPMENT_CATALOG} from '../game/equipment.js';
import {merchantProfile,merchantBuyingTerms} from '../game/merchant-preferences.js';
import {artilleryTradePreview} from '../game/artillery-trade.js';
import {merchantExchangeOffers,merchantExchangePreview} from '../game/merchant-exchange.js';
import {encodeSave,decodeSave} from '../game/save.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const save=s=>decodeSave(encodeSave(s)).campaign;
function prepared(){let s=order(initialCampaign(),{type:'purchaseEquipment',item:1803});s.sectors.cordoba.owner='patriot';s.sectors.mendoza.owner='patriot';return s;}
const proposal=(s,key)=>{const offer=merchantExchangeOffers(s,isSupplied).find(o=>o.key===key);assert.ok(offer);return {type:'exchangeEquipment',sector:s.location,lines:[{key,receipt:offer.receipt,quantity:1}]};};
test('travel to Caroya changes the actual resale payment for the same stored cavalry weapon',()=>{
 let s=prepared();const item=structuredClone(s.armoryItems[0]);assert.equal(resaleBreakdown(item,'retiro').total,72);s=order(s,{type:'travel',sector:'cordoba'});
 assert.equal(s.location,'cordoba');assert.equal(resaleBreakdown(item,s.location).total,90);const cash=s.resources.treasury,fund=s.merchants.cordoba.cash;
 s=save(order(s,{type:'sellEquipment',instanceId:item.id}));assert.equal(s.resources.treasury,cash+90);assert.equal(s.merchants.cordoba.cash,fund-90);assert.deepEqual(s.merchants.cordoba.usedItems,[item]);
 const buy=usedEquipmentBreakdown(item).total;assert.equal(buy,144);s=save(order(s,{type:'purchaseUsedEquipment',sector:'cordoba',instanceId:item.id}));assert.deepEqual(s.armoryItems,[item]);assert.equal(s.resources.treasury,cash+90-buy);
});
test('Caroya refuses worn handhelds in both direct sales and exchanges; another workshop accepts the exact item',()=>{
 let s=prepared();s.armoryItems[0].condition=20;s=order(s,{type:'travel',sector:'cordoba'});const item=structuredClone(s.armoryItems[0]),a=proposal(s,`sell:weapon:${item.id}`);
 assert.match(merchantExchangePreview(s,a,isSupplied).reason,/menos de 25/);
 for(const action of [{type:'sellEquipment',instanceId:item.id},a]){const rejected=dispatchCampaign(s,action);assert.match(rejected.lastError,/menos de 25/);assert.deepEqual({...rejected,lastError:null},s);}
 s=order(s,{type:'travel',sector:'mendoza'});assert.equal(resaleBreakdown(item,s.location).reason,null);const cash=s.resources.treasury;s=save(order(s,{type:'sellEquipment',instanceId:item.id}));assert.equal(s.resources.treasury,cash+14);assert.deepEqual(s.merchants.mendoza.usedItems,[item]);
});
test('a local preference prices the host and fitted bayonet separately and preserves existing used prices',()=>{
 const item={item:1800,condition:50,fittings:{bayonet:{weapon:1811,condition:25,fittingPattern:'india_socket'}}};
 assert.deepEqual(resaleBreakdown(item,'cordoba').items.map(p=>p.price),[36,3]);assert.equal(resaleBreakdown(item,'retiro').total,53);assert.equal(usedEquipmentBreakdown(item).total,106);
 assert.ok(resaleBreakdown({...item,condition:24.99},'cordoba').reason);assert.equal(resaleBreakdown({...item,condition:25},'cordoba').reason,null);
});
test('El Plumerillo pays its artillery preference through direct sales and the same exchange offer',()=>{
 let s=prepared();s=order(s,{type:'travel',sector:'mendoza'});const gun={id:'local-gun',type:'field8',side:'player',loaded:false,ammo:1,reloadProgress:.6};s.artilleryStores={mendoza:[gun]};
 const plan=artilleryTradePreview(s,{sector:'mendoza',gunId:gun.id},isSupplied);assert.equal(plan.price,550);const a=proposal(s,`sell:artillery:stored:${gun.id}`);assert.equal(merchantExchangePreview(s,a,isSupplied).sales,550);
 const single=save(order(s,plan.action)),exchange=save(order(s,a));assert.equal(single.resources.treasury,exchange.resources.treasury);assert.equal(single.merchants.mendoza.cash,exchange.merchants.mendoza.cash);assert.deepEqual(exchange.merchants.mendoza.usedArtillery,[gun]);
});
test('preferences cannot create a profitable used-buyback route or authorize buying outside a workshop',()=>{
 for(const item of EQUIPMENT_CATALOG)for(const at of ['retiro','cordoba','mendoza']){const terms=merchantBuyingTerms(at,item.item);assert.ok(terms.fraction<.8);assert.equal(terms.percent,Math.round(terms.fraction*100));}
 assert.match(merchantProfile('cordoba').description,/25%/);assert.equal(merchantProfile('ensenada'),null);
 const s=prepared();s.location='ensenada';const a=proposal(s,`sell:weapon:${s.armoryItems[0].id}`);assert.match(merchantExchangePreview(s,a,isSupplied).reason,/maestranza/);
});
test('exchanges use the local cavalry quote, reject a previous town receipt and retain finite merchant funds',()=>{
 let s=prepared();const id=s.armoryItems[0].id,old=proposal(s,`sell:weapon:${id}`);s=order(s,{type:'travel',sector:'cordoba'});old.sector='cordoba';assert.match(merchantExchangePreview(s,old,isSupplied).reason,/cambió/);
 const a=proposal(s,`sell:weapon:${id}`),before=s.resources.treasury;s.merchants.cordoba.cash=89;const rejected=dispatchCampaign(s,a);assert.match(rejected.lastError,/diferencia/);assert.deepEqual({...rejected,lastError:null},s);
 s.merchants.cordoba.cash=90;s=save(order(s,a));assert.equal(s.resources.treasury,before+90);assert.equal(s.merchants.cordoba.cash,0);
});
