import {operativeLocation} from './squads.js';
import {TRAINABLE_SKILLS,practice} from './skill-training.js';
import {WEAPONS} from './data.js';
import {militiaEligibility} from './militia.js';
import {repairEquipmentQueue,repairEquipment,repairEquipmentBlocked} from './equipment-repair.js';
export {repairEquipmentQueue} from './equipment-repair.js';

export const WORK_ASSIGNMENTS={practice:'Práctica individual',instructor:'Instructor',student:'Alumno',repair:'Reparación'};
export const STUDY_SKILLS={agility:'Agilidad',stealth:'Sigilo',marksmanship:'Puntería',medical:'Medicina',mechanical:'Mecánica',ridingSkill:'Equitación'};
export const TOOLKIT_PRICE=120;
export const TOOLKIT_POINTS=100;
const need=(condition,message)=>{if(!condition)throw Error(message);};
const deployed=(s,id)=>Boolean(s.pendingBattle?.squad?.some(u=>Number(u.id)===Number(id)));
const firearm=op=>(WEAPONS[op.weapon]?.capacity??0)>0;
const trainingRoles=['practice','instructor','student'];

export function migrateAssignments(s,roster){
  for(const op of roster){const r=s.operativeState[op.id];if(!r)continue;
    if(r.toolkitPoints===undefined)r.toolkitPoints=0;
    if(r.trainingCredit===undefined)r.trainingCredit=0;
  }
  return s;
}

export const WORK_ISSUE_TEXT={
  invalid_assignment:'La asignación no existe.',unavailable:'El combatiente no está disponible.',deployed:'El combatiente está desplegado.',militia_busy:'Suspendé primero la instrucción de milicias.',unsafe:'La asignación necesita un sector seguro.',unstable:'Necesita estar estable y tener más de 10 de energía.',invalid_skill:'Elegí una habilidad para practicar.',zero_skill:'Una habilidad en cero no se puede aprender mediante práctica.',training_complete:'Ya alcanzó el límite de práctica de esa habilidad.',missing_instructor:'Elegí un instructor distinto del alumno.',instructor_unavailable:'El instructor debe estar disponible en el mismo sector.',instructor_assignment:'El instructor debe enseñar esta misma habilidad.',instructor_skill:'El instructor debe superar la habilidad del alumno.',instructor_busy:'El instructor ya tiene un alumno asignado.',no_mechanical_skill:'Necesita conocimientos de mecánica.',no_tools:'No quedan puntos de herramientas.',target_unavailable:'El equipo debe estar con un combatiente presente en este sector.',target_not_firearm:'El combatiente no lleva un arma de fuego reparable.',target_changed:'El arma asignada ya no está equipada.',repair_complete:'El equipo asignado ya está en perfecto estado.',invalid_repair_scope:'Elegí el equipo llevado o el arma principal.',repair_pack_full:'Retirá una entrada de la mochila para separar el equipo apilado.',no_students:'No hay un alumno disponible para esta habilidad en el mismo sector.',militia_trainer_unavailable:'El instructor de milicias debe estar vivo y presente en este sector.',militia_supply:'La instrucción de milicias necesita abastecimiento.',militia_rural:'Las milicias se instruyen en ciudades, no en pasos rurales.',militia_control:'La ciudad debe estar bajo control patriota.',militia_loyalty:'La ciudad no tiene suficiente lealtad para instruir milicias.',militia_cancelled:'La ocupación enemiga dispersó el curso de milicias.',militia_complete:'El curso de milicias terminó.',
};
const issue=code=>({code,reason:WORK_ISSUE_TEXT[code]});
function availabilityIssue(s,op){
  const r=s.operativeState[op.id],location=operativeLocation(s,op.id);
  if(!s.recruited.includes(op.id)||!r?.alive||r.hp<=0||r.captured)return issue('unavailable');
  if(deployed(s,op.id))return issue('deployed');
  if(s.militiaTraining?.some(t=>t.trainerId===op.id))return issue('militia_busy');
  if(s.sectors[location]?.owner!=='patriot'||s.pendingBattle?.sector===location)return issue('unsafe');
  if(r.hp<15||r.bleeding>0||r.energy<=10)return issue('unstable');
  return null;
}

