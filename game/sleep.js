import {worldOwner,worldCell} from './world-cells.js';
import {sleepRecovery} from './sleep-needs.js';
import {recoverFatigue,maximumEnergy,needsCollapseRecovery} from './fatigue.js';
import {operativeInTransit,operativeLocation} from './squads.js';

// Period-game rates on the existing 0–100 fatigue/energy scale.
export const SLEEP_FATIGUE=80;
export const SLEEP_ENERGY=10;
export const SLEEP_ISSUE_TEXT={sleep_started:'Se durmió por agotamiento. Su asignación queda suspendida.',sleep_collapsed:'Cayó dormido por agotamiento. Necesita recuperar al menos 60 de capacidad de energía antes de despertar.',sleep_complete:'Terminó de dormir y puede retomar su asignación.',sleep_disturbed:'Se despertó porque el sector ya no permite descansar.'};
const deployed=(s,id)=>s.pendingBattle?.squad?.some(u=>Number(u.id)===id);
const available=(s,id)=>s.recruited.includes(id)&&s.operativeState[id]?.alive&&!s.operativeState[id].captured&&!deployed(s,id)&&!operativeInTransit(s,id);
const safe=(s,id,context={})=>available(s,id)&&!(context.traveling??[]).includes(id)&&!(context.unsafe??[]).includes(id)&&['patriot','neutral'].includes(worldOwner(s,operativeLocation(s,id)))&&s.pendingBattle?.sector!==operativeLocation(s,id)&&!s.enemyGroups?.some(g=>['waiting','engaged','stationed'].includes(g.status)&&(g.target===operativeLocation(s,id)||g.target===worldCell(operativeLocation(s,id))?.locality));
export function sleepOrderReason(s,id,asleep){
 const r=s.operativeState[id];
 if(typeof asleep!=='boolean')return 'Indicá si debe dormir o despertar.';
 if(!available(s,id))return 'El combatiente no está disponible para esta orden.';
 if(asleep===Boolean(r.asleep))return asleep?'Ya está durmiendo.':'Ya está despierto.';
 if(!asleep)return needsCollapseRecovery(r)||maximumEnergy(r)<=10?'El agotamiento impide despertar. Necesita al menos 60 de capacidad de energía.':'';
 if(!safe(s,id))return 'Dormir requiere un sector seguro.';
 if(r.hp<15)return 'Está en estado crítico: necesita atención médica.';
 if(r.energy>=100&&r.fatigue===0)return 'No está cansado.';
 return '';
}
export function setSleep(s,id,asleep){const reason=sleepOrderReason(s,id,asleep);if(reason)throw Error(reason);const r=s.operativeState[id];r.asleep=asleep;if(asleep&&maximumEnergy(r)<=10)r.sleepCollapsed=true;}

export function prepareSleep(s,roster,context={}){
 const events=[];
 for(const op of roster){
  const r=s.operativeState[op.id];if(!r)continue;
  if(r.sleepCollapsed&&!needsCollapseRecovery(r))r.sleepCollapsed=false;
  if(!available(s,op.id)){r.asleep=false;if(!s.recruited.includes(op.id)||!r.alive||r.captured)r.sleepCollapsed=false;continue;}
  if(r.asleep&&!safe(s,op.id,context)){r.asleep=false;events.push({id:op.id,code:'sleep_disturbed'});continue;}
  if(!safe(s,op.id,context)||r.hp<15||r.bleeding)continue;
  // Finish the stage before collapsing. A paused onward route retains its path;
  // a hostile arrival still takes precedence over strategic sleep.
  const stopped=s.squads?.some(q=>q.members.includes(op.id)&&q.journey?.status==='paused'&&q.journey.reason==='exhausted')||(context.stoppedTravel??[]).includes(op.id);
  const collapse=maximumEnergy(r)<=10||stopped&&r.fatigue>=SLEEP_FATIGUE;
  const newCollapse=collapse&&!r.sleepCollapsed;if(collapse)r.sleepCollapsed=true;
  // Patients and deliberately resting soldiers already have a recovery job.
  if(newCollapse||!r.asleep&&(needsCollapseRecovery(r)||!['rest','patient'].includes(r.assignment)&&(r.energy<=SLEEP_ENERGY||r.fatigue>=SLEEP_FATIGUE))){
   r.asleep=true;events.push({id:op.id,code:newCollapse?'sleep_collapsed':'sleep_started'});
  }
 }
 return events;
}
export function finishSleepHour(s,roster,context={}){
 const events=[];
 for(const op of roster){
  const r=s.operativeState[op.id];if(!r||!safe(s,op.id,context))continue;
  if(r.asleep){
   // Medical care already applies this hour's rest recovery to these roles.
   if(!['rest','patient'].includes(r.assignment)){const rate=sleepRecovery({...op,...r});recoverFatigue(r,rate.fatigue,rate.energy);}
   if(r.energy>=100&&r.fatigue===0){r.asleep=false;events.push({id:op.id,code:'sleep_complete'});}
  }else if(r.assignment==='active'&&!(context.working??[]).includes(op.id)&&!s.militiaTraining?.some(t=>t.trainerId===op.id)&&r.hp>=15&&!r.bleeding){
   recoverFatigue(r,1,3);
  }
 }
 return [...events,...prepareSleep(s,roster,context)];
}
export function sleepStatus(r){const rate=sleepRecovery(r);return r.asleep?(needsCollapseRecovery(r)?'Durmiendo por agotamiento · no puede despertar hasta recuperar 60 de capacidad de energía. ':'Durmiendo · ')+ `+${rate.energy} energía/h · −${rate.fatigue} fatiga/h. Retoma su asignación al recuperarse.`:'Despierto';}
