import {combatOrder} from './opening-driver.mjs';
import {actionCosts,canSee,firearmShotOptions,stanceCost} from '../game/tactical.js';

// An observed window target can expose the head while blocking the torso.
// Use the actual cursor previews and pay the current order's full action cost.
export function openingBodyRegionOrder(battle,unit){
 const order=combatOrder(battle,unit);
 if(order?.type!=='fire'&&!(order?.type==='stance'&&order.stance==='prone'))return order;
 const visible=battle.units.filter(other=>other.side!==unit.side&&other.hp>=15&&!other.departure&&!other.routed&&!other.unconscious&&!other.surrendered&&battle.units.some(observer=>observer.side===unit.side&&canSee(battle,observer,other)));
 const lower={...unit,stance:'crouched',weaponReady:false};
 if(unit.stance==='standing'&&!unit.mounted&&visible.some(target=>{
  const cost=actionCosts(battle,lower,target);
  return unit.ap>=stanceCost(unit,'crouched')+cost.fire+cost.aim*2&&canSee(battle,lower,target)&&firearmShotOptions(battle,lower,target,2).some(option=>option.chance>=25);
 }))return {type:'stance',unitId:unit.id,stance:'crouched'};
 const shots=visible.flatMap(target=>{
  const cost=actionCosts(battle,unit,target),aim=Math.min(4,Math.floor((unit.ap-cost.fire)/cost.aim));
  return aim<0?[]:firearmShotOptions(battle,unit,target,aim).filter(option=>option.chance>=25).map(option=>({target,...option,score:option.chance*option.damageFactor-(cost.fire+option.aim*cost.aim)*.2}));
 }).sort((a,b)=>b.score-a.score);
 const shot=shots[0];return shot?{type:'fire',unitId:unit.id,targetId:shot.target.id,aim:shot.aim,hitLocation:shot.hitLocation}:order;
}
