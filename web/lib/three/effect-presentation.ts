import {absoluteBodyHeight} from '../../../game/sight-geometry.js';
import {surfaceHeight} from '../../../game/tactical-space.js';
import type {CombatEffectEvent,EffectPoint} from './combat-effects';

type LocalEffect={id:number;startedAt:number;visual:any}|null;
const point=(p:any):EffectPoint=>({x:p?.x,y:p?.y,height:p?.height,...(p?.tacticalLevel===undefined?{}:{tacticalLevel:p.tacticalLevel}),...(p?.fraction===undefined?{}:{fraction:p.fraction})});
const landing=(state:any,p:any)=>({x:p?.x,y:p?.y,tacticalLevel:p?.tacticalLevel??0,elevation:surfaceHeight(state,p)??NaN});
const finite=(p:any)=>p&&[p.x,p.y,p.height].every(Number.isFinite);

/** Copy only already admitted presentation records. The renderer gets no roster or private trajectory. */
export function presentCombatEffects(state:any,frame:any,knife:LocalEffect=null,grenade:LocalEffect=null):readonly CombatEffectEvent[]{
 const events:CombatEffectEvent[]=[],base=`${frame?.sequenceId??'local'}:${frame?.index??0}`,startedAtSeconds=(frame?.startedAt??0)/1000;
 const shot=frame?.shotVisual;
 if(shot?.visible&&finite(shot.source)&&finite(shot.impact)&&['projectile','impact'].includes(frame.type))events.push({id:`${base}:firearm`,kind:'firearm',stage:frame.type,startedAtSeconds,...(frame.unitId?{actorKey:`unit:${frame.unitId}`} :{}),...(frame.durationMs>0?{durationSeconds:frame.durationMs/1000}:{}),visual:{visible:true,source:point(shot.source),impact:point(shot.impact),outcome:shot.outcome??null,...(shot.material?{material:shot.material}:{}),...(shot.spread===undefined?{}:{spread:Boolean(shot.spread)}),...(shot.discharge===false?{discharge:false}:{}),...(['primary','offhand'].includes(shot.shotHand)?{shotHand:shot.shotHand}:{}),...(typeof shot.shotId==='string'||typeof shot.shotId==='number'?{shotId:shot.shotId}:{})}});
 const thrown=frame?.knifeVisual?{id:`${base}:knife`,startedAt:frame.startedAt,visual:frame.knifeVisual}:knife?{...knife,id:`local:knife:${knife.id}`}:null;
 if(thrown?.visual?.visible){const v=thrown.visual,source={...point(v.source),height:v.source?.height??absoluteBodyHeight(state,{...v.source,stance:'standing'},'muzzle')};if(finite(source)&&finite(v.impact))events.push({id:thrown.id,kind:'knife',startedAtSeconds:thrown.startedAt/1000,durationSeconds:.6,visual:{visible:true,source,impact:point(v.impact),weapon:v.weapon}});}
 const bomb=frame?.grenadeEffect?{...frame.grenadeEffect,id:`${frame.sequenceId}:grenade:${frame.grenadeEffect.id}`}:grenade?{...grenade,id:`local:grenade:${grenade.id}`}:null;
 if(bomb?.visual?.visible){const v=bomb.visual,ground=landing(state,v.landing);if(finite(v.source)&&finite(v.impact)&&Number.isFinite(ground.elevation)&&Array.isArray(v.points)&&v.points.length>=2&&v.points.length<=256&&v.points.every(finite))events.push({id:bomb.id,kind:'grenade',startedAtSeconds:bomb.startedAt/1000,durationSeconds:1.2,visual:{visible:true,source:point(v.source),impact:point(v.impact),landing:ground,points:v.points.map(point),radius:v.radius,detonated:Boolean(v.detonated)}});}
 const cannon=frame?.artilleryVisual;
 if(cannon?.visible&&finite(cannon.source))events.push({id:`${base}:artillery`,kind:'artillery',...(cannon.cannonId?{cannonId:cannon.cannonId}:{}),stage:['projectile','impact'].includes(frame.type)?frame.type:'effect',startedAtSeconds,...(frame.durationMs>0?{durationSeconds:frame.durationMs/1000}:{}),visual:{visible:true,source:point(cannon.source),...(cannon.impact?{impact:point(cannon.impact)}:{}),...(Array.isArray(cannon.points)?{points:cannon.points.map(point)}:{}),...(Array.isArray(cannon.impacts)?{impacts:cannon.impacts.map((p:any)=>({...point(p),outcome:p.outcome??null,...(p.material?{material:p.material}:{})}))}:{}),...(cannon.canister?{canister:true}:{}),...(cannon.discharge===false?{discharge:false}:{})}});
 return events;
}
