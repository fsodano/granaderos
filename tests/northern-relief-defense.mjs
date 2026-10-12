import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {actBattle,endTurn,completedTacticalVictory,stanceCost} from '../game/tactical.js';
import {availableAmmunition} from '../game/ammunition-types.js';
import {careAssignmentReason} from '../game/medical-care.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {fight} from './opening-driver.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {retainNorthernHandoverService} from './northern-handover-route.mjs';
import {recordRouteStrategicEvidence} from './route-strategic-failure-evidence.mjs';

// Keep the actual clinic physicians and soldiers without usable rounds in
// reserve. Adjacent native aid remains available; prone is a paid order.
export function northernReliefDefenseController(physicianIds){
 const physicians=new Set(physicianIds.map(String));
 return (battle,unit)=>{
  const action=cautiousCombatOrder(battle,unit);
  if(!physicians.has(unit.id)&&(unit.loaded>0||availableAmmunition(unit)>0))return action;
  if(action?.type==='useItem'||action?.slot==='medical')return action;
  if(unit.stance!=='prone'&&!unit.mounted&&!unit.knockedDown&&!unit.entangled&&unit.ap>=stanceCost(unit,'prone'))return {type:'stance',unitId:unit.id,stance:'prone'};
  return null;
 };
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
  const result=fight(request,previous,{controller:northernReliefDefenseController(physicianIds)});
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
  return {campaign:c,summary};
 }catch(error){recordRouteStrategicEvidence({helper:'resolveStockNorthernReliefEncounter',stage:'preparation-failure',campaign:pair?.campaign??c,inputCapture,context:pair?{battle:pair.battle}:null,error});throw error;}
}
