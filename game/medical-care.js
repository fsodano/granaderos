import {operativeLocation} from './squads.js';
import {WORK_ASSIGNMENTS} from './assignments.js';
import {sleepStatus} from './sleep.js';
import {baseMorale} from './morale.js';

export const CARE_ASSIGNMENTS={active:'En servicio',doctor:'Médico',patient:'Paciente',rest:'Descanso'};
export const ALL_ASSIGNMENTS={...CARE_ASSIGNMENTS,...WORK_ASSIGNMENTS};
export const MEDICAL_KIT_PRICE=30;
export const REST_HEALING_HOURS=6;
const requireThat=(value,message)=>{if(!value)throw Error(message);};
const deployed=(s,id)=>Boolean(s.pendingBattle?.squad?.some(u=>Number(u.id)===Number(id)));
const training=(s,id)=>Boolean(s.militiaTraining?.some(t=>t.trainerId===id));
const safe=(s,id)=>s.sectors[operativeLocation(s,id)]?.owner==='patriot'&&s.pendingBattle?.sector!==operativeLocation(s,id);
export const doctorRate=op=>2+Math.floor((op.medical??0)/20);
export const CARE_ISSUE_TEXT={invalid_assignment:'La asignación no existe.',unavailable:'El combatiente no está disponible.',deployed:'El combatiente está desplegado en el sector táctico.',militia_busy:'Suspendé primero su instrucción de milicias.',unsafe:'La atención y el descanso necesitan un sector seguro.',no_medical_skill:'Necesita al menos 20 de medicina.',unstable:'El médico necesita estar estable y tener más de 10 de energía.',no_medkits:'El médico no tiene botiquines.',healing_complete:'Recuperado. Puede volver al servicio.',no_patients:'Sin pacientes heridos asignados en este sector.',no_doctor:'Sin médico disponible en este sector. Solo recupera energía.',bleeding:'El descanso no detiene la hemorragia. Necesita un médico.',critical:'Estado crítico: necesita un médico para recuperar salud.',sleeping:'Está durmiendo; retomará su tarea al despertar.',rest_complete:'El descanso terminó: salud y energía recuperadas, sin fatiga.'};
const issue=code=>({code,reason:CARE_ISSUE_TEXT[code]});

// Old campaigns already restored health outside combat. Keep their existing wounds
// stable, but give every subsequent deployment the same finite personal supplies.
export function migrateMedicalCare(s,roster){
  for(const op of roster){
    const record=s.operativeState[op.id];if(!record)continue;
    if(record.maxHp===undefined)record.maxHp=op.maxHp;
    if(record.bleeding===undefined)record.bleeding=0;
    if(record.bandaged===undefined)record.bandaged=record.bleeding?0:Math.max(0,record.maxHp-record.hp);
    if(record.energy===undefined)record.energy=100;
    if(record.asleep===undefined)record.asleep=false;
    if(record.medkits===undefined)record.medkits=2;
    if(record.assignment===undefined)record.assignment='active';
    if(record.recoveryHours===undefined)record.recoveryHours=0;
  }
  return s;
}

export function careAssignmentIssue(s,op,assignment){
  const record=s.operativeState[op.id];
  if(!Object.hasOwn(CARE_ASSIGNMENTS,assignment))return issue('invalid_assignment');
  if(!s.recruited.includes(op.id)||!record?.alive||record.hp<=0)return issue('unavailable');
  if(deployed(s,op.id))return issue('deployed');
  if(training(s,op.id))return issue('militia_busy');
  if(assignment==='active')return null;
  if(!safe(s,op.id))return issue('unsafe');
  if(assignment==='doctor'){
    if(record.asleep)return issue('sleeping');
    if((op.medical??0)<20)return issue('no_medical_skill');
    if(record.hp<15||record.bleeding>0||record.energy<=10)return issue('unstable');
    if(record.medkits<1)return issue('no_medkits');
  }
  return null;
}
export function careAssignmentReason(s,op,assignment){return careAssignmentIssue(s,op,assignment)?.reason??'';}

