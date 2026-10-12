import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {actBattle,endTurn,completedTacticalVictory} from '../game/tactical.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {fight} from './opening-driver.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const serving=c=>c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);

// Keep every actual retained contract through the next bounded clock step.
export function retainNorthernHandoverService(start,{hours=2,report=()=>{}}={}){
 let c=start;assert.ok(hours>0&&hours<=24);
 for(const id of serving(c)){
  let expiry=contractExpiresSeconds(c.contracts[id]);
  assert.ok(c.contracts[id]&&(expiry===null||expiry>clock(c)),`The living survivor ${id} must still be serving.`);
  while(expiry!==null&&expiry<=clock(c)+hours*3600){
   const quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),contract=c.contracts[id],cash=c.resources.treasury;
   assert.equal(quote.available,true,quote.reason);
   const action={type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0};
   c=dispatchCampaign(c,action);assert.equal(c.lastError,null,c.lastError);assert.equal(c.resources.treasury,cash-quote.price);
   assert.equal(contractExpiresSeconds(c.contracts[id]),expiry+86400);
   report({event:'northernHandoverRenewal',action,quote,cost:cash-c.resources.treasury,hour:c.hour,secondOfHour:c.secondOfHour??0});
   expiry=contractExpiresSeconds(c.contracts[id]);
  }
 }
 return c;
}

// Resolve the real local raid, apply finite field care, and replay the complete
// native order tape through an official midpoint save before settlement.
export function resolveNorthernHandoverEncounter(start,{report=()=>{}}={}){
 const before=structuredClone(start),active=start.activeSquadId,encounter=start.pendingEncounter;
 assert.ok(encounter);let c=decodeSave(encodeSave(start)).campaign;
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);};
 const guard=c.squads.find(q=>q.location===encounter.sector&&q.members.some(id=>c.operativeState[id].alive&&!c.operativeState[id].captured));
 assert.ok(guard,'The attacked town needs its actual local reserve.');
 order({type:'selectSquad',id:guard.id});order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
 const prepared=structuredClone(c),request=c.pendingBattle,previous=c.sectorStates[encounter.sector];
 assert.equal(request.defenseGroupId,encounter.groupId);
 report({event:'northernHandoverDefenseInput',campaign:structuredClone(c),battle:enterSector(request,previous)});
 const result=fight(request,previous,{controller:cautiousCombatOrder});
 assert.ok(completedTacticalVictory(result.battle),'The actual reserve must win the native counterattack.');
 const aid=autoBandageBattle(result.battle),orders=[...result.orders,...aid.steps];
 for(const unit of aid.battle.units.filter(u=>u.side==='player'&&u.hp>0&&!u.militia&&!u.surrendered&&!u.departure)){
  assert.ok(unit.hp>=15&&!unit.bleeding,`Survivor ${unit.id} needs timely finite aid before strategic time resumes.`);
 }
 const replay=withSave=>{
  let pair={campaign:structuredClone(prepared),battle:enterSector(request,previous)};
  for(let index=0;index<orders.length;index++){
   const action=orders[index],battle=action.type==='endTurn'?endTurn(pair.battle):actBattle(pair.battle,action);
   assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);
   const synced=syncBattleTime(pair.campaign,battle);assert.equal(synced.error,null,synced.error);pair={campaign:synced.campaign,battle:synced.battle};
   if(withSave&&index===Math.floor(orders.length/2))pair=decodeSave(encodeSave(pair.campaign,pair.battle));
  }
  return pair;
 };
 const uninterrupted=replay(false),saved=replay(true);assert.deepEqual(saved,uninterrupted);
 assert.deepEqual(saved.battle.units,aid.battle.units);assert.equal(saved.battle.seed,aid.battle.seed);assert.equal(saved.battle.elapsedSeconds,aid.battle.elapsedSeconds);
 assert.ok(completedTacticalVictory(saved.battle));
 c=dispatchCampaign(saved.campaign,{type:'battleResult',battleId:request.id,outcome:'victory',sectorState:saved.battle,survivors:saved.battle.units.filter(u=>u.side==='player')});
 assert.equal(c.lastError,null,c.lastError);assert.equal(c.defeated,false);assert.equal(c.sectors[encounter.sector].owner,'patriot');
 const losses=result.battle.units.filter(u=>u.side==='player'&&u.hp<=0&&!u.militia&&!u.missionAlly).map(u=>Number(u.id));
 for(const id of losses)assert.equal(c.operativeState[id].alive,false);
 for(const [id,record]of Object.entries(before.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 order({type:'selectSquad',id:active});assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 const summary={sector:encounter.sector,groupId:encounter.groupId,status:result.battle.status,turns:result.battle.turn,actions:result.actions,elapsedSeconds:result.battle.elapsedSeconds,units:result.battle.units.map(u=>({id:u.id,side:u.side,hp:u.hp,ammo:u.ammo,loaded:u.loaded,routed:u.routed}))};
 report({event:'battleFinished',...summary});report({event:'northernHandoverDefenseReplay',...summary,losses,orders,aid:{steps:aid.steps,untreated:aid.untreated,stoppedReason:aid.stoppedReason},exactSavedReplay:true,envoyJourney:structuredClone(c.squads.find(q=>q.id===active)?.journey),campaign:structuredClone(c)});
 return c;
}

// A remote raid pauses the clock; it does not cancel the departed envoy's
// physical journey. Follow that same journey, restoring selection after care.
export function continueNorthernHandoverTravel(start,{squadId=start.activeSquadId,target='tucuman',report=()=>{}}={}){
 const before=structuredClone(start);let c=decodeSave(encodeSave(start)).campaign;
 const order=action=>{const previous=c;c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);report({event:'northernHandoverOrder',action,fromSeconds:clock(previous),toSeconds:clock(c),cost:previous.resources.treasury-c.resources.treasury});};
 if(c.activeSquadId!==squadId)order({type:'selectSquad',id:squadId});
 let noProgress=0;
 for(let step=0;step<96;step++){
  if(c.pendingEncounter){c=resolveNorthernHandoverEncounter(c,{report});assert.equal(c.activeSquadId,squadId);}
  const squad=c.squads.find(q=>q.id===squadId);assert.ok(squad&&squad.members.length,'The actual envoy party must remain available.');
  if(!squad.journey&&squad.location===target){assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);report({event:'northernHandoverArrived',campaign:structuredClone(c)});return c;}
  c=retainNorthernHandoverService(c,{report});
  if(!squad.journey)order({type:'travel',sector:target,queue:true});
  else if(squad.journey.status==='paused')order({type:'resumeTravel'});
  else assert.equal(squad.journey.status,'moving',squad.journey.reason);
  const from=clock(c);order({type:'wait',hours:1});noProgress=clock(c)===from?noProgress+1:0;
  assert.ok(noProgress<3,'Repeated zero-time notices cannot complete the envoy journey.');
 }
 assert.fail('The native handover journey did not reach its destination within 96 ordinary hourly steps.');
}
