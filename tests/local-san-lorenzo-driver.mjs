// Acceptance controller: ordinary orders from actual stock-route survivors.
// This is one reproducible strategy, not the game AI or a balance guarantee.
import {fight as recordedFight} from './opening-driver.mjs';
import {automaticOrder} from '../game/autonomous-orders.js';
import {actBattle,teamCanSee,meleePreview,getReachable,shotChance,actionCosts,stanceCost,hasFirearm,firearmShotOptions,firearmFlightPreview,weaponFor,reloadPlan} from '../game/tactical.js';
import {spacePoint} from '../game/tactical-space.js';
import {shotLocationEffects} from '../game/targeted-combat.js';
import {sectorSearchOrder} from './sector-search-driver.mjs';
import {firstAidPlan} from '../game/first-aid.js';
import {pairedPistol,secondaryPistolView} from '../game/paired-fire.js';
const live=u=>u.hp>0&&!u.departure&&!u.surrendered&&!u.unconscious&&!u.routed;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const friendlyRay=shot=>Boolean(shot?.interveningFriendly||shot?.shots?.some(hand=>hand.interveningFriendly));
const civilianRay=(b,u,target,hitLocation)=>{
 const second=pairedPistol(u),views=[u,...(second?[secondaryPistolView(u,second)]:[])];
 return views.some(view=>{
  // The public preview contains known bodies only, at their actual heights.
  // It does not reveal hidden civilians or predict a seeded off-aim miss.
  const flight=firearmFlightPreview(b,view,target,hitLocation);
  return flight.victimKind==='npc'||Boolean(flight.bodyImpacts?.some(impact=>impact.victimKind==='npc'));
 });
};
// The final candidate boundary also checks the unchanged automatic fallback.
// This predicate adds no chance threshold and applies no order to the input.
export function localSanLorenzoFireSafe(b,u,action,{avoidCivilians=false}={}){
 if(action?.type!=='fire')return true;
 const target=b.units.find(other=>other.id===action.targetId);if(!target)return false;
 const aim=action.aim??0,hitLocation=action.hitLocation??'torso';
 const shot=firearmShotOptions(b,u,target,aim).find(option=>option.aim===aim&&option.hitLocation===hitLocation);
 return Boolean(shot)&&!friendlyRay(shot)&&(!avoidCivilians||!civilianRay(b,u,target,hitLocation));
}
export function localSanLorenzoOrder(b,u,{avoidCivilians=false}={}){
 const visible=b.units.filter(t=>t.side==='enemy'&&live(t)&&teamCanSee(b,'player',t));
 const perceived={...b,units:b.units.filter(t=>t.side===u.side||visible.some(v=>v.id===t.id)),npcs:(b.npcs??[]).filter(t=>teamCanSee(b,'player',t))};
 const infantry=b.units.filter(t=>t.side==='player'&&live(t)&&!t.missionAlly&&t.hp>=15);
 const supported=!infantry.length||infantry.some(t=>distance(t,u)<8);
 function* candidates(){
  if(u.bleeding&&firstAidPlan(u,u).valid)yield u.activeSlot==='medical'?{type:'heal'}:{type:'weapon',slot:'medical'};
  else if(u.activeSlot==='medical')yield {type:'weapon',slot:'primary'};
  if(u.knockedDown)yield {type:'stance',stance:'standing'};
  if(u.missionAlly){
   // The cavalry joins its actual infantry before contact. It keeps its
   // carried pistol for fire and selects the saber only for an adjacent foe.
   if(!supported){
    const rally=infantry.reduce((p,t)=>({x:p.x+t.x/infantry.length,y:p.y+t.y/infantry.length}),{x:0,y:0});
    const bounds=getReachable(perceived,u).filter(p=>p.cost>0&&p.cost<=Math.min(32,u.ap-20)&&distance(p,rally)<distance(u,rally)).sort((a,c)=>distance(a,rally)-distance(c,rally)||a.cost-c.cost);
    if(bounds[0])yield {type:'move',...spacePoint(bounds[0])};
    return;
   }
   if(visible.some(t=>distance(u,t)<=2)&&u.activeSlot!=='blade')yield {type:'weapon',slot:'blade'};
   if(u.activeSlot==='blade')for(const t of [...visible].sort((a,c)=>distance(u,a)-distance(u,c))){
    if(meleePreview(b,u,t).valid)yield {type:'melee',targetId:t.id};
    if(!infantry.length)yield {type:'charge',targetId:t.id};
   }
  }
  if(!visible.length&&u.stance==='prone')yield {type:'stance',stance:'standing'};
  if(visible.length&&u.loaded&&u.stance==='standing'&&!u.mounted&&visible.every(t=>distance(u,t)>2)&&visible.some(t=>shotChance(b,u,t,4)>=25)&&u.ap>=stanceCost(u,'crouched')+actionCosts(b,{...u,stance:'crouched',weaponReady:false},visible[0]).fire+12)yield {type:'stance',stance:'crouched'};
  if(!u.loaded&&u.stance==='prone')yield {type:'stance',stance:'crouched'};
  if(u.jammed)yield {type:'reprime'};
  for(const t of visible)if(meleePreview(b,u,t).valid)yield {type:'melee',targetId:t.id};
  if(hasFirearm(u)&&u.loaded&&!u.jammed){
   const shots=[];
   for(const t of visible){
    const cost=actionCosts(b,u,t);if(u.ap<cost.fire)continue;
    for(const shot of firearmShotOptions(b,u,t,Math.min(4,Math.floor((u.ap-cost.fire)/cost.aim)))){
     if(shot.chance<25)continue;
     if(friendlyRay(shot)||avoidCivilians&&civilianRay(b,u,t,shot.hitLocation))continue;
     const effect=shotLocationEffects(shot.hitLocation,weaponFor(u).damage*shot.damageFactor,t);
     const score=shot.chance*(Math.min(t.hp,effect.damage)+(t.hp-effect.damage<15?15:0))-(cost.fire+shot.aim*cost.aim)*.2;
     shots.push({t,...shot,score});
    }
   }
   for(const shot of shots.sort((a,c)=>c.score-a.score))yield {type:'fire',targetId:shot.t.id,aim:shot.aim,hitLocation:shot.hitLocation};
  }
  if(u.missionAlly&&infantry.length)return;
  if(hasFirearm(u)&&!u.loaded&&u.ammo&&visible.length&&!reloadPlan(u,b).partial)yield {type:'reload'};
  const known=u.lastKnownEnemy??u.lastHeardNoise;
  if(!visible.length&&!known&&b.turn>=20){const search=sectorSearchOrder(b,u);if(search)yield search;}
  const goal=visible.length?visible:known?[known]:[{x:b.width-3,y:Math.round(b.height/2)}],currentDistance=Math.min(...goal.map(t=>distance(u,t)));
  const moves=getReachable(perceived,u).filter(p=>p.cost>0&&p.cost<=Math.min(32,Math.max(0,u.ap-30)));
  const scored=moves.map(p=>{const actor={...u,...spacePoint(p)},d=Math.min(...goal.map(t=>distance(p,t))),cover=b.tiles.find(t=>t.x===p.x&&t.y===p.y)?.cover??0,chance=visible.length?Math.max(...visible.map(t=>Math.max(shotChance(b,actor,t,2),shotChance(b,actor,t,2,'head')))):0;return {p,d,score:visible.length?chance*.7+cover*.7-Math.max(0,5-d)*12-p.cost*.2:-d-p.cost*.01};}).filter(x=>visible.length?x.d>=3||!hasFirearm(u):x.d<currentDistance).sort((a,c)=>c.score-a.score);
  const currentScore=visible.length?Math.max(...visible.map(t=>Math.max(shotChance(b,u,t,2),shotChance(b,u,t,2,'head'))))*.7+(b.tiles.find(t=>t.x===u.x&&t.y===u.y)?.cover??0)*.7-Math.max(0,5-currentDistance)*12:-currentDistance;
  if(scored[0]&&scored[0].score>currentScore+2)yield {type:'move',...spacePoint(scored[0].p)};
  if(hasFirearm(u)&&!u.loaded&&u.ammo)yield {type:'reload'};
  const automatic=automaticOrder(b,u);if(automatic)yield automatic;
 }
 for(const candidate of candidates()){
  const action={...candidate,unitId:u.id};
  if(!localSanLorenzoFireSafe(b,u,action,{avoidCivilians}))continue;
  if(!actBattle(b,action).lastError)return action;
 }
 return null;
}
export function fight(request,previous=null,{avoidCivilians=false}={}){return recordedFight(request,previous,{controller:(b,u)=>localSanLorenzoOrder(b,u,{avoidCivilians})});}
