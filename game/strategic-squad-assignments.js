import {canCreateSquad,canReassignOperative,operativeLocation} from './squads.js';
import {careAssignmentReason} from './medical-care.js';

// Numbered UI slots refer to saved squads. Forming a later slot first must not
// renumber it, and old named squads retain their IDs and membership.
export function strategicSquadSlots(state){
 const slots=Array.from({length:6},(_,index)=>({number:index+1,label:`Escuadra ${index+1}`,squad:null})),remaining=[];
 for(const squad of state.squads??[]){
  const match=/^Escuadra ([1-6])$/.exec(squad.name);
  if(match&&!slots[Number(match[1])-1].squad)slots[Number(match[1])-1].squad=squad;
  else remaining.push(squad);
 }
 const extra=[];
 for(const squad of remaining){const slot=slots.find(slot=>!slot.squad);if(slot)slot.squad=squad;else extra.push({number:null,label:squad.name,squad});}
 return [...slots,...extra];
}

export function strategicSquadLabel(state,squadId){return strategicSquadSlots(state).find(slot=>slot.squad?.id===squadId)?.label??'En servicio';}

export function strategicSquadAssignments(state,operativeId,operative=null){
 const at=operativeLocation(state,operativeId),unavailable=state.pendingBattle||state.pendingEncounter||state.defeated?'Terminá el encuentro antes de cambiar de escuadra.':!canReassignOperative(state,operativeId)?'El combatiente debe estar disponible y sin una ruta pendiente.':operative?careAssignmentReason(state,operative,'active')||null:null;
 return strategicSquadSlots(state).map(slot=>{
  const squad=slot.squad;
  const reason=unavailable??(squad?.journey?'La escuadra tiene una ruta pendiente.':squad&&squad.location!==at?'Los combatientes deben reunirse en el mismo sector.':squad&&squad.members.length>=6&&!squad.members.includes(operativeId)?'La escuadra ya tiene seis combatientes.':!squad&&!canCreateSquad(state)?'No hay otra escuadra disponible.':null);
  const action=squad?{type:'assignToSquad',operativeId,squadId:squad.id,returnToService:true}:{type:'createSquad',name:slot.label,ids:[operativeId],sector:at,returnToService:true};
  return {...slot,reason,action};
 });
}
