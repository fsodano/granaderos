import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {visit,saved,order} from './local-contract-fixture.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {rosterFor} from '../game/campaign.js';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import {supplyRouteDressings} from './route-dressings.mjs';

test('route care redistributes real local carried dressings before consuming a finite discovered cache',()=>{
 let start=leaveFiniteCache(takeFiniteCache(visit(initialCampaign()),10,[]));
 const cache=sectorInventoryModel(start,'retiro',rosterFor(start),4).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(cache);
 start=order(start,{type:'sectorInventory',sector:'retiro',operativeId:4,direction:'take',sourceKey:cache.key,expected:cache.expected,count:12});
 const before=structuredClone(start),events=[],initialTotal=start.recruited.reduce((sum,id)=>sum+start.operativeState[id].medkits,0),target=7;
 const s=supplyRouteDressings(start,10,target,{report:event=>events.push(event)});
 assert.deepEqual(start,before);assert.equal(s.operativeState[10].medkits,target);assert.equal(s.resources.treasury,start.resources.treasury);assert.equal(s.hour,start.hour);assert.equal(s.secondOfHour,start.secondOfHour);
 const chest=s.sectorStates.retiro.props.find(prop=>prop.id==='retiro:armory-cache');assert.equal(chest.contents.some(item=>item.item==='medkits'),false);assert.equal(s.recruited.reduce((sum,id)=>sum+s.operativeState[id].medkits,0),initialTotal);
 assert.ok(events.some(event=>event.event==='routeDressingDonation'));assert.ok(events.some(event=>event.event==='routeDressingsCollected'));assert.deepEqual(saved({campaign:s}).campaign,s);
 const checkpoint=structuredClone(s);assert.throws(()=>supplyRouteDressings(s,10,20),/finite dressings/);assert.deepEqual(s,checkpoint,'an exhausted finite plan must not partially alter its caller');
 const reserves=Object.fromEntries(s.recruited.map(id=>[id,s.operativeState[id].medkits]));
 assert.throws(()=>supplyRouteDressings(s,3,s.operativeState[3].medkits+1,{reserves}),/finite dressings/);
 assert.deepEqual(s,checkpoint,'A later top-up cannot steal another actor’s declared carried reserve.');
});