function carePresent(s,op,context={}){return s.recruited.includes(op.id)&&s.operativeState[op.id]?.alive&&!deployed(s,op.id)&&!(context.traveling??[]).includes(op.id)&&!(context.unsafe??[]).includes(op.id)&&(!training(s,op.id)||s.operativeState[op.id].asleep)&&safe(s,op.id);}
const needsCare=r=>r.bleeding>0||r.hp<r.maxHp;
export function careAssignmentProgress(s,op,roster,context={}){
  const r=s.operativeState[op.id],status=(state,code=null)=>({state,code});
  if((context.unsafe??[]).includes(op.id))return status('blocked','unsafe');
  if((context.traveling??[]).includes(op.id)||r.asleep)return status('waiting');
  if(r.assignment==='patient'&&!needsCare(r))return status('complete','healing_complete');
  if(r.assignment==='rest'&&!needsCare(r)&&r.energy>=100&&(r.fatigue??0)<=0&&(r.morale??baseMorale(op))>=baseMorale(op))return status('complete','rest_complete');
  const problem=careAssignmentIssue(s,op,r.assignment);
  if(r.assignment==='doctor'){
    // Completing the final patient's care takes precedence over an empty kit.
    const patients=roster.filter(o=>o.id!==op.id&&carePresent(s,o,context)&&s.operativeState[o.id].assignment==='patient'&&operativeLocation(s,o.id)===operativeLocation(s,op.id)&&needsCare(s.operativeState[o.id]));
    if(!patients.length&&(!problem||problem.code==='no_medkits'))return status('blocked','no_patients');
  }
  if(problem)return status('blocked',problem.code);
  if(r.assignment==='patient'){
    const doctor=roster.some(o=>o.id!==op.id&&carePresent(s,o,context)&&s.operativeState[o.id].assignment==='doctor'&&!careAssignmentIssue(s,o,'doctor')&&operativeLocation(s,o.id)===operativeLocation(s,op.id));
    return doctor?status('waiting'):status('blocked','no_doctor');
  }
  if(r.assignment==='rest'){
    if(r.bleeding>0)return status('blocked','bleeding');
    if(r.hp<15)return status('blocked','critical');
  }
  return status('working');
}

export function assignMedicalCare(s,op,assignment){
  const reason=careAssignmentReason(s,op,assignment);requireThat(!reason,reason);
  const record=s.operativeState[op.id];
  if(record.assignment!==assignment)record.recoveryHours=0;
  record.assignment=assignment;
}

export function careStatus(s,op,roster){
  const record=s.operativeState[op.id],assignment=record.assignment??'active';
  if(!record.alive)return 'Caído en servicio.';
  if(deployed(s,op.id))return 'Desplegado en el sector táctico.';
  if(record.asleep)return sleepStatus(record);
  if(training(s,op.id))return 'Instruyendo milicias.';
  if(assignment==='active')return record.bleeding?'Hemorragia sin atender: necesita un médico.':'Disponible para marchar y combatir.';
  if(!safe(s,op.id))return 'Asignación detenida: el sector no es seguro.';
  if(assignment==='doctor'){
    const reason=careAssignmentReason(s,op,'doctor');if(reason)return `Atención detenida: ${reason}`;
    if(!roster.some(o=>o.id!==op.id&&s.recruited.includes(o.id)&&s.operativeState[o.id]?.alive&&s.operativeState[o.id].assignment==='patient'&&operativeLocation(s,o.id)===operativeLocation(s,op.id)&&(s.operativeState[o.id].hp<s.operativeState[o.id].maxHp||s.operativeState[o.id].bleeding>0)))return 'Sin pacientes heridos asignados en este sector.';
    return `Hasta ${doctorRate(op)} salud/h · 1 botiquín/h de atención.`;
  }
  if(assignment==='patient'){
    if(record.hp>=record.maxHp&&!record.bleeding)return 'Recuperado. Puede volver al servicio.';
    const doctor=roster.find(o=>o.id!==op.id&&s.operativeState[o.id]?.assignment==='doctor'&&!careAssignmentReason(s,o,'doctor')&&operativeLocation(s,o.id)===operativeLocation(s,op.id));
    return doctor?`En atención con ${doctor.nickname??doctor.name}. Las hemorragias tienen prioridad.`:'Sin médico disponible en este sector. Solo recupera energía.';
  }
  return record.bleeding?'El descanso no detiene la hemorragia. Necesita un médico.':record.hp<15?'Estado crítico: necesita un médico para recuperar salud.':`+12 energía/h · +1 salud cada ${REST_HEALING_HOURS} h de descanso.`;
}

