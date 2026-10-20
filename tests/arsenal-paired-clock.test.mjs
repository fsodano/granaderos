import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {enterSector} from '../game/world.js';
import {actBattle,canSee,meleePreview,exitPreview} from '../game/tactical.js';
import {publicAssignmentNotice} from '../game/assignment-attention.js';
import {publicContractNotice} from '../game/contract-attention.js';
import {publicLogisticsNotice} from '../game/logistics-attention.js';
import {syncBattleTime,REST_SECONDS} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {civilianIncidents} from '../game/civilian-harm.js';
import {createPairedRouteOrders,replayPairedRouteOrders,fightPairedRouteBattle} from './paired-route-battle.mjs';
import {withdrawArsenalRear} from './arsenal-medical-reserve.mjs';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';
import {defaultContentPackage} from '../game/content-package.js';
import {DEFAULT_MAPS,DEFAULT_WORLD} from '../campaigns/default.js';
import {blankMap} from '../game/map-schema.js';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,a)=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,next.lastError);return next;};
const official=pair=>{const saved=decodeSave(encodeSave(pair.campaign,pair.battle));assert.deepEqual(saved,pair);return saved;};
function servingStart({content=null,hour=22}={}){
 let c=initialCampaign(8,content??undefined);const op=rosterFor(c).find(op=>op.id===110),quote=contractQuote(c,op,'day'),cash=c.resources.treasury;
 assert.equal(quote.available,true);c=order(c,{type:'recruitCivic',id:110,term:'day'});assert.equal(c.resources.treasury,cash-quote.total);
 // Real strategic waiting and quoted prepayment cover the coming midnight.
 c=order(c,{type:'wait',hours:hour-c.hour});const renewal=contractRenewalQuote(c,op,'day'),prior=structuredClone(c.contracts[110]),beforeCash=c.resources.treasury,beforeClock=clock(c);
 assert.equal(renewal.available,true);c=order(c,{type:'renewContract',id:110,term:'day',expectedExpiresAt:prior.expiresAt,expectedExpiresSecond:prior.expiresSecond??0});
 assert.equal(c.resources.treasury,beforeCash-renewal.price);assert.equal(clock(c),beforeClock);assert.equal(contractExpiresSeconds(c.contracts[110]),contractExpiresSeconds(prior)+renewal.hours*3600);
 for(let attempt=0;attempt<8&&clock(c)<hour*3600;attempt++){
  const priorClock=clock(c);c=order(c,{type:'wait',hours:(hour*3600-priorClock)/3600});
  assert.ok(clock(c)>=priorClock&&clock(c)<=hour*3600);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);
  if(clock(c)===priorClock)assert.ok(publicAssignmentNotice(c)||publicContractNotice(c)||publicLogisticsNotice(c),'A zero-time repeat needs an actual public notice.');
 }
 assert.equal(clock(c),hour*3600,'Actual public notice acknowledgement reaches the declared strategic hour.');
 return c;
}

