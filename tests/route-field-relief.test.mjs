import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {hireArrivalDueSeconds} from '../game/hiring-arrivals.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {recruitRouteFieldRelief} from './route-field-relief.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,a)=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+': '+next.lastError);return next;};
const saved=c=>{const next=decodeSave(encodeSave(c)).campaign;assert.deepEqual(next,c);return next;};
function setup({people=12,serving=6,treasury=20000,delays=[0,1,2,3,4,0],raid=false,remoteGuard=false,nearExpiry=false}={}){
 const d=scaffoldDocuments('declared-paid-field-relief'),base=d.content.characters[0],weapon=defaultContentPackage().weapons.find(w=>w.template===1800);
 d.content.rules.startingTreasury=treasury;d.content.rules.deploymentCartridges=8;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:20,max:null}];
 d.content.weapons.push({...structuredClone(weapon),id:'relief-musket',name:'Mosquete del relevo',art:base.portrait});
 d.content.characters=Array.from({length:people},(_,i)=>({...structuredClone(base),id:'relief-'+String(i).padStart(2,'0'),name:'Relevo '+i,nickname:'Relevo '+i,weapon:'relief-musket',monthlyPay:300,serviceGuarantee:31,arrivalHours:i<serving||remoteGuard&&i===serving?0:delays[(i-serving)%delays.length],attributes:{...base.attributes,marksmanship:70+i}}));
 if(raid){
  d.content.startingTerritory['watch-post'].owner='patriot';
  d.world.arrivalFacilities['watch-post']=['barracks'];d.content.arrivalSites.push({sector:'watch-post',facilities:['barracks']});
  d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:240,axis:['watch-post']}}};
 }
 const declared=structuredClone(d),content=compileCampaignPackage(d.manifest,d);let campaign=initialCampaign(42,content);const ids=rosterFor(campaign).map(op=>op.id);
 for(const id of ids.slice(0,serving))campaign=order(campaign,{type:'recruitCivic',id,term:'day',destination:raid&&!remoteGuard?'watch-post':'camp'});
 if(remoteGuard){
  const home=campaign.activeSquadId;
  campaign=order(campaign,{type:'recruitCivic',id:ids[serving],term:'day',destination:'watch-post'});
  campaign=order(campaign,{type:'createSquad',ids:[ids[serving]],sector:'watch-post',name:'Guardia local'});
  campaign=order(campaign,{type:'selectSquad',id:home});
 }else if(raid)campaign=order(campaign,{type:'createSquad',ids:ids.slice(0,serving),sector:'watch-post',name:'Guardia local'});
 campaign=order(campaign,{type:'advanceStrategicTime',seconds:121});
 if(nearExpiry)campaign=order(campaign,{type:'wait',hours:22});
 assert.deepEqual(d,declared);return {campaign:saved(campaign),ids};
}
function physical(c,id){
 const body=c.operativeState[id],person=rosterFor(c).find(op=>op.id===id);
 return {hp:body.hp,maxHp:body.maxHp,alive:body.alive,captured:body.captured,location:body.location,bleeding:body.bleeding,medkits:body.medkits,inventory:body.inventory,condition:body.condition,weaponDropped:body.weaponDropped,ammunition:unitAmmunitionByType({...person,...body,loaded:body.carriedLoaded??0})};
}
function replay(start,result){
 let campaign=start;
 for(const [index,row]of result.orders.entries()){
  assert.equal(clock(campaign),row.from);assert.equal(campaign.resources.treasury,row.treasuryBefore);campaign=order(campaign,row.action);
  assert.equal(clock(campaign),row.to);assert.equal(campaign.resources.treasury,row.treasuryAfter);
  if(index===Math.floor(result.orders.length/2))campaign=saved(campaign);
 }
 assert.deepEqual(saved(campaign),result.campaign);
}

