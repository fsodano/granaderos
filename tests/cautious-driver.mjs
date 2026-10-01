import {canSee,teamCanSee,getReachable,actionCosts,stanceCost,firearmShotOptions} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {combatOrder} from './opening-driver.mjs';
import {sameCell,sameSurface,spacePoint} from '../game/tactical-space.js';

// After contact, use the game's existing shot, cover, medical aid and memory
// evaluation. Retain opening reconnaissance only while no current or recent
// contact is available. A null combat choice means hold, not a forced advance.
export function cautiousCombatOrder(state,unit){
 const target=state.units.find(other=>other.side!==unit.side&&other.hp>=15&&!other.departure&&!other.surrendered&&!other.unconscious&&canSee(state,unit,other));
 // The player squad deliberately fires from prone at contact. Pay the setup
 // only when the lowered gun retains a useful shot with two aiming levels.
 // A roof edge can hide a ground target from prone. Forcing that posture
 // otherwise fights the AI's stand order and consumes the turn in a loop.
 if(target&&unit.activeSlot==='primary'&&unit.weaponMode!=='melee'&&unit.loaded>0&&!unit.jammed&&!unit.mounted&&!unit.knockedDown&&!unit.entangled&&unit.stance!=='prone'){
  const costs=actionCosts(state,{...unit,stance:'prone',weaponReady:false},target);
  const lowered={...unit,stance:'prone',weaponReady:false};
  const aim=Math.min(4,Math.floor((unit.ap-stanceCost(unit,'prone')-costs.fire)/costs.aim));
  if(aim>=2&&canSee(state,lowered,target)&&firearmShotOptions(state,lowered,target,aim).some(option=>option.chance>=25))return {type:'stance',unitId:unit.id,stance:'prone'};
 }
 const contact=state.units.some(other=>other.side!==unit.side&&other.hp>0&&!other.departure&&!other.surrendered&&!other.unconscious&&canSee(state,unit,other));
 const known=unit.lastKnownEnemy??unit.lastHeardNoise,age=state.turn-(known?.turn??-Infinity);
 const order=contact||age>=0&&age<=3?chooseEnemyAction(state,unit):combatOrder(state,unit);
 if(order?.type!=='move')return order;
 // The autonomous policy uses personal sight. Player squad control must also
 // respect occupancy reported by teammates before confirming its destination.
 const view={...state,units:state.units.filter(other=>other.side===unit.side||teamCanSee(state,unit.side,other))};
 const reachable=getReachable(view,unit);
 if(reachable.some(p=>sameCell(p,order)))return order;
 const distance=p=>Math.hypot(p.x-order.x,p.y-order.y);
 const options=reachable.filter(p=>sameSurface(p,order)&&p.cost>0&&p.cost<=Math.min(24,unit.ap)&&distance(p)<distance(unit));
 options.sort((a,b)=>distance(a)-distance(b)||a.cost-b.cost||a.y-b.y||a.x-b.x);
 return options.length?{type:'move',unitId:unit.id,...spacePoint(options[0])}:null;
}
