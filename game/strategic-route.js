import {CAMPAIGN_SECTORS,isSupplied} from './campaign.js';
import {queueSquadTravel,squadTravelStatus} from './squad-travel.js';

// Preview only the small squad record. Never clone tactical sector snapshots on hover.
export function previewStrategicRoute(s,squadId,destination,mode='march'){
 const q=s.squads.find(q=>q.id===squadId);
 const reject=reason=>({valid:false,reason,path:[],hours:0,action:null});
 if(!q)return reject('La escuadra no existe.');
 if(s.defeated)return reject('La campaña ha terminado.');
 if(s.pendingBattle)return reject('Resolvé el sector táctico antes de marchar.');
 if(s.pendingEncounter)return reject('Respondé al encuentro antes de marchar.');
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
