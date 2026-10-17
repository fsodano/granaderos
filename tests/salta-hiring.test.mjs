import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {hiringTravelHours} from '../game/hiring-arrivals.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {fundedRouteContent,routeHiringCeiling} from './funded-route-fixture.mjs';
import {quoteSaltaHires} from './salta-hiring.mjs';

const order=(c,a)=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+': '+next.lastError);return next;};
const saved=c=>decodeSave(encodeSave(c)).campaign;

test('Salta quotes a complete paid force when the remaining eligible volunteers exceed the old weekly ceiling',()=>{
 let c=initialCampaign(8,fundedRouteContent());
 // Existing serving personnel remain employed. The chosen nine-person column
 // needs three arrivals; the other paid volunteers stay outside that column.
 const ordinary=rosterFor(c).filter(op=>op.id>=100&&op.id<1000&&contractQuote(c,op,'day').total<1000);
 for(const op of ordinary)c=order(c,{type:'recruitCivic',id:op.id,term:'day'});
 const local=c.recruited.slice(0,9),start=saved(c),before=structuredClone(start);
 assert.equal(rosterFor(start).filter(op=>op.id>=100&&op.id<1000&&!start.recruited.includes(op.id)&&contractQuote(start,op,'week').available&&contractQuote(start,op,'week').price<=routeHiringCeiling(start,250)).length,0);
 const plan=quoteSaltaHires(start,local);assert.equal(plan.offers.length,3);assert.ok(plan.replacements.every(offer=>offer.term==='day'));
 assert.ok(plan.total<=start.resources.treasury-plan.reserve);
 let hired=start;
 for(const offer of plan.offers){
  const quote=contractQuote(hired,rosterFor(hired).find(op=>op.id===offer.id),offer.term),cash=hired.resources.treasury;
  assert.deepEqual(offer.quote,quote);assert.equal(hiringTravelHours(hired,offer.id),0);
  hired=order(hired,{type:'recruitCivic',id:offer.id,term:offer.term});
  assert.equal(hired.resources.treasury,cash-quote.total);assert.equal(hired.contracts[offer.id].paid,quote.price);
  assert.equal(hired.contracts[offer.id].started,start.hour);assert.equal(hired.operativeState[offer.id].location,start.location);
  assert.equal(hired.operativeState[offer.id].hp,start.operativeState[offer.id].hp);
 }
 assert.equal(hired.resources.treasury,start.resources.treasury-plan.total);
 assert.deepEqual(hired.recruited.filter(id=>!start.recruited.includes(id)),plan.offers.map(offer=>offer.id));
 assert.deepEqual(saved(hired),hired);assert.deepEqual(start,before);
});

test('ordinary weekly relief remains possible within the complete public budget',()=>{
 const start=initialCampaign(45,fundedRouteContent()),before=structuredClone(start),plan=quoteSaltaHires(start,[]);
 assert.equal(plan.offers.length,12);assert.ok(plan.replacements.every(offer=>offer.term==='week'));
 let current=start;for(const offer of plan.offers)current=order(current,{type:'recruitCivic',id:offer.id,term:offer.term});
 assert.equal(current.resources.treasury,start.resources.treasury-plan.total);assert.ok(current.resources.treasury>=plan.reserve);
 assert.deepEqual(saved(current),current);assert.deepEqual(start,before);
});

test('an unaffordable complete force refuses before any Native booking',()=>{
 const content=fundedRouteContent();content.rules.startingTreasury=300;
 const start=initialCampaign(45,content),before=structuredClone(start);
 assert.throws(()=>quoteSaltaHires(start,[]),/No complete quoted Salta relief fits the actual budget/);
 assert.deepEqual(start,before);assert.deepEqual(start.recruited,[]);assert.deepEqual(start.hiringArrivals,[]);
});


test('five genuinely serving local people need only seven additional quoted Native hires and remain separate from those transactions',()=>{
 let c=initialCampaign(45,fundedRouteContent());const ordinary=rosterFor(c).filter(op=>op.id>=100&&op.id<1000&&contractQuote(c,op,'day').available&&contractQuote(c,op,'day').total<1000).slice(0,5);
 assert.equal(ordinary.length,5);for(const op of ordinary)c=order(c,{type:'recruitCivic',id:op.id,term:'week'});
 const local=ordinary.map(op=>op.id),start=saved(c),before=structuredClone(start),contracts=structuredClone(start.contracts),plan=quoteSaltaHires(start,local);
 assert.equal(plan.offers.length,7);assert.equal(new Set([...local,...plan.offers.map(o=>o.id)]).size,12);
 for(const offer of plan.offers){assert.ok(!local.includes(offer.id));const quote=contractQuote(c,rosterFor(c).find(op=>op.id===offer.id),offer.term);assert.deepEqual(offer.quote,quote);const cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id:offer.id,term:offer.term});assert.equal(c.resources.treasury,cash-quote.total);assert.equal(c.contracts[offer.id].paid,quote.price);}
 assert.equal(c.resources.treasury,start.resources.treasury-plan.total);assert.ok(c.resources.treasury>=plan.reserve);assert.equal(c.recruited.length,12);
 for(const id of local){assert.deepEqual(c.contracts[id],contracts[id]);assert.deepEqual(c.operativeState[id],start.operativeState[id]);}
 assert.deepEqual(saved(c),c);assert.deepEqual(start,before);
});
