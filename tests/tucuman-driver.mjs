// Continue firing from a valid position when the usual 25% preference stalls.
// Low-probability shots still spend real ammunition and AP.
import {northernCombatOrder} from './northern-route.mjs';
import {knownRouteShotSafety} from './route-fire-safety.mjs';
import {teamCanSee,firearmShotOptions,actionCosts,hasLineOfSight} from '../game/tactical.js';
export function tucumanCombatOrder(b,u){
 const action=northernCombatOrder(b,u);if(action||!u.loaded||u.jammed)return action;
 const shots=[];
 for(const t of b.units.filter(v=>v.side==='enemy'&&v.hp>=15&&!v.departure&&!v.unconscious&&!v.surrendered&&!v.routed&&teamCanSee(b,u.side,v)&&hasLineOfSight(b,u,v))){
 const cost=actionCosts(b,u,t);if(u.ap<cost.fire)continue;
 const safe=knownRouteShotSafety(b,u,t);
 for(const o of firearmShotOptions(b,u,t,Math.min(4,Math.floor((u.ap-cost.fire)/cost.aim)))){
  if(!safe(o))continue;
  if(o.chance>=5&&o.damageFactor>0)shots.push({score:o.chance*o.damageFactor,action:{type:'fire',unitId:u.id,targetId:t.id,aim:o.aim,hitLocation:o.hitLocation}});
 }
 }return shots.sort((a,b)=>b.score-a.score)[0]?.action??null;
}
