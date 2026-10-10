// Keep the commander behind the battery and fire from an affordable legal stance.
import {mountainBatteryOrder} from './mountain-battery-driver.mjs';
import {knownRouteShotSafety} from './route-fire-safety.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {chooseGrenadeThrow} from '../game/tactical-ai-grenades.js';
import {artilleryProfile} from '../game/artillery-definitions.js';
import {getReachable,teamCanSee,firearmShotOptions,actionCosts,stanceCost,artilleryContact} from '../game/tactical.js';
export const coastalCommandOrder=(b,u,{leaderId='7',helperId='8',screenDistance=Infinity,commanderDistance=3,requireCrewForCover=false}={})=>{
 const normal=mountainBatteryOrder(b,u,{leaderId,helperId,screenDistance}),gun=b.artillery.find(g=>g.side===u.side);
 const coverCommander=!requireCrewForCover||b.units.some(actor=>actor.id===leaderId&&actor.hp>=15&&!actor.routed&&!actor.unconscious&&!actor.departure);
 if(coverCommander&&u.id==='57'&&gun&&b.mode==='exploration'&&normal?.type==='move'){
  const distance=p=>Math.hypot(gun.x-p.x,gun.y-p.y);if(distance(u)<=commanderDistance)return null;
  const view={...b,units:b.units.filter(v=>v.side===u.side||teamCanSee(b,u.side,v))};
  const p=getReachable(view,u).filter(p=>p.cost>0&&p.cost<=20&&distance(p)<distance(u)&&distance(p)>=commanderDistance-1).sort((a,c)=>distance(a)-distance(c)||a.cost-c.cost)[0];
  return p?{type:'move',unitId:u.id,x:p.x,y:p.y}:null;
 }
 if(coverCommander&&u.id==='57'&&b.mode==='combat'&&normal?.type==='move')return null;
 if(normal||u.stance!=='crouched'||!u.loaded||u.jammed)return normal;
 const shots=[];
 for(const target of b.units.filter(v=>v.side!==u.side&&v.hp>=15&&!v.routed&&!v.surrendered&&!v.unconscious&&!v.departure&&teamCanSee(b,u.side,v))){const cost=actionCosts(b,u,target);if(u.ap<cost.fire)continue;const safe=knownRouteShotSafety(b,u,target);for(const o of firearmShotOptions(b,u,target,Math.min(4,Math.floor((u.ap-cost.fire)/cost.aim))))if(o.chance>=25&&o.damageFactor>0&&safe(o))shots.push({score:o.chance*o.damageFactor,action:{type:'fire',unitId:u.id,targetId:target.id,aim:o.aim,hitLocation:o.hitLocation}});}
 return shots.sort((a,c)=>c.score-a.score)[0]?.action??null;
};

// Beltrán replaces the fallen gunner; a living crew is required for cover.
export const blockadeCommandOrder=(battle,unit)=>coastalCommandOrder(battle,unit,{leaderId:'2',screenDistance:3,requireCrewForCover:true});

