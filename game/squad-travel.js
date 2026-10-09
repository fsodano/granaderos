import {TRAVEL_BALANCE} from './travel-balance.js';
import {entryFromSector} from './tactical-exits.js';
import {CAMPAIGN_SECTORS} from './data.js';
import {validWorldLocation,campaignPlace,adjacentCells,cellLegHours,legacyCellStepHours,previousCellStepHours,cellTravelPlan,cellWinterClosed,worldOwner,worldCell,sameCityCells,ROAD_LINKS} from './world-cells.js';
import {tooTiredToMarch,advanceMarchFatigue} from './march-fatigue.js';
import {mountForOperative} from './horses.js';
import {recordStrategicArrival} from './deployment-return.js';

const sector=id=>CAMPAIGN_SECTORS.find(d=>d.id===id);
const need=(ok,message)=>{if(!ok)throw Error(message);};
const modes=['march','horse','posta','flotilla','carts'];
const progressSeconds=j=>j.elapsed*3600+(j.elapsedSecond??0);
const campaignSeconds=s=>s.hour*3600+(s.secondOfHour??0);
const setProgressSeconds=(journey,seconds)=>{journey.elapsed=Math.floor(seconds/3600);if(seconds%3600)journey.elapsedSecond=seconds%3600;else delete journey.elapsedSecond;};
// Continuous time stops at exact travel-hour work and locality boundaries.
// Legacy journeys omit both fractions and retain their whole-hour cadence.
export function nextSquadTravelBoundarySeconds(s){
 const due=s.squads.filter(q=>q.journey?.status==='moving').map(({journey:j})=>Math.min(3600-(j.pendingSeconds??0),j.returning?progressSeconds(j):j.legHours*3600-progressSeconds(j))).filter(seconds=>seconds>0);
 return due.length?Math.min(...due):null;
}
export const TRAVEL_REASONS={exhausted:'La escuadra necesita descansar.',assignment:'Hay combatientes durmiendo o con otra asignación.',blocked:'La ruta está ocupada.',winter:'La nieve cerró el paso.',transport:'El transporte no está disponible.',remounts:'Faltan pesos para la siguiente etapa de postas.',contact:'Hay un encuentro en este sector.',empty:'La escuadra no tiene combatientes.',unavailable:'Hay combatientes que no pueden marchar.',assault:'En el límite del sector. Puede atacar o esperar a otras escuadras.'};
export const assaultNeighbor=(from,to)=>Boolean(sector(to)&&(sector(from)?.neighbors.includes(to)||validWorldLocation(from)&&adjacentCells(from,to)));
export const travelLegHours=(from,to,mode='march')=>{
 if(adjacentCells(from,to))return cellLegHours(from,to,mode);
 if(sameCityCells(from,to)){
  const link=ROAD_LINKS.find(link=>link.from===from&&link.to===to||link.from===to&&link.to===from);
  if(link)return (link.path.length-1)*TRAVEL_BALANCE.cityCellHours;
 }
 return Math.ceil(({march:TRAVEL_BALANCE.roadWalkHours,horse:TRAVEL_BALANCE.horseHours,posta:4,flotilla:5,carts:18}[mode])*([from,to].some(id=>sector(id)?.biome==='mountain')?TRAVEL_BALANCE.mountainFactor:1));
};
export function supportedTravelLegHours(from,to,mode='march'){
 const hours=new Set([travelLegHours(from,to,mode)]);
 if(adjacentCells(from,to)){hours.add(legacyCellStepHours(to,mode));hours.add(previousCellStepHours(to,mode));}
 if(!sector(from)&&adjacentCells(from,to)){
  if(mode==='march')hours.add(worldCell(to)?.biome==='mountain'?4:2);
 }else hours.add(Math.ceil(({march:12,horse:6,posta:4,flotilla:5,carts:18}[mode])*([from,to].some(id=>sector(id)?.biome==='mountain')?1.5:1)));
 return [...hours];
}
export const squadHasHorses=(s,q)=>Boolean(q?.members.length&&q.members.every(id=>mountForOperative(s.horseState,id)?.canMount));
function pathTo(s,from,to,mode){
 if(['march','horse'].includes(mode)||!sector(from)||!sector(to))return cellTravelPlan({location:from,hour:s.hour,sectors:s.sectors},to,mode).path;
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
 if(s.pendingBattle?.sector===to||j.intent!=='attack'&&(worldOwner(s,to)==='royalist'||s.enemyGroups?.some(g=>g.target===to&&g.status==='stationed')))return 'blocked';
 if([from,to].some(id=>cellWinterClosed(s,id)))return 'winter';
 if(j.mode==='horse'&&!squadHasHorses(s,q))return 'transport';
 if(!['march','horse'].includes(j.mode)&&!s.routes[j.mode]||j.mode==='flotilla'&&s.blockade)return 'transport';
 if(j.mode==='posta'&&s.resources.treasury<10)return 'remounts';
 return null;
}
export function queueSquadTravel(s,q,{sector:destination,waypoints=[],mode='march',intent='travel'}){
 need(!q.journey,'Terminá o cancelá la ruta anterior.');need(modes.includes(mode),'Medio de transporte desconocido.');
 need(Array.isArray(waypoints)&&waypoints.length<=8,'Elegí hasta ocho escalas.');
 need(['travel','attack'].includes(intent),'La intención de marcha es inválida.');
 if(intent==='attack')need(waypoints.length===0&&assaultNeighbor(q.location,destination),'Prepará el ataque desde un sector vecino, sin escalas.');
 need(validWorldLocation(q.location),'La ubicación de la escuadra no existe.');
 let path=[q.location];for(const to of [...waypoints,destination]){need(validWorldLocation(to)&&(intent==='attack'||worldOwner(s,to)!=='royalist'),'Cada escala debe ser una celda terrestre accesible.');const leg=intent==='attack'?[q.location,to]:pathTo(s,path.at(-1),to,mode);need(leg?.length,'Los realistas cortan la ruta de tránsito.');path.push(...leg.slice(1));}
 need(path.length>1&&path.length<=65,'La ruta debe tener entre una y 64 etapas.');
 need(['march','horse'].includes(mode)||path.every(id=>sector(id)),'Las celdas rurales requieren marcha a pie o caballos.');
 need(mode!=='flotilla'||path.every(id=>sector(id).theater==='coast'),'La flotilla requiere una ruta costera.');
 q.journey={version:1,path,mode,startedAt:s.hour,...(s.secondOfHour?{startedSecond:s.secondOfHour}:{}),legHours:travelLegHours(path[0],path[1],mode),elapsed:0,status:'moving',returning:false,reason:null,...(intent==='attack'?{intent}:{})};
 const reason=legIssue(s,q);need(!reason,TRAVEL_REASONS[reason]);return q.journey;
}
export function cancelSquadTravel(q,choice='stop'){
 need(q?.journey,'La escuadra no tiene una ruta pendiente.');need(['stop','return'].includes(choice),'Elegí detenerse o regresar.');
 const j=q.journey;
 if(progressSeconds(j)===0){delete q.journey;return;}
 if(choice==='return'||j.intent==='attack'){j.returning=true;j.status='moving';j.reason=null;}else if(!j.returning){j.path=j.path.slice(0,2);}
}
export function resumeSquadTravel(s,q){
 need(q?.journey?.status==='paused','La ruta no está detenida.');const reason=legIssue(s,q);need(!reason,TRAVEL_REASONS[reason]);q.journey.status='moving';q.journey.reason=null;
}
export function squadTravelStatus(q){
 const j=q.journey;if(!j)return null;
 const covered=progressSeconds(j)/3600,legRemaining=j.returning?covered:j.legHours-covered;
 return {status:j.status,intent:j.intent??'travel',mode:j.mode,from:j.path[0],to:j.returning?j.path[0]:j.path[1],destination:j.returning?j.path[0]:j.path.at(-1),returning:j.returning,elapsed:covered,elapsedSeconds:progressSeconds(j),legHours:j.legHours,legRemaining,remaining:legRemaining+(j.returning?0:j.path.slice(2).reduce((sum,to,i)=>sum+travelLegHours(j.path[i+1],to,j.mode),0)),path:[...j.path],reason:j.reason?TRAVEL_REASONS[j.reason]:null};
}
// One hour for every squad, independent of which squad the player selected.
// Call after work/recovery, before enemy contacts. Arrivals stop explicit waits.
export function advanceSquadTravel(s,roster,{note,releaseAtArrival,onArrival=()=>{},stopAtEveryArrival=false,seconds=3600}){
 need(Number.isSafeInteger(seconds)&&seconds>=1&&seconds<=3600,'El intervalo de marcha es inválido.');
 const events=[];
 const announce=(q,text)=>{note(s,`${q.name}: ${text}`);events.push({squadId:q.id,name:q.name,sector:q.location,text});};
 for(const q of s.squads){
  const j=q.journey;if(!j)continue;
  if(!q.members.length){delete q.journey;announce(q,'se cancela la marcha; no quedan combatientes.');continue;}
  if(j.status==='ready')continue;
  if(j.status!=='moving')continue;
  const covered=progressSeconds(j);
  if(!j.returning&&covered===0){const reason=legIssue(s,q);if(reason){j.status='paused';j.reason=reason;announce(q,TRAVEL_REASONS[reason]);continue;}if(j.mode==='posta')s.resources.treasury-=10;}
  const blocked=j.intent!=='attack'&&(worldOwner(s,j.path[1])==='royalist'||s.enemyGroups?.some(g=>g.target===j.path[1]&&g.status==='stationed'));
  const winter=j.path.slice(0,2).some(id=>cellWinterClosed(s,id));
  // A changed front never moves soldiers instantly back to the departure sector.
  if(!j.returning&&covered>0&&(blocked||winter||s.pendingBattle?.sector===j.path[1])){j.returning=true;j.reason=winter?'winter':'blocked';announce(q,winter?'la nieve cerró el paso; regresa por la etapa recorrida.':'el destino quedó cerrado; regresa por la etapa recorrida.');}
  const traveled=Math.min(seconds,j.returning?covered:j.legHours*3600-covered),work=(j.pendingSeconds??0)+traveled,hours=Math.floor(work/3600);
  if(work%3600)j.pendingSeconds=work%3600;else delete j.pendingSeconds;
  for(let hour=0;hour<hours;hour++){
   advanceMarchFatigue(s,roster.map(op=>({...op,...(mountForOperative(s.horseState,op.id)??{})})),{traveling:q.members,mode:j.mode,mountain:j.path.slice(0,2).some(id=>campaignPlace(id)?.biome==='mountain')});
   for(const horse of s.horseState.horses)if(!horse.returned&&q.members.includes(horse.assignedTo))horse.stamina=Math.max(0,horse.stamina-2);
  }
  setProgressSeconds(j,covered+(j.returning?-traveled:traveled));
  if(j.returning?progressSeconds(j)>0:progressSeconds(j)<j.legHours*3600)continue;
  if(!j.returning&&j.intent==='attack'){j.status='ready';j.reason='assault';announce(q,`alcanza el límite de ${campaignPlace(j.path[1]).name}. Puede atacar o esperar a otras escuadras.`);continue;}
  const from=q.location,to=j.returning?from:j.path[1];
  if(to!==from)recordStrategicArrival(s,q.members,from,to);
  q.location=to;for(const id of q.members)s.operativeState[id].location=to;
  for(const horse of s.horseState.horses)if(!horse.returned&&q.members.includes(horse.assignedTo))horse.location=to;
  if(q.id===s.activeSquadId)s.location=to;
  j.status='paused';setProgressSeconds(j,0);
  onArrival(q);
  for(const horse of s.horseState.horses)if(!horse.returned&&horse.hired&&horse.hireUntil<=s.hour&&q.members.includes(horse.assignedTo)){horse.returned=true;horse.assignedTo=null;}
  releaseAtArrival(q);
  if(j.returning||j.path.length===2||!q.members.length){delete q.journey;announce(q,`llega a ${campaignPlace(to).name}.`);continue;}
  j.path.shift();j.legHours=travelLegHours(j.path[0],j.path[1],j.mode);j.reason=legIssue(s,q);
  if(j.reason)announce(q,`${campaignPlace(to).name}. ${TRAVEL_REASONS[j.reason]}`);else{j.status='moving';if(stopAtEveryArrival)announce(q,`llega a ${campaignPlace(to).name}; la ruta continúa hacia ${campaignPlace(j.path.at(-1)).name}.`);}
 }
 if(events.length)s.travelNotice={hour:s.hour,...(s.secondOfHour?{secondOfHour:s.secondOfHour}:{}),events};
 return events.length>0;
}
export function validateSquadTravel(s){
 const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
 const notice=s.travelNotice;
 need(notice===undefined||notice===null||notice&&integer(notice.hour,0,s.hour)&&(notice.secondOfHour===undefined||integer(notice.secondOfHour,0,3599))&&notice.hour*3600+(notice.secondOfHour??0)<=campaignSeconds(s)&&Array.isArray(notice.events)&&notice.events.length>0&&notice.events.length<=16&&notice.events.every(e=>e&&typeof e.squadId==='string'&&s.squads.some(q=>q.id===e.squadId)&&typeof e.name==='string'&&e.name.length<=30&&validWorldLocation(e.sector)&&typeof e.text==='string'&&e.text.length<=500),'El aviso de marcha guardado es inválido.');
 for(const q of s.squads){const j=q.journey;if(j===undefined)continue;
  need(j&&typeof j==='object'&&!Array.isArray(j)&&j.version===1&&modes.includes(j.mode)&&['moving','paused','ready'].includes(j.status)&&typeof j.returning==='boolean'&&(j.reason===null||Object.hasOwn(TRAVEL_REASONS,j.reason))&&integer(j.startedAt,0,s.hour)&&Array.isArray(j.path)&&j.path.length>=2&&j.path.length<=65&&j.path[0]===q.location&&j.path.every((id,i)=>validWorldLocation(id)&&(i===0||sector(j.path[i-1])?.neighbors.includes(id)||adjacentCells(j.path[i-1],id)))&&integer(j.legHours,1,96)&&integer(j.elapsed,0,j.returning||j.status==='ready'?j.legHours:j.legHours-1),'La ruta guardada es inválida.');
  need(['startedSecond','elapsedSecond','pendingSeconds'].every(key=>j[key]===undefined||integer(j[key],0,3599))&&j.startedAt*3600+(j.startedSecond??0)<=campaignSeconds(s),'Los segundos de la ruta guardada son inválidos.');
  const covered=progressSeconds(j);
  need(covered<=j.legHours*3600&&covered<=campaignSeconds(s)-(j.startedAt*3600+(j.startedSecond??0))&&(j.returning||(j.pendingSeconds??0)===(j.elapsedSecond??0)),'El tiempo recorrido de la ruta guardada es inválido.');
  need(['march','horse'].includes(j.mode)||j.path.every(id=>sector(id)),'La ruta guardada usa transporte no disponible en celdas rurales.');
  need(supportedTravelLegHours(j.path[0],j.path[1],j.mode).includes(j.legHours),'La duración de la etapa guardada es inválida.');
  need((j.intent===undefined||j.intent==='attack')&&(j.intent!=='attack'||j.path.length===2)&&(j.status!=='ready'||j.intent==='attack'&&covered===j.legHours*3600&&!j.pendingSeconds&&!j.returning&&j.reason==='assault'),'La preparación de ataque guardada es inválida.');
  need(q.members.length>0&&(j.mode!=='flotilla'||j.path.every(id=>sector(id).theater==='coast'))&&(j.status!=='paused'||covered===0&&!j.returning)&&(j.returning?covered>0:true),'El avance guardado es inválido.');
  need(q.members.every(id=>!s.pendingBattle?.squad?.some(u=>Number(u.id)===id)),'Una escuadra en ruta no puede estar desplegada.');
  if(['moving','ready'].includes(j.status))need(q.members.every(id=>s.operativeState[id].alive&&!s.operativeState[id].captured&&!s.operativeState[id].asleep&&s.operativeState[id].assignment==='active'&&!s.militiaTraining?.some(t=>t.trainerId===id)),'Los viajeros guardados no están disponibles.');
 }
}

