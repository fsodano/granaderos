import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,rosterFor,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {contractAttentionStates} from '../game/contract-attention.js';
import {playerKnownCampaign} from '../game/player-known-state.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const wait=(s,hours)=>order(s,{type:'wait',hours});
const hire=(s=initialCampaign(),id=103)=>order(s,{type:'recruitCivic',id,term:'day'});
const notice=s=>s.contractAttention.notice;
const saved=s=>decodeSave(encodeSave(s)).campaign;

test('real paid contract warns at two hours, preserves service and stops again on actual expiry',()=>{
 const start=hire(),cash=start.resources.treasury;let s=wait(start,24);
 assert.equal(s.hour,22);assert.deepEqual(notice(s),{hour:22,requestedHours:24,advancedHours:22,events:[{operativeId:103,expiresAt:24,code:'expiring'}]});
 assert.ok(s.recruited.includes(103));assert.equal(s.contracts[103].expiresAt,24);assert.equal(s.resources.treasury,cash);
 s=wait(s,1);assert.equal(s.hour,23);assert.equal(notice(s),null);
 s=wait(s,6);assert.equal(s.hour,24);assert.equal(notice(s).advancedHours,1);assert.equal(notice(s).events[0].code,'expired');assert.ok(!s.recruited.includes(103));assert.ok(!s.squads.some(q=>q.members.includes(103)));assert.equal(s.operativeState[103].alive,true);
 s=wait(s,3);assert.equal(s.hour,27);assert.equal(notice(s),null);
});

test('renewal from the notice charges the current quote, banks time and rejects a stale repeat atomically',()=>{
 let s=wait(hire(),24);s.operativeState[103].xp=200;const op=rosterFor(s).find(o=>o.id===103),quote=contractQuote(s,op,'day'),cash=s.resources.treasury;
 const a={type:'renewContract',id:103,term:'day',expectedExpiresAt:24};s=order(s,a);
 assert.equal(s.contracts[103].expiresAt,48);assert.equal(s.resources.treasury,cash-quote.price);assert.deepEqual(s.contractAttention.reported,{});
 const rejected=dispatchCampaign(s,a);assert.match(rejected.lastError,/contrato cambió/);assert.deepEqual({...rejected,lastError:null},s);
 const resumed=wait(s,24);assert.equal(resumed.hour,46);assert.equal(notice(resumed).events[0].expiresAt,48);
});

test('a loaded campaign inside the warning window pauses once without spending a free hour',()=>{
 let s=wait(hire(),20);s.hour=23;s.horseState.hour=23;s.contractAttention={version:1,reported:{},notice:null};s=restoreCampaign(serializeCampaign(s));
 const before=structuredClone(s);s=wait(s,6);assert.equal(s.hour,23);assert.equal(notice(s).advancedHours,0);assert.deepEqual(s.resources,before.resources);assert.deepEqual(s.operativeState,before.operativeState);
 s=wait(s,6);assert.equal(s.hour,24);assert.equal(notice(s).events[0].code,'expired');
});

test('multiple contracts and assignment completion share the same fully processed hour',()=>{
 const funds=initialCampaign();funds.resources.treasury=20000;let s=hire(hire(funds),106);s=wait(s,21);Object.assign(s.operativeState[3],{assignment:'rest',energy:90,fatigue:1});s=wait(s,6);
 assert.equal(s.hour,22);assert.equal(notice(s).events.length,2);assert.deepEqual(notice(s).events.map(e=>e.operativeId),[103,106]);assert.equal(s.operativeState[3].energy,100);assert.equal(s.assignmentAttention.notice.advancedHours,1);
 s=wait(s,1);assert.equal(s.hour,23);assert.equal(notice(s),null);assert.equal(s.assignmentAttention.notice,null);
});

test('save continuation retains both the warning and acknowledgement without duplicate stops',()=>{
 const before=wait(hire(),20),first=wait(before,6);assert.deepEqual(wait(saved(before),6),first);assert.deepEqual(saved(first),first);
 assert.deepEqual(wait(saved(first),1),wait(first,1));const expired=wait(first,6);assert.deepEqual(saved(expired),expired);assert.deepEqual(wait(saved(expired),2),wait(expired,2));
});

test('public contract notices are detached and never include acknowledgement markers',()=>{
 const s=wait(hire(),24),snapshot=serializeCampaign(s),known=playerKnownCampaign(s);assert.deepEqual(known.contractNotice,notice(s));assert.ok(!Object.hasOwn(known,'contractAttention'));known.contractNotice.events[0].expiresAt=999;assert.equal(serializeCampaign(s),snapshot);
});

test('dead, captured, permanent and dismissed soldiers do not produce renewal warnings',()=>{
 const s=hire();s.hour=22;assert.equal(contractAttentionStates(s).length,1);
 s.operativeState[103].alive=false;assert.deepEqual(contractAttentionStates(s),[]);s.operativeState[103].alive=true;s.operativeState[103].captured=true;assert.deepEqual(contractAttentionStates(s),[]);
 const dismissed=order(wait(hire(),22),{type:'dismiss',id:103});assert.deepEqual(dismissed.contractAttention.reported,{});assert.equal(notice(wait(dismissed,1)),null);
 assert.deepEqual(contractAttentionStates(initialCampaign()),[]);
});