// The guide describes progressively slower practice at high skill and faster
// learning with a better teacher. Credit uses integers to survive save/reload.
export function studyRate(op,skill,instructor=null){
  const value=op[skill]??0;
  const hours=value<=45?24:value<=60?48:value<=75?240:360;
  const wisdom=.6+(op.wisdom??50)/125;
  const teaching=instructor?(value<=60?1.5:2+Math.min(3,Math.max(0,((instructor[skill]??0)-value)/10)))+(instructor.traits?.includes('teacher')?.5:0):1;
  return Math.max(1,Math.round(40000/hours*wisdom*teaching));
}
export const repairRate=op=>1+Math.floor((op.mechanical??0)/15);

const repairScope=(r,options={})=>options.repairScope??r.repairScope??'primary';
const savedOptions=r=>({skill:r.trainingSkill,instructorId:r.instructorId,targetId:r.repairTargetId,weaponId:r.repairWeaponId,repairScope:r.repairScope});
const repairComplete=(s,target,scope)=>scope==='equipment'?repairEquipmentQueue(s.operativeState[target.id],target).length===0:(s.operativeState[target.id].condition??100)>=100;
const trainingComplete=(r,op,skill)=>(r.trainedStats?.[skill]??0)>=10||(op[skill]??0)>=100;
function repairTargetIssue(s,op,options,roster){
  const r=s.operativeState[op.id],target=roster.find(o=>o.id===Number(options.targetId??r.repairTargetId??op.id));
  if(!target||!s.recruited.includes(target.id)||!s.operativeState[target.id]?.alive||s.operativeState[target.id]?.captured||deployed(s,target.id)||operativeLocation(s,target.id)!==operativeLocation(s,op.id))return issue('target_unavailable');
  if(!['primary','equipment'].includes(repairScope(r,options)))return issue('invalid_repair_scope');
  if(repairScope(r,options)==='equipment')return null;
  if(!firearm(target)||s.operativeState[target.id].weaponDropped)return issue('target_not_firearm');
  if(options.weaponId!==undefined&&target.weapon!==options.weaponId)return issue('target_changed');
  return null;
}
export function workAssignmentIssue(s,op,assignment,options={},roster=[]){
  if(!Object.hasOwn(WORK_ASSIGNMENTS,assignment))return issue('invalid_assignment');
  const unavailable=availabilityIssue(s,op);if(unavailable)return unavailable;
  const r=s.operativeState[op.id],skill=options.skill??r.trainingSkill;
  if(trainingRoles.includes(assignment)){
    if(!TRAINABLE_SKILLS.includes(skill))return issue('invalid_skill');
    if((op[skill]??0)<=0)return issue('zero_skill');
    if(assignment!=='instructor'&&trainingComplete(r,op,skill))return issue('training_complete');
    if(assignment==='student'){
      const teacher=roster.find(o=>o.id===Number(options.instructorId??r.instructorId));
      if(!teacher||teacher.id===op.id)return issue('missing_instructor');
      if(availabilityIssue(s,teacher)||operativeLocation(s,teacher.id)!==operativeLocation(s,op.id))return issue('instructor_unavailable');
      const teacherRecord=s.operativeState[teacher.id];
      if(teacherRecord.assignment!=='instructor'||teacherRecord.trainingSkill!==skill)return issue('instructor_assignment');
      if((teacher[skill]??0)<=(op[skill]??0))return issue('instructor_skill');
      if(roster.some(o=>o.id!==op.id&&s.recruited.includes(o.id)&&s.operativeState[o.id]?.alive&&s.operativeState[o.id].assignment==='student'&&s.operativeState[o.id].instructorId===teacher.id))return issue('instructor_busy');
    }
  }else{
    if((op.mechanical??0)<=0)return issue('no_mechanical_skill');
    if(r.toolkitPoints<=0)return issue('no_tools');
    const targetIssue=repairTargetIssue(s,op,options,roster);if(targetIssue)return targetIssue;
    const target=roster.find(o=>o.id===Number(options.targetId??r.repairTargetId??op.id));
    if(repairComplete(s,target,repairScope(r,options)))return issue('repair_complete');
    if(repairScope(r,options)==='equipment'&&repairEquipmentBlocked(s.operativeState[target.id],target))return issue('repair_pack_full');
  }
  return null;
}
export function workAssignmentReason(s,op,assignment,options={},roster=[]){return workAssignmentIssue(s,op,assignment,options,roster)?.reason??'';}

