import {secondHeldPistol} from './paired-fire.js';

export const reprimeCost=unit=>unit.traits?.includes('gunsmith_artillerist')?10:15;

// Work belongs to the physically held guns. The ignition kit is implicit.
// Each pan costs one full action; a second gun never borrows future AP.
export function planReprime(unit,{exploring=false,firearm=false}={}){
 const cost=reprimeCost(unit),other=firearm?secondHeldPistol(unit):null;
 const required=firearm?[...(unit.jammed?['primary']:[]),...(other?.jammed&&(other.condition??100)>0?['offhand']:[])]:[];
 const count=Math.min(required.length,exploring?Infinity:Math.floor(Math.max(0,unit.ap??0)/cost));
 const hands=required.slice(0,count);
 const reason=!firearm?'Prepará un arma de fuego en la mano.':!required.length?'El arma no necesita cebado.':!count?`Cebar requiere ${cost} PA.`:'';
 return {hands,required:required.length,pending:required.length-hands.length,pa:hands.length*cost,totalPA:required.length*cost,cost,reason};
}

export function reprimeLabel(plan){
 return plan.hands.length===2?'Cebar ambas pistolas':plan.hands[0]==='offhand'?'Cebar segunda mano':'Cebar';
}
