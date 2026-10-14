import {publicSupportStagingPlan} from './public-support-staging.mjs';
import {publicRearFormationFollowPlan,publicLateRearSearchEligible} from './public-rear-formation.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {sectorSearchOrder} from './sector-search-driver.mjs';
import {getReachable,teamCanSee,hasLineOfSight,hasFirearm,actionCosts,knownArtillery} from '../game/tactical.js';
import {choosePlayerSharedSightingInvestigation} from '../game/tactical-ai.js';
import {firearmServiceable} from '../game/firearm-serviceability.js';
import {medicalPatientAvailable} from '../game/medical-patient.js';
import {criticalFirstAidNeeded} from '../game/first-aid.js';
import {sameSurface,spacePoint,surfaceAt} from '../game/tactical-space.js';
import {directionTo,turnAPCost} from '../game/tactical-awareness.js';
import {publicRouteView as publicView,usefulRouteRifleShot as usefulRifleShot,usefulRouteFiringPosture as usefulFiringPosture} from './route-infantry-progress.mjs';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const fit=unit=>unit.hp>=15&&!unit.departure&&!unit.routed&&!unit.unconscious&&!unit.surrendered&&!unit.fled&&!unit.asleep;
const rifleReady=unit=>fit(unit)&&(unit.activeSlot??'primary')==='primary'&&unit.loaded>0&&!unit.jammed&&!unit.weaponDropped&&hasFirearm(unit)&&firearmServiceable(unit);

// A blocked firing lane does not justify repeated paid posture changes.
// Use only current known occupants and actual same-level reachable cover.
function infantryCoverOrder(battle,unit,action){
 if(!rifleReady(unit)||battle.mode!=='combat'||battle.phase!=='player'||battle.reactionStack?.length||unit.knockedDown||unit.entangled||unit.mounted)return action;
 const view=publicView(battle,unit),contacts=view.units.filter(other=>other.side!==unit.side&&fit(other));if(!contacts.length)return action;
 const costs=actionCosts(battle,unit),budget=Math.min(24,unit.ap-costs.fire),cover=point=>surfaceAt(battle,point)?.cover??0,currentUseful=Boolean(usefulRifleShot(view,unit));
 if(budget<=0)return null;
 const options=getReachable(view,unit).filter(point=>point.cost>0&&point.cost<=budget&&sameSurface(point,unit)&&point.path.every(step=>sameSurface(step,unit))&&
  !point.path.some(step=>contacts.some(contact=>sameSurface(step,contact)&&distance(step,contact)<=2.5))).map(point=>{
   const actor={...unit,...spacePoint(point),weaponReady:false,momentum:0,ap:unit.ap-point.cost},positioned={...view,units:view.units.map(other=>other.id===unit.id?actor:other)};
   const useful=Boolean(usefulRifleShot(positioned,actor)),gain=cover(point)-cover(unit);
   return useful&&!currentUseful||gain>0?{point,score:(useful?100:0)+gain*.8-point.cost*.3}:null;
  }).filter(Boolean).sort((a,b)=>b.score-a.score||a.point.cost-b.point.cost||a.point.y-b.point.y||a.point.x-b.point.x);
 const next=options[0]?.point;
 return next?{type:'move',unitId:unit.id,...spacePoint(next)}:null;
}