// Declared clock/contact subsystem arena only: before initialCampaign, author
// an open Retiro courtyard and the player anchor beside the original resident
// catalogue's 3,7 anchor. Keep both original residents, their identities, stats,
// health and service rules. No returned Native state is repositioned or edited.
// This is not evidence of the ordinary campaign's room-discovery route.
function declaredCourtyard(){
 const content=defaultContentPackage();content.maps=structuredClone(DEFAULT_MAPS);content.world=structuredClone(DEFAULT_WORLD);
 content.maps.retiro=blankMap({id:'retiro',title:'Declared paired-clock courtyard'});
 content.world.expansion.buildingTargets.retiro=0;
 content.world.deployment.retiro={...(content.world.deployment.retiro??{}),playerAnchors:[{x:1,y:7}]};
 return content;
}
test('a real civilian death and paid service replay at their actual checkpoint hour across midnight',()=>{
 const content=declaredCourtyard(),definition=structuredClone(content),visited=order(servingStart({content,hour:23}),{type:'visitSector'}),request=visited.pendingBattle,previous=visited.sectorStates.retiro,before=structuredClone(visited);
 const run=()=>{
  const bridge=createPairedRouteOrders(visited,enterSector(request,previous)),issue=a=>bridge.executeOrder(bridge.pair.battle,a);
  official(bridge.pair);
  const start=clock(visited),contract=structuredClone(visited.contracts[110]),cash=visited.resources.treasury;
  const inputCapture=recordRouteStrategicEvidence({helper:'pairedClockDeclared',stage:'preparation-input',campaign:visited,context:{scope:'Actual new declared control initial pair before its existing native orders; no added entry, orders or synchronization.',pair:bridge.pair}});
  assert.deepEqual(bridge.pair.battle.buildings,[]);assert.deepEqual(bridge.pair.battle.wallEdges,[]);
  assert.deepEqual(bridge.pair.battle.npcs.map(n=>n.id).sort(),['cabral','local-retiro']);
  assert.equal(canSee(bridge.pair.battle,bridge.pair.battle.units.find(u=>u.id==='110'),bridge.pair.battle.npcs.find(n=>n.id==='local-retiro')),true,'Native admission establishes the declared contact before any target-dependent order.');
  const targetId='local-retiro';let deathHour=null,deathSeconds=null;
  for(let attempt=0;attempt<240;attempt++){
   const b=bridge.pair.battle,u=b.units.find(u=>u.id==='110'),n=b.npcs.find(n=>n.id===targetId);assert.ok(u&&n);
   if(n.hp===0){deathHour=bridge.pair.campaign.hour;deathSeconds=clock(bridge.pair.campaign);break;}
   if(clock(bridge.pair.campaign)-start>6*3600)recordRouteStrategicEvidence({helper:'pairedClockDeclared',stage:'preparation-failure',campaign:bridge.pair.campaign,inputCapture,context:{scope:'Actual declared control state/order list at its unchanged failed reconnaissance bound; no added orders or synchronization.',pair:bridge.pair,orders:bridge.orders,actor:u}});
   assert.ok(clock(bridge.pair.campaign)-start<=6*3600,'Public reconnaissance and contact stay bounded.');
   const observed=canSee(b,u,n);
   if(!observed){
    recordRouteStrategicEvidence({helper:'pairedClockDeclared',stage:'route-checkpoint',campaign:bridge.pair.campaign,inputCapture,context:{scope:'Actual lost-sight pair/orders before a non-target native wait; no hidden target point, added query or synchronization.',pair:bridge.pair,orders:bridge.orders,actor:u,targetId}});
    const elapsed=b.elapsedSeconds;issue({type:'endTurn'});assert.equal(bridge.pair.battle.elapsedSeconds,elapsed+REST_SECONDS);continue;
   }
   assert.equal(observed,true,'Every approach or strike needs actual observed resident contact.');
   const preview=meleePreview(b,u,n,{approach:true});assert.equal(preview.valid,true,preview.reason);
   if(preview.path.length)issue({type:'move',unitId:u.id,x:preview.destination.x,y:preview.destination.y,tacticalLevel:preview.destination.tacticalLevel??0});
   else{assert.equal(canSee(b,u,n),true,'Every actual strike uses an observed resident.');issue({type:'melee',unitId:u.id,targetId:n.id});}
  }
  assert.ok(deathHour!==null);assert.ok(civilianIncidents(bridge.pair.battle.npcs.find(n=>n.id===targetId)).some(e=>e.kind==='death'));
  const event=bridge.pair.campaign.cityLoyaltyEvents.find(e=>e.eventId==='civilian:npc-local-retiro');assert.ok(event);assert.equal(event.hour,deathHour);
  for(let attempt=0;attempt<24&&clock(bridge.pair.campaign)<deathSeconds+2*3600;attempt++){const elapsed=bridge.pair.battle.elapsedSeconds;issue({type:'endTurn'});assert.equal(bridge.pair.battle.elapsedSeconds,elapsed+REST_SECONDS);}
  assert.ok(bridge.pair.campaign.hour>=25);assert.ok(clock(bridge.pair.campaign)>=deathSeconds+2*3600);
  assert.deepEqual(bridge.pair.campaign.contracts[110],contract);assert.ok(bridge.pair.campaign.recruited.includes(110));assert.equal(bridge.pair.campaign.resources.treasury,cash);
  const replay=replayPairedRouteOrders(visited,request,previous,bridge.orders);assert.deepEqual(replay,bridge.pair);official(bridge.pair);
  const finalOnly=syncBattleTime(visited,bridge.pair.battle);assert.equal(finalOnly.error,null);
  assert.equal(finalOnly.campaign.cityLoyaltyEvents.find(e=>e.eventId===event.eventId).hour,finalOnly.campaign.hour);
  assert.notEqual(finalOnly.campaign.cityLoyaltyEvents.find(e=>e.eventId===event.eventId).hour,event.hour,'An end-only confirmation is a different history, not a replay oracle.');
  return {pair:bridge.pair,orders:bridge.orders};
 };
 const first=run(),second=run();assert.deepEqual(second,first);assert.deepEqual(visited,before);assert.deepEqual(content,definition,'Native reducers do not mutate the authoring declaration.');
});