test('six actual paid survivors receive only six quoted local replacements, with real arrival, guarantee, stock and renewal custody',()=>{
 const {campaign:start,ids}=setup({nearExpiry:true}),before=structuredClone(start),events=[];
 const result=recruitRouteFieldRelief(start,{report:e=>events.push(e)}),after=result.campaign;
 assert.equal(result.ready,true);assert.equal(result.reason,null);assert.equal(result.localIds.length,12);assert.equal(result.hires.length,6);assert.equal(new Set(result.hires.map(h=>h.id)).size,6);
 assert.equal(after.hiringArrivals.length,0);assert.equal(clock(after),clock(start)+4*3600);
 assert.equal(after.resources.treasury,start.resources.treasury-result.hires.reduce((n,h)=>n+h.quote.total,0)-result.renewals.reduce((n,r)=>n+r.quote.price,0));
 assert.ok(result.renewals.length>0,'the original day contracts are actually renewed before the waiting clock can expire them');
 for(const id of ids.slice(0,6)){assert.ok(after.recruited.includes(id));assert.ok(contractExpiresSeconds(after.contracts[id])>clock(after));assert.deepEqual(physical(after,id),physical(start,id));assert.equal(after.contracts[id].guaranteeId,start.contracts[id].guaranteeId);}
 for(const hire of result.hires){
  assert.ok(!start.recruited.includes(hire.id));assert.equal(hire.quote.permanent,false);assert.equal(hire.debited,hire.quote.total);assert.equal(hire.quote.guarantee,31);
  const contract=after.contracts[hire.id],body=after.operativeState[hire.id],due=hireArrivalDueSeconds(hire.arrival),person=rosterFor(after).find(op=>op.id===hire.id);
  assert.equal(contract.started*3600+(contract.startedSecond??0),due);assert.equal(contractExpiresSeconds(contract),due+hire.quote.hours*3600);assert.equal(contract.paid,hire.quote.price);assert.equal(contract.guaranteeId,hire.guaranteeId);
  assert.deepEqual(after.serviceGuarantees.entries[hire.guaranteeId],{operativeId:hire.id,amount:31,fundedAt:hire.arrival.bookedAt,fundedSecond:hire.arrival.bookedSecond,state:'held'});
  assert.equal(body.location,'camp');assert.equal(body.alive,true);assert.equal(body.hp,person.maxHp);assert.equal(Object.values(physical(after,hire.id).ammunition).reduce((a,b)=>a+b,0),8,'new stock is only the native paid first issue');
 }
 assert.equal(events.filter(e=>e.event==='routeFieldReliefBooked').length,6);assert.deepEqual(start,before);replay(start,result);
});

test('an already sufficient local serving force performs no order, wait or extra payment',()=>{
 const {campaign:start}=setup(),before=structuredClone(start),result=recruitRouteFieldRelief(start,{minimum:6});
 assert.equal(result.ready,true);assert.equal(result.reason,null);assert.deepEqual(result.orders,[]);assert.deepEqual(result.hires,[]);assert.deepEqual(result.renewals,[]);assert.deepEqual(result.campaign,start);assert.deepEqual(start,before);
});

test('unaffordable or exhausted paid relief returns honestly without inventing a recruit or a balance',()=>{
 const poor=setup({serving:0,treasury:1}).campaign,poorBefore=structuredClone(poor),refused=recruitRouteFieldRelief(poor,{minimum:2});
 assert.equal(refused.ready,false);assert.match(refused.reason,/Insufficient treasury/);assert.deepEqual(refused.orders,[]);assert.deepEqual(refused.campaign,poor);assert.deepEqual(poor,poorBefore);
 const exhausted=setup({people:6,serving:6}).campaign,before=structuredClone(exhausted),missing=recruitRouteFieldRelief(exhausted);
 assert.equal(missing.ready,false);assert.match(missing.reason,/No available paid catalogue/);assert.deepEqual(missing.orders,[]);assert.deepEqual(missing.campaign,exhausted);assert.deepEqual(exhausted,before);
});

test('already paid local bookings fill the deficit without being charged or booked again',()=>{
 const {campaign,ids}=setup({people:8,serving:6,delays:[3,4]});let start=campaign;
 for(const id of ids.slice(6))start=order(start,{type:'recruitCivic',id,term:'week',destination:'camp'});
 const before=structuredClone(start),result=recruitRouteFieldRelief(start,{minimum:8});assert.equal(result.ready,true);assert.deepEqual(result.hires,[]);assert.equal(result.localIds.length,8);assert.equal(result.campaign.hiringArrivals.length,0);
 assert.equal(result.campaign.resources.treasury,start.resources.treasury);assert.equal(result.orders.some(r=>r.action.type==='recruitCivic'),false);assert.equal(clock(result.campaign),clock(start)+4*3600);assert.deepEqual(start,before);replay(start,result);
});

test('an actual pending native raid returns its complete current campaign before any relief order',()=>{
 const {campaign,ids}=setup({raid:true,people:8,serving:6,delays:[8]});let start=campaign;
 const group=launchEnemyGroup(start,'frontier','watch-post',{immediate:true});assert.ok(group);start=order(start,{type:'wait',hours:1});assert.equal(start.pendingEncounter.groupId,group.id);start=saved(start);
 const before=structuredClone(start),result=recruitRouteFieldRelief(start,{minimum:8});assert.equal(result.ready,false);assert.equal(result.reason,'pending-encounter');assert.deepEqual(result.orders,[]);assert.deepEqual(result.hires,[]);assert.deepEqual(result.campaign,start);assert.deepEqual(start,before);assert.equal(ids.length,8);
});

