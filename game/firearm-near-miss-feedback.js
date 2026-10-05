import {CRITICAL_HEALTH} from './actor-condition.js';
import {firearmPassesNear} from './firearm-near-passage.js';

// These receipts are transport/presentation evidence, never saved battle fields.
const results=new WeakMap(),consumedFrames=new WeakSet();let collecting=null;
const capable=unit=>unit?.side==='player'&&unit.hp>=CRITICAL_HEALTH&&(unit.energy??100)>0&&!['unconscious','knockedDown','routed','bound','captured','entangled','surrendered','departure','fled'].some(key=>unit[key]);
const contacted=(flight,id)=>[...(flight.bodyImpacts??[]),...(flight.victimId!=null?[flight]:[])].some(hit=>[(hit.victimKind??'unit')==='unit'&&String(hit.victimId)===id,(hit.actualVictimKind??hit.victimKind??'unit')==='unit'&&String(hit.actualVictimId??hit.victimId)===id].some(Boolean));

export function captureFirearmNearMissFeedback(before,execute){
 if(collecting)return execute();
 const current={before,ids:new Set(),presented:false,consumed:false};collecting=current;
 try{const after=execute();if(current.ids.size&&after!==before)results.set(after,current);return after;}finally{collecting=null;}
}
export function recordFirearmNearMissFeedback(state,{source,attacker=source,weapon,flight,damagedBodies,discharged}={},emit){
 if(discharged!==true||!['player','enemy'].includes(source?.side)||!state.units?.includes(source)||attacker?.side!==source.side||!weapon||![weapon.fireAP,weapon.range,weapon.capacity].every(value=>Number.isFinite(value)&&value>0)||!(damagedBodies instanceof Set))return [];
 const flights=flight?.shotLoad?flight.pellets?.map(pellet=>pellet.flight):flight?[flight]:[];
 if(!flights?.length)return [];
 const ids=state.units.filter(unit=>unit!==source&&capable(unit)&&!damagedBodies.has(`unit:${unit.id}`)&&!flights.some(ray=>contacted(ray,unit.id))&&flights.some(ray=>firearmPassesNear(state,attacker,unit,ray))).map(unit=>unit.id);
 for(const id of ids)collecting?.ids.add(id);
 if(ids.length)emit?.(ids);
 return ids;
}
export function getFirearmNearMissFeedback(before,after){
 const receipt=results.get(after);return before!==after&&receipt?.before===before?[...receipt.ids]:[];
}
export function markFirearmNearMissPresented(after){const receipt=results.get(after);if(receipt)receipt.presented=true;}
export function consumeFirearmNearMissFeedback(before,after,frame){
 if(frame){
  // The worker transports admitted own IDs. Rendering the same frame again,
  // including a silent sparse event, cannot backfill another quote.
  if(frame.type!=='impact'||frame.state?.units!==after.units||!Array.isArray(frame.nearMissIds)||consumedFrames.has(frame))return [];
  consumedFrames.add(frame);
  return [...new Set(frame.nearMissIds)].filter(id=>typeof id==='string'&&after.units.some(unit=>unit.id===id&&capable(unit)));
 }
 const receipt=results.get(after);
 if(!receipt||receipt.before!==before||receipt.presented||receipt.consumed||before===after)return [];
 receipt.consumed=true;return [...receipt.ids];
}