// Typed progress reuses the order rules, with completion taking precedence over
// a resource exhausted by the final successful working hour.
export function workAssignmentProgress(s,op,roster,context={}){
  const r=s.operativeState[op.id],options=savedOptions(r);
  const status=(state,code=null)=>({state,code});
  if((context.unsafe??[]).includes(op.id))return status('blocked','unsafe');
  if((context.traveling??[]).includes(op.id))return status('waiting');
  if(['practice','student'].includes(r.assignment)&&trainingComplete(r,op,r.trainingSkill))return status('complete','training_complete');
  if(r.assignment==='repair'&&!repairTargetIssue(s,op,options,roster)&&repairComplete(s,roster.find(o=>o.id===r.repairTargetId),repairScope(r)))return status('complete','repair_complete');
  const problem=workAssignmentIssue(s,op,r.assignment,options,roster);if(problem)return status(problem.code.endsWith('_complete')?'complete':'blocked',problem.code);
  if(r.assignment==='repair'){
    if((context.unsafe??[]).includes(r.repairTargetId))return status('blocked','target_unavailable');
    if((context.traveling??[]).includes(r.repairTargetId))return status('waiting');
  }
  if(r.assignment==='student'){
    if((context.unsafe??[]).includes(r.instructorId))return status('blocked','instructor_unavailable');
    if((context.traveling??[]).includes(r.instructorId))return status('waiting');
  }
  if(r.assignment==='instructor'){
    const students=roster.filter(o=>s.recruited.includes(o.id)&&s.operativeState[o.id]?.alive&&s.operativeState[o.id].assignment==='student'&&s.operativeState[o.id].instructorId===op.id);
    if(!students.some(o=>!workAssignmentIssue(s,o,'student',{},roster)&&!(context.unsafe??[]).includes(o.id)))return status('blocked','no_students');
    if(students.every(o=>(context.traveling??[]).includes(o.id)))return status('waiting');
  }
  return status('working');
}

export function militiaAssignmentIssue(s,course,{isSupplied}={}){
  if(s.sectors[course.sector]?.owner!=='patriot')return issue('militia_cancelled');
  if(deployed(s,course.trainerId)||!s.operativeState[course.trainerId]?.alive||operativeLocation(s,course.trainerId)!==course.sector)return issue('militia_trainer_unavailable');
  need(typeof isSupplied==='function','Falta la regla de abastecimiento para la instrucción.');
  if(!isSupplied(s,course.sector))return issue('militia_supply');
  const eligible=militiaEligibility(s,course.sector);
  return eligible.eligible?null:{code:`militia_${eligible.code}`,reason:eligible.reason};
}

export function assignWork(s,op,action,roster){
  const reason=workAssignmentReason(s,op,action.assignment,action,roster);need(!reason,reason);
  const r=s.operativeState[op.id];r.assignment=action.assignment;r.recoveryHours=0;
  if(trainingRoles.includes(action.assignment)){
    if(r.trainingSkill!==(action.skill??r.trainingSkill))r.trainingCredit=0;
    r.trainingSkill=action.skill??r.trainingSkill;
    if(action.assignment==='student')r.instructorId=Number(action.instructorId??r.instructorId);
    else delete r.instructorId;
    delete r.repairTargetId;delete r.repairWeaponId;delete r.repairScope;
  }else{
    r.repairTargetId=Number(action.targetId??r.repairTargetId??op.id);
    if(repairScope(r,action)==='equipment'){r.repairScope='equipment';delete r.repairWeaponId;}
    else{delete r.repairScope;r.repairWeaponId=roster.find(o=>o.id===r.repairTargetId).weapon;}
    delete r.trainingSkill;delete r.instructorId;
  }
}

function learn(r,op,skill,amount){
  const unit={...op,side:'player',trainedStats:{...r.trainedStats},skillPractice:{...r.skillPractice}};
  practice(unit,skill,amount);r.trainedStats=unit.trainedStats;r.skillPractice=unit.skillPractice;
}
const workCost=r=>{r.energy=Math.max(0,r.energy-3);r.fatigue=Math.min(100,r.fatigue+2);};

