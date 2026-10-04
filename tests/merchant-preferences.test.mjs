import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {resaleBreakdown,usedEquipmentBreakdown,EQUIPMENT_CATALOG} from '../game/equipment.js';
import {merchantProfile,merchantBuyingTerms} from '../game/merchant-preferences.js';
import {withStoredGear,assertTradeRejected} from './commerce-gear-fixture.mjs';
import {encodeSave,decodeSave} from '../game/save.js';

test('retained catalog preference quotes are deterministic and never authorize current public sales',()=>{
 const state=withStoredGear(initialCampaign(),1803),item=structuredClone(state.armoryItems[0]);assert.equal(resaleBreakdown(item,'retiro').total,72);assert.equal(resaleBreakdown(item,'cordoba').total,90);assert.equal(usedEquipmentBreakdown(item).total,144);
 for(const sector of ['retiro','cordoba','mendoza']){assertTradeRejected(state,{type:'sellEquipment',sector,instanceId:item.id});assertTradeRejected(state,{type:'purchaseUsedEquipment',sector,instanceId:item.id});}
 assert.deepEqual(decodeSave(encodeSave(state)).campaign,state);
});
test('retained local preference prices host and fitted bayonet separately without changing their conditions',()=>{
 const item={item:1800,condition:50,fittings:{bayonet:{weapon:1811,condition:25,fittingPattern:'india_socket'}}},before=structuredClone(item);
 assert.deepEqual(resaleBreakdown(item,'cordoba').items.map(part=>part.price),[36,3]);assert.equal(resaleBreakdown(item,'retiro').total,53);assert.equal(usedEquipmentBreakdown(item).total,106);assert.deepEqual(item,before);
 assert.ok(resaleBreakdown({...item,condition:24.99},'cordoba').reason);assert.equal(resaleBreakdown({...item,condition:25},'cordoba').reason,null);
});
test('catalog preferences retain bounded fractions and do not open a workshop or cashless exchange',()=>{
 for(const item of EQUIPMENT_CATALOG)for(const sector of ['retiro','cordoba','mendoza']){const terms=merchantBuyingTerms(sector,item.item);assert.ok(terms.fraction<.8);assert.equal(terms.percent,Math.round(terms.fraction*100));}
 assert.match(merchantProfile('cordoba').description,/25%/);assert.equal(merchantProfile('ensenada'),null);
 const state=withStoredGear(initialCampaign(),1803);assertTradeRejected(state,{type:'exchangeEquipment',sector:'cordoba',lines:[{key:`sell:weapon:${state.armoryItems[0].id}`,quantity:1,receipt:'old-workshop-receipt'}]});
});
