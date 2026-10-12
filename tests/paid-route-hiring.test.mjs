import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {fundedRouteContent} from './funded-route-fixture.mjs';
import {bookRouteHires,finishRouteHireArrivals} from './paid-route-hiring.mjs';
import {saved,order} from './local-contract-fixture.mjs';

const ids=[112,115,123];
const fresh=content=>saved({campaign:order(initialCampaign(1812,content),{type:'advanceStrategicTime',seconds:121})}).campaign;

for(const delayed of [false,true])test(`paid northern replacements retain ${delayed?'mixed authored':'immediate stock'} arrival, payment, service and saved replay`,()=>{
 const content=fundedRouteContent();
 if(delayed)for(const [index,id]of ids.entries())content.characters.find(person=>person.id===`person-${id}`).arrivalHours=[0,2,8][index];
 const start=fresh(content),before=structuredClone(start),events=[];
 const booked=bookRouteHires(start,ids,{report:event=>events.push(event)});
 assert.deepEqual(start,before);assert.equal(events.length,ids.length);
 assert.equal(booked.campaign.resources.treasury,start.resources.treasury-booked.hires.reduce((sum,hire)=>sum+hire.quote.total,0));
 assert.deepEqual(booked.campaign.hiringArrivals.map(arrival=>arrival.operativeId),delayed?[115,123]:[]);
 const ready=finishRouteHireArrivals(booked.campaign,booked.hires),hours=delayed?8:6;
 assert.equal(ready.hour,hours);assert.equal(ready.secondOfHour,121);assert.deepEqual(ready.hiringArrivals,[]);
 for(const [index,id]of ids.entries()){
  const contract=ready.contracts[id],arrived=delayed?[0,2,8][index]:0;
  assert.equal(contract.started,arrived);assert.equal(contract.startedSecond,121);
  assert.equal(contract.expiresAt,arrived+168);assert.equal(contract.expiresSecond,121);
  assert.equal(ready.operativeState[id].location,'retiro');
 }
 let replay=before;
 for(const id of ids)replay=order(replay,{type:'recruitCivic',id,term:'week',destination:'retiro'});
 replay=saved({campaign:replay}).campaign;replay=order(replay,{type:'wait',hours});
 assert.deepEqual(saved({campaign:replay}).campaign,ready,'public booking and real waits replay through an official save');
 const duplicate=dispatchCampaign(ready,{type:'recruitCivic',id:ids[0],term:'week',destination:'retiro'});
 assert.ok(duplicate.lastError);assert.deepEqual({...duplicate,lastError:null},{...ready,lastError:null});
});

test('duplicate route hire identities fail before any transaction',()=>{
 const start=fresh(fundedRouteContent()),before=structuredClone(start),events=[];
 assert.throws(()=>bookRouteHires(start,[112,112],{report:event=>events.push(event)}),/unique identities/);
 assert.deepEqual(start,before);assert.deepEqual(events,[]);
});
