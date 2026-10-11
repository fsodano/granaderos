import assert from 'node:assert/strict';
import {rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {hireArrivalOrder,hireArrivalDueSeconds} from '../game/hiring-arrivals.js';
import {order,saved} from './local-contract-fixture.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';

const clock=s=>s.hour*3600+(s.secondOfHour??0);

export function assertRouteHireArrived(s,hire){
 const {id,quote,arrival}=hire,contract=s.contracts[id],due=hireArrivalDueSeconds(arrival);
 assert.equal(s.recruited.filter(value=>value===id).length,1,'A paid route hire arrives once.');
 assert.equal(s.hiringArrivals.some(value=>value.operativeId===id),false);
 assert.equal(s.operativeState[id].location,arrival.destination);
 assert.equal(contract.kind,quote.permanent?'patriot':'paid');assert.equal(contract.term,arrival.term);assert.equal(contract.paid,quote.price);
 assert.equal(contract.started*3600+(contract.startedSecond??0),due,'The real quoted arrival starts service.');
 assert.equal(contractExpiresSeconds(contract),quote.permanent?null:due+quote.hours*3600);
}

// Observe ordinary booking without assuming that every profile has a delay.
// Each transaction includes the actual guarantee, when one is required.
export function bookRouteHires(start,ids,{term='week',destination=start.location,report=()=>{}}={}){
 assert.equal(new Set(ids).size,ids.length,'Route hires must have unique identities.');
 const before=structuredClone(start),hires=[];let s=saved({campaign:start}).campaign;
 for(const id of ids){
  assert.ok(!s.recruited.includes(id)&&!s.hiringArrivals.some(value=>value.operativeId===id));
  const operative=rosterFor(s).find(person=>person.id===id);assert.ok(operative);
  const quote=contractQuote(s,operative,term);assert.equal(quote.available,true,quote.reason);
  const arrival=hireArrivalOrder(s,operative,term,quote,destination),treasuryBefore=s.resources.treasury;
  s=order(s,{type:'recruitCivic',id,term,destination});
  const hire={id,quote:structuredClone(quote),arrival:structuredClone(arrival),debited:treasuryBefore-s.resources.treasury};
  assert.equal(hire.debited,quote.total,'Pay the actual service and guarantee once.');
  if(arrival.travelHours){
   assert.equal(s.recruited.includes(id),false);assert.equal(s.contracts[id],undefined);
   assert.deepEqual(s.hiringArrivals.find(value=>value.operativeId===id),arrival);
  }else assertRouteHireArrived(s,hire);
  hires.push(hire);report({event:'routeHireBooked',...hire,treasuryBefore,treasury:s.resources.treasury});
 }
 assert.equal(s.resources.treasury,start.resources.treasury-hires.reduce((sum,hire)=>sum+hire.debited,0));
 assert.deepEqual(start,before);return {campaign:saved({campaign:s}).campaign,hires};
}

// Keep the route's ordinary readiness wait. The clock can also pay actual
// agreed income; that income is not a duplicate hiring payment.
export function finishRouteHireArrivals(start,hires,{minimumWaitHours=6,report=()=>{}}={}){
 assert.ok(Number.isSafeInteger(minimumWaitHours)&&minimumWaitHours>=0&&minimumWaitHours<=720);
 const before=structuredClone(start),until=Math.max(clock(start)+minimumWaitHours*3600,...hires.map(hire=>hireArrivalDueSeconds(hire.arrival)));
 const hours=(until-clock(start))/3600;assert.ok(Number.isSafeInteger(hours));
 const s=saved({campaign:advanceCampaignHours(start,hours)}).campaign;
 assert.equal(clock(s),until);for(const hire of hires)assertRouteHireArrived(s,hire);
 assert.deepEqual(start,before);report({event:'routeHiresReady',hours,hires:hires.map(hire=>hire.id),hour:s.hour,second:s.secondOfHour??0,treasury:s.resources.treasury});
 return s;
}
