import {actBattle,getReachable,movementStepCost,stanceCost,teamCanSee,approachCompleted} from './tactical.js';
import {movementStance} from './tactical-condition.js';
import {sameCell,tacticalLevel,surfaceAt} from './tactical-space.js';

const point=p=>({x:p.x,y:p.y,...(p.tacticalLevel===undefined?{}:{tacticalLevel:p.tacticalLevel}),...(p.kind?{kind:p.kind}:{}),...(p.linkId?{linkId:p.linkId}:{})});
const ready=u=>u&&u.side==='player'&&!u.militia&&!u.departure&&!u.routed&&!u.surrendered&&!u.unconscious&&u.hp>=15&&u.energy>0;
const stopped=state=>({state,continuation:null,status:'stopped'});
function reject(state,reason){const next=structuredClone(state);next.lastError=reason;next.log=[...(next.log??[]),reason].slice(-80);return stopped(next);}

/** Commit one reached cell. The remaining route is a plan, never paid state.
 * Every step still passes through the ordinary movement/visibility/clock rules.
 * Callers discard the continuation whenever the destination or gait changes.
 */
export function movementStep(state,action,continuation=null){
 if(action?.type!=='move')return reject(state,'La marcha necesita una orden de movimiento.');
 const unit=state.units.find(u=>u.id===String(action.unitId));
 if(!ready(unit)||state.deployment||state.status!=='active'||!['player','interrupt'].includes(state.phase)||unit.equipmentCursor)return reject(state,'El combatiente no puede marchar ahora.');
 if(action.movement!==undefined&&!['walk','run','crouch','prone'].includes(action.movement))return reject(state,'Forma de desplazamiento inválida.');
 const destination={x:action.x,y:action.y,tacticalLevel:action.tacticalLevel??tacticalLevel(unit)};
 if(!Number.isInteger(destination.x)||!Number.isInteger(destination.y)||!surfaceAt(state,destination))return reject(state,'El destino está fuera del sector.');
 if(sameCell(unit,destination))return {state,continuation:null,status:'completed'};
 const stance=action.movement?movementStance(action.movement):unit.stance;
 const plannedUnit=action.movement?{...unit,movementMode:action.movement,stance,ap:state.mode==='exploration'?unit.ap:Math.max(0,unit.ap-stanceCost(unit,stance))}:unit;
 let route;
 if(continuation!==undefined&&continuation!==null){
  if(!Array.isArray(continuation)||!continuation.length||continuation.length>state.tiles.length+(state.upperSurfaces?.length??0)||!continuation.every(p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&surfaceAt(state,p))||!sameCell(continuation.at(-1),destination))return reject(state,'La ruta de marcha ya no corresponde al destino.');
  route=continuation;
 }else{
  const observed=p=>teamCanSee(state,unit.side,p);
  const planning={...state,units:state.units.filter(v=>v.side===unit.side||observed(v)).map(v=>v.id===unit.id?plannedUnit:v),npcs:(state.npcs??[]).filter(observed)};
  route=getReachable(planning,plannedUnit,{movementIntent:action.movementIntent,stopAt:p=>sameCell(p,destination)})[0]?.path;
 }
 if(!route?.length)return reject(state,'Destino inaccesible o puntos de acción insuficientes.');
 const first=point(route[0]),cost=movementStepCost(state,plannedUnit,unit,first,{movementIntent:action.movementIntent});
 if(!Number.isFinite(cost))return reject(state,'La ruta de marcha está bloqueada.');
 if(state.mode!=='exploration'&&cost>plannedUnit.ap)return reject(state,'Faltan puntos de acción para continuar la marcha.');
 const next=actBattle(state,{...action,...first,type:'move'}, {cost,path:[first]});
 const actor=next.units.find(u=>u.id===unit.id);
 if(next.lastError)return stopped(next);
 // Keep one readable line for an uninterrupted exploration march. Intervening
 // civilian, contact or other events retain their original journal entries.
 if(continuation&&state.mode==='exploration'){
  const prefix=`${unit.name} avanza `,suffix=' casillas.',previous=state.log.at(-1),line=next.log.at(-1);
  if(previous?.startsWith(prefix)&&previous.endsWith(suffix)&&line===`${prefix}1${suffix}`){
   const count=Number(previous.slice(prefix.length,-suffix.length)),index=next.log.length-2;
   if(Number.isInteger(count)&&next.log[index]===previous){next.log.splice(index,2,`${prefix}${count+1}${suffix}`);}
  }
 }
 if(!ready(actor)||!approachCompleted(state,next,unit.id,{destination:first})||next.turn!==state.turn||next.status!=='active')return stopped(next);
 if(sameCell(actor,destination))return {state:next,continuation:null,status:'completed'};
 return {state:next,continuation:route.slice(1).map(point),status:'moving'};
}