// Two coastal guns need separate crews and space for their translated bodies.
// Infantry scouts the flanks so contact occurs before an exposed crew arrives.
export function coastalBatteryController(initial,{sharedArtillerySight=false}={}){
 const approach={x:Math.floor(initial.width*.65),y:Math.floor(initial.height*.5)};
 const distanceToApproach=gun=>Math.hypot(gun.x-approach.x,gun.y-approach.y);
 // A light piece may arrive ahead of a heavy one. Move the physically leading
 // gun first; purchase order must not make it wait while blocking the rear gun.
 const initialAssigned=new Set(),preferred=initial.artillery.filter(g=>g.side==='player').sort((a,b)=>distanceToApproach(a)-distanceToApproach(b)||String(a.id).localeCompare(String(b.id))).map(g=>{
  const ids=initial.units.filter(u=>u.side==='player'&&u.id!=='57'&&u.hp>0&&!initialAssigned.has(u.id))
   .sort((a,b)=>Math.hypot(a.x-g.x,a.y-g.y)-Math.hypot(b.x-g.x,b.y-g.y)||String(a.id).localeCompare(String(b.id)))
   .slice(0,artilleryProfile(initial,g).crew).map(u=>u.id);
  for(const id of ids)initialAssigned.add(id);
  return {ids,artilleryId:g.id};
 });
 return (b,u)=>{
  // Recompute from the original preferences and current living actors. This
  // permits a surviving soldier to replace a casualty without retaining
  // mutable crew assignments across a deterministic battle replay.
  const assigned=new Set(),working=preferred.filter(p=>{const g=b.artillery.find(g=>g.id===p.artilleryId);return g&&(g.loaded||g.ammo>0);});
  const reserved=new Set(working.flatMap(p=>p.ids)),crews=[];
  for(const preference of working){
   const gun=b.artillery.find(g=>g.id===preference.artilleryId),required=artilleryProfile(b,gun).crew,priority=v=>preference.ids.includes(v.id)?preference.ids.indexOf(v.id):reserved.has(v.id)?required+1:required;
   const ids=b.units.filter(v=>v.side==='player'&&v.id!=='57'&&v.hp>=15&&!v.unconscious&&!v.routed&&!v.departure&&!v.fled&&!v.surrendered&&!assigned.has(v.id))
    .sort((a,c)=>priority(a)-priority(c)||Math.hypot(a.x-gun.x,a.y-gun.y)-Math.hypot(c.x-gun.x,c.y-gun.y)||String(a.id).localeCompare(String(c.id)))
    .slice(0,required).map(v=>v.id);
   if(ids.length<required)continue;
   for(const id of ids)assigned.add(id);
   crews.push({...preference,ids});
  }
  const crew=crews.find(p=>p.ids.includes(u.id))??crews[0];
  if(!crew)return tucumanCombatOrder(b,u);
  const gun=b.artillery.find(g=>g.id===crew.artilleryId);
  const action=mountainBatteryOrder(b,u,{leaderId:crew.ids[0],helperId:crew.ids[1]??'none',artilleryId:crew.artilleryId,screenDistance:4,clearCrewLane:true,routeAroundObstacles:true,flankScreen:true,keepCrewTogether:true,sharedArtillerySight});
  if(assigned.has(u.id)&&b.mode==='combat'&&b.phase==='player'&&!artilleryContact(b,u,gun)&&!u.knockedDown&&!u.entangled&&(!action||action.type==='move')){
   if(u.stance==='prone')return u.ap>=stanceCost(u,'crouched')?{type:'stance',unitId:u.id,stance:'crouched'}:null;
   const view={...b,units:b.units.filter(v=>v.side===u.side||teamCanSee(b,u.side,v))};
   const route=getReachable({...view,mode:'exploration'},u).filter(p=>p.cost>0&&(p.tacticalLevel??0)===0&&artilleryContact(view,{...u,...p},gun)).sort((a,c)=>a.cost-c.cost)[0];
   const reachable=new Map(getReachable(view,u).filter(p=>p.cost>0).map(p=>[`${p.x},${p.y},${p.tacticalLevel??0}`,p]));
   const point=route&&[...route.path].reverse().map(p=>reachable.get(`${p.x},${p.y},${p.tacticalLevel??0}`)).find(Boolean);
   return point?{type:'move',unitId:u.id,x:point.x,y:point.y,tacticalLevel:point.tacticalLevel??0}:null;
  }
  if(b.mode==='exploration'&&crew!==crews[0]&&action?.type==='artilleryMove'){
   const front=b.artillery.find(g=>g.id===crews[0].artilleryId);
   if(Math.hypot(front.x-gun.x,front.y-gun.y)<8)return null;
  }
  if(assigned.has(u.id)&&b.mode==='combat'&&artilleryContact(b,u,gun)&&(gun.loaded||gun.ammo>0)&&action?.type==='move')return null;
  const cover=b.units.some(v=>assigned.has(v.id)&&v.hp>=15&&!v.unconscious&&!v.routed&&!v.departure&&b.artillery.some(g=>g.side==='player'&&(g.loaded||g.ammo>0)&&Math.hypot(v.x-g.x,v.y-g.y)<=1.5));
  if(u.id==='57'&&cover&&b.mode==='combat'&&action?.type==='move')return null;
  return action;
 };
}

