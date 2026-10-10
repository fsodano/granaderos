// Continue firing from a valid position when the usual 25% preference stalls.
// Low-probability shots still spend real ammunition and AP.
import {northernCombatOrder} from './northern-route.mjs';
import {teamCanSee,firearmShotOptions,actionCosts,hasLineOfSight} from '../game/tactical.js';
export function tucumanCombatOrder(b,u){
 const action=northernCombatOrder(b,u);if(action||!u.loaded||u.jammed)return action;
 const shots=[];
 for(const t of b.units.filter(v=>v.side==='enemy'&&v.hp>=15&&!v.departure&&!v.unconscious&&!v.surrendered&&!v.routed&&teamCanSee(b,u.side,v)&&hasLineOfSight(b,u,v))){
 const cost=actionCosts(b,u,t);if(u.ap<cost.fire)continue;
 for(const o of firearmShotOptions(b,u,t,Math.min(4,Math.floor((u.ap-cost.fire)/cost.aim)))){
  if(o.interveningFriendly||o.shots?.some(shot=>shot.interveningFriendly))continue;
  if(o.chance>=5&&o.damageFactor>0)shots.push({score:o.chance*o.damageFactor,action:{type:'fire',unitId:u.id,targetId:t.id,aim:o.aim,hitLocation:o.hitLocation}});
 }
 }return shots.sort((a,b)=>b.score-a.score)[0]?.action??null;
}
