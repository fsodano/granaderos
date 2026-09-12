import {canSee,teamCanSee,getReachable} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {combatOrder} from './opening-driver.mjs';

// After contact, use the game's existing shot, cover, medical aid and memory
// evaluation. Retain opening reconnaissance only while no current or recent
// contact is available. A null combat choice means hold, not a forced advance.
export function cautiousCombatOrder(state,unit){
 const contact=state.units.some(other=>other.side!==unit.side&&other.hp>0&&!other.departure&&!other.surrendered&&!other.unconscious&&canSee(state,unit,other));
 const known=unit.lastKnownEnemy??unit.lastHeardNoise,age=state.turn-(known?.turn??-Infinity);
 const order=contact||age>=0&&age<=3?chooseEnemyAction(state,unit):combatOrder(state,unit);
 if(order?.type!=='move')return order;
 // The autonomous policy uses personal sight. Player squad control must also
 // respect occupancy reported by teammates before confirming its destination.
 const view={...state,units:state.units.filter(other=>other.side===unit.side||teamCanSee(state,unit.side,other))};
 const reachable=getReachable(view,unit);
 if(reachable.some(p=>p.x===order.x&&p.y===order.y))return order;
 const distance=p=>Math.hypot(p.x-order.x,p.y-order.y);
 const options=reachable.filter(p=>p.cost>0&&p.cost<=Math.min(24,unit.ap)&&distance(p)<distance(unit));
 options.sort((a,b)=>distance(a)-distance(b)||a.cost-b.cost||a.y-b.y||a.x-b.x);
 return options.length?{type:'move',unitId:unit.id,x:options[0].x,y:options[0].y}:null;
}
