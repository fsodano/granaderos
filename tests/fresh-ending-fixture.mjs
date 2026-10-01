import assert from 'node:assert/strict';
import {rosterFor} from '../game/campaign.js';
import {order,saved} from './local-contract-fixture.mjs';
import {freshCuyoRoute} from './fresh-cuyo-fixture.mjs';
import {finishCreatedCoast,finishCreatedNorthernReturn,finishCreatedFinalCapitalReturn} from './created-ending-route.mjs';

// Use ordinary local work and finite dressings before the retained force moves.
export function stabilizeBeforeMarch(s){
 const care={hours:0,dressingsUsed:0,dressingsBought:0,cost:0};
 while(true){
  const roster=rosterFor(s).filter(o=>s.squad.includes(o.id)),patients=roster.filter(o=>s.operativeState[o.id].bleeding||s.operativeState[o.id].hp<15);
  if(!patients.length)break;assert.ok(care.hours<24,'urgent care must finish through finite hourly work');
  const doctors=roster.filter(o=>!patients.includes(o)&&o.medical>=20&&(s.operativeState[o.id].energy??100)>10).sort((a,b)=>Number((s.operativeState[b.id].medkits??2)>0)-Number((s.operativeState[a.id].medkits??2)>0)||b.medical-a.medical).slice(0,patients.length);assert.ok(doctors.length,'a stable local doctor is required before the march');
  for(const o of roster)s=order(s,{type:'assignCare',id:o.id,assignment:'active'});
  const stocks=new Map();for(const doctor of doctors){
   if(!s.operativeState[doctor.id].medkits){const money=s.resources.treasury;s=order(s,{type:'purchaseMedicalSupplies',id:doctor.id,quantity:1});care.cost+=money-s.resources.treasury;care.dressingsBought++;}
   stocks.set(doctor.id,s.operativeState[doctor.id].medkits);s=order(s,{type:'assignCare',id:doctor.id,assignment:'doctor'});
  }
  for(const patient of patients)s=order(s,{type:'assignCare',id:patient.id,assignment:'patient'});
  s=saved({campaign:order(s,{type:'wait',hours:1})}).campaign;care.hours++;
  for(const doctor of doctors){assert.equal(s.operativeState[doctor.id].medkits,stocks.get(doctor.id)-1);care.dressingsUsed++;}
 }
 for(const id of s.squad)s=order(s,{type:'assignCare',id,assignment:'active'});
 assert.equal(care.cost,care.dressingsBought*10);return {campaign:s,care};
}

export function freshHistoricalEnding(options){return finishHistoricalFromCuyo(freshCuyoRoute(),options);}
export function finishHistoricalFromCuyo(prefix,options){
 const coast=finishCreatedCoast(prefix,options);
 const north=finishCreatedNorthernReturn(coast,options);
 return finishCreatedFinalCapitalReturn(north,options);
}