// A ready squad is at the boundary, not a defender or worker in either sector.
export function assaultGroups(s){
 const targets=[...new Set(s.squads.filter(q=>q.journey?.intent==='attack'&&!q.journey.returning).map(q=>q.journey.path[1]))];
 return targets.map(target=>({sector:target,ready:s.squads.filter(q=>q.journey?.intent==='attack'&&q.journey.path[1]===target&&q.journey.status==='ready').map(q=>({id:q.id,name:q.name,origin:q.location,members:[...q.members]})),incoming:s.squads.filter(q=>q.journey?.intent==='attack'&&!q.journey.returning&&q.journey.path[1]===target&&q.journey.status!=='ready').map(q=>({id:q.id,name:q.name,remaining:squadTravelStatus(q).remaining,status:q.journey.status}))}));
}
export function readyAssaultSquads(s,target){const groups=s.squads.filter(q=>q.journey?.status==='ready'&&q.journey.path[1]===target);need(groups.length>0,'No hay escuadras listas en ese límite.');return groups;}
export function arriveForAssault(s,groups,target){
 const manifest=groups.map(q=>({id:q.id,name:q.name||q.id,origin:q.location,members:[...q.members]}));
 for(const q of groups){recordStrategicArrival(s,q.members,q.location,target);q.location=target;delete q.journey;for(const horse of s.horseState.horses)if(!horse.returned&&q.members.includes(horse.assignedTo))horse.location=target;if(q.id===s.activeSquadId)s.location=target;}
 return manifest;
}
export function validateAssaultDeployment(s){
 const b=s.pendingBattle;if(b?.assaultSquads===undefined)return;
 const manifest=b.assaultSquads,mission=b.missionId==='san_lorenzo'&&b.sector==='san_lorenzo',location=mission?'san_nicolas':b.sector;
 need(!b.defenseGroupId&&!b.exploration&&(!b.missionId&&sector(b.sector)||mission)&&Array.isArray(manifest)&&manifest.length>0&&manifest.length<=8&&new Set(manifest.map(q=>q?.id)).size===manifest.length,'Las escuadras del asalto son inválidas.');
 need(manifest.every(group=>{const q=s.squads.find(q=>q.id===group?.id);return q&&q.location===location&&!q.journey&&(mission?group.origin==='san_nicolas':assaultNeighbor(group.origin,b.sector))&&Array.isArray(group.members)&&group.members.length>0&&group.members.length<=6&&JSON.stringify(group.members)===JSON.stringify(q.members);}), 'Los participantes del asalto no corresponden a sus escuadras.');
 for(const group of manifest){const name=s.squads.find(q=>q.id===group.id).name||group.id;if(group.name===undefined)group.name=name;need(group.name===name,'El nombre de la escuadra de llegada no corresponde a la campaña.');}
 need(!mission||(b.origin==='san_nicolas'&&manifest.some(q=>q.id===s.activeSquadId)),'El origen de la misión no corresponde a la escuadra activa.');
 const ids=manifest.flatMap(q=>q.members);need(new Set(ids).size===ids.length&&ids.length===b.squad.length&&b.squad.every(u=>ids.includes(u.id)),'El destacamento del asalto está incompleto.');
 for(const group of manifest){const entry=entryFromSector(group.origin,b.sector);need(group.members.every(id=>{const unit=b.squad.find(u=>u.id===id);return s.operativeState[id]?.arrival?.fromSector===group.origin&&s.operativeState[id]?.location===location&&unit.entryEdge===entry.entryEdge&&unit.entryAnchor?.x===entry.entryAnchor.x&&unit.entryAnchor?.y===entry.entryAnchor.y;}),'La entrada del asalto no corresponde al origen.');}
}
