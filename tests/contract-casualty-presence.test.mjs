import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {dispatchCampaign,civicStatus,rosterFor,contractQuote} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {order,saved} from './local-contract-fixture.mjs';
import {paidCasualty} from './paid-casualty-fixture.mjs';

test('an actual hired casualty remains dead and saveable when its contract expires after a fresh capital victory',()=>{
 const {campaign:before,id}=paidCasualty(),death=before.operativeState[id].deathMinute,corpse=structuredClone(before.sectorStates.buenos_aires.units.find(u=>Number(u.id)===id));let s=advanceCampaignHours(before,before.contracts[id].expiresAt-before.hour);assert.ok(!s.recruited.includes(id));assert.equal(s.contracts[id],undefined);s=saved({campaign:s}).campaign;assert.equal(s.contentPresence.people[`person-${id}`].recruited,false);assert.equal(s.contentPresence.people[`person-${id}`].alive,false);assert.equal(s.contentPresence.people[`person-${id}`].sector,null);assert.equal(s.operativeState[id].hp,0);assert.equal(s.operativeState[id].deathMinute,death);assert.deepEqual(s.sectorStates.buenos_aires.units.find(u=>Number(u.id)===id),corpse);assert.deepEqual(s.contentPresence.receipts,before.contentPresence.receipts);assert.deepEqual(s.contentPresence.events,before.contentPresence.events);
 // The battle may kill the old fixed replacement. Hire only a living person
 // admitted by the real service rules, at their current affordable quote.
 const replacement=rosterFor(s).filter(op=>civicStatus(s,op.id).available)
  .map(op=>({op,quote:contractQuote(s,op,'week')}))
  .filter(({quote})=>quote.available&&!quote.permanent&&quote.price<=s.resources.treasury)
  .sort((a,b)=>a.quote.price-b.quote.price||a.op.id-b.op.id)[0];
 assert.ok(replacement,'an actual living replacement must be available and affordable');
 const cash=s.resources.treasury;s=order(s,{type:'recruitCivic',id:replacement.op.id,term:'week'});
 assert.equal(s.resources.treasury,cash-replacement.quote.price);
 s=advanceCampaignHours(s,6);s=saved({campaign:s}).campaign;
 assert.deepEqual(s.recruited,[replacement.op.id]);assert.equal(s.contracts[replacement.op.id].paid,replacement.quote.price);
 assert.equal(s.operativeState[id].hp,0);assert.equal(s.operativeState[id].deathMinute,death);
 assert.deepEqual(s.sectorStates.buenos_aires.units.find(u=>Number(u.id)===id),corpse);
 assert.ok(dispatchCampaign(s,{type:'recruitCivic',id,term:'week'}).lastError);
});

test('removing a confirmed casualty from service clears only its roster presence and never restores its body',()=>{
 const {campaign:before,id}=paidCasualty(),cash=before.resources.treasury,death=before.operativeState[id].deathMinute;const s=order(before,{type:'dismiss',id});assert.equal(s.resources.treasury,cash);assert.equal(s.operativeState[id].deathMinute,death);assert.equal(s.operativeState[id].alive,false);assert.equal(saved({campaign:s}).campaign.contentPresence.people[`person-${id}`].recruited,false);assert.equal(s.sectorStates.buenos_aires.units.find(u=>Number(u.id)===id).hp,0);
});

test('older stale deceased-service flags can be repaired without accepting a living actor, health change or revived placement',()=>{
 const {campaign:before,id}=paidCasualty(),s=advanceCampaignHours(before,before.contracts[id].expiresAt-before.hour),wire=JSON.parse(encodeSave(s));wire.campaign.contentPresence.people[`person-${id}`].recruited=true;const restored=decodeSave(JSON.stringify(wire));assert.equal(restored.campaign.contentPresence.people[`person-${id}`].recruited,false);assert.equal(restored.campaign.operativeState[id].hp,0);assert.equal(wire.campaign.contentPresence.people[`person-${id}`].recruited,true);
 for(const mutate of [p=>p.alive=true,p=>p.hp=1,p=>p.sector='cell-27-27']){const forged=structuredClone(wire);mutate(forged.campaign.contentPresence.people[`person-${id}`]);assert.throws(()=>decodeSave(JSON.stringify(forged)),/apariciones/);}
});
