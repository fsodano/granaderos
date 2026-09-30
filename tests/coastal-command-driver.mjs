// Keep the commander behind the battery and fire from an affordable legal stance.
import {mountainBatteryOrder} from './mountain-battery-driver.mjs';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {chooseGrenadeThrow} from '../game/tactical-ai-grenades.js';
import {getReachable,teamCanSee,firearmShotOptions,actionCosts,stanceCost} from '../game/tactical.js';
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
 for(const target of b.units.filter(v=>v.side!==u.side&&v.hp>=15&&!v.routed&&!v.surrendered&&!v.unconscious&&!v.departure&&teamCanSee(b,u.side,v))){const cost=actionCosts(b,u,target);if(u.ap<cost.fire)continue;for(const o of firearmShotOptions(b,u,target,Math.min(4,Math.floor((u.ap-cost.fire)/cost.aim))))if(o.chance>=25&&o.damageFactor>0)shots.push({score:o.chance*o.damageFactor,action:{type:'fire',unitId:u.id,targetId:target.id,aim:o.aim,hitLocation:o.hitLocation}});}
 return shots.sort((a,c)=>c.score-a.score)[0]?.action??null;
};

// Beltrán replaces the fallen gunner; a living crew is required for cover.
export const blockadeCommandOrder=(battle,unit)=>coastalCommandOrder(battle,unit,{leaderId:'2',screenDistance:3,requireCrewForCover:true});

// Once contact begins, keep the light gun in cover instead of pushing it
// toward an enemy that only a forward scout can see.
export const santaFeBatteryOrder=(battle,unit,{helperId='none',holdExploration=false}={})=>{
 // Sector persistence retains bodies. A dead former gunner must not suppress
 // the replacement officer's battery orders on a later visit.
 const leaderId=battle.units.some(actor=>actor.id==='2'&&actor.hp>0)?'2':'1000';
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