// Preserve the dated default physician-following policy exactly. The new
// critical approach is used only by the explicit paid-cover option.
function legacyPhysicianCoverOrder(battle,unit,action,protectedIds,direction){
 if(!fit(unit)||!(unit.medkits>0)||battle.phase!=='player'||battle.reactionStack?.length||unit.knockedDown||unit.entangled)return action;
 const patients=battle.units.filter(other=>other.side===unit.side&&medicalPatientAvailable(other)&&(other.bleeding>0||criticalFirstAidNeeded(other)));
 if(action?.type==='move'&&patients.some(patient=>sameSurface(action,patient)&&distance(action,patient)<=1.5&&hasLineOfSight(battle,{...unit,...action},patient)))return action;
 const progress=point=>point.x*direction.x+point.y*direction.y;
 const screen=battle.units.filter(other=>other.side===unit.side&&!protectedIds.has(other.id)&&fit(other)&&sameSurface(unit,other))
  .sort((a,b)=>progress(b)-progress(a)||b.marksmanship-a.marksmanship||String(a.id).localeCompare(String(b.id)));
 if(!screen.length)return action;
 const lead=screen[Math.min(1,screen.length-1)],goal={x:lead.x-2*direction.x,y:lead.y-2*direction.y,tacticalLevel:unit.tacticalLevel??0};
 if(distance(unit,goal)<=2&&progress(unit)<=progress(lead))return null;
 const view={...battle,units:battle.units.filter(other=>other.side===unit.side||teamCanSee(battle,unit.side,other)),npcs:(battle.npcs??[]).filter(other=>teamCanSee(battle,unit.side,other)),artillery:knownArtillery(battle,unit)};
 const costs=actionCosts(battle,unit),budget=Math.min(16,unit.ap-costs.weapon-costs.heal);
 if(budget<=0)return null;
 const candidates=getReachable(view,unit).filter(point=>point.cost>0&&point.cost<=budget&&sameSurface(point,unit)&&point.path.every(step=>sameSurface(step,unit))&&
  progress(point)<=progress(lead)&&distance(point,goal)<distance(unit,goal));
 const score=point=>distance(point,goal)-(surfaceAt(battle,point)?.cover??0)*.02;
 candidates.sort((a,b)=>score(a)-score(b)||a.cost-b.cost||a.y-b.y||a.x-b.x);
 return candidates[0]?{type:'move',unitId:unit.id,...spacePoint(candidates[0])}:null;
}

// A qualified supplied physician follows the actual infantry, not a hidden
// opponent. Keep the native aid approach when it already reaches a patient.
function physicianCoverOrder(battle,unit,action,protectedIds,direction){
 if(!fit(unit)||!(unit.medkits>0)||battle.phase!=='player'||battle.reactionStack?.length||unit.knockedDown||unit.entangled)return action;
 const patients=battle.units.filter(other=>other.side===unit.side&&other.id!==unit.id&&medicalPatientAvailable(other)&&(other.bleeding>0||criticalFirstAidNeeded(other)))
  .sort((a,b)=>Number(criticalFirstAidNeeded(b))-Number(criticalFirstAidNeeded(a))||a.hp-b.hp||distance(unit,a)-distance(unit,b)||String(a.id).localeCompare(String(b.id)));
 if(action?.type==='move'&&patients.some(patient=>sameSurface(action,patient)&&distance(action,patient)<=1.5&&hasLineOfSight(battle,{...unit,...action},patient)))return action;
 const view=publicView(battle,unit),costs=actionCosts(battle,unit),budget=Math.min(16,unit.ap-costs.weapon-costs.heal);
 if(budget<=0)return null;
 const reachable=getReachable(view,unit).filter(point=>point.cost>0&&point.cost<=budget&&sameSurface(point,unit)&&point.path.every(step=>sameSurface(step,unit)));
 for(const patient of patients){
  if(!sameSurface(unit,patient))continue;
  const near=reachable.filter(point=>distance(point,patient)<=1.5&&hasLineOfSight(battle,{...unit,...point},patient)).sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x)[0];
  const step=near??reachable.filter(point=>distance(point,patient)<distance(unit,patient)).sort((a,b)=>distance(a,patient)-distance(b,patient)||a.cost-b.cost||a.y-b.y||a.x-b.x)[0];
  if(step)return {type:'move',unitId:unit.id,...spacePoint(step)};
 }
 const progress=point=>point.x*direction.x+point.y*direction.y;
 const screen=battle.units.filter(other=>other.side===unit.side&&!protectedIds.has(other.id)&&fit(other)&&sameSurface(unit,other))
  .sort((a,b)=>progress(b)-progress(a)||b.marksmanship-a.marksmanship||String(a.id).localeCompare(String(b.id)));
 if(!screen.length)return action;
 const lead=screen[Math.min(1,screen.length-1)],goal={x:lead.x-2*direction.x,y:lead.y-2*direction.y,tacticalLevel:unit.tacticalLevel??0};
 if(distance(unit,goal)<=2&&progress(unit)<=progress(lead))return null;
 const candidates=reachable.filter(point=>
  progress(point)<=progress(lead)&&distance(point,goal)<distance(unit,goal));
 const score=point=>distance(point,goal)-(surfaceAt(battle,point)?.cover??0)*.02;
 candidates.sort((a,b)=>score(a)-score(b)||a.cost-b.cost||a.y-b.y||a.x-b.x);
 return candidates[0]?{type:'move',unitId:unit.id,...spacePoint(candidates[0])}:null;
}

