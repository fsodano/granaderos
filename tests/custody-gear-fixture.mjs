import {makeOutfit} from '../game/outfits.js';
import {initialHorseState,MATURITY_HOURS} from '../game/horses.js';

// Finite preexisting property for isolated custody tests. These helpers do not
// buy stock, grant a route reward, or change a new-player campaign constructor.
export function withCarriedPonchos(state,id,count=1){
 const next=structuredClone(state),record=next.operativeState[id];record.inventory??={};
 record.inventory.outfit={...makeOutfit('poncho'),count};return next;
}
export function withLegacyRepairReserve(state,id,points=100){
 const next=structuredClone(state);next.operativeState[id].toolkitPoints=points;return next;
}
export function withOwnedMount(state,{hired=false,name='Correo'}={}){
 const next=structuredClone(state);next.horseState??=initialHorseState();const id=`horse-${next.horseState.nextId++}`;
 next.horseState.horses.push({id,name,sex:'mare',location:next.location,bornAt:next.hour-MATURITY_HOURS,stamina:100,condition:100,feed:7,assignedTo:null,hired,hireUntil:hired?next.hour+720:null,pregnantUntil:null});
 return {state:next,id};
}
