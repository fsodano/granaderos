import {operativeLocation} from './squads.js';
import {worldOwner} from './world-cells.js';
import {hasWorkshop} from './campaign-headquarters.js';

// Bounded integration of strategic doctor/patient work. Tactical first aid,
// sleep, militia care and unloaded bleeding retain their separate integrations.
export const CARE_ASSIGNMENTS=Object.freeze({active:'En servicio',doctor:'Médico',patient:'Paciente'});
export const MEDICAL_SUPPLY_PRICE=10;
export const doctorRate=op=>2+Math.floor((op.medical??0)/20);
const need=(ok,message)=>{if(!ok)throw Error(message);};
const deployed=(s,id)=>Boolean(s.pendingBattle?.squad.some(u=>Number(u.id)===id));
const available=(s,id)=>s.recruited.includes(id)&&s.operativeState[id]?.alive&&s.operativeState[id].hp>0&&!s.operativeState[id].captured&&!deployed(s,id);
const safe=(s,id)=>worldOwner(s,operativeLocation(s,id))==='patriot'&&s.pendingBattle?.sector!==operativeLocation(s,id);
const assignment=(s,id)=>s.operativeState[id]?.assignment??'active';
const needsCare=(s,op)=>s.operativeState[op.id].bleeding>0||s.operativeState[op.id].hp<op.maxHp;
export function careAssignmentReason(s,op,value){
 if(!Object.hasOwn(CARE_ASSIGNMENTS,value))return 'La asignación no existe.';
 if(!op||!available(s,op.id))return 'El combatiente no está disponible.';
 if(value==='active')return '';
 if(s.militiaTraining?.some(c=>c.trainerId===op.id))return 'Suspendé primero la instrucción de milicias.';
 if(!safe(s,op.id))return 'La atención necesita un sector bajo control patriota y sin combate.';
 if(value==='doctor'){
  const r=s.operativeState[op.id];
  if((op.medical??0)<20)return 'Necesita al menos 20 de medicina.';
  if(r.hp<15||r.bleeding>0||(r.energy??100)<=10)return 'El médico debe estar estable y tener más de 10 de energía.';
  if((r.medkits??2)<1)return 'El médico no tiene vendas.';
 }
 return '';
}
export function assignMedicalCare(s,op,value){const reason=careAssignmentReason(s,op,value);need(!reason,reason);s.operativeState[op.id].assignment=value;}
const present=(s,op,traveling)=>available(s,op.id)&&safe(s,op.id)&&!traveling.includes(op.id)&&!s.militiaTraining?.some(c=>c.trainerId===op.id);
export function advanceMedicalCare(s,roster,{traveling=[]}={}){
 const patients=roster.filter(o=>present(s,o,traveling)&&assignment(s,o.id)==='patient'&&needsCare(s,o)).sort((a,b)=>{
  const x=s.operativeState[a.id],y=s.operativeState[b.id];return Number(y.bleeding>0)-Number(x.bleeding>0)||x.hp/a.maxHp-y.hp/b.maxHp||a.id-b.id;
 });
 const treated=new Set();
 for(const doctor of roster.filter(o=>present(s,o,traveling)&&assignment(s,o.id)==='doctor'&&!careAssignmentReason(s,o,'doctor'))){
  const patient=patients.find(o=>o.id!==doctor.id&&!treated.has(o.id)&&operativeLocation(s,o.id)===operativeLocation(s,doctor.id));if(!patient)continue;
  const medic=s.operativeState[doctor.id],r=s.operativeState[patient.id];medic.medkits=(medic.medkits??2)-1;medic.energy=Math.max(0,(medic.energy??100)-3);medic.fatigue=Math.min(100,(medic.fatigue??0)+2);treated.add(patient.id);
  if(r.bleeding>0)r.bleeding=0;
  else r.hp=Math.min(patient.maxHp,r.hp+doctorRate(doctor));
  if(r.bandaged!==undefined)r.bandaged=Math.min(r.bandaged,patient.maxHp-r.hp);
 }
 return [...treated];
}
export function careStatus(s,op,roster){
 const r=s.operativeState[op.id],role=assignment(s,op.id);if(!r?.alive)return 'Caído en servicio.';
 if(role==='active')return 'Disponible para marchar y combatir.';
 const reason=careAssignmentReason(s,op,role);if(reason)return reason;
 if(role==='doctor'){
  const patients=roster.filter(o=>o.id!==op.id&&present(s,o,[])&&assignment(s,o.id)==='patient'&&operativeLocation(s,o.id)===operativeLocation(s,op.id)&&needsCare(s,o));
  return patients.length?`Hasta ${doctorRate(op)} salud por hora; una venda por hora de atención.`:'Sin pacientes heridos asignados en este sector.';
 }
 if(!needsCare(s,op))return 'Recuperado. Puede volver al servicio.';
 const doctor=roster.find(o=>o.id!==op.id&&present(s,o,[])&&assignment(s,o.id)==='doctor'&&!careAssignmentReason(s,o,'doctor')&&operativeLocation(s,o.id)===operativeLocation(s,op.id));
 return doctor?`En atención con ${doctor.nickname??doctor.name}. La hemorragia se atiende primero.`:'Sin médico disponible en este sector.';
}
export function medicalSupplyQuote(s,op,quantity,supplied){
 const cost=quantity*MEDICAL_SUPPLY_PRICE;
 const reason=!op||!available(s,op.id)?'El combatiente no está disponible.':!Number.isInteger(quantity)||quantity<1||quantity>20?'Elegí entre 1 y 20 vendas.':(s.operativeState[op.id].medkits??2)+quantity>1000?'No puede llevar más de 1000 vendas.':operativeLocation(s,op.id)!==s.location||!safe(s,op.id)||!hasWorkshop(s,s.location)||!supplied?'El combatiente debe estar en el taller controlado y abastecido.':s.resources.treasury<cost?'No hay suficientes pesos.':'';
 return {cost,reason,available:!reason};
}
export function validateMedicalCare(s,roster){
 for(const op of roster){const r=s.operativeState[op.id];if(r.assignment===undefined)continue;need(Object.hasOwn(CARE_ASSIGNMENTS,r.assignment),'La asignación médica guardada es inválida.');
  if(r.assignment==='active')continue;
  need(s.recruited.includes(op.id)&&r.alive&&r.hp>0&&!deployed(s,op.id)&&!s.militiaTraining.some(c=>c.trainerId===op.id),'La asignación médica es incompatible con el servicio.');
  if(r.assignment==='doctor')need(op.medical>=20,'La asignación necesita conocimientos médicos.');
 }
}