export function advanceMedicalCare(s,roster,{traveling=[]}={}){
  const treated=new Set(),deaths=[];
  const present=op=>carePresent(s,op,{traveling});
  const patients=roster.filter(op=>present(op)&&s.operativeState[op.id].assignment==='patient').sort((a,b)=>{
    const left=s.operativeState[a.id],right=s.operativeState[b.id];
    return Number(right.bleeding>0)-Number(left.bleeding>0)||left.hp/left.maxHp-right.hp/right.maxHp||a.id-b.id;
  });
  for(const doctor of roster.filter(op=>present(op)&&s.operativeState[op.id].assignment==='doctor'&&!careAssignmentReason(s,op,'doctor'))){
    const patient=patients.find(op=>op.id!==doctor.id&&!treated.has(op.id)&&operativeLocation(s,op.id)===operativeLocation(s,doctor.id)&&(s.operativeState[op.id].bleeding>0||s.operativeState[op.id].hp<s.operativeState[op.id].maxHp));
    if(!patient)continue;
    const medic=s.operativeState[doctor.id],record=s.operativeState[patient.id];
    medic.medkits--;medic.energy=Math.max(0,medic.energy-3);medic.fatigue=Math.min(100,medic.fatigue+2);treated.add(patient.id);
    if(record.bleeding>0){record.bleeding=0;record.bandaged=record.maxHp-record.hp;}
    else {record.hp=Math.min(record.maxHp,record.hp+doctorRate(doctor));record.bandaged=Math.min(record.bandaged,record.maxHp-record.hp);}
  }
  for(const op of roster){
    const record=s.operativeState[op.id];if(!s.recruited.includes(op.id)||!record?.alive||deployed(s,op.id))continue;
    // An unbandaged wound keeps bleeding during strategic time, including travel.
    if(record.bleeding>0){record.hp=Math.max(0,record.hp-Math.max(1,Math.ceil(record.bleeding/4)));record.recoveryHours=0;}
    if(record.hp===0){record.alive=false;record.asleep=false;record.assignment='active';record.recoveryHours=0;deaths.push(op.id);continue;}
    if(!present(op)){record.recoveryHours=0;continue;}
    if(record.assignment==='patient'||record.assignment==='rest'||record.asleep){
      if(!record.asleep||['patient','rest'].includes(record.assignment)){record.energy=Math.min(100,record.energy+12);record.fatigue=Math.max(0,record.fatigue-8);}
      if((record.assignment==='rest'||record.asleep&&record.assignment!=='patient')&&!record.bleeding&&record.hp>=15&&record.hp<record.maxHp){
        record.recoveryHours++;
        if(record.recoveryHours>=REST_HEALING_HOURS){record.hp=Math.min(record.maxHp,record.hp+1);record.bandaged=Math.min(record.bandaged,record.maxHp-record.hp);record.recoveryHours=0;}
      }else record.recoveryHours=0;
    }else record.recoveryHours=0;
  }
  return deaths;
}

export function returnMedicalCare(s,id,report,op){
  const record=s.operativeState[id],maxHp=report.maxHp??record.maxHp??op.maxHp;
  requireThat(Number.isInteger(maxHp)&&maxHp>0&&maxHp<=op.maxHp,'La salud máxima del parte es inválida.');
  requireThat(record.alive||!(report.hp>0),'Un combatiente caído no puede volver al servicio.');
  requireThat(Number.isInteger(report.hp)&&report.hp>=0&&report.hp<=maxHp,'Las heridas del parte son inválidas.');
  const bleeding=report.bleeding??record.bleeding??0;
  const bandaged=report.bandaged??Math.min(record.bandaged??0,maxHp-report.hp);
  requireThat(Number.isFinite(bleeding)&&bleeding>=0&&bleeding<=100,'La hemorragia del parte es inválida.');
  requireThat(Number.isFinite(bandaged)&&bandaged>=0&&bandaged<=maxHp-report.hp,'Las vendas del parte son inválidas.');
  if(report.medkits!==undefined)requireThat(Number.isInteger(report.medkits)&&report.medkits>=0&&report.medkits<=100000,'Los botiquines del parte son inválidos.');
  Object.assign(record,{maxHp,hp:report.hp,bleeding,bandaged,alive:report.hp>0,recoveryHours:0});
  if(report.medkits!==undefined)record.medkits=report.medkits;
  if(!record.alive){record.assignment='active';record.asleep=false;}
}

export function validateMedicalCare(s,roster){
  migrateMedicalCare(s,roster);
  for(const op of roster){
    const r=s.operativeState[op.id];requireThat(r,'Falta una hoja de servicio.');
    requireThat(typeof r.asleep==='boolean'&&(!r.asleep||s.recruited.includes(op.id)&&r.alive&&!r.captured&&!deployed(s,op.id)),'El estado de sueño guardado es inválido.');
    requireThat(Number.isInteger(r.maxHp)&&r.maxHp>0&&r.maxHp<=op.maxHp&&r.hp<=r.maxHp,'La salud máxima guardada es inválida.');
    requireThat(Number.isFinite(r.bleeding)&&r.bleeding>=0&&r.bleeding<=100&&Number.isFinite(r.bandaged)&&r.bandaged>=0&&r.bandaged<=r.maxHp-r.hp,'Las heridas guardadas son inválidas.');
    requireThat(Number.isInteger(r.medkits)&&r.medkits>=0&&r.medkits<=100000,'Los botiquines guardados son inválidos.');
    requireThat(Object.hasOwn(ALL_ASSIGNMENTS,r.assignment)&&Number.isInteger(r.recoveryHours)&&r.recoveryHours>=0&&r.recoveryHours<REST_HEALING_HOURS,'Las asignaciones guardadas son inválidas.');
    requireThat(r.assignment==='active'||(s.recruited.includes(op.id)&&r.alive&&!deployed(s,op.id)&&!training(s,op.id)),'El combatiente tiene asignaciones incompatibles.');
    requireThat(r.assignment!=='doctor'||(op.medical??0)>=20,'La asignación médica guardada es inválida.');
  }
}
