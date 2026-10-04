import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from '../game/campaign.js';
import {withStoredGear} from './commerce-gear-fixture.mjs';
import {saved} from './local-contract-fixture.mjs';
import {sellSurplusEquipment} from './surplus-equipment-route.mjs';

test('surplus route equipment cannot create money or dispose of existing guns',()=>{
 const start=withStoredGear(initialCampaign(8),1801,7),before=structuredClone(start),events=[];
 const campaign=sellSurplusEquipment(start,'retiro',[],9000,{reserve:0,report:event=>events.push(event)});
 assert.deepEqual(start,before);assert.deepEqual(campaign,before);assert.notEqual(campaign,start);
 assert.deepEqual(events,[{stage:'surplus-equipment-sales',event:'equipmentTradingUnavailable',sector:'retiro',sales:[],treasury:3200,target:9000,shortfall:5800}]);
 assert.deepEqual(saved({campaign}).campaign,campaign);
});
