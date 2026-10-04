import {canSee,weaponFor} from './tactical.js';
import {speechFor} from './characters.js';
import {TRAINING_LABELS} from './skill-training.js';
import {COMPANION_GRIEF_MORALE} from './companion-grief.js';
const griefLossFormat=new Intl.NumberFormat('es-AR',{maximumFractionDigits:2});
export function tacticalFeedback(before,after){
 const messages=[];
 // Only a newly admitted receipt can announce grief. Loading an existing
 // receipt or rendering the same state does not discover another death.
 for(const unit of after.units.filter(u=>u.side==='player')){
  const old=before.units.find(u=>u.id===unit.id);if(!old)continue;
  const received=new Set((old.companionGrief??[]).map(entry=>entry.companionId));
  for(const receipt of unit.companionGrief??[]){
   if(received.has(receipt.companionId))continue;
   received.add(receipt.companionId);
   const companion=after.units.find(other=>other.side==='player'&&Number(other.id)===receipt.companionId&&other.hp===0);
   if(!companion||!Number.isSafeInteger(receipt.companionId)||!Number.isFinite(receipt.loss)||receipt.loss<0||receipt.loss>COMPANION_GRIEF_MORALE)continue;
   const effect=receipt.loss===0?'Moral sin cambio.':receipt.loss<.01?'Moral baja menos de 0,01.':`Moral −${griefLossFormat.format(receipt.loss)}.`;
   messages.push(`${unit.name} lamenta la muerte de ${companion.name}. ${effect}`);
  }
 }
 for(const unit of after.units.filter(u=>u.side==='player')){
  const old=before.units.find(u=>u.id===unit.id);if(!old)continue;
  if(unit.nervousIsolationWarned===true&&old.nervousIsolationWarned===undefined&&
     !unit.militia&&!unit.missionAlly&&Number.isSafeInteger(Number(unit.id))&&Number(unit.id)>=0&&
     String(Number(unit.id))===unit.id&&Array.isArray(unit.abilities)&&unit.abilities.includes('nervous_isolation')){
   messages.push(`${unit.name} siente temor al quedar sin apoyo.`);
  }
 }
 for(const unit of after.units.filter(u=>u.side==='player')){
  const old=before.units.find(u=>u.id===unit.id);if(!old)continue;
  for(const [skill,label]of Object.entries(TRAINING_LABELS)){const gain=(unit.trainedStats?.[skill]??0)-(old.trainedStats?.[skill]??0);if(gain>0)messages.push(`${unit.nickname||unit.name}: ${label} +${gain}`);}
  if(unit.jammed&&!old.jammed)messages.push(`${unit.nickname||unit.name}: ${weaponFor({...unit,activeSlot:'primary'}).name} atascada. Volvé a cebar la cazoleta.`);
  if(unit.offHand?.jammed&&!old.offHand?.jammed)messages.push(`${unit.nickname||unit.name}: ${weaponFor({...unit,...unit.offHand,activeSlot:'primary'}).name} atascada en la segunda mano.`);
 }
 return messages;
}
// Chatter uses authored personality lines. A UI cooldown and a sparse event
// choice prevent one quote for every hit, contact or interrupt.
export function contextualBanter(before,after,eventNumber=0){
 const players=after.units.filter(u=>u.side==='player'&&u.hp>0&&!u.unconscious),enemies=after.units.filter(u=>u.side==='enemy'&&u.hp>0&&!u.departure&&!u.fled);
 const wounded=players.find(u=>{const old=before.units.find(v=>v.id===u.id);return old&&u.hp<old.hp;});
 const contact=players.find(u=>{const old=before.units.find(v=>v.id===u.id);return old&&enemies.some(e=>canSee(after,u,e)&&!canSee(before,old,before.units.find(v=>v.id===e.id)??e));});
 const near=players.find(u=>enemies.some(e=>e.lastTargetId===u.id&&e.loaded<(before.units.find(v=>v.id===e.id)?.loaded??e.loaded)));
 const interrupt=after.phase==='interrupt'&&before.phase!=='interrupt'?players.find(u=>after.interrupt?.unitIds.includes(u.id)):null;
 const event=wounded?'wounded':contact?'contact':near?'near':interrupt?'interrupt':null,unit=wounded??contact??near??interrupt;
 if(!event||!unit||event!=='contact'&&eventNumber%3!==0)return null;
 const text=speechFor(unit,event==='near'||event==='interrupt'?'contact':event);
 return text?{id:unit.id,name:unit.nickname||unit.name,x:unit.x,y:unit.y,tacticalLevel:unit.tacticalLevel,text}:null;
}
