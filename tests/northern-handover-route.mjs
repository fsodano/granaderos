import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../packages/game/campaign.js';
import {contractRenewalQuote,contractExpiresSeconds} from '../packages/game/contracts.js';
import {decodeSave,encodeSave} from '../packages/game/save.js';
import {enterSector} from '../packages/game/world.js';
import {syncBattleTime} from '../packages/game/time.js';
import {actBattle,endTurn,completedTacticalVictory,teamCanSee} from '../packages/game/tactical.js';
import {autoBandageBattle} from '../packages/game/auto-bandage.js';
import {fight} from './opening-driver.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const serving=c=>c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);

// Keep every actual retained contract through the next bounded clock step.
export function retainNorthernHandoverService(start,{hours=2,keepServing,report=()=>{}}={}){
 let c=start;assert.ok(hours>0&&hours<=24);
 assert.ok(keepServing===undefined||Array.isArray(keepServing)&&new Set(keepServing).size===keepServing.length&&keepServing.every(id=>Number.isSafeInteger(id)&&Object.hasOwn(c.operativeState,id)),'Retained road duty must name actual distinct recorded people; native deaths remain in that intended cohort.');
 const keepers=keepServing===undefined?null:new Set(keepServing);
 for(const id of serving(c).filter(id=>!keepers||keepers.has(id))){
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
export function resolveNorthernHandoverEncounter(start,{controllerFor,report=()=>{}}={}){
 assert.ok(controllerFor===undefined||typeof controllerFor==='function');
 const before=structuredClone(start),active=start.activeSquadId,encounter=start.pendingEncounter;
 assert.ok(encounter);let c=decodeSave(encodeSave(start)).campaign;
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);};
 const guard=c.squads.find(q=>q.location===encounter.sector&&q.members.some(id=>c.operativeState[id].alive&&!c.operativeState[id].captured));
 assert.ok(guard,'The attacked town needs its actual local reserve.');
 order({type:'selectSquad',id:guard.id});order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
 const prepared=structuredClone(c),request=c.pendingBattle,previous=c.sectorStates[encounter.sector];
 assert.equal(request.defenseGroupId,encounter.groupId);
 const initial=enterSector(request,previous);
 report({event:'northernHandoverDefenseInput',campaign:structuredClone(c),battle:initial});
 const inputCapture=recordRouteStrategicEvidence({helper:'resolveNorthernHandoverEncounter',stage:'route-checkpoint',campaign:c,context:{phase:'before-fight',request,previous,initial,scope:'Actual existing controller-construction entry before fight performs its unchanged own entry; no added entry, orders, synchronization or save normalization.'}});
 const result=fight(request,previous,{controller:controllerFor?controllerFor(initial):cautiousCombatOrder});
 let failureMessage='The actual reserve must win the native counterattack.';
 if(!completedTacticalVictory(result.battle)){
  recordRouteStrategicEvidence({helper:'resolveNorthernHandoverEncounter',stage:'battle-outcome-failure',campaign:c,inputCapture,context:{phase:'after-fight-before-victory-assertion',result,scope:'Actual returned fight result and complete issued order tape before the unchanged victory assertion; no added orders, synchronization, settlement or save normalization.'}});
  const b=result.battle,position=u=>({x:u.x,y:u.y,tacticalLevel:u.tacticalLevel??0});
  const own=b.units.filter(u=>u.side==='player').map(u=>({id:u.id,...position(u),hp:u.hp,ap:u.ap,loaded:u.loaded,ammo:u.ammo,medkits:u.medkits,bleeding:u.bleeding,routed:u.routed,unconscious:u.unconscious,departure:u.departure}));
  const knownEnemies=b.units.filter(u=>u.side==='enemy'&&teamCanSee(b,'player',u)).map(u=>({id:u.id,...position(u),hp:u.hp,stance:u.stance,routed:u.routed}));
  const knownGuns=b.artillery.filter(g=>g.side==='player'||teamCanSee(b,'player',g)).map(g=>({id:g.id,side:g.side,...position(g),loaded:g.loaded,ammo:g.ammo}));
  failureMessage+=' '+JSON.stringify({sector:request.sector,status:b.status,turns:b.turn,phase:b.phase,actions:result.actions,elapsedSeconds:b.elapsedSeconds,own,knownEnemies,knownGuns});
 }
 assert.ok(completedTacticalVictory(result.battle),failureMessage);
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
export function continueNorthernHandoverTravel(start,{squadId=start.activeSquadId,target='tucuman',mode,keepServing,controllerFor,report=()=>{}}={}){
 const before=structuredClone(start);let c=decodeSave(encodeSave(start)).campaign;
 const order=action=>{const previous=c;c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);report({event:'northernHandoverOrder',action,fromSeconds:clock(previous),toSeconds:clock(c),cost:previous.resources.treasury-c.resources.treasury});};
 if(c.activeSquadId!==squadId)order({type:'selectSquad',id:squadId});
 let noProgress=0;
 for(let step=0;step<96;step++){
  if(c.pendingEncounter){c=resolveNorthernHandoverEncounter(c,{controllerFor,report});assert.equal(c.activeSquadId,squadId);}
  const squad=c.squads.find(q=>q.id===squadId);assert.ok(squad&&squad.members.length,'The actual envoy party must remain available.');
  if(!squad.journey&&squad.location===target){assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);report({event:'northernHandoverArrived',campaign:structuredClone(c)});return c;}
  c=retainNorthernHandoverService(c,{keepServing,report});
  if(!squad.journey)order({type:'travel',sector:target,queue:true,...(mode===undefined?{}:{mode})});
  else if(squad.journey.status==='paused')order({type:'resumeTravel'});
  else assert.equal(squad.journey.status,'moving',squad.journey.reason);
  const from=clock(c);order({type:'wait',hours:1});noProgress=clock(c)===from?noProgress+1:0;
  assert.ok(noProgress<3,'Repeated zero-time notices cannot complete the envoy journey.');
 }
 assert.fail('The native handover journey did not reach its destination within 96 ordinary hourly steps.');
}