function sharedInfantryOrder(battle,unit,protectedIds){
 if(protectedIds.has(unit.id)||!fit(unit)||unit.missionAlly||unit.mounted||unit.knockedDown||unit.entangled||battle.phase!=='player'||battle.reactionStack?.length||
  (unit.activeSlot??'primary')!=='primary'||!unit.loaded||unit.jammed||unit.weaponDropped||!hasFirearm(unit)||!firearmServiceable(unit))return null;
 const contacts=battle.units.filter(other=>other.side!==unit.side&&fit(other)&&teamCanSee(battle,unit.side,other))
  .sort((a,b)=>distance(unit,a)-distance(unit,b)||String(a.id).localeCompare(String(b.id)));
 for(const contact of contacts){
  const action=choosePlayerSharedSightingInvestigation(battle,unit,contact);
  if(action&&(action.type!=='look'||turnAPCost(unit,directionTo(unit,action))>0))return action;
 }
 return null;
}

// The paid Ensenada force keeps its original deployment and battery policy.
// Once contact is lost, a recurring crew approach must not prevent searching
// the public map. Search before that approach; observed targets still select
// ordinary battery orders and spend the force's real ammunition and AP.
export function recoveryPortSearchController(initial,{reserveIds=[],coordinateInfantry=false,coordinateRifleCover=false,coordinateSupportStaging=false,coordinateRearFormation=false}={}){
 const battery=coastalBatteryController(initial,{sharedArtillerySight:true});
 const reserves=new Set(reserveIds.map(String));
 const physicians=new Set(coordinateInfantry?initial.units.filter(unit=>unit.side==='player'&&unit.medical>=60&&unit.medkits>0).map(unit=>unit.id):[]);
 const protectedIds=new Set([...reserves,...physicians]);
 const own=initial.units.filter(unit=>unit.side==='player'&&fit(unit)),origin=own.reduce((point,unit)=>({x:point.x+unit.x/own.length,y:point.y+unit.y/own.length}),{x:0,y:0});
 const delta={x:initial.width*.65-origin.x,y:initial.height*.5-origin.y},length=Math.hypot(delta.x,delta.y)||1,direction={x:delta.x/length,y:delta.y/length};
 const ordinary=(battle,unit)=>{
  const observed=battle.units.some(other=>other.side!==unit.side&&other.hp>=15&&!other.departure&&!other.routed&&!other.unconscious&&!other.surrendered&&teamCanSee(battle,unit.side,other));
  const lateRear=coordinateInfantry&&coordinateRifleCover&&coordinateSupportStaging&&coordinateRearFormation&&reserves.has(unit.id)&&battle.status==='active'&&battle.turn>=20&&battle.mode==='exploration'&&battle.phase==='player'&&!battle.reactionStack?.length;
  // This late reserve boundary gets ONE ordinary battery consultation before
  // reconnaissance. Cache the return even if public search cannot proceed;
  // finite aid, hand preparation, firing, loading and pan work stay first.
  const cached=lateRear?battery(battle,unit):null;
  if(lateRear&&cached&&!['move','charge','climb','artilleryMove'].includes(cached.type))return {action:cached,rearSearch:false};
  if(battle.turn>=20&&battle.phase==='player'&&!observed){
   const rearSearch=lateRear&&publicLateRearSearchEligible(battle,unit,{reserveIds});
   const search=sectorSearchOrder(rearSearch?publicView(battle,unit):battle,unit);
   if(search)return {action:search,rearSearch};
  }
  return {action:lateRear?cached:battery(battle,unit),rearSearch:false};
 };
 const controller=(battle,unit)=>{
  const admitted=ordinary(battle,unit);let action=admitted.action;
  if(coordinateInfantry&&coordinateRifleCover){
   // The explicit infantry doctrine never replaces admitted fire, medicine,
   // reload or maintenance. No-contact search retains the existing bounds.
   const uselessPosture=!usefulFiringPosture(battle,unit,action);
   if(!reserves.has(unit.id)&&physicians.has(unit.id)&&(!action||['move','charge'].includes(action.type)||uselessPosture))return physicianCoverOrder(battle,unit,action,protectedIds,direction);
   if(uselessPosture)action=usefulRifleShot(publicView(battle,unit),unit)??infantryCoverOrder(battle,unit,null);
   else if(!protectedIds.has(unit.id)&&action?.type==='move'&&battle.mode==='combat')action=infantryCoverOrder(battle,unit,action);
  }else if(coordinateInfantry&&!reserves.has(unit.id)&&physicians.has(unit.id)&&(!action||['move','charge'].includes(action.type)))return legacyPhysicianCoverOrder(battle,unit,action,protectedIds,direction);
  // The new opt-in first preserves this actor's ordinary work, then uses
  // pure public previews to preserve other front work and its current lane.
  // No second stateful controller call or future AP budget is introduced.
  if(coordinateInfantry&&coordinateRifleCover&&coordinateSupportStaging&&!action&&!protectedIds.has(unit.id)){
   const support=publicSupportStagingPlan(battle,unit,{protectedIds});if(support)return support.action;
  }
  if(!reserves.has(unit.id)||!['move','charge'].includes(action?.type))return action;
  // The existing foundry cohort follows behind paid infantry. Fire, reload,
  // adjacent aid and maintenance retain their ordinary orders. Follow the
  // second forward soldier so one exposed scout cannot pull the reserve ahead.
  const screen=battle.units.filter(other=>other.side===unit.side&&!reserves.has(other.id)&&other.medical<90&&other.hp>=15&&!other.departure&&!other.routed&&!other.unconscious&&!other.surrendered).sort((a,b)=>b.x-a.x||b.marksmanship-a.marksmanship);
  // Only the explicit support doctrine holds required rear move/charge
  // after this EXISTING screen predicate is empty. It deliberately admits
  // medical 60--89 and unarmed/empty nonreserves; no new crew/fit rule.
  // Fire, adjacent aid, maintenance and legal exits already returned above.
  if(!screen.length){
   // Retain the exact current ordinary search order. Each healthy rear actor
   // gets its own ordinary pass; the one-shared-fallback cap stays unchanged.
   if(admitted.rearSearch)return action;
   return coordinateInfantry&&coordinateRifleCover&&coordinateSupportStaging?null:action;
  }
  const lead=screen[Math.min(1,screen.length-1)],goal={x:Math.max(0,lead.x-4),y:lead.y,tacticalLevel:0},distance=point=>Math.hypot(point.x-goal.x,point.y-goal.y);
  const observed=other=>teamCanSee(battle,unit.side,other);
  const view={...battle,units:battle.units.filter(other=>other.side===unit.side||observed(other)),npcs:(battle.npcs??[]).filter(observed),artillery:knownArtillery(battle,unit)};
  const point=getReachable(view,unit).filter(point=>sameSurface(point,goal)&&point.cost>0&&point.cost<=Math.min(20,unit.ap)&&point.x<=goal.x&&distance(point)<distance(unit)).sort((a,b)=>distance(a)-distance(b)||a.cost-b.cost||a.y-b.y||a.x-b.x)[0];
  return point?{type:'move',unitId:unit.id,...spacePoint(point)}:null;
 };
 // A shared bound follows a complete ordinary squad pass. It cannot jump
 // ahead of another soldier's shot, reload or the physician's finite aid.
 controller.sharedFallback=coordinateInfantry?(coordinateRearFormation&&coordinateRifleCover&&coordinateSupportStaging?
  (battle,unit)=>sharedInfantryOrder(battle,unit,protectedIds)??publicRearFormationFollowPlan(battle,unit,{reserveIds})?.action??null:
  (battle,unit)=>sharedInfantryOrder(battle,unit,protectedIds)):undefined;
 return controller;
}
