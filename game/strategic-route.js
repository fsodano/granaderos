import {CAMPAIGN_SECTORS,isSupplied} from './campaign.js';
import {queueSquadTravel,squadTravelStatus} from './squad-travel.js';
import {worldCell,locationId,cellTravelPlan} from './world-cells.js';
import {tooTiredToMarch} from './march-fatigue.js';

// Preview only the small squad record. Never clone tactical sector snapshots on hover.
export function previewStrategicRoute(s,squadId,destination,mode='march'){
 const q=s.squads.find(q=>q.id===squadId);
 const reject=reason=>({valid:false,reason,path:[],hours:0,action:null});
 if(!q)return reject('La escuadra no existe.');
 if(s.defeated)return reject('La campaña ha terminado.');
 if(s.pendingBattle)return reject('Resolvé el sector táctico antes de marchar.');
 if(s.pendingEncounter)return reject('Respondé al encuentro antes de marchar.');
 if(q.journey)return reject('Terminá o cancelá la ruta anterior.');
 if(!q.members.length)return reject('La escuadra no tiene combatientes.');
 if(q.members.some(id=>!s.recruited.includes(id)||!s.operativeState[id]?.alive||s.operativeState[id].captured))return reject('Hay combatientes que no pueden marchar.');
 if(q.members.some(id=>s.operativeState[id].asleep||s.operativeState[id].assignment!=='active'||s.militiaTraining?.some(t=>t.trainerId===id)))return reject('Hay combatientes durmiendo o con otra asignación.');
 if(q.members.some(id=>tooTiredToMarch(s.operativeState[id])))return reject('La escuadra necesita descansar.');
 const cell=worldCell(destination);
 if(!cell)return reject('Elegí un destino en el mapa.');
 destination=locationId(destination);
 if(destination===q.location)return reject('La escuadra ya está en este sector.');
 if(!cell.anchor||!worldCell(q.location)?.anchor){
  if(mode!=='march')return reject('Para esta celda, elegí marcha a pie.');
  const plan=cellTravelPlan({...s,location:q.location},destination);
  if(plan.reason)return reject(plan.reason);
  return {valid:true,reason:null,path:plan.path,hours:plan.hours,action:{type:'travel',sector:destination,mode}};
 }
 const target=CAMPAIGN_SECTORS.find(d=>d.id===destination);
 if(!target)return reject('Elegí un destino en el mapa.');
 if(destination===q.location)return reject('La escuadra ya está en este sector.');
 const intent=s.sectors[destination].owner==='royalist'||s.blockade&&target.theater==='coast'?'attack':'travel';
 if(intent==='attack'){
  if(s.completed)return reject('La campaña está ganada.');
  if(!target.neighbors.some(id=>s.sectors[id].owner==='patriot'&&isSupplied(s,id)))return reject('Debes abrir una ruta hasta el frente.');
 }
 try{
  const draft={...q,members:[...q.members]};
  queueSquadTravel(s,draft,{sector:destination,mode,intent});
  const status=squadTravelStatus(draft);
  return {valid:true,reason:null,path:status.path,hours:status.remaining,action:{type:intent,sector:destination,mode,queue:true}};
 }catch(error){return reject(error.message);}
}
