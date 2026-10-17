import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {actBattle,endTurn,completedTacticalVictory,stanceCost,artilleryContact,canSee,teamCanSee,hasFirearm,artilleryCosts,artilleryCrewPlan,artilleryReloadPreview,actionCosts,firearmShotOptions,getReachable,movementEnergy,movementStepCost} from '../game/tactical.js';
import {sameSurface,spacePoint,surfaceAt} from '../game/tactical-space.js';
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
import {knownRouteCivilianShotSafety,knownRouteBystanderShotSafety} from './route-fire-safety.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {publicRouteView} from './route-infantry-progress.mjs';
import {limitEnergy} from '../game/fatigue.js';
import {lowerWeapon} from '../game/weapon-readiness.js';
import {isInteriorVisible} from '../game/tactical-visibility.js';

function paidReliefPosition(view,unit,point){
 const copy=structuredClone(view),actor=copy.units.find(other=>other.id===unit.id);let paid=0;
 actor.braced=false;actor.overwatch=false;
 for(const step of point.path){
  const surface=surfaceAt(copy,step),cost=movementStepCost(copy,actor,actor,step);if(!surface||!Number.isFinite(cost)||cost<=0||actor.ap<cost)return null;
  const diagonal=actor.x!==step.x&&actor.y!==step.y?1.4:1,raw=movementEnergy(actor,surface,copy.mode==='exploration')*diagonal,energy=copy.mode==='exploration'?raw:Math.ceil(raw),direction=`${step.x-actor.x},${step.y-actor.y}`,facing=directionTo(actor,step);
  lowerWeapon(actor);limitEnergy(actor);paid+=cost;
  Object.assign(actor,spacePoint(step),{ap:actor.ap-cost,facing,momentum:direction===actor.lastDirection?actor.momentum+1:1,lastDirection:direction,energy:Math.max(0,Math.round((actor.energy-energy)*1000)/1000)});
  delete actor.lastTargetId;delete actor.lastShotPosition;if(actor.energy<=0)return null;
 }
 return paid===point.cost?{view:copy,actor}:null;
}

function safeReliefFireOrMove(battle,unit,action,shotSafety=knownRouteCivilianShotSafety){
 if(action?.type!=='fire')return action;
 const target=battle.units.find(other=>other.id===action.targetId),aim=action.aim??0,hitLocation=action.hitLocation??'torso';
 const requested=target&&firearmShotOptions(battle,unit,target,aim).find(option=>option.aim===aim&&option.hitLocation===hitLocation);
 if(shotSafety(battle,unit,target)(requested))return action;
 const rooms=new Set(battle.revealedRooms??[]);
 const targets=battle.units.filter(other=>other.side!==unit.side&&other.hp>0&&!other.unconscious&&!other.routed&&!other.surrendered&&!other.departure&&isInteriorVisible(battle,other,rooms)&&canSee(battle,unit,other));
 const shots=(state,actor)=>targets.flatMap(target=>{
  if(!canSee(state,actor,target))return [];
  const costs=actionCosts(state,actor,target);if(actor.ap<costs.fire)return [];
  const maxAim=Math.min(4,Math.floor((actor.ap-costs.fire)/costs.aim)),safe=shotSafety(state,actor,target);
  return firearmShotOptions(state,actor,target,maxAim).filter(option=>option.chance>0&&option.damageFactor>0&&safe(option)).map(option=>({
   score:option.expectedDamage??option.chance*option.damageFactor,
   action:{type:'fire',unitId:actor.id,targetId:target.id,aim:option.aim,hitLocation:option.hitLocation},
  }));
 }).sort((a,b)=>b.score-a.score||a.action.aim-b.action.aim||String(a.action.targetId).localeCompare(String(b.action.targetId))||a.action.hitLocation.localeCompare(b.action.hitLocation));
 const alternative=shots(battle,unit)[0];if(alternative)return alternative.action;
 if(unit.mounted||unit.knockedDown||unit.entangled)return null;
 // Preserve all known bodies and obstacles. A short actual route may clear
 // the firing lane; its preview reserves the next shot after paying movement,
 // facing and gun preparation. The next callback rechecks the actual scene.
 const publicView=publicRouteView(battle,unit),view={...publicView,units:publicView.units.filter(other=>other.side===unit.side||isInteriorVisible(battle,other,rooms)),npcs:publicView.npcs.filter(other=>isInteriorVisible(battle,other,rooms))};
 const moves=getReachable(view,unit).filter(point=>sameSurface(point,unit)&&point.cost>0&&point.cost<=24&&point.cost<unit.ap&&point.path.length<=3&&!point.path.some(step=>step.kind==='climb'))
  .sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x).slice(0,48);
 const choices=[];
 for(const point of moves){
  const paid=paidReliefPosition(view,unit,point);if(!paid)continue;
  const shot=shots(paid.view,paid.actor)[0];
  if(shot)choices.push({point,score:shot.score});
 }
 choices.sort((a,b)=>b.score-a.score||a.point.cost-b.point.cost||a.point.y-b.point.y||a.point.x-b.point.x);
 return choices[0]?{type:'move',unitId:unit.id,...spacePoint(choices[0].point)}:null;
}

