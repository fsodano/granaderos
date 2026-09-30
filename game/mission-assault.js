import {tooTiredToMarch} from './march-fatigue.js';

export function missionAssaultSquads(state){
 return state.squads.filter(q=>q.members.length&&q.location==='san_nicolas').map(q=>{
  let reason=q.journey?'La escuadra está en marcha.':null;
  for(const id of q.members){
   const r=state.operativeState[id],contract=state.contracts[id];
   if(!state.recruited.includes(id)||!r?.alive||r.hp<15||r.unconscious||r.captured||r.location&&r.location!=='san_nicolas'||!contract||contract.expiresAt!==null&&contract.expiresAt<=state.hour)reason??='Hay combatientes no disponibles.';
   else if(tooTiredToMarch(r))reason??='La escuadra necesita descansar.';
   else if(r.asleep||r.assignment!=='active'||state.militiaTraining?.some(t=>t.trainerId===id))reason??='Hay combatientes con otra asignación.';
  }
  if(state.enemyGroups?.some(g=>g.target==='san_nicolas'&&['waiting','engaged','stationed'].includes(g.status)))reason??='Hay fuerzas enemigas en San Nicolás.';
  return {id:q.id,name:q.name||q.id,origin:'san_nicolas',members:[...q.members],reason};
 });
}
export function missionAssaultManifest(state,ids){
 const need=(ok,text)=>{if(!ok)throw Error(text);};
 need(Array.isArray(ids)&&ids.length>0&&ids.length<=8&&new Set(ids).size===ids.length&&ids.includes(state.activeSquadId),'Seleccioná la escuadra activa y hasta siete escuadras de apoyo.');
 const options=missionAssaultSquads(state);
 const manifest=ids.map(id=>{const q=options.find(q=>q.id===id);need(q&&!q.reason,q?.reason??'La escuadra no está en San Nicolás.');const {reason,...entry}=q;return entry;});
 const members=manifest.flatMap(q=>q.members);
 need(members.length<=48&&new Set(members).size===members.length,'Los combatientes del despliegue están repetidos.');
 return manifest;
}
