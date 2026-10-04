// Presentation timing is in milliseconds. It never changes simulation time.
import {spriteOrderPose} from './sprite-order-pose.js';
export const BATTLE_PLAYBACK=Object.freeze({step:210,prepare:420,action:300,impact:900,effect:600});
export function battleFramePose(frame){return frame.type==='prepare'||frame.type==='step'||frame.performed===false?'idle':spriteOrderPose(frame.action);}
const attacks=new Set(['fire','firePoint','melee','meleePoint','charge','artillery','throwKnife','throwGrenade','useItem']);
export function battleFrameDuration(frame){
 if(frame.type==='step')return BATTLE_PLAYBACK.step;
 if(frame.type==='effect')return BATTLE_PLAYBACK.effect;
 if(frame.type==='prepare')return attacks.has(frame.action)?BATTLE_PLAYBACK.prepare:BATTLE_PLAYBACK.action;
 if(frame.impacts?.length)return BATTLE_PLAYBACK.impact;
 return attacks.has(frame.action)?BATTLE_PLAYBACK.effect:frame.action==='move'||frame.action==='climb'?0:BATTLE_PLAYBACK.action;
}
// Only already-observed actors and targets enter the camera calculation.
export function battleFrameFocus(frame){
 const actor=frame.unitId?frame.state.units.find(u=>u.id===frame.unitId):null;
 const target=frame.impacts?.[0]??frame.targetPoint;
 if(!actor)return target?{id:target.unitId??target.id,x:target.x,y:target.y,tacticalLevel:target.tacticalLevel}:null;
 if(target&&target.tacticalLevel===actor.tacticalLevel)return {id:actor.id,x:(actor.x+target.x)/2,y:(actor.y+target.y)/2,tacticalLevel:actor.tacticalLevel};
 return {id:actor.id,x:actor.x,y:actor.y,tacticalLevel:actor.tacticalLevel};
}
