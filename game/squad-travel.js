import {CAMPAIGN_SECTORS} from './data.js';
import {tooTiredToMarch,advanceMarchFatigue} from './march-fatigue.js';
import {mountForOperative} from './horses.js';
import {recordStrategicArrival} from './deployment-return.js';

const sector=id=>CAMPAIGN_SECTORS.find(d=>d.id===id);
const need=(ok,message)=>{if(!ok)throw Error(message);};
const modes=['march','posta','flotilla','carts'];
export const TRAVEL_REASONS={exhausted:'La escuadra necesita descansar.',assignment:'Hay combatientes durmiendo o con otra asignación.',blocked:'La ruta está ocupada.',winter:'La nieve cerró el paso.',transport:'El transporte no está disponible.',remounts:'No quedan remudas para la posta.',contact:'Hay un encuentro en este sector.',empty:'La escuadra no tiene combatientes.',unavailable:'Hay combatientes que no pueden marchar.'};
export const travelLegHours=(from,to,mode='march')=>Math.ceil(({march:12,posta:4,flotilla:5,carts:18}[mode])*([from,to].some(id=>sector(id)?.biome==='mountain')?1.5:1));
function pathTo(s,from,to){
 const queue=[[from]],seen=new Set([from]);
 while(queue.length){const path=queue.shift(),last=path.at(-1);if(last===to)return path;for(const id of sector(last).neighbors)if(!seen.has(id)&&s.sectors[id].owner==='patriot'){seen.add(id);queue.push([...path,id]);}}
 return null;
}
function legIssue(s,q){
 const j=q.journey,[from,to]=j.path;
 if(!q.members.length)return 'empty';
 if(q.members.some(id=>!s.recruited.includes(id)||!s.operativeState[id]?.alive||s.operativeState[id].captured))return 'unavailable';
 if(q.members.some(id=>tooTiredToMarch(s.operativeState[id])))return 'exhausted';
 if(q.members.some(id=>s.operativeState[id].asleep||s.operativeState[id].assignment!=='active'||s.militiaTraining?.some(t=>t.trainerId===id)))return 'assignment';
 if(s.enemyGroups?.some(g=>g.target===from&&['waiting','engaged','stationed'].includes(g.status)))return 'contact';
 if(s.pendingBattle?.sector===to||s.sectors[to].owner!=='patriot'||s.enemyGroups?.some(g=>g.target===to&&g.status==='stationed'))return 'blocked';
 const month=(2+Math.floor(s.hour/720))%12+1;
 if([from,to].some(id=>['uspallata','los_patos'].includes(id))&&month>=6&&month<=8)return 'winter';
 if(j.mode!=='march'&&!s.routes[j.mode]||j.mode==='flotilla'&&s.blockade)return 'transport';
 if(j.mode==='posta'&&s.resources.horses<1)return 'remounts';
 return null;
}
export function queueSquadTravel(s,q,{sector:destination,waypoints=[],mode='march'}){
 need(!q.journey,'Terminá o cancelá la ruta anterior.');need(modes.includes(mode),'Medio de transporte desconocido.');
 need(Array.isArray(waypoints)&&waypoints.length<=8,'Elegí hasta ocho escalas.');
 let path=[q.location];for(const to of [...waypoints,destination]){need(sector(to)&&s.sectors[to].owner==='patriot','Cada escala debe ser un sector propio.');const leg=pathTo(s,path.at(-1),to);need(leg,'Los realistas cortan la ruta de tránsito.');path.push(...leg.slice(1));}
 need(path.length>1&&path.length<=65,'La ruta debe tener entre una y 64 etapas.');
 need(mode!=='flotilla'||path.every(id=>sector(id).theater==='coast'),'La flotilla requiere una ruta costera.');
 q.journey={version:1,path,mode,startedAt:s.hour,legHours:travelLegHours(path[0],path[1],mode),elapsed:0,status:'moving',returning:false,reason:null};
 const reason=legIssue(s,q);need(!reason,TRAVEL_REASONS[reason]);return q.journey;
}
export function cancelSquadTravel(q,choice='stop'){
 need(q?.journey,'La escuadra no tiene una ruta pendiente.');need(['stop','return'].includes(choice),'Elegí detenerse o regresar.');
 const j=q.journey;
 if(j.elapsed===0){delete q.journey;return;}
 if(choice==='return'){j.returning=true;j.reason=null;}else if(!j.returning){j.path=j.path.slice(0,2);}
}
export function resumeSquadTravel(s,q){
 need(q?.journey?.status==='paused','La ruta no está detenida.');const reason=legIssue(s,q);need(!reason,TRAVEL_REASONS[reason]);q.journey.status='moving';q.journey.reason=null;
}
export function squadTravelStatus(q){
 const j=q.journey;if(!j)return null;
 const legRemaining=j.returning?j.elapsed:j.legHours-j.elapsed;
 return {status:j.status,mode:j.mode,from:j.path[0],to:j.returning?j.path[0]:j.path[1],destination:j.returning?j.path[0]:j.path.at(-1),returning:j.returning,elapsed:j.elapsed,legHours:j.legHours,legRemaining,remaining:legRemaining+(j.returning?0:j.path.slice(2).reduce((sum,to,i)=>sum+travelLegHours(j.path[i+1],to,j.mode),0)),path:[...j.path],reason:j.reason?TRAVEL_REASONS[j.reason]:null};
}
// One hour for every squad, independent of which squad the player selected.
// Call after work/recovery, before enemy contacts. Arrivals stop explicit waits.
export function advanceSquadTravel(s,roster,{note,releaseAtArrival}){
 const events=[];
 const announce=(q,text)=>{note(s,`${q.name}: ${text}`);events.push({squadId:q.id,name:q.name,sector:q.location,text});};
 for(const q of s.squads){
  const j=q.journey;if(!j)continue;
  if(!q.members.length){delete q.journey;announce(q,'se cancela la marcha; no quedan combatientes.');continue;}
  if(j.status!=='moving')continue;
  if(!j.returning&&j.elapsed===0){const reason=legIssue(s,q);if(reason){j.status='paused';j.reason=reason;announce(q,TRAVEL_REASONS[reason]);continue;}if(j.mode==='posta')s.resources.horses--;}
  const blocked=s.sectors[j.path[1]].owner!=='patriot'||s.enemyGroups?.some(g=>g.target===j.path[1]&&g.status==='stationed');
  // A changed front never moves soldiers instantly back to the departure sector.
  if(!j.returning&&j.elapsed>0&&(blocked||s.pendingBattle?.sector===j.path[1])){j.returning=true;j.reason='blocked';announce(q,'el destino quedó cerrado; regresa por la etapa recorrida.');}
  advanceMarchFatigue(s,roster.map(op=>({...op,...(mountForOperative(s.horseState,op.id)??{})})),{traveling:q.members,mode:j.mode,mountain:j.path.slice(0,2).some(id=>sector(id).biome==='mountain')});
  for(const horse of s.horseState.horses)if(!horse.returned&&q.members.includes(horse.assignedTo))horse.stamina=Math.max(0,horse.stamina-2);
  j.elapsed+=j.returning?-1:1;
  if(j.returning?j.elapsed>0:j.elapsed<j.legHours)continue;
  const from=q.location,to=j.returning?from:j.path[1];
  if(to!==from)recordStrategicArrival(s,q.members,from,to);
  q.location=to;for(const id of q.members)s.operativeState[id].location=to;
  for(const horse of s.horseState.horses)if(!horse.returned&&q.members.includes(horse.assignedTo))horse.location=to;
  if(q.id===s.activeSquadId)s.location=to;
  j.status='paused';j.elapsed=0;
  for(const horse of s.horseState.horses)if(!horse.returned&&horse.hired&&horse.hireUntil<=s.hour&&q.members.includes(horse.assignedTo)){horse.returned=true;horse.assignedTo=null;}
  releaseAtArrival(q);
  if(j.returning||j.path.length===2||!q.members.length){delete q.journey;announce(q,`llega a ${sector(to).name}.`);continue;}
  j.path.shift();j.legHours=travelLegHours(j.path[0],j.path[1],j.mode);j.reason=legIssue(s,q);
  if(j.reason)announce(q,`${sector(to).name}. ${TRAVEL_REASONS[j.reason]}`);else j.status='moving';
 }
 if(events.length)s.travelNotice={hour:s.hour,events};
 return events.length>0;
}
export function validateSquadTravel(s){
 const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
 const notice=s.travelNotice;
 need(notice===undefined||notice===null||notice&&integer(notice.hour,0,s.hour)&&Array.isArray(notice.events)&&notice.events.length>0&&notice.events.length<=16&&notice.events.every(e=>e&&typeof e.squadId==='string'&&s.squads.some(q=>q.id===e.squadId)&&typeof e.name==='string'&&e.name.length<=30&&sector(e.sector)&&typeof e.text==='string'&&e.text.length<=500),'El aviso de marcha guardado es inválido.');
 for(const q of s.squads){const j=q.journey;if(j===undefined)continue;
  need(j&&typeof j==='object'&&!Array.isArray(j)&&j.version===1&&modes.includes(j.mode)&&['moving','paused'].includes(j.status)&&typeof j.returning==='boolean'&&(j.reason===null||Object.hasOwn(TRAVEL_REASONS,j.reason))&&integer(j.startedAt,0,s.hour)&&Array.isArray(j.path)&&j.path.length>=2&&j.path.length<=65&&j.path[0]===q.location&&j.path.every((id,i)=>sector(id)&&(i===0||sector(j.path[i-1]).neighbors.includes(id)))&&j.legHours===travelLegHours(j.path[0],j.path[1],j.mode)&&integer(j.elapsed,0,j.legHours-1),'La ruta guardada es inválida.');
  need(q.members.length>0&&(j.mode!=='flotilla'||j.path.every(id=>sector(id).theater==='coast'))&&(j.status!=='paused'||j.elapsed===0&&!j.returning)&&(j.returning?j.elapsed>0:true),'El avance guardado es inválido.');
  need(q.members.every(id=>!s.pendingBattle?.squad?.some(u=>Number(u.id)===id)),'Una escuadra en ruta no puede estar desplegada.');
  if(j.status==='moving')need(q.members.every(id=>s.operativeState[id].alive&&!s.operativeState[id].captured&&!s.operativeState[id].asleep&&s.operativeState[id].assignment==='active'&&!s.militiaTraining?.some(t=>t.trainerId===id)),'Los viajeros guardados no están disponibles.');
 }
}