test('queued travel can pause for a renewal without moving a soldier or resetting the route',()=>{
 let s=wait(hire(),20);s=order(s,{type:'travel',sector:'buenos_aires',queue:true});s=wait(s,6);
 assert.equal(s.hour,22);assert.equal(s.squads[0].journey.elapsed,2);assert.equal(s.location,'retiro');assert.equal(s.operativeState[103].fatigue,4);
 s=order(s,{type:'renewContract',id:103,term:'day',expectedExpiresAt:24});assert.equal(s.squads[0].journey.elapsed,2);
 s=wait(s,12);assert.equal(s.hour,32);assert.equal(s.location,'buenos_aires');assert.equal(s.contracts[103].expiresAt,48);assert.ok(s.recruited.includes(103));assert.equal(s.operativeState[103].fatigue,24);
});

test('expiry on a queued route reports once and preserves departure until a real arrival',()=>{
 let s=order(wait(hire(),20),{type:'travel',sector:'buenos_aires',queue:true});s=wait(s,10);s=wait(s,10);
 assert.equal(s.hour,24);assert.equal(s.contracts[103].departurePending,true);assert.ok(s.recruited.includes(103));assert.equal(notice(s).events[0].code,'expired');
 s=wait(saved(s),1);assert.equal(s.hour,25);assert.equal(notice(s),null);s=wait(s,10);assert.equal(s.hour,32);assert.ok(!s.recruited.includes(103));assert.equal(s.location,'buenos_aires');
});

test('blocking travel and tactical synchronization retain their full elapsed duration',()=>{
 let s=order(wait(hire(),20),{type:'travel',sector:'buenos_aires'});assert.equal(s.hour,32);assert.equal(s.location,'buenos_aires');assert.ok(!s.recruited.includes(103));assert.equal(notice(s),null);
 s=order(wait(hire(),20),{type:'visitSector'});const id=s.pendingBattle.id;s=order(s,{type:'syncTacticalTime',battleId:id,elapsedSeconds:6*3600});assert.equal(s.hour,26);assert.equal(s.contracts[103].departurePending,true);assert.ok(s.recruited.includes(103));assert.equal(notice(s),null);
 const restored=restoreCampaign(serializeCampaign(s));assert.deepEqual(order(restored,{type:'syncTacticalTime',battleId:id,elapsedSeconds:6*3600}),restored);
});

test('same-hour enemy contact takes priority over renewing or advancing',()=>{
 let s=wait(hire(),14);launchEnemyGroup(s,'coast','retiro');s=wait(s,10);assert.equal(s.hour,22);assert.equal(s.pendingEncounter.sector,'retiro');assert.ok(notice(s));
 for(const action of [{type:'wait',hours:1},{type:'renewContract',id:103,term:'day',expectedExpiresAt:24}]){const bad=dispatchCampaign(s,action);assert.match(bad.lastError,/encuentro/);assert.deepEqual({...bad,lastError:null},s);}
});

test('malformed saved notices are rejected while absent metadata starts unacknowledged',()=>{
 const s=wait(hire(),22);for(const corrupt of [
  n=>n.contractAttention=null,n=>n.contractAttention.version=2,n=>n.contractAttention.reported=[],n=>n.contractAttention.reported[9999]={expiresAt:24,code:'expiring'},
  n=>n.contractAttention.notice.hour=99,n=>n.contractAttention.notice.requestedHours=0,n=>n.contractAttention.notice.advancedHours=25,n=>n.contractAttention.notice.events=[],
  n=>n.contractAttention.notice.events.push({...n.contractAttention.notice.events[0]}),n=>n.contractAttention.notice.events[0].expiresAt=25,n=>n.contractAttention.notice.events[0].code='free_renewal',n=>n.contractAttention.notice.events[0].privateSeed=123,
 ]){const bad=structuredClone(s);corrupt(bad);assert.throws(()=>restoreCampaign(serializeCampaign(bad)),corrupt.toString());}
 const missing=structuredClone(s);delete missing.contractAttention;const restored=restoreCampaign(serializeCampaign(missing));assert.deepEqual(restored.contractAttention,{version:1,reported:{},notice:null});assert.equal(notice(wait(restored,1)).advancedHours,0);
});

test('insufficient funds reject renewal without acknowledging or changing the warning',()=>{
 const s=wait(hire(),24);s.resources.treasury=0;const bad=dispatchCampaign(s,{type:'renewContract',id:103,term:'day',expectedExpiresAt:24});assert.match(bad.lastError,/Falta|pesos|fondos/i);assert.deepEqual({...bad,lastError:null},s);
});

test('renewing an expired traveling contract cancels deferred departure without restoring supplies',()=>{
 let s=order(wait(hire(),20),{type:'travel',sector:'buenos_aires',queue:true});s=wait(wait(s,10),10);assert.equal(s.contracts[103].departurePending,true);
 s.operativeState[103].rations=1;s.operativeState[103].torches=1;const r=structuredClone(s.operativeState[103]),journey=structuredClone(s.squads[0].journey);
 s=order(s,{type:'renewContract',id:103,term:'day',expectedExpiresAt:24});assert.equal(s.contracts[103].departurePending,undefined);assert.equal(s.contracts[103].expiresAt,48);assert.equal(s.hour,24);assert.deepEqual(s.squads[0].journey,journey);assert.equal(s.operativeState[103].rations,r.rations);assert.equal(s.operativeState[103].torches,r.torches);
 s=wait(saved(s),12);assert.ok(s.recruited.includes(103));assert.equal(s.location,'buenos_aires');assert.equal(s.operativeState[103].rations,1);
});
