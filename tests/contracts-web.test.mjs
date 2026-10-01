import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,contractQuote,rosterFor,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {defaultProfile} from '../game/character-profile.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const create={type:'createOfficer',name:'Elena del Sur',profile:defaultProfile(),answers:{origin:'cabildo',doctrine:'guerrilla_tactician',crisis:'rally',specialty:'teacher',temperament:'optimistic'}};
test('genuine new game creates exactly one custom officer then hires explores Retiro and saves',()=>{
 let s=initialCampaign();assert.deepEqual(s.recruited,[]);assert.deepEqual(s.squad,[]);assert.equal(s.defeated,false);assert.deepEqual(restoreCampaign(serializeCampaign(s)).recruited,[]);assert.ok(dispatchCampaign(s,{type:'visitSector'}).lastError);
 const startingTreasury=s.resources.treasury;s=order(s,create);assert.equal(s.resources.treasury,startingTreasury);assert.deepEqual(s.recruited,[1000]);assert.equal(rosterFor(s).find(o=>o.id===1000).leadership,55);s=order(s,{type:'recruitCivic',id:101,term:'week'});assert.deepEqual(s.recruited,[1000,101]);assert.equal(s.contracts[101].expiresAt,168);s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle);const saved=decodeSave(encodeSave(s,b));assert.equal(saved.battle.units.filter(u=>u.side==='player').length,2);s=order(saved.campaign,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.map(u=>({...u,id:Number(u.id)}))});assert.deepEqual(s.recruited,[1000,101]);
});
test('contracts pay upfront, renew at current experience price, expire safely without duplicating gear',()=>{
 let s=order(initialCampaign(),create);s=order(s,{type:'recruitCivic',id:100,term:'day'});const op=rosterFor(s).find(o=>o.id===100),cash=s.resources.treasury;s.operativeState[100].xp=200;const q=contractQuote(s,op,'week');assert.ok(q.price>Math.ceil(op.monthlyPay/30)*7);s=order(s,{type:'renewContract',id:100,term:'week'});assert.equal(s.resources.treasury,cash-q.price);assert.equal(s.contracts[100].expiresAt,192);s.operativeState[100].rations=1;s=order(s,{type:'wait',hours:192});assert.equal(s.hour,190);s=order(s,{type:'wait',hours:2});assert.ok(!s.recruited.includes(100));assert.ok(!s.squads[0].members.includes(100));assert.equal(s.defeated,false);s=order(s,{type:'recruitCivic',id:100,term:'day'});assert.equal(s.operativeState[100].rations,1);s=order(s,{type:'dismiss',id:100});assert.ok(!s.contracts[100]);
});
test('elite terms are limited only by funds and historical figures cannot be bought',()=>{
 let s=initialCampaign();const elite=rosterFor(s).find(o=>o.tier==='elite');assert.ok(elite);
 assert.ok(contractQuote(s,elite,'month').price>s.resources.treasury);assert.ok(dispatchCampaign(s,{type:'recruitCivic',id:elite.id,term:'month'}).lastError);s=order(s,{type:'recruitCivic',id:elite.id,term:'day'});assert.equal(s.contracts[elite.id].expiresAt,24);assert.ok(dispatchCampaign(s,{type:'recruit',id:3,term:'day'}).lastError);s=order(s,{type:'wait',hours:24});assert.equal(s.hour,22);s=order(s,{type:'wait',hours:2});assert.deepEqual(s.recruited,[]);assert.equal(s.defeated,false);
});
test('old saves retain explicit legacy service and malformed contracts reject',()=>{
 const s=initialCampaign();s.recruited=[3];s.squad=[3];s.squads[0].members=[3];delete s.contracts;const old=restoreCampaign(serializeCampaign(s));assert.equal(old.contracts[3].kind,'legacy');old.contracts[3].expiresAt=-1;assert.throws(()=>restoreCampaign(serializeCampaign(old)));
});
test('elite renewals bank days at the daily price and dead recruits cannot be hired',()=>{
 let s=order(initialCampaign(),create);const elites=rosterFor(s).filter(o=>o.tier==='elite');assert.ok(elites.length>=2);
 const id=elites[0].id;const daily=contractQuote(s,rosterFor(s).find(o=>o.id===id),'day').price;
 s=order(s,{type:'recruitCivic',id,term:'day'});assert.equal(s.contracts[id].expiresAt,24);
 s.resources.treasury=daily*3;
 s=order(s,{type:'renewContract',id,term:'day'});assert.equal(s.contracts[id].expiresAt,48);
 s=order(s,{type:'wait',hours:6});s=order(s,{type:'renewContract',id,term:'day'});assert.equal(s.contracts[id].expiresAt,72);
 assert.equal(s.resources.treasury,daily);
 s=order(s,{type:'dismiss',id});s.operativeState[id].alive=false;s.operativeState[id].hp=0;
 assert.ok(dispatchCampaign(s,{type:'recruitCivic',id,term:'day'}).lastError);
});

test('paid foreign renewals restore foreign standing once per soldier per day and survive saves',()=>{
 let s=order(initialCampaign(),{type:'recruitCivic',id:103,term:'week'});
 const op=rosterFor(s).find(o=>o.id===103);assert.equal(op.foreign,true);
 const initialStanding=s.reputation.foreign,expires=s.contracts[103].expiresAt,cash=s.resources.treasury;
 const quote=contractQuote(s,op,'day');assert.ok(quote.price>0);
 s=order(s,{type:'renewContract',id:103,term:'day',expectedExpiresAt:expires});
 assert.equal(s.resources.treasury,cash-quote.price);assert.equal(s.reputation.foreign,initialStanding+5);
 const stale=dispatchCampaign(s,{type:'renewContract',id:103,term:'day',expectedExpiresAt:expires});assert.ok(stale.lastError);assert.equal(stale.resources.treasury,s.resources.treasury);assert.equal(stale.reputation.foreign,s.reputation.foreign);
 s=decodeSave(encodeSave(s)).campaign;
 s=order(s,{type:'renewContract',id:103,term:'day',expectedExpiresAt:s.contracts[103].expiresAt});
 assert.equal(s.reputation.foreign,initialStanding+5,'buying more days at the same time does not repeat the standing reward');
 for(let i=0;i<30&&s.hour<24;i++)s=order(s,{type:'wait',hours:1});assert.equal(s.hour,24);
 s=order(s,{type:'renewContract',id:103,term:'day',expectedExpiresAt:s.contracts[103].expiresAt});
 assert.equal(s.reputation.foreign,initialStanding+10);
 assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);
});

test('domestic renewals and rejected permanent renewals do not add foreign standing',()=>{
 let s=order(initialCampaign(),create);s=order(s,{type:'recruitCivic',id:100,term:'week'});
 const standing=s.reputation.foreign;assert.ok(!rosterFor(s).find(o=>o.id===100).foreign);
 s=order(s,{type:'renewContract',id:100,term:'day',expectedExpiresAt:s.contracts[100].expiresAt});
 assert.equal(s.reputation.foreign,standing);
 const rejected=dispatchCampaign(s,{type:'renewContract',id:1000,term:'day'});assert.ok(rejected.lastError);assert.equal(rejected.reputation.foreign,standing);assert.equal(rejected.resources.treasury,s.resources.treasury);
});
