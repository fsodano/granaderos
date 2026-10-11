import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {hiringTravelHours} from '../game/hiring-arrivals.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {fundedRouteContent} from './funded-route-fixture.mjs';
import {prepareFreshCoastalHires} from './fresh-coastal-fixture.mjs';

const ids=[110,136,141,120],save=s=>decodeSave(encodeSave(s)).campaign;
const order=(s,action)=>{const next=dispatchCampaign(s,action);assert.equal(next.lastError,null,JSON.stringify(action)+next.lastError);return next;};
const clock=s=>s.hour*3600+(s.secondOfHour??0);
function replay(start,actions){
 let s=start;
 for(let index=0;index<actions.length;index++){
  s=order(s,actions[index]);if(index===Math.floor(actions.length/2))s=save(s);
 }
 return save(s);
}

test('coastal hiring retains immediate stock arrivals, exact paid terms and the real six-hour readiness wait',()=>{
 const start=save(order(initialCampaign(8,fundedRouteContent()),{type:'advanceStrategicTime',seconds:121})),before=structuredClone(start),events=[];
 assert.ok(ids.every(id=>hiringTravelHours(start,id)===0),'Canonical stock hires are immediate.');
 const quotes=ids.map(id=>contractQuote(start,rosterFor(start).find(op=>op.id===id),'week'));
 const result=prepareFreshCoastalHires(start,ids,{report:event=>events.push(event)}),s=result.campaign;
 assert.deepEqual(start,before);assert.equal(result.waitHours,6);assert.equal(clock(s)-clock(start),6*3600);
 assert.equal(s.resources.treasury,start.resources.treasury-quotes.reduce((sum,quote)=>sum+quote.total,0));
 assert.equal(new Set(result.hires.map(hire=>hire.id)).size,ids.length);assert.deepEqual(s.hiringArrivals,[]);
 for(const [index,id]of ids.entries()){
  const contract=s.contracts[id];assert.equal(s.recruited.filter(value=>value===id).length,1);assert.equal(s.operativeState[id].location,'retiro');
  assert.equal(contract.kind,'paid');assert.equal(contract.term,'week');assert.equal(contract.paid,quotes[index].price);
  assert.equal(contract.started,0);assert.equal(contract.startedSecond,121);assert.equal(contractExpiresSeconds(contract),121+quotes[index].hours*3600);
  assert.equal(result.hires[index].debited,quotes[index].total);
 }
 const booked=events.filter(event=>event.action.type==='recruitCivic');assert.equal(booked.length,ids.length);
 assert.ok(booked.every(event=>event.campaign.recruited.includes(event.action.id)&&!event.campaign.hiringArrivals.some(a=>a.operativeId===event.action.id)));
 assert.ok(result.orders.some(action=>action.type==='wait'&&action.hours===6));assert.deepEqual(replay(start,result.orders),s);
 const duplicate=dispatchCampaign(s,{type:'recruitCivic',id:ids[0],term:'week',destination:'retiro'});assert.ok(duplicate.lastError);assert.equal(duplicate.resources.treasury,s.resources.treasury);
});

test('coastal hiring supports mixed authored delays with exact arrival starts, saved pending people and public-order replay',()=>{
 const content=fundedRouteContent(),delays=[0,2,6,8];
 for(const [index,id]of ids.entries())content.characters.find(character=>character.id===`person-${id}`).arrivalHours=delays[index];
 const start=save(order(initialCampaign(8,content),{type:'advanceStrategicTime',seconds:121})),events=[],before=structuredClone(start);
 const result=prepareFreshCoastalHires(start,ids,{report:event=>events.push(event)}),s=result.campaign;
 assert.deepEqual(start,before);assert.equal(result.waitHours,8);assert.equal(clock(s)-clock(start),8*3600);
 assert.deepEqual(result.orders.filter(action=>action.type==='wait').map(action=>action.hours),[2,4,2]);
 const twoHours=events.find(event=>event.action.type==='wait'&&event.hour===2).campaign;
 assert.deepEqual(twoHours.hiringArrivals.map(arrival=>arrival.operativeId),[141,120]);assert.deepEqual(save(twoHours),twoHours);
 assert.equal(twoHours.contracts[141],undefined);assert.equal(twoHours.recruited.includes(141),false);
 const sixHours=events.find(event=>event.action.type==='wait'&&event.hour===6).campaign;
 assert.deepEqual(sixHours.hiringArrivals.map(arrival=>arrival.operativeId),[120]);assert.deepEqual(save(sixHours),sixHours);
 for(const [index,id]of ids.entries()){
  const hire=result.hires[index],contract=s.contracts[id];assert.equal(hire.arrival.travelHours,delays[index]);assert.equal(hire.arrival.dueAt,delays[index]);assert.equal(hire.arrival.dueSecond,121);
  assert.equal(contract.started,delays[index]);assert.equal(contract.startedSecond,121);assert.equal(contract.paid,hire.quote.price);
  assert.equal(contractExpiresSeconds(contract),(delays[index]+hire.quote.hours)*3600+121);assert.equal(s.recruited.filter(value=>value===id).length,1);
 }
 assert.equal(s.resources.treasury,start.resources.treasury-result.hires.reduce((sum,hire)=>sum+hire.debited,0));assert.deepEqual(s.hiringArrivals,[]);assert.deepEqual(replay(start,result.orders),s);
});

test('coastal hiring rejects duplicate identities before any public payment',()=>{
 const start=initialCampaign(8,fundedRouteContent()),before=structuredClone(start),events=[];
 assert.throws(()=>prepareFreshCoastalHires(start,[110,110],{report:event=>events.push(event)}),/unique identities/);
 assert.deepEqual(start,before);assert.deepEqual(events,[]);
});