test('a real raid during paid arrival waiting stops immediately and preserves the booked deficit on re-entry',()=>{
 const {campaign:start}=setup({raid:true,people:8,serving:6,delays:[8]}),group=launchEnemyGroup(start,'frontier','watch-post');assert.ok(group);
 const before=structuredClone(start),result=recruitRouteFieldRelief(start,{minimum:8});assert.equal(result.ready,false);assert.equal(result.reason,'pending-encounter');assert.equal(result.campaign.pendingEncounter.groupId,group.id);assert.equal(result.hires.length,2);assert.equal(result.campaign.hiringArrivals.length,2);
 assert.equal(result.orders.at(-1).action.type,'wait');assert.equal(result.orders.filter(r=>r.action.type==='wait').length,1);assert.equal(clock(result.campaign),clock(start)+3600);assert.equal(result.campaign.pendingEncounter.arrivedAt,group.arrivalAt);assert.ok(clock(result.campaign)<Math.min(...result.campaign.hiringArrivals.map(hireArrivalDueSeconds)));replay(start,result);
 const interrupted=structuredClone(result.campaign),again=recruitRouteFieldRelief(result.campaign,{minimum:8});assert.deepEqual(again.campaign,interrupted);assert.deepEqual(again.hires,[]);assert.deepEqual(again.orders,[]);assert.deepEqual(result.campaign,interrupted);assert.deepEqual(start,before);
});

test('a zero-time paid hire that releases a real waiting remote encounter records its receipt and stops before another booking',()=>{
 const {campaign:start}=setup({raid:true,remoteGuard:true,people:9,delays:[8]}),group=launchEnemyGroup(start,'frontier','watch-post',{immediate:true});assert.ok(group);
 assert.equal(start.location,'camp');assert.equal(start.pendingEncounter,null);const before=structuredClone(start),result=recruitRouteFieldRelief(start,{minimum:8});
 assert.equal(result.ready,false);assert.equal(result.reason,'pending-encounter');assert.equal(result.campaign.pendingEncounter.groupId,group.id);assert.equal(clock(result.campaign),clock(start));
 assert.equal(result.hires.length,1);assert.equal(result.orders.length,1);assert.equal(result.orders[0].action.type,'recruitCivic');assert.deepEqual(result.renewals,[]);
 const hire=result.hires[0],queued=result.campaign.hiringArrivals;
 assert.equal(queued.length,1);assert.equal(queued[0].operativeId,hire.id);assert.equal(queued[0].guaranteeId,hire.guaranteeId);assert.equal(result.campaign.resources.treasury,start.resources.treasury-hire.quote.total);
 assert.equal(result.campaign.serviceGuarantees.entries[hire.guaranteeId].state,'held');for(const id of start.recruited)assert.deepEqual(physical(result.campaign,id),physical(start,id));
 assert.deepEqual(start,before);replay(start,result);const again=recruitRouteFieldRelief(result.campaign,{minimum:8});assert.deepEqual(again.campaign,result.campaign);assert.deepEqual(again.orders,[]);
});

test('a paid renewal that releases a real remote encounter records only that extension and never issues the following wait',()=>{
 const {campaign,ids}=setup({raid:true,remoteGuard:true,people:9,delays:[8]});let start=order(campaign,{type:'wait',hours:23});
 // The first real wait pauses at Native's two-hour renewal warning. The next
 // acknowledged wait reaches the actual one-hour renewal boundary.
 start=order(start,{type:'wait',hours:1});assert.ok(contractExpiresSeconds(start.contracts[ids[0]])<=clock(start)+3600);
 for(const id of ids.slice(7))start=order(start,{type:'recruitCivic',id,term:'week',destination:'camp'});
 const group=launchEnemyGroup(start,'frontier','watch-post',{immediate:true});assert.ok(group);assert.equal(start.pendingEncounter,null);
 const before=structuredClone(start),result=recruitRouteFieldRelief(start,{minimum:8});
 assert.equal(result.ready,false);assert.equal(result.reason,'pending-encounter');assert.equal(result.campaign.pendingEncounter.groupId,group.id);assert.equal(clock(result.campaign),clock(start));
 assert.deepEqual(result.hires,[]);assert.equal(result.renewals.length,1);assert.equal(result.orders.length,1);assert.equal(result.orders[0].action.type,'renewContract');
 const renewed=result.renewals[0];assert.equal(result.campaign.resources.treasury,start.resources.treasury-renewed.quote.price);assert.equal(contractExpiresSeconds(result.campaign.contracts[renewed.id]),contractExpiresSeconds(start.contracts[renewed.id])+86400);
 assert.deepEqual(result.campaign.hiringArrivals,start.hiringArrivals);for(const id of start.recruited){assert.deepEqual(physical(result.campaign,id),physical(start,id));if(id!==renewed.id)assert.deepEqual(result.campaign.contracts[id],start.contracts[id]);}
 assert.deepEqual(start,before);replay(start,result);const again=recruitRouteFieldRelief(result.campaign,{minimum:8});assert.deepEqual(again.campaign,result.campaign);assert.deepEqual(again.orders,[]);
});

test('invalid relief bounds refuse before changing any current state',()=>{
 const {campaign:start}=setup(),before=structuredClone(start);
 for(const minimum of [0,13,1.5,Infinity])assert.throws(()=>recruitRouteFieldRelief(start,{minimum}),/bounded/);assert.deepEqual(start,before);
});
