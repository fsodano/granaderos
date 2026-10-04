import {canSee,weaponFor} from './tactical.js';
import {speechFor} from './characters.js';
import {TRAINING_LABELS} from './skill-training.js';
export function tacticalFeedback(before,after){
 const messages=[];
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
