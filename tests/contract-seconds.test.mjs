import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,rosterFor,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {contractQuote,contractStatus,contractExpiresSeconds,contractStartedFields} from '../game/contracts.js';
import {DEFAULT_CONTRACT_RULES} from '../game/contract-rules.js';
import {collectContractAttention,contractAttentionStates,nextContractWarningSeconds,publicContractNotice,validateContractAttention} from '../game/contract-attention.js';

const hired=()=>{const s=dispatchCampaign(initialCampaign(),{type:'recruitCivic',id:103,term:'day'});assert.equal(s.lastError,null);return s;};

test('new contracts and extensions preserve a full paid term at any second of the hour',()=>{
  const s=hired(),op=rosterFor(s).find(o=>o.id===103);delete s.contracts[103];s.hour=1;s.secondOfHour=3599;
  let q=contractQuote(s,op,'day');assert.equal(q.expiresAt,25);assert.equal(q.expiresSecond,3599);
  assert.deepEqual(contractStartedFields(s,q.expiresSecond),{started:1,startedSecond:3599,expiresSecond:3599});
  s.contracts[103]={kind:'paid',term:'day',started:1,startedSecond:3599,expiresAt:q.expiresAt,expiresSecond:q.expiresSecond,paid:q.price};
  s.hour=2;s.secondOfHour=17;q=contractQuote(s,op,'week');
  assert.equal(q.expiresAt,193);assert.equal(q.expiresSecond,3599);
  s.hour=26;s.secondOfHour=121;q=contractQuote(s,op,'day');assert.equal(q.expiresAt,50);assert.equal(q.expiresSecond,121);
});

test('whole-hour contracts stay compatible and status remains active until the precise expiry',()=>{
  const s=hired();assert.equal(contractExpiresSeconds(s.contracts[103]),24*3600);
  assert.deepEqual(contractStartedFields(s,0),{started:0});
  s.hour=24;s.secondOfHour=10;s.contracts[103].expiresSecond=11;
  assert.equal(contractStatus(s,103).active,true);assert.equal(contractStatus(s,103).remaining,1/3600);
  s.secondOfHour=11;assert.equal(contractStatus(s,103).active,false);assert.equal(contractStatus(s,103).remaining,0);
  s.contracts[103].expiresAt=null;delete s.contracts[103].expiresSecond;
  assert.equal(contractExpiresSeconds(s.contracts[103]),null);assert.equal(contractStatus(s,103).remaining,null);
  assert.deepEqual(contractStartedFields(s,null),{started:24,startedSecond:11});
});

test('renewal rejects a stale same-hour service deadline before charging and preserves the exact accepted deadline',()=>{
  let s=dispatchCampaign(initialCampaign(),{type:'advanceStrategicTime',seconds:121});assert.equal(s.lastError,null);
  s=dispatchCampaign(s,{type:'recruitCivic',id:103,term:'day'});assert.equal(s.lastError,null);
  s=restoreCampaign(serializeCampaign(s));assert.equal(s.contracts[103].expiresAt,24);assert.equal(s.contracts[103].expiresSecond,121);
  for(const expectedExpiresSecond of [120,122]){
    const rejected=dispatchCampaign(s,{type:'renewContract',id:103,term:'day',expectedExpiresAt:24,expectedExpiresSecond});
    assert.match(rejected.lastError,/contrato cambió/);assert.deepEqual({...rejected,lastError:null},s,'a stale notice cannot charge money or alter the saved service');
  }
  const price=contractQuote(s,rosterFor(s).find(op=>op.id===103),'day').price;
  const renewed=dispatchCampaign(s,{type:'renewContract',id:103,term:'day',expectedExpiresAt:24,expectedExpiresSecond:121});
  assert.equal(renewed.lastError,null);assert.equal(renewed.resources.treasury,s.resources.treasury-price);
  assert.equal(contractExpiresSeconds(renewed.contracts[103]),contractExpiresSeconds(s.contracts[103])+24*3600);
  assert.equal(renewed.hour,s.hour);assert.equal(renewed.secondOfHour,s.secondOfHour);assert.ok(restoreCampaign(serializeCampaign(renewed)));
});

test('fractional warnings distinguish same-hour renewal and actual expiry without duplicate events',()=>{
  const s=hired();s.contracts[103].expiresSecond=121;s.hour=22;s.secondOfHour=120;
  assert.deepEqual(contractAttentionStates(s),[]);s.secondOfHour=121;
  const event={operativeId:103,expiresAt:24,expiresSecond:121,code:'expiring'};
  assert.deepEqual(collectContractAttention(s),[event]);assert.deepEqual(collectContractAttention(s),[]);
  s.contracts[103].expiresSecond=122;s.secondOfHour=122;
  assert.deepEqual(collectContractAttention(s),[{...event,expiresSecond:122}]);
  s.hour=24;s.secondOfHour=121;assert.equal(contractAttentionStates(s)[0].code,'expiring');
  s.secondOfHour=122;assert.deepEqual(collectContractAttention(s),[{...event,expiresSecond:122,code:'expired'}]);
});