// Once contact begins, keep the light gun in cover instead of pushing it
// toward an enemy that only a forward scout can see.
export const santaFeBatteryOrder=(battle,unit,{helperId='none',holdExploration=false}={})=>{
 // Sector persistence retains bodies. A dead former gunner must not suppress
 // the replacement officer's battery orders on a later visit.
 const capable=actor=>actor.side===unit.side&&actor.hp>=15&&!actor.unconscious&&!actor.routed&&!actor.departure&&!actor.fled&&!actor.surrendered;
 const preferred=['2','1000'].find(id=>battle.units.some(actor=>actor.id===id&&capable(actor)));
 const gun=battle.artillery.find(g=>g.side===unit.side&&(g.loaded||g.ammo>0));
 const distance=actor=>gun?Math.hypot(actor.x-gun.x,actor.y-gun.y):0;
 const replacement=battle.units.filter(actor=>capable(actor)&&actor.id!=='57').sort((a,b)=>distance(a)-distance(b)||a.marksmanship-b.marksmanship||String(a.id).localeCompare(String(b.id)))[0];
 const leaderId=preferred??replacement?.id??'57';
 const action=coastalCommandOrder(battle,unit,{leaderId,helperId,screenDistance:3,commanderDistance:6,requireCrewForCover:true});
 if(holdExploration&&battle.mode==='exploration'&&!action)return null;
 if(battle.mode==='combat'&&action?.type==='artilleryMove')return unit.stance==='standing'&&unit.ap>=stanceCost(unit,'crouched')?{type:'stance',unitId:unit.id,stance:'crouched'}:null;
 if(!action&&battle.phase==='player'&&!battle.units.some(v=>v.side!==unit.side&&v.hp>=15&&!v.routed&&!v.unconscious&&!v.surrendered&&!v.departure&&teamCanSee(battle,unit.side,v))){
  // Search known map quadrants when no opponent is in shared sight. Stopping
  // forever at the center cannot prove that the entire sector is clear.
  const corners=[[.25,.25],[.75,.25],[.75,.75],[.25,.75]],corner=corners[Math.floor((battle.turn-1)/4)%corners.length],goal={x:Math.floor(battle.width*corner[0]),y:Math.floor(battle.height*corner[1])};
  const distance=p=>Math.hypot(p.x-goal.x,p.y-goal.y);
  if(distance(unit)>3){
   if(unit.stance!=='standing'&&unit.ap>=stanceCost(unit,'standing'))return {type:'stance',unitId:unit.id,stance:'standing'};
   const view={...battle,units:battle.units.filter(v=>v.side===unit.side||teamCanSee(battle,unit.side,v))};
   const point=getReachable(view,unit).filter(p=>p.cost>0&&p.cost<=Math.min(30,unit.ap-20)&&distance(p)<distance(unit)).sort((a,b)=>distance(a)-distance(b)||a.cost-b.cost)[0];
   if(point)return {type:'move',unitId:unit.id,x:point.x,y:point.y,tacticalLevel:point.tacticalLevel??0};
  }
 }
 return action;
};

// The reserve bronze cannon needs two people. Keep the assistant and screen
// in place when the battery has no legal approach step.
export const humahuacaBatteryOrder=(battle,unit)=>{
 const grenade=chooseGrenadeThrow(battle,unit,battle.units.filter(target=>target.side!==unit.side&&teamCanSee(battle,unit.side,target)));
 if(grenade)return grenade;
 if(battle.units.some(target=>target.side!==unit.side&&target.hp>=15&&!target.routed&&!target.unconscious&&!target.departure&&!target.surrendered&&Math.hypot(target.x-unit.x,target.y-unit.y)<=2.5&&teamCanSee(battle,unit.side,target))){
  const defense=chooseEnemyAction(battle,unit);if(defense)return defense;
 }
 return santaFeBatteryOrder(battle,unit,{helperId:'139',holdExploration:true});
};
