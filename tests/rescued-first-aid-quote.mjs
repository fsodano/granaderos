import assert from 'node:assert/strict';
import {criticalFirstAidNeeded,firstAidPlan} from '../game/first-aid.js';

// Quote only wound work. One prospective dressing lets the Native pure plan
// price each stroke; it never adds a dressing or applies care to an operative.
export function quoteRescuerFirstAid(rawDoctor,patients){
 const doctor={
  id:rawDoctor.id,medical:rawDoctor.medical??rawDoctor.stats?.medical??30,
  dexterity:rawDoctor.dexterity??rawDoctor.stats?.dexterity??75,
  experienceLevel:rawDoctor.experienceLevel??rawDoctor.stats?.experienceLevel??Math.min(10,4+Math.floor((rawDoctor.xp??0)/100)),
  medkits:1,
 };
 const quotes=patients.map(raw=>{
  let patient={id:raw.id,maxHp:raw.maxHp??raw.health??raw.stats?.health??100,hp:raw.hp??raw.health??raw.stats?.health??100,bleeding:raw.bleeding??0,bandaged:raw.bandaged};
  assert.ok(patient.hp>0,'first aid can quote only an actual living rescuer');
  const before={...patient},strokes=[];
  while(criticalFirstAidNeeded(patient)||patient.bleeding>0){
   const plan=firstAidPlan(doctor,patient);
   assert.ok(plan.valid,`actual physician cannot quote rescuer ${patient.id}: ${plan.reason}`);
   assert.ok(plan.hpAfter>patient.hp||plan.bleedingAfter<patient.bleeding,'each quoted Native stroke must advance the wound');
   strokes.push(plan);
   patient={...patient,hp:plan.hpAfter,bleeding:plan.bleedingAfter,bandaged:plan.bandagedAfter};
  }
  return {id:raw.id,before,after:patient,strokes,dressings:strokes.reduce((sum,plan)=>sum+plan.dressingsUsed,0)};
 });
 return {physician:doctor,patients:quotes,dressings:quotes.reduce((sum,quote)=>sum+quote.dressings,0)};
}
