import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {actBattle,endTurn,completedTacticalVictory,stanceCost,canSee,teamCanSee,hasFirearm,artilleryCosts,artilleryCrewPlan,artilleryReloadPreview} from '../game/tactical.js';
import {sameSurface} from '../game/tactical-space.js';
import {choosePlayerSharedSightingInvestigation} from '../game/tactical-ai.js';
import {firearmServiceable} from '../game/firearm-serviceability.js';
import {directionTo,turnAPCost} from '../game/tactical-awareness.js';
import {availableAmmunition} from '../game/ammunition-types.js';
import {careAssignmentReason} from '../game/medical-care.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {fight,sharedSightingInvestigationOrder} from './opening-driver.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {retainNorthernHandoverService} from './northern-handover-route.mjs';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';
import {recordRouteBattleFailure} from './route-failure-evidence.mjs';

// Keep the actual clinic physicians and soldiers without usable rounds in
// reserve. Adjacent native aid remains available; prone is a paid order.
export function northernReliefDefenseController(physicianIds,{minimumIdleRounds=0}={}){
 assert.ok(Number.isInteger(minimumIdleRounds)&&minimumIdleRounds>=0);
 const physicians=new Set(physicianIds.map(String));
 let encounter=null,signature=null,lastTurn=null,lastElapsed=null,idleRounds=0;
 const stalled=battle=>{
  if(!minimumIdleRounds)return true;
  const identity=JSON.stringify([battle.sectorId,battle.battleId,battle.startSeconds]);
  if(identity!==encounter||battle.turn<lastTurn||battle.elapsedSeconds<lastElapsed){encounter=identity;signature=null;lastTurn=null;idleRounds=0;}
  lastElapsed=battle.elapsedSeconds;
  // Only our physical work and currently public contacts can reset this
  // quiet-round count. AP recovery, facing and unseen movement cannot.
  const point=actor=>({id:actor.id,x:actor.x,y:actor.y,level:actor.tacticalLevel??0,hp:actor.hp});
  const own=battle.units.filter(actor=>actor.side==='player').map(actor=>({...point(actor),bleeding:actor.bleeding,loaded:actor.loaded,ammo:actor.ammo,inventory:actor.inventory,medkits:actor.medkits,reloadProgress:actor.reloadProgress,activeSlot:actor.activeSlot,weaponDropped:actor.weaponDropped,jammed:actor.jammed}));
  const observed=battle.units.filter(actor=>actor.side!=='player'&&teamCanSee(battle,'player',actor)).map(point);
  const guns=battle.artillery.filter(gun=>gun.side==='player'||teamCanSee(battle,'player',gun)).map(gun=>({id:gun.id,x:gun.x,y:gun.y,level:gun.tacticalLevel??0,...(gun.side==='player'?{loaded:gun.loaded,ammo:gun.ammo,reloadProgress:gun.reloadProgress}:{})}));
  const current=JSON.stringify([own,observed,guns].map(rows=>rows.sort((a,b)=>String(a.id).localeCompare(String(b.id)))));
  if(current!==signature){signature=current;idleRounds=0;lastTurn=battle.turn;return false;}
  if(battle.turn!==lastTurn){idleRounds++;lastTurn=battle.turn;}
  return idleRounds>=minimumIdleRounds;
 };
 const held=unit=>!unit||physicians.has(unit.id)||!(unit.loaded>0||availableAmmunition(unit)>0);
 const meaningful=(unit,action)=>action&& (action.type!=='look'||turnAPCost(unit,directionTo(unit,action))>0);
 const crewKeepsReserves=(battle,unit,action)=>{
  const kind={artillery:'fire',artilleryPivot:'pivot',artilleryMove:'move'}[action?.type];
  if(!kind&&action?.type!=='artilleryReload')return true;
  const gun=battle.artillery.find(piece=>piece.id===action.artilleryId);if(!gun)return false;
  const plan=action.type==='artilleryReload'?artilleryReloadPreview(battle,unit,gun):artilleryCrewPlan(battle,unit,gun,artilleryCosts(battle,unit,gun)[kind]);
  return !plan.reason&&plan.crew.length>0&&plan.crew.every(id=>!held(battle.units.find(member=>member.id===id)));
 };
 const controller=(battle,unit)=>{
  const action=cautiousCombatOrder(battle,unit);
  if(!held(unit))return crewKeepsReserves(battle,unit,action)?action:null;
  if(action?.type==='useItem'||action?.slot==='medical')return action;
  if(unit.stance!=='prone'&&!unit.mounted&&!unit.knockedDown&&!unit.entangled&&unit.ap>=stanceCost(unit,'prone'))return {type:'stance',unitId:unit.id,stance:'prone'};
  return null;
 };
 // A whole squad pass first admits ordinary care, reload, fire and real crew
 // work. Public squad sight can then guide one native bound around a wall;
 // it does not create personal sight, contact memory or an artillery crew.
 controller.sharedFallback=(battle,unit)=>{
  if(!stalled(battle))return null;
  // Wounded support keeps ordinary shots, finite aid and maintenance; it
  // does not advance toward a contact it cannot personally see.
  if(held(unit)||unit.side!=='player'||unit.militia||unit.missionAlly||unit.hp<15||unit.hp<unit.maxHp||unit.bleeding>0||unit.energy<=0||unit.unconscious||unit.routed||unit.departure||unit.surrendered||unit.mounted||unit.knockedDown||unit.entangled||unit.jammed||unit.weaponDropped||(unit.activeSlot??'primary')!=='primary'||!hasFirearm(unit)||!firearmServiceable(unit)||!(unit.loaded>0))return null;
  const existing=sharedSightingInvestigationOrder(battle,unit);if(meaningful(unit,existing))return existing;
  const observers=battle.units.filter(member=>member.side===unit.side&&member.hp>=15&&!member.unconscious&&!member.routed&&!member.departure&&!member.surrendered);
  const contacts=battle.units.filter(target=>target.side!==unit.side&&target.hp>0&&!target.unconscious&&!target.routed&&!target.departure&&!target.surrendered&&sameSurface(unit,target)&&observers.some(member=>canSee(battle,member,target)));
  const distance=point=>Math.hypot(point.x-unit.x,point.y-unit.y);
  contacts.sort((a,b)=>distance(a)-distance(b)||String(a.id).localeCompare(String(b.id)));
  for(const target of contacts){const action=choosePlayerSharedSightingInvestigation(battle,unit,target);if(meaningful(unit,action))return action;}
  return null;
 };
 return controller;
}

