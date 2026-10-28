import {CRITICAL_HEALTH} from './actor-condition.js';
import {sameSurface} from './tactical-space.js';

// Explicit Granaderos tuning. Fear adds ordinary shock; it does not change
// experience, action points, health, morale, equipment or random draws.
export const NERVOUS_ISOLATION_SHOCK=2;
export const NERVOUS_ISOLATION_RADIUS=4;
export const NERVOUS_ISOLATION_MORALE=50;
const capable=unit=>Boolean(unit&&Number.isFinite(unit.hp)&&unit.hp>=CRITICAL_HEALTH&&
 (unit.energy??100)>0&&!unit.unconscious&&!unit.asleep&&!unit.knockedDown&&
 !unit.routed&&!unit.fled&&!unit.captured&&!unit.captive&&!unit.bound&&!unit.detained&&
 !unit.entangled&&!unit.departure&&!unit.surrendered&&Number.isFinite(unit.x)&&Number.isFinite(unit.y));
const owned=unit=>Number.isSafeInteger(Number(unit?.id))&&Number(unit.id)>=0&&String(Number(unit.id))===String(unit.id);

// Pure public status. Only actual own military bodies can supply support;
// hidden enemies, civilian NPCs and remembered contacts are never inspected.
// `addedShock` uses the supplied current shock. A next-turn forecast supplies
// shock/2, because the existing turn boundary performs recovery first.
export function nervousIsolationStatus(state,unit){
 const result=(eligible,active,reason,addedShock=0)=>({eligible,active,reason,addedShock});
 if(!Array.isArray(unit?.abilities)||!unit.abilities.includes('nervous_isolation'))return result(false,false,'ability');
 if(unit.side!=='player'||unit.militia||unit.missionAlly||!owned(unit)||!capable(unit)||
    !Number.isFinite(unit.morale)||unit.morale<0||unit.morale>100||
    !Number.isFinite(unit.shock??0)||(unit.shock??0)<0||(unit.shock??0)>20)return result(false,false,'incapable');
 if(unit.morale>=NERVOUS_ISOLATION_MORALE)return result(true,false,'morale');
 const companion=(state?.units??[]).some(other=>String(other.id)!==String(unit.id)&&other.side===unit.side&&
  capable(other)&&sameSurface(other,unit)&&Math.hypot(other.x-unit.x,other.y-unit.y)<=NERVOUS_ISOLATION_RADIUS);
 if(companion)return result(true,false,'companion');
 return result(true,true,'isolated',Math.min(NERVOUS_ISOLATION_SHOCK,20-(unit.shock??0)));
}

// Call only after the ordinary shock decay at a real new player combat turn.
// The caller owns the one-time named notice, not the eligibility rule.
export function applyNervousIsolation(state,unit){
 if(state?.mode!=='combat'||state.status!=='active')return 0;
 const added=nervousIsolationStatus(state,unit).addedShock;
 if(added>0)unit.shock=(unit.shock??0)+added;
 return added;
}