test('actual placement and a paid authorized exit preserve their entire native paired replay',()=>{
 const ready=servingStart(),campaign=order(ready,{type:'attack',sector:'buenos_aires'}),before=structuredClone(campaign),request=campaign.pendingBattle,previous=campaign.sectorStates.buenos_aires;
 const initial=enterSector(request,previous),ids=request.squad.map(op=>String(op.id));assert.deepEqual(ids,['110']);
 const execute=()=>{
  let crossing=null;
  const result=fightPairedRouteBattle(campaign,request,previous,{deploy:(battle,executeOrder)=>withdrawArsenalRear(initial,ids,{destination:'retiro',executeOrder:(current,action)=>{
   if(action.type==='exit'){const preview=exitPreview(current,action);assert.equal(preview.available,true,preview.reason);crossing={before:structuredClone(current),preview,action:structuredClone(action)};}
   const next=executeOrder(current,action);if(action.type==='exit')crossing.after=structuredClone(next);return next;
  }})(battle)});
  assert.ok(crossing);const before=crossing.before.units.find(u=>u.id==='110'),after=crossing.after.units.find(u=>u.id==='110');
  assert.equal(after.ap,before.ap-(crossing.before.mode==='exploration'?0:crossing.preview.costById['110']),'Native exploration pays seconds and energy; native combat also pays its quoted AP.');
  assert.ok(after.energy<before.energy);assert.ok(crossing.after.elapsedSeconds>crossing.before.elapsedSeconds);
  const native=actBattle(crossing.before,crossing.action);assert.equal(native.lastError,null);for(const key of ['hp','ap','energy','loaded','ammo','inventory','departure'])assert.deepEqual(native.units.find(u=>u.id==='110')[key],after[key]);
  return {result,crossing};
 };
 const a=execute(),b=execute();assert.deepEqual(b,a);const first=a.result,second=b.result;assert.deepEqual(second,first);assert.equal(first.battle.status,'retreat');assert.equal(first.battle.units.find(u=>u.id==='110').departure.destination,'retiro');
 assert.ok(first.orders.some(a=>a.type==='placeDeployment'));assert.ok(first.orders.some(a=>a.type==='confirmDeployment'));assert.equal(first.orders.filter(a=>a.type==='exit').length,1);
 assert.ok(first.battle.elapsedSeconds>0);assert.equal(clock(first.pair.campaign),clock(campaign)+first.battle.elapsedSeconds);assert.equal(first.pair.campaign.resources.treasury,campaign.resources.treasury);
 const actor=initial.units.find(u=>u.id==='110'),returned=first.battle.units.find(u=>u.id==='110');assert.equal(returned.hp,actor.hp);assert.equal(returned.loaded,actor.loaded);assert.equal(returned.ammo,actor.ammo);assert.equal(returned.ap,a.crossing.after.units.find(u=>u.id==='110').ap);assert.equal(first.battle.seed,initial.seed);assert.deepEqual(first.battle.artillery,initial.artillery);
 assert.deepEqual(first.pair.campaign.contracts[110],campaign.contracts[110]);assert.deepEqual(campaign,before);official(first.pair);
});
