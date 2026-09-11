import {recoverFatigue} from './fatigue.js';
import {operativeInTransit,operativeLocation} from './squads.js';

// Period-game rates on the existing 0–100 fatigue/energy scale.
export const SLEEP_FATIGUE=80;
export const SLEEP_ENERGY=10;
export const SLEEP_ISSUE_TEXT={sleep_started:'Se durmió por agotamiento. Su asignación queda suspendida.',sleep_complete:'Terminó de dormir y puede retomar su asignación.',sleep_disturbed:'Se despertó porque el sector ya no permite descansar.'};
const deployed=(s,id)=>s.pendingBattle?.squad?.some(u=>Number(u.id)===id);
const available=(s,id)=>s.recruited.includes(id)&&s.operativeState[id]?.alive&&!s.operativeState[id].captured&&!deployed(s,id)&&!operativeInTransit(s,id);
const safe=(s,id,context={})=>available(s,id)&&!(context.traveling??[]).includes(id)&&!(context.unsafe??[]).includes(id)&&s.sectors[operativeLocation(s,id)]?.owner==='patriot'&&s.pendingBattle?.sector!==operativeLocation(s,id)&&!s.enemyGroups?.some(g=>['waiting','engaged','stationed'].includes(g.status)&&g.target===operativeLocation(s,id));
export function sleepOrderReason(s,id,asleep){
 const r=s.operativeState[id];
 if(typeof asleep!=='boolean')return 'Indicá si debe dormir o despertar.';
 if(!available(s,id))return 'El combatiente no está disponible para esta orden.';
 if(asleep===Boolean(r.asleep))return asleep?'Ya está durmiendo.':'Ya está despierto.';
 if(!asleep)return '';
 if(!safe(s,id))return 'Dormir requiere un sector seguro.';
 if(r.hp<15)return 'Está en estado crítico: necesita atención médica.';
 if(r.energy>=100&&r.fatigue===0)return 'No está cansado.';
 return '';
}
export function setSleep(s,id,asleep){const reason=sleepOrderReason(s,id,asleep);if(reason)throw Error(reason);s.operativeState[id].asleep=asleep;}

export function prepareSleep(s,roster,context={}){
 const events=[];
 for(const op of roster){
  const r=s.operativeState[op.id];if(!r)continue;
  if(!available(s,op.id)){r.asleep=false;continue;}
  if(r.asleep&&!safe(s,op.id,context)){r.asleep=false;events.push({id:op.id,code:'sleep_disturbed'});continue;}
  // Patients and deliberately resting soldiers already have a recovery job.
  if(!r.asleep&&!['rest','patient'].includes(r.assignment)&&safe(s,op.id,context)&&r.hp>=15&&!r.bleeding&&(r.energy<=SLEEP_ENERGY||r.fatigue>=SLEEP_FATIGUE)){
   r.asleep=true;events.push({id:op.id,code:'sleep_started'});
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
   if(!['rest','patient'].includes(r.assignment)){recoverFatigue(r,8,12);}
   if(r.energy>=100&&r.fatigue===0){r.asleep=false;events.push({id:op.id,code:'sleep_complete'});}
  }else if(r.assignment==='active'&&!(context.working??[]).includes(op.id)&&!s.militiaTraining?.some(t=>t.trainerId===op.id)&&r.hp>=15&&!r.bleeding){
   recoverFatigue(r,1,3);
  }
 }
 return [...events,...prepareSleep(s,roster,context)];
}
export function sleepStatus(r){return r.asleep?'Durmiendo · +12 energía/h · −8 fatiga/h. Retoma su asignación al recuperarse.':'Despierto';}