test('saved notices validate exact seconds and public notices preserve nonzero precision',()=>{
  const s=hired();s.hour=24;s.secondOfHour=120;
  const event={operativeId:103,expiresAt:24,expiresSecond:121,code:'expiring'};
  s.contractAttention={version:1,reported:{103:{expiresAt:24,expiresSecond:121,code:'expiring'}},notice:{hour:24,secondOfHour:120,requestedHours:1,advancedHours:0,events:[event]}};
  assert.doesNotThrow(()=>validateContractAttention(s,rosterFor(s)));assert.deepEqual(publicContractNotice(s),s.contractAttention.notice);
  for(const mutate of [
    n=>n.secondOfHour=121,n=>n.secondOfHour=3600,n=>n.secondOfHour=null,
    n=>n.events[0].expiresSecond=120,n=>n.events[0].expiresSecond=-1,n=>n.events[0].expiresSecond=1.5,n=>n.events[0].expiresSecond=null,
  ]){const copy=structuredClone(s);mutate(copy.contractAttention.notice);assert.throws(()=>validateContractAttention(copy,rosterFor(copy)),/avisos/);}
  const copy=publicContractNotice(s);copy.events[0].expiresSecond=0;assert.equal(s.contractAttention.notice.events[0].expiresSecond,121);
});

test('salary percentages are applied before the single daily ceiling without floating-point extra pesos',()=>{
  const s={hour:0,hiringPriceMultiplier:6,operativeState:{103:{xp:100}},contentCampaign:{package:{contractRules:{...DEFAULT_CONTRACT_RULES,salaryMonthDays:20}}}};
  const q=contractQuote(s,{id:103,monthlyPay:600,service:'contract'},'day');assert.equal(q.daily,198);assert.equal(q.price,198);
});

test('an explicit fractional wait expires an undeployed whole-hour contract at its deadline without adding time',()=>{
  const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
  let before=order(hired(),{type:'wait',hours:22});
  before=order(before,{type:'wait',hours:1});before=order(before,{type:'advanceStrategicTime',seconds:3599});
  assert.equal(before.hour,23);assert.equal(before.secondOfHour,3599);assert.ok(before.recruited.includes(103));
  const waited=order(restoreCampaign(serializeCampaign(before)),{type:'wait',hours:1});
  assert.equal(waited.hour,24);assert.equal(waited.secondOfHour,3599);
  assert.equal(waited.recruited.includes(103),false);assert.equal(waited.contracts[103],undefined);
  const expiry=waited.log.find(entry=>entry.text.includes('concluye su contrato'));
  assert.equal(expiry.hour,24);assert.equal(expiry.secondOfHour,undefined);assert.ok(restoreCampaign(serializeCampaign(waited)));
  const atDeadline=order(before,{type:'advanceStrategicTime',seconds:3600});
  assert.equal(atDeadline.hour,24);assert.equal(atDeadline.secondOfHour,0);assert.equal(atDeadline.recruited.includes(103),false);
  const continuous=order(atDeadline,{type:'advanceStrategicTime',seconds:3599});
  assert.equal(continuous.hour,waited.hour);assert.equal(continuous.secondOfHour,waited.secondOfHour);assert.equal(continuous.contracts[103],undefined);
  assert.deepEqual(continuous.log.find(entry=>entry.text.includes('concluye su contrato')),expiry);
});

test('continuous time stops at the exact fractional renewal warning once, then resumes through precise expiry',()=>{
  const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
  let state=order(initialCampaign(),{type:'advanceStrategicTime',seconds:121});
  state=order(state,{type:'recruitCivic',id:103,term:'day'});
  state=order(state,{type:'wait',hours:21});state=order(state,{type:'advanceStrategicTime',seconds:3599});
  assert.equal(state.hour,22);assert.equal(state.secondOfHour,120);assert.equal(state.contractAttention.notice,null);
  assert.equal(nextContractWarningSeconds(state),1);
  const before=structuredClone(state);state=order(state,{type:'advanceStrategicTime',seconds:900});
  assert.equal(state.hour,22);assert.equal(state.secondOfHour,121);assert.ok(state.recruited.includes(103));
  assert.deepEqual(state.contractAttention.notice,{hour:22,secondOfHour:121,requestedHours:1,advancedHours:0,events:[{operativeId:103,expiresAt:24,expiresSecond:121,code:'expiring'}]});
  assert.equal(nextContractWarningSeconds(state),null);
  assert.deepEqual(order(restoreCampaign(serializeCampaign(before)),{type:'advanceStrategicTime',seconds:900}),state);
  state=order(restoreCampaign(serializeCampaign(state)),{type:'advanceStrategicTime',seconds:900});
  assert.equal(state.hour,22);assert.equal(state.secondOfHour,1021);assert.equal(state.contractAttention.notice,null);
  state=order(state,{type:'advanceStrategicTime',seconds:3600});state=order(state,{type:'advanceStrategicTime',seconds:2699});
  assert.equal(state.hour,24);assert.equal(state.secondOfHour,120);assert.ok(state.recruited.includes(103));
  state=order(state,{type:'advanceStrategicTime',seconds:900});
  assert.equal(state.hour,24);assert.equal(state.secondOfHour,121);assert.equal(state.recruited.includes(103),false);
  assert.equal(state.contractAttention.notice.events[0].code,'expired');assert.ok(restoreCampaign(serializeCampaign(state)));
});

test('warning countdown shares notice admission and ignores acknowledged warnings without a zero step',()=>{
  const state=hired();state.hour=21;state.secondOfHour=3599;
  assert.equal(nextContractWarningSeconds(state),1);
  for(const change of [copy=>copy.operativeState[103].alive=false,copy=>copy.operativeState[103].captured=true,copy=>copy.contracts[103].expiresAt=null,copy=>copy.contractAttention.reported[103]={expiresAt:24,code:'expiring'}]){
    const copy=structuredClone(state);change(copy);assert.equal(nextContractWarningSeconds(copy),null);
  }
  state.hour=22;state.secondOfHour=0;assert.equal(nextContractWarningSeconds(state),null);assert.equal(contractAttentionStates(state)[0].code,'expiring');
});