// Keep the actual clinic physicians and soldiers without usable rounds in
// reserve. Adjacent native aid remains available; prone is a paid order.
export function northernReliefDefenseController(physicianIds,{minimumIdleRounds=0,localCareBattle=null,prioritizeLocalBattery=false}={}){
 assert.ok(Number.isInteger(minimumIdleRounds)&&minimumIdleRounds>=0);
 const physicians=new Set(physicianIds.map(String));
 // Local care may start with real serving troops away from their guns. Reuse
 // the existing paid approach and shared-sight battery policy, without giving
 // a clinical role to the crew or removing any real body from its previews.
 const nonclinical=unit=>Boolean(unit&&!physicians.has(unit.id)&&unit.medical<60);
 const battery=localCareBattle?coastalBatteryController(localCareBattle,{sharedArtillerySight:true,crewEligible:nonclinical,crewOnly:true,prioritizeCrewApproach:prioritizeLocalBattery}):null;
 const shotSafety=battery?knownRouteBystanderShotSafety:knownRouteCivilianShotSafety;
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
  return !plan.reason&&plan.crew.length>0&&plan.crew.every(id=>{const member=battle.units.find(member=>member.id===id);return battery?nonclinical(member):!held(member);});
 };
 // This is a Native current crew, not a reserved candidate list. A hold
 // cannot spend AP, move a body or make an incomplete group into a crew.
 const actualNonclinicalCrew=(battle,unit)=>nonclinical(unit)&&battle.artillery.some(gun=>{
  if(gun.side!==unit.side||!(gun.loaded||gun.ammo>0)||!artilleryContact(battle,unit,gun))return false;
  const plan=artilleryCrewPlan(battle,unit,gun,0);
  return !plan.reason&&plan.crew.every(id=>nonclinical(battle.units.find(member=>member.id===id)));
 });
 const actualNonclinicalContact=(battle,unit)=>nonclinical(unit)&&battle.artillery.some(gun=>gun.side===unit.side&&(gun.loaded||gun.ammo>0)&&artilleryContact(battle,unit,gun));
 const controller=(battle,unit)=>{
  const action=cautiousCombatOrder(battle,unit),reserved=held(unit);let ordinary=null;
  // Only the local-care caller whose actual initial battery had no complete
  // eligible crew requests setup priority. The existing crewOnly coordinator
  // admits its current real members; no copied body is removed or relocated.
  if(prioritizeLocalBattery&&battery&&battle.mode==='combat'&&battle.phase==='player'&&nonclinical(unit)&&!unit.knockedDown&&!unit.entangled){
   if(action?.type==='useItem'||action?.slot==='medical')return action;
   const coordinated=battery(battle,unit),currentCrew=actualNonclinicalCrew(battle,unit);
   if(coordinated||currentCrew||actualNonclinicalContact(battle,unit)){
    const close=battle.units.filter(other=>other.side!==unit.side&&other.hp>=15&&!other.routed&&!other.unconscious&&!other.departure&&!other.fled&&!other.surrendered&&sameSurface(unit,other)&&canSee(battle,unit,other)&&Math.hypot(unit.x-other.x,unit.y-other.y)<=2.5);
    if(close.length&&['fire','melee'].includes(action?.type)){const defense=crewKeepsReserves(battle,unit,action)?safeReliefFireOrMove(battle,unit,action,shotSafety):null;if(['fire','melee'].includes(defense?.type)&&close.some(target=>target.id===defense.targetId))return defense;}
    if(coordinated){
     if(!crewKeepsReserves(battle,unit,coordinated))return null;
     const safe=safeReliefFireOrMove(battle,unit,coordinated,shotSafety);
     // The coordinator already holds a real gun-contact post. Its later
     // personal-shot safety check cannot turn that hold into a rifle walk,
     // even while the other actual assigned member is still approaching.
     const convertedMove=coordinated.type==='fire'&&safe?.type==='move';
     return convertedMove&&actualNonclinicalContact(battle,unit)?null:safe;
    }
    // Do not spend the assembled gun's current AP on an optional personal
    // rifle reload or posture when the actual finite gun work must wait.
    return null;
   }
  }
  // Preserve every admitted cautious order, including current cover movement,
  // posture and look. Battery coordination is an idle fallback, not a reason
  // to replace ordinary work with a different crew route.
  if(!reserved){
   ordinary=crewKeepsReserves(battle,unit,action)?safeReliefFireOrMove(battle,unit,action,shotSafety):null;
   // A real complete local gun crew keeps its pre-contact post instead of
   // taking an optional personal-rifle investigation away from the piece.
   // Care, attacks, maintenance and all nonpriority/default work stay exact.
   if(prioritizeLocalBattery&&battery&&battle.mode==='exploration'&&ordinary?.type==='move'&&actualNonclinicalCrew(battle,unit))return null;
   if(!battery||ordinary)return ordinary;
  }else if(action?.type==='useItem'||action?.slot==='medical')return action;
  if(battery&&battle.mode==='combat'&&battle.phase==='player'&&nonclinical(unit)&&!unit.knockedDown&&!unit.entangled){
   const coordinated=battery(battle,unit);
   if(coordinated)return crewKeepsReserves(battle,unit,coordinated)?safeReliefFireOrMove(battle,unit,coordinated,shotSafety):null;
   // An upright complete dry-rifle crew honors the battery's actual hold.
   // Dropping prone here would merely require another paid rise next call.
   if(actualNonclinicalCrew(battle,unit))return null;
  }
  if(!reserved)return ordinary;
  if(unit.stance!=='prone'&&!unit.mounted&&!unit.knockedDown&&!unit.entangled&&unit.ap>=stanceCost(unit,'prone'))return {type:'stance',unitId:unit.id,stance:'prone'};
  return null;
 };
 // A whole squad pass first admits ordinary care, reload, fire and real crew
 // work. Public squad sight can then guide one native bound around a wall;
 // it does not create personal sight, contact memory or an artillery crew.
 controller.sharedFallback=(battle,unit)=>{
  if(!stalled(battle))return null;
  // A current complete nonclinical crew keeps its finite piece. Personal
  // rifle ammunition is not a requirement for Native artillery service.
  if(prioritizeLocalBattery&&battery&&actualNonclinicalContact(battle,unit))return null;
  if(battery&&actualNonclinicalCrew(battle,unit))return null;
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