// The real counterattack pauses clinic work. Resolve and replay that battle
// before another care hour; do not replace casualties or grant supplies.
export function resolveStockNorthernReliefEncounter(start,{physicianIds=[],report=()=>{}}={}){
 const before=structuredClone(start),encounter=structuredClone(start.pendingEncounter),active=start.activeSquadId;
 assert.equal(encounter?.sector,'tucuman','The northern clinic needs its actual Tucumán counterattack.');
 assert.equal(start.pendingBattle,null);
 const inputCapture=recordRouteStrategicEvidence({helper:'resolveStockNorthernReliefEncounter',stage:'preparation-input',campaign:start,context:{encounter,physicianIds}});
 let c=decodeSave(encodeSave(start)).campaign,pair;
 try{
  c=retainNorthernHandoverService(c,{hours:2,report});
  const assignments=new Map(c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured).map(id=>[id,c.operativeState[id].assignment]));
  const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);};
  const guard=c.squads.find(q=>q.location===encounter.sector&&q.members.some(id=>c.operativeState[id].alive&&!c.operativeState[id].captured));
  assert.ok(guard,'The attacked clinic needs an actual local serving reserve.');
  order({type:'selectSquad',id:guard.id});order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
  const prepared=structuredClone(c),request=c.pendingBattle,previous=c.sectorStates[encounter.sector];
  assert.equal(request.defenseGroupId,encounter.groupId);
  report({event:'northernReliefDefenseInput',campaign:structuredClone(c),battle:enterSector(request,previous)});
  // Two isolated ordinary idle windows occur in the successful defense.
  // Require three unchanged native rounds before a blind shared bound.
  const controller=northernReliefDefenseController(physicianIds,{minimumIdleRounds:3}),result=fight(request,previous,{controller,sharedFallback:controller.sharedFallback});
  if(!completedTacticalVictory(result.battle))recordRouteBattleFailure({campaign:prepared,request,previous,result,expectedOutcome:'victory',controller,executeBattle:fight});
  assert.ok(completedTacticalVictory(result.battle),'The actual local reserve must win the native counterattack.');
  const aid=autoBandageBattle(result.battle),orders=[...result.orders,...aid.steps];
  for(const unit of aid.battle.units.filter(u=>u.side==='player'&&u.hp>0&&!u.militia&&!u.surrendered&&!u.departure))assert.ok(unit.hp>=15&&!unit.bleeding,`Actual survivor ${unit.id} needs timely finite aid before care hours resume.`);
  for(const id of physicianIds){const unit=aid.battle.units.find(u=>u.id===String(id));assert.ok(unit?.hp>=15&&!unit.bleeding&&!unit.unconscious&&!unit.routed&&!unit.departure,`The real clinic physician ${id} must remain available.`);}
  const replay=withSave=>{
   let replayed={campaign:structuredClone(prepared),battle:enterSector(request,previous)};
   for(let index=0;index<orders.length;index++){
    const action=orders[index],battle=action.type==='endTurn'?endTurn(replayed.battle):actBattle(replayed.battle,action);
    assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);
    const synced=syncBattleTime(replayed.campaign,battle);assert.equal(synced.error,null,synced.error);replayed={campaign:synced.campaign,battle:synced.battle};
    if(withSave&&index===Math.floor(orders.length/2))replayed=decodeSave(encodeSave(replayed.campaign,replayed.battle));
   }
   return replayed;
  };
  const uninterrupted=replay(false);pair=replay(true);assert.deepEqual(pair,uninterrupted);
  for(const key of ['units','npcs','artillery','seed','elapsedSeconds'])assert.deepEqual(pair.battle[key],aid.battle[key]);
  assert.ok(completedTacticalVictory(pair.battle));
  const settlement={type:'battleResult',battleId:request.id,outcome:'victory',sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')};
  c=dispatchCampaign(pair.campaign,settlement);assert.equal(c.lastError,null,c.lastError);assert.ok(dispatchCampaign(c,settlement).lastError,'The real defense settlement cannot be paid twice.');
  assert.equal(c.defeated,false);assert.equal(c.sectors[encounter.sector].owner,'patriot');assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);
  const losses=result.battle.units.filter(u=>u.side==='player'&&u.hp<=0&&before.operativeState[u.id]?.alive).map(u=>Number(u.id));
  for(const id of losses){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].hp,0);}
  for(const [id,record]of Object.entries(before.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
  for(const [id,assignment]of assignments)if(c.recruited.includes(id)&&c.operativeState[id].alive&&c.operativeState[id].assignment!==assignment&&!careAssignmentReason(c,rosterFor(c).find(op=>op.id===id),assignment))order({type:'assignCare',operativeId:id,assignment});
  order({type:'selectSquad',id:active});assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
  const summary={sector:encounter.sector,groupId:encounter.groupId,status:result.battle.status,turns:result.battle.turn,actions:result.actions,elapsedSeconds:pair.battle.elapsedSeconds,losses,physicianIds:[...physicianIds],orders,aid:{steps:aid.steps,untreated:aid.untreated,stoppedReason:aid.stoppedReason},exactSavedReplay:true};
  report({event:'northernReliefDefenseComplete',...summary,campaign:structuredClone(c)});
  recordRouteStrategicEvidence({helper:'resolveStockNorthernReliefEncounter',stage:'route-checkpoint',campaign:c,inputCapture,context:{phase:'native-defense-success-after-all-replay-settlement-and-save-guards',prepared,request,previous,rawResult:result,aid,replayedPair:pair,settledPair:{campaign:c,battle:pair.battle},settledPairScope:'The final native battle and actual already-settled campaign; this is not an active pending official save pair.',settlement,summary}});
  return {campaign:c,summary};
 }catch(error){recordRouteStrategicEvidence({helper:'resolveStockNorthernReliefEncounter',stage:'preparation-failure',campaign:pair?.campaign??c,inputCapture,context:pair?{battle:pair.battle}:null,error});throw error;}
}
