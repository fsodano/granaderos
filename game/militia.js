import {getCityStatus} from './cities.js';
// Training cohorts reserve existing soldiers on promotion; no rank multiplication.
export const MILITIA_NAMES=['Cívicos','Montoneras','Granaderos y línea'];
export const MILITIA_COHORT=3;
export const MILITIA_LIMIT=60;
export function militiaCourse(trainer,rank){
 const specialist=[11,57].includes(Number(trainer.id))||(trainer.traits??[]).some(t=>['line_marksman','guerrilla_tactician'].includes(t));
 const teacher=(trainer.traits??[]).includes('teacher');
 const leadership=Math.max(0,Math.min(100,trainer.leadership||0));
 return {hours:Math.ceil((48+rank*24)*(1-leadership*.005)*(specialist?.75:1)*(teacher?.75:1)),specialist,teacher,cost:{treasury:60*(rank+1),muskets:rank===1?0:5,horses:rank===1?3:0},count:MILITIA_COHORT};
}
export function militiaAssignment(state,id){return(state.militiaTraining??[]).find(t=>t.trainerId===id)??null;}

// City eligibility is shared by orders, ongoing courses and map presentation.
// Trainer location, funds, assignments and rank availability remain order checks.
export function militiaEligibility(state,sectorId){
 const city=getCityStatus(state,sectorId);
 if(!city)return {eligible:false,code:'rural',reason:'Las milicias se instruyen en ciudades, no en pasos rurales.',city:null};
 if(!city.controlled)return {eligible:false,code:'control',reason:`Debes controlar todos los sectores de ${city.name}.`,city};
 if(city.loyalty<city.threshold)return {eligible:false,code:'loyalty',reason:`${city.name} necesita ${city.threshold}% de lealtad para instruir milicias.`,city};
 return {eligible:true,code:'ready',reason:'La ciudad permite instruir milicias.',city};
}
