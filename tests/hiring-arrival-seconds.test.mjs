import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {advanceHireArrivals,hireArrivalDueSeconds,nextHireArrivalSeconds,redirectHire,validateHireArrivals} from '../game/hiring-arrivals.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {secureArea} from './controlled-area-fixture.mjs';

const order=(s,action)=>{const next=dispatchCampaign(s,action);assert.equal(next.lastError,null,next.lastError);return next;};
const saved=s=>decodeSave(encodeSave(s)).campaign;
const hire={type:'recruitCivic',id:110,term:'day',destination:'retiro'};
function booked(second=3599,destination='retiro'){
  const content=defaultContentPackage();content.characters.find(c=>c.id==='person-110').arrivalHours=1;
  const state=initialCampaign(42,content);state.secondOfHour=second;
  if(destination!=='retiro')secureArea(state,destination);
  return order(state,{...hire,destination});
}

test('a hire booked one second before an hour still travels for the complete authored hour',()=>{
  const s=saved(booked()),arrival=s.hiringArrivals[0],arrived=[];
  assert.equal(arrival.bookedSecond,3599);assert.equal(arrival.departedSecond,3599);assert.equal(arrival.dueSecond,3599);
  assert.equal(hireArrivalDueSeconds(arrival),7199);assert.equal(nextHireArrivalSeconds(s),3600);
  s.hour=1;s.secondOfHour=0;advanceHireArrivals(s,a=>arrived.push(a));
  assert.equal(arrived.length,0);assert.equal(nextHireArrivalSeconds(s),3599);
  s.secondOfHour=3598;advanceHireArrivals(s,a=>arrived.push(a));assert.equal(arrived.length,0);
  s.secondOfHour=3599;advanceHireArrivals(s,a=>arrived.push(a));
  assert.deepEqual(arrived,[arrival]);assert.equal(s.hiringArrivals.length,0);assert.equal(nextHireArrivalSeconds(s),null);
});

test('redirecting at a fractional hour restarts the full journey and preserves the paid receipt',()=>{
  let s=booked(37,'ensenada');secureArea(s,'buenos_aires');s.sectors.ensenada.owner='royalist';
  s=order(s,{type:'advanceStrategicTime',seconds:3600});s=order(s,{type:'advanceStrategicTime',seconds:84});
  const receipt={...s.hiringArrivals[0]},cash=s.resources.treasury;
  redirectHire(s,110,'buenos_aires');s=saved(s);
  const redirected=s.hiringArrivals[0];
  assert.equal(redirected.bookedAt,receipt.bookedAt);assert.equal(redirected.bookedSecond,37);
  assert.equal(redirected.departedAt,1);assert.equal(redirected.departedSecond,121);
  assert.equal(redirected.dueAt,2);assert.equal(redirected.dueSecond,121);assert.equal(nextHireArrivalSeconds(s),3600);
  assert.equal(redirected.paid,receipt.paid);assert.equal(redirected.priceScale,receipt.priceScale);assert.equal(s.resources.treasury,cash);
});

test('legacy whole-hour receipts retain their due time and price through save and redirection',()=>{
  let s=booked(0),a=s.hiringArrivals[0];
  for(const key of ['bookedSecond','departedSecond','dueSecond'])delete a[key];
  const price=a.priceScale;s=saved(s);a=s.hiringArrivals[0];
  assert.equal(Object.hasOwn(a,'dueSecond'),false);assert.equal(hireArrivalDueSeconds(a),3600);assert.equal(a.priceScale,price);
  s.secondOfHour=53;secureArea(s,'buenos_aires');redirectHire(s,110,'buenos_aires');s=saved(s);
  assert.equal(s.hiringArrivals[0].bookedSecond,undefined);assert.equal(s.hiringArrivals[0].departedSecond,53);
  assert.equal(nextHireArrivalSeconds(s),3600);assert.equal(s.hiringArrivals[0].priceScale,price);
});

