import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {saved} from './local-contract-fixture.mjs';
import {bankRouteIncome} from './route-income-banking.mjs';
import {dailyIncome} from '../game/campaign.js';

test('route funds come from a physical port agreement and an actual daily payment, preserving the input',()=>{
 const start=initialCampaign(),before=structuredClone(start),events=[],s=bankRouteIncome(start,10000,{report:event=>events.push(event)});
 assert.deepEqual(start,before);assert.equal(start.resources.treasury,3200);assert.ok(s.hour>=24);assert.equal(s.location,start.location);assert.deepEqual(s.squad,start.squad);assert.equal(s.resources.treasury,start.resources.treasury+8000);assert.equal(dailyIncome(s),8000);
 assert.ok(events.some(event=>event.event==='townIncomeActivated'));assert.equal(events.at(-1).event,'routeIncomeBanked');assert.deepEqual(saved({campaign:s}).campaign,s);assert.deepEqual(bankRouteIncome(s,10000),s);
});