export function advanceAssignments(s,roster,{traveling=[]}={}){
  const moving=new Set(traveling),taught=new Set();
  for(const op of roster){
    const r=s.operativeState[op.id];if(!r||!Object.hasOwn(WORK_ASSIGNMENTS,r.assignment)||moving.has(op.id))continue;
    const options=savedOptions(r);
    if(workAssignmentReason(s,op,r.assignment,options,roster))continue;
    if(r.assignment==='instructor')continue;
    if(r.assignment==='repair'){
      if(moving.has(r.repairTargetId))continue;
      const target=s.operativeState[r.repairTargetId],budget=Math.min(repairRate(op),r.toolkitPoints);
      const points=repairScope(r)==='equipment'?repairEquipment(target,roster.find(o=>o.id===r.repairTargetId),budget):Math.min(budget,100-target.condition);
      if(points<=0)continue;
      if(repairScope(r)!=='equipment')target.condition+=points;
      r.toolkitPoints-=Math.ceil(points);learn(r,op,'mechanical',1);workCost(r);continue;
    }
    const instructor=r.assignment==='student'?roster.find(o=>o.id===r.instructorId):null;
    if(instructor&&(moving.has(instructor.id)||taught.has(instructor.id)))continue;
    const credit=r.trainingCredit+studyRate(op,r.trainingSkill,instructor),points=Math.floor(credit/1000);
    r.trainingCredit=credit%1000;if(points)learn(r,op,r.trainingSkill,points);workCost(r);
    if(instructor){workCost(s.operativeState[instructor.id]);taught.add(instructor.id);}
  }
}

export function workStatus(s,op,roster){
  const r=s.operativeState[op.id],reason=workAssignmentReason(s,op,r.assignment,savedOptions(r),roster);
  if(reason)return `Asignación detenida: ${reason}`;
  if(r.assignment==='repair'){const target=roster.find(o=>o.id===r.repairTargetId);const queue=repairScope(r)==='equipment'?repairEquipmentQueue(s.operativeState[target.id],target):null;return `${target.nickname}: ${queue?`${queue[0].label} · ${queue.reduce((sum,item)=>sum+item.count,0)} objetos pendientes. `:''}Hasta ${repairRate(op)} puntos/h. Cada punto consume 1 de herramientas.`;}
  if(r.assignment==='instructor')return roster.some(o=>s.recruited.includes(o.id)&&s.operativeState[o.id]?.assignment==='student'&&s.operativeState[o.id].instructorId===op.id)?`Enseña ${STUDY_SKILLS[r.trainingSkill].toLowerCase()} a su alumno.`:'Espera un alumno de esta habilidad en el mismo sector.';
  return `${STUDY_SKILLS[r.trainingSkill]}: ${r.skillPractice?.[r.trainingSkill]??0}/40 de práctica${r.assignment==='student'?` · instructor: ${roster.find(o=>o.id===r.instructorId)?.nickname}`:''}. Avanzá las horas para aprender.`;
}

export function validateAssignments(s,roster){
  migrateAssignments(s,roster);
  for(const op of roster){const r=s.operativeState[op.id];
    need(Number.isInteger(r.toolkitPoints)&&r.toolkitPoints>=0&&r.toolkitPoints<=100000,'Las herramientas guardadas son inválidas.');
    need(Number.isInteger(r.trainingCredit)&&r.trainingCredit>=0&&r.trainingCredit<1000,'La práctica fraccionaria guardada es inválida.');
    if(r.trainingSkill!==undefined)need(TRAINABLE_SKILLS.includes(r.trainingSkill),'La habilidad de estudio guardada es inválida.');
    if(r.instructorId!==undefined)need(Number.isInteger(r.instructorId)&&r.instructorId!==op.id&&roster.some(o=>o.id===r.instructorId),'El instructor guardado es inválido.');
    if(r.repairTargetId!==undefined)need(Number.isInteger(r.repairTargetId)&&roster.some(o=>o.id===r.repairTargetId),'El destinatario de la reparación es inválido.');
    if(r.repairScope!==undefined)need(r.repairScope==='equipment'&&r.repairWeaponId===undefined,'El alcance de la reparación es inválido.');
    if(r.repairWeaponId!==undefined)need(Number.isInteger(r.repairWeaponId)&&(WEAPONS[r.repairWeaponId]?.capacity??0)>0,'El arma a reparar es inválida.');
    if(trainingRoles.includes(r.assignment))need(TRAINABLE_SKILLS.includes(r.trainingSkill)&&(op[r.trainingSkill]??0)>0,'La asignación de estudio guardada es inválida.');
    if(r.assignment==='student')need(r.instructorId!==undefined,'Falta el instructor del alumno.');
    if(r.assignment==='repair')need(r.repairTargetId!==undefined&&(r.repairScope==='equipment'||r.repairWeaponId!==undefined)&&(op.mechanical??0)>0,'La reparación guardada es inválida.');
  }
  const teachers=roster.filter(o=>s.recruited.includes(o.id)&&s.operativeState[o.id]?.alive&&s.operativeState[o.id].assignment==='student').map(o=>s.operativeState[o.id].instructorId);
  need(new Set(teachers).size===teachers.length,'Un instructor no puede atender dos alumnos a la vez.');
}