test('saved fractional receipts validate seconds, complete departure/due pairs and timestamp order',()=>{
  const s=booked(53);
  const invalid=[
    a=>a.bookedSecond=-1,a=>a.departedSecond=3600,a=>a.dueSecond=1.5,a=>a.dueSecond=null,
    a=>delete a.departedSecond,a=>delete a.dueSecond,a=>a.dueSecond++,a=>a.departedSecond=54,
    a=>a.bookedSecond=54,a=>a.bookedSecond=undefined,
  ];
  for(const mutate of invalid){const copy=structuredClone(s);mutate(copy.hiringArrivals[0]);assert.throws(()=>validateHireArrivals(copy,rosterFor(copy)),/llegadas/);}
  assert.doesNotThrow(()=>validateHireArrivals(s,rosterFor(s)));
});

test('a blocked overdue arrival does not freeze the next clock step and remains pending',()=>{
  const s=booked(37);s.hour=2;s.secondOfHour=0;s.sectors.retiro.owner='royalist';
  advanceHireArrivals(s,()=>assert.fail('unsafe destination must hold the hire'));
  assert.equal(s.hiringArrivals.length,1);assert.equal(nextHireArrivalSeconds(s),null);
  s.hiringArrivals.push({...s.hiringArrivals[0],dueAt:4,dueSecond:11});assert.equal(nextHireArrivalSeconds(s),7211);
  s.defeated=true;assert.equal(nextHireArrivalSeconds(s),null);
});

test('continuous campaign time admits the hire at its exact deadline and grants the complete paid service',()=>{
  let s=booked();s=order(s,{type:'advanceStrategicTime',seconds:3599});
  assert.equal(s.hour,1);assert.equal(s.secondOfHour,3598);assert.equal(s.recruited.includes(110),false);s=saved(s);
  s=order(s,{type:'advanceStrategicTime',seconds:1});assert.ok(s.recruited.includes(110));
  assert.equal(s.hiringArrivals.length,0);assert.equal(s.contracts[110].started,1);assert.equal(s.contracts[110].startedSecond,3599);
  assert.equal(s.contracts[110].expiresAt,25);assert.equal(s.contracts[110].expiresSecond,3599);s=saved(s);
  s=order(s,{type:'wait',hours:22});assert.equal(s.hour,23);assert.equal(s.secondOfHour,3599);assert.equal(s.contractAttention.notice.events[0].code,'expiring');
  s=order(s,{type:'advanceStrategicTime',seconds:3599});s=order(s,{type:'advanceStrategicTime',seconds:3600});
  assert.equal(s.hour,25);assert.equal(s.secondOfHour,3598);assert.ok(s.recruited.includes(110));assert.ok(saved(s).contracts[110]);
  s=order(s,{type:'advanceStrategicTime',seconds:1});assert.equal(s.hour,25);assert.equal(s.secondOfHour,3599);
  assert.equal(s.recruited.includes(110),false);assert.equal(s.contracts[110],undefined);assert.equal(s.contractAttention.notice.events[0].code,'expired');assert.ok(saved(s));
});

test('an explicit wait from a fractional start admits a whole-hour hire at its deadline without adding time',()=>{
  const before=order(booked(0),{type:'advanceStrategicTime',seconds:3599});
  const waited=order(saved(before),{type:'wait',hours:1});
  assert.equal(waited.hour,1);assert.equal(waited.secondOfHour,3599);
  assert.ok(waited.recruited.includes(110));assert.equal(waited.hiringArrivals.length,0);
  assert.equal(waited.contracts[110].started,1);assert.equal(waited.contracts[110].startedSecond,undefined);
  assert.equal(waited.contracts[110].expiresAt,25);assert.equal(waited.contracts[110].expiresSecond,undefined);
  const arrival=waited.log.find(entry=>entry.text.includes('llega a')&&entry.text.includes('comienza su servicio'));
  assert.equal(arrival.hour,1);assert.equal(arrival.secondOfHour,undefined);assert.ok(saved(waited));
  const atDeadline=order(before,{type:'advanceStrategicTime',seconds:3600});
  assert.equal(atDeadline.hour,1);assert.equal(atDeadline.secondOfHour,0);
  const continuous=order(atDeadline,{type:'advanceStrategicTime',seconds:3599});
  assert.equal(continuous.hour,waited.hour);assert.equal(continuous.secondOfHour,waited.secondOfHour);
  assert.deepEqual(continuous.contracts[110],waited.contracts[110]);assert.equal(continuous.resources.treasury,waited.resources.treasury);
});
