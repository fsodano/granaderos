import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,operativeLocation,restoreCampaign,serializeCampaign} from '../game/campaign.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
// Controlled medical loss isolates campaign recovery from combat hit rolls.
const fatalBleeding=(s,ids)=>{for(const id of ids)Object.assign(s.operativeState[id],{hp:1,bleeding:4,bandaged:0});return s;};

test('losing the last deployed soldiers to bleeding preserves deaths and permits paid rebuilding at Retiro',()=>{
 let s=order(initialCampaign(),{type:'travel',sector:'buenos_aires'});const ids=[...s.squad];
 s=order(fatalBleeding(s,ids),{type:'wait',hours:1});assert.equal(s.defeated,false);assert.equal(s.location,'retiro');assert.deepEqual(s.squad,[]);
 for(const id of ids){assert.equal(s.operativeState[id].alive,false);assert.equal(s.operativeState[id].hp,0);assert.equal(s.operativeState[id].location,'buenos_aires');}
 s=restoreCampaign(serializeCampaign(s));const cash=s.resources.treasury;
 s=order(s,{type:'recruitCivic',id:123,term:'week'});assert.ok(s.resources.treasury<cash);assert.ok(s.squad.includes(123));assert.equal(s.operativeState[123].location,'retiro');
 for(const id of ids)assert.equal(s.operativeState[id].alive,false);
 assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});

test('loss of a selected squad does not move another surviving squad or the selected command',()=>{
 let s=order(initialCampaign(),{type:'createSquad',name:'Destacamento',ids:[3]});s=order(s,{type:'travel',sector:'buenos_aires'});
 const other=structuredClone(s.squads.find(q=>q.id!==s.activeSquadId));
 s=order(fatalBleeding(s,[3]),{type:'wait',hours:1});assert.equal(s.defeated,false);assert.equal(s.location,'buenos_aires');assert.deepEqual(s.squads.find(q=>q.id===other.id),other);
 for(const id of [4,10]){assert.equal(s.operativeState[id].alive,true);assert.equal(operativeLocation(s,id),'retiro');}
 assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});

test('loss of Retiro still ends the campaign and prevents replacement hiring',()=>{
 let s=initialCampaign();s.sectors.retiro.owner='royalist';s=order(s,{type:'wait',hours:1});assert.equal(s.defeated,true);
 const n=dispatchCampaign(s,{type:'recruitCivic',id:123,term:'week'});assert.ok(n.lastError);assert.deepEqual(n.resources,s.resources);
});
