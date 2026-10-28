import {handLayout} from './hand-layout.js';
import {itemQuantity} from './tactical-inventory.js';
import {isGrenadeStack,validateGrenadeStack} from './grenades.js';
import {stanceCost,effectiveWounds} from './tactical-condition.js';
import {directionTo} from './tactical-awareness.js';

// Period-game balance, not historical explosive specifications. JA2's throw
// uses a ground point, standing preparation, no aim refinement or launch breath.
export const GRENADE_THROW=Object.freeze({radius:3,damage:55,energyDamage:45});
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const stat=(u,key,fallback=75)=>clamp(Number.isFinite(u?.[key])?u[key]:fallback,0,100);
export function heldGrenade(unit){
 if(!unit||unit.activeSlot!=='item')return null;
 const slot=handLayout(unit).right;
 if(slot!==unit.activeItem||!slot?.startsWith('inventory:'))return null;
 try{
  const record=unit.inventory?.[slot.slice(10)];
  if(!itemQuantity(unit,slot)||!isGrenadeStack(record))return null;
  validateGrenadeStack(record);return {slot,record};
 }catch{return null;}
}
export function grenadeThrowCosts(unit,target){
 const stance=stanceCost(unit,'standing'),attack=Math.ceil(10+(100-stat(unit,'dexterity'))/10)+3;
 const facing=Number.isFinite(target?.x)&&Number.isFinite(target?.y)?directionTo(unit,target):unit.facing??2;
 return {stance,turn:0,attack,aim:0,aimLevel:0,facing,energy:0,total:stance+attack};
}
export function grenadeThrowRange(unit,grenade=heldGrenade(unit)){
 if(!grenade)return {maximum:0};
 return {maximum:clamp(stat(unit,'strength')*(.5+stat(unit,'energy',100)/200)/10/grenade.record.weight,2,12)};
}
export function grenadeThrowChance(unit,distance,grenade=heldGrenade(unit)){
 if(!grenade||!Number.isFinite(distance)||distance<0||distance>grenadeThrowRange(unit,grenade).maximum)return 0;
 const wounds=Number.isFinite(unit.hp)?effectiveWounds(unit):0;
 return Math.round(clamp((stat(unit,'dexterity')+stat(unit,'marksmanship'))/2-distance*2+
  (stat(unit,'morale',80)-80)*.1-wounds*.3-(100-stat(unit,'energy',100))*.15-(unit.shock??0)*4-(unit.fatigue??0)*.05,1,95));
}
export const grenadeScatterRadius=distance=>Math.min(3,Math.max(1,Math.ceil(distance/5)));
