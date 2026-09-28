import {militiaCarePatients} from './garrison.js';
import {refreshMilitaryCondition} from './actor-condition.js';
import {careRules,DEFAULT_CARE_RULES,strategicBleedingPercent} from './campaign-care-rules.js';
import {restRecovery,recoverAtRest} from './strategic-rest.js';
import {operativeLocation} from './squads.js';
import {worldOwner} from './world-cells.js';
import {workshopAccessReason} from './workshop-service.js';

// Bounded integration of strategic doctor/patient work. Tactical first aid,
// automatic sleep and civilian care retain separate integrations.
export const CARE_ASSIGNMENTS=Object.freeze({active:'En servicio',doctor:'Médico',militia_doctor:'Médico de milicias',patient:'Paciente',rest:'Descanso'});
export const careAssignmentBusy=value=>value!=='active'&&Object.hasOwn(CARE_ASSIGNMENTS,value);
const medicalAssignment=value=>value==='doctor'||value==='militia_doctor';
export const MEDICAL_SUPPLY_PRICE=DEFAULT_CARE_RULES.dressingPrice;
export const doctorRate=(op,s)=>careRules(s).baseHealing+Math.floor((op.medical??0)/careRules(s).skillStep);
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
 if(!safe(s,op.id))return 'La atención y el descanso necesitan un sector bajo control patriota y sin combate.';
 if(medicalAssignment(value)){
  const r=s.operativeState[op.id];
  if((op.medical??0)<careRules(s).minimumSkill)return `Necesita al menos ${careRules(s).minimumSkill} de medicina.`;
  if(r.hp<15||r.bleeding>0||(r.energy??100)<=10)return 'El médico debe estar estable y tener más de 10 de energía.';
  if((r.medkits??2)<1)return 'El médico no tiene vendas.';
 }
 return '';
}
export function assignMedicalCare(s,op,value){const reason=careAssignmentReason(s,op,value);need(!reason,reason);const r=s.operativeState[op.id];if(r.assignment!==value&&r.recoveryHours!==undefined)r.recoveryHours=0;r.assignment=value;}
const present=(s,op,traveling)=>available(s,op.id)&&safe(s,op.id)&&!traveling.includes(op.id)&&!s.militiaTraining?.some(c=>c.trainerId===op.id);
export function advanceMedicalCare(s,roster,{traveling=[]}={}){
 const patients=roster.filter(o=>present(s,o,traveling)&&assignment(s,o.id)==='patient'&&needsCare(s,o)).sort((a,b)=>{
  const x=s.operativeState[a.id],y=s.operativeState[b.id];return Number(y.bleeding>0)-Number(x.bleeding>0)||x.hp/a.maxHp-y.hp/b.maxHp||a.id-b.id;
 });
 const treated=new Set();
 for(const doctor of roster.filter(o=>present(s,o,traveling)&&assignment(s,o.id)==='doctor'&&!careAssignmentReason(s,o,'doctor'))){
  const patient=patients.find(o=>o.id!==doctor.id&&!treated.has(o.id)&&operativeLocation(s,o.id)===operativeLocation(s,doctor.id));if(!patient)continue;
  const medic=s.operativeState[doctor.id],r=s.operativeState[patient.id];medic.medkits=(medic.medkits??2)-1;medic.energy=Math.max(0,(medic.energy??100)-careRules(s).energyCost);medic.fatigue=Math.min(100,(medic.fatigue??0)+careRules(s).fatigueCost);treated.add(patient.id);
  if(r.bleeding>0)r.bleeding=0;
  else r.hp=Math.min(patient.maxHp,r.hp+doctorRate(doctor,s));
  if(r.bandaged!==undefined)r.bandaged=Math.min(r.bandaged,patient.maxHp-r.hp);
 }
 for(const doctor of roster.filter(o=>present(s,o,traveling)&&assignment(s,o.id)==='militia_doctor'&&!careAssignmentReason(s,o,'militia_doctor'))){
  const patient=militiaCarePatients(s,operativeLocation(s,doctor.id)).find(u=>!treated.has(u.id));if(!patient)continue;
  const medic=s.operativeState[doctor.id];medic.medkits=(medic.medkits??2)-1;medic.energy=Math.max(0,(medic.energy??100)-careRules(s).energyCost);medic.fatigue=Math.min(100,(medic.fatigue??0)+careRules(s).fatigueCost);treated.add(patient.id);
  if(patient.bleeding>0)patient.bleeding=0;else patient.hp=Math.min(patient.maxHp,patient.hp+doctorRate(doctor,s));
  if(patient.bandaged!==undefined)patient.bandaged=Math.min(patient.bandaged,patient.maxHp-patient.hp);
  recoverAtRest(patient,patient,{state:s});refreshMilitaryCondition(patient);
 }
 for(const op of roster){const r=s.operativeState[op.id];if(!['patient','rest'].includes(r.assignment))continue;
  if(!present(s,op,traveling)){if(r.recoveryHours!==undefined)r.recoveryHours=0;continue;}
  recoverAtRest(r,op,{heal:r.assignment==='rest',state:s});
 }
 return [...treated];
}
// Strategic medical work runs first at each hour boundary. The active tactical
// scene owns deployed wounds; unjoined arrivals, former service and custody do
// not receive another simulation here.
export function advanceMilitaryWounds(s,roster){
 const deaths=[],percent=strategicBleedingPercent(s);
 for(const op of roster){
  const r=s.operativeState[op.id];if(!available(s,op.id)||!r.bleeding)continue;
  r.hp=Math.max(0,r.hp-Math.ceil(r.bleeding*percent/100));
  if(r.recoveryHours!==undefined)r.recoveryHours=0;
  if(r.hp>0)continue;
  Object.assign(r,{alive:false,bleeding:0,energy:0,assignment:'active',recoveryHours:0,deathMinute:s.hour*60+Math.floor((s.secondOfHour??0)/60)});
  deaths.push(op.id);
 }
 return deaths;
}
export function careStatus(s,op,roster){
 const r=s.operativeState[op.id],role=assignment(s,op.id);if(!r?.alive)return 'Caído en servicio.';
 if(role==='active')return r.bleeding>0?`Hemorragia sin atender: pierde ${Math.ceil(r.bleeding*strategicBleedingPercent(s)/100)} de salud por hora fuera del combate.`:'Disponible para marchar y combatir.';
 const reason=careAssignmentReason(s,op,role);if(reason)return reason;
 if(role==='rest'){
  const rate=restRecovery(op,r,s),recovery=`+${rate.energy} energía/h · −${rate.fatigue} fatiga/h.`;
  if(r.bleeding>0)return `${recovery} El descanso no detiene la hemorragia: necesita un médico.`;
  if(r.hp<15)return `${recovery} Estado crítico: necesita un médico para recuperar salud.`;
  if(!needsCare(s,op)&&(r.energy??100)>=100&&(r.fatigue??0)===0)return 'Descanso completo. Puede volver al servicio.';
  return `${recovery}${r.hp<op.maxHp?` +1 salud cada ${careRules(s).restHealingHours} h (${r.recoveryHours??0}/${careRules(s).restHealingHours}).`:''}`;
 }
 if(role==='militia_doctor'){
  const patients=militiaCarePatients(s,operativeLocation(s,op.id));
  return patients.length?`${patients.length} ${patients.length===1?'miliciano herido':'milicianos heridos'} en esta celda. Atiende a uno por hora; primero detiene la hemorragia. Cada atención consume una venda.`:'Sin milicianos heridos en esta celda. No consume vendas.';
 }
 if(role==='doctor'){
  const patients=roster.filter(o=>o.id!==op.id&&present(s,o,[])&&assignment(s,o.id)==='patient'&&operativeLocation(s,o.id)===operativeLocation(s,op.id)&&needsCare(s,o));
  return patients.length?`Hasta ${doctorRate(op,s)} salud por hora; una venda, ${careRules(s).energyCost} de energía y ${careRules(s).fatigueCost} de fatiga por hora de atención.`:'Sin pacientes heridos asignados en este sector.';
 }
 if(!needsCare(s,op))return 'Recuperado. Puede volver al servicio.';
 const doctor=roster.find(o=>o.id!==op.id&&present(s,o,[])&&assignment(s,o.id)==='doctor'&&!careAssignmentReason(s,o,'doctor')&&operativeLocation(s,o.id)===operativeLocation(s,op.id));
 return doctor?`En atención con ${doctor.nickname??doctor.name}. La hemorragia se atiende primero.`:'Sin médico disponible en este sector. Solo recupera energía y reduce fatiga.';
}
export function medicalSupplyQuote(s,op,quantity,supplied){
 const cost=quantity*careRules(s).dressingPrice;
 const reason=!op||!available(s,op.id)?'El combatiente no está disponible.':!Number.isInteger(quantity)||quantity<1||quantity>20?'Elegí entre 1 y 20 vendas.':(s.operativeState[op.id].medkits??2)+quantity>1000?'No puede llevar más de 1000 vendas.':workshopAccessReason(s,op,supplied)||(s.resources.treasury<cost?'No hay suficientes pesos.':'');
 return {cost,reason,available:!reason};
}
export function validateMedicalCare(s,roster){
 for(const op of roster){const r=s.operativeState[op.id];if(r.recoveryHours!==undefined)need(Number.isInteger(r.recoveryHours)&&r.recoveryHours>=0&&r.recoveryHours<careRules(s).restHealingHours&&(r.recoveryHours===0||r.assignment==='rest'),'El descanso guardado es inválido.');if(r.assignment===undefined)continue;need(Object.hasOwn(CARE_ASSIGNMENTS,r.assignment),'La asignación médica guardada es inválida.');
  if(r.assignment==='active')continue;
  need(s.recruited.includes(op.id)&&r.alive&&r.hp>0&&!deployed(s,op.id)&&!s.militiaTraining.some(c=>c.trainerId===op.id),'La asignación médica es incompatible con el servicio.');
  if(medicalAssignment(r.assignment))need(op.medical>=careRules(s).minimumSkill,'La asignación necesita conocimientos médicos.');
 }
}
