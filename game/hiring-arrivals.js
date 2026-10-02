import {characterForOperative,isContractOperative} from './content-character-ids.js';
import {CAMPAIGN_SECTORS} from './data.js';
import {arrivalSitesFor,arrivalSiteLabel} from './arrival-sites.js';
import {CONTRACT_TERMS,contractQuote} from './contracts.js';

export function hiringArrivalReason(state,destination){
  const site=arrivalSitesFor(state).find(s=>s.sector===destination);
  if(!site)return 'Elegí una posta, un cuartel, un puerto o un embarcadero habilitado.';
  if(state.sectors?.[destination]?.owner!=='patriot')return 'El destino de llegada debe estar bajo tu control.';
  if((state.enemyGroups??[]).some(g=>g.target===destination&&['waiting','stationed','engaged'].includes(g.status)))return 'El destino de llegada está ocupado o en combate.';
  if(state.blockade&&!site.facilities.some(f=>['post','barracks'].includes(f)))return 'El bloqueo impide llegar por agua. Elegí un destino con acceso terrestre.';
  return null;
}
export function hiringArrivalOptions(state){
  return CAMPAIGN_SECTORS.filter(s=>!hiringArrivalReason(state,s.id)).map(s=>({id:s.id,name:s.name,infrastructure:arrivalSiteLabel(arrivalSitesFor(state).find(site=>site.sector===s.id))}));
}
export function hiringTravelHours(state,id){return characterForOperative(state,id)?.arrivalHours??0;}
export function pendingHire(state,id){return (state.hiringArrivals??[]).find(a=>a.operativeId===Number(id));}
export function hireArrivalOrder(state,operative,term,quote,destination){
  const travelHours=hiringTravelHours(state,operative.id);
  return {operativeId:operative.id,destination,bookedAt:state.hour,departedAt:state.hour,dueAt:state.hour+travelHours,travelHours,term,paid:quote.price,permanent:quote.permanent,serviceHours:quote.hours};
}
export function advanceHireArrivals(state,arrive){
  if(state.defeated)return;
  for(const arrival of [...(state.hiringArrivals??[])]){
    const record=state.operativeState[arrival.operativeId];
    if(!record?.alive||record.captured||record.serviceEquipmentReturn||state.recruited.includes(arrival.operativeId)||state.contracts[arrival.operativeId])continue;
    if(arrival.dueAt>state.hour||hiringArrivalReason(state,arrival.destination)||state.pendingBattle?.sector===arrival.destination)continue;
    // Grant service once, after all safety checks and after the hour's raids.
    arrive(arrival);
    state.hiringArrivals=state.hiringArrivals.filter(a=>a!==arrival);
  }
}
export function redirectHire(state,id,destination){
  const arrival=pendingHire(state,id);if(!arrival)throw Error('No hay una llegada pendiente para este personaje.');
  const reason=hiringArrivalReason(state,destination);if(reason)throw Error(reason);
  if(arrival.destination===destination)throw Error('Ese ya es el destino elegido.');
  arrival.destination=destination;arrival.departedAt=state.hour;arrival.dueAt=state.hour+arrival.travelHours;
}
export function cancelHireArrival(state,id){
  const arrival=pendingHire(state,id);if(!arrival)throw Error('No hay una llegada pendiente para cancelar.');
  state.resources.treasury+=arrival.paid;state.hiringArrivals=state.hiringArrivals.filter(a=>a!==arrival);
}
export function validateHireArrivals(state,roster){
  if(state.hiringArrivals===undefined)return;
  const need=ok=>{if(!ok)throw Error('Las llegadas de contratados guardadas son inválidas.');};
  const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
  const keys=['operativeId','destination','bookedAt','departedAt','dueAt','travelHours','term','paid','permanent','serviceHours'];
  need(Array.isArray(state.hiringArrivals)&&state.hiringArrivals.length<=roster.length);
  const ids=new Set();
  for(const a of state.hiringArrivals){
    need(a&&typeof a==='object'&&!Array.isArray(a)&&Object.keys(a).length===keys.length&&keys.every(k=>Object.hasOwn(a,k)));
    const operative=roster.find(o=>o.id===a.operativeId);
    need(operative&&isContractOperative(state,operative)&&!ids.has(a.operativeId)&&!state.recruited.includes(a.operativeId)&&!state.contracts?.[a.operativeId]);ids.add(a.operativeId);
    need(state.operativeState[a.operativeId]?.alive&&!state.operativeState[a.operativeId]?.captured&&!state.operativeState[a.operativeId]?.serviceEquipmentReturn&&arrivalSitesFor(state).some(site=>site.sector===a.destination));
    need(integer(a.bookedAt,0,state.hour)&&integer(a.departedAt,a.bookedAt,state.hour)&&integer(a.travelHours,1,168)&&a.travelHours===hiringTravelHours(state,a.operativeId)&&a.dueAt===a.departedAt+a.travelHours);
    need(Object.hasOwn(CONTRACT_TERMS,a.term));
    const quote=contractQuote(state,operative,a.term);
    need(a.permanent===quote.permanent&&a.serviceHours===quote.hours&&integer(a.paid,0,1e9)&&a.paid===quote.price);
  }
}
