import {handLayout} from './hand-layout.js';
import {handRecord,itemQuantity} from './tactical-inventory.js';
import {stanceCost,effectiveWounds} from './tactical-condition.js';
import {directionTo,turnAPCost} from './tactical-awareness.js';

// An improvised use of the existing facon, not a claim about military doctrine.
// AP, reach and damage use Granaderos' existing scale. There is no firearm
// preparation, cartridge debit or automatic creation of a replacement knife.
export const KNIFE_THROW = Object.freeze({weapon:1813,aimAP:3,energy:6,damage:32});
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const stat=(u,key,fallback=75)=>clamp(Number.isFinite(u?.[key])?u[key]:fallback,0,100);
export function heldThrowingKnife(unit){
 if(!unit)return null;
 const slot=handLayout(unit).right;
 if(!['primary','blade','offhand'].includes(slot)||!itemQuantity(unit,slot))return null;
 const record=handRecord(unit,slot);
 return record.weapon===KNIFE_THROW.weapon?{slot,record}:null;
}
export function knifeThrowCosts(unit,target,aim=0){
 const standing={...unit,stance:'standing'};
 const facing=Number.isFinite(target?.x)&&Number.isFinite(target?.y)?directionTo(standing,target):unit.facing??2;
 const stance=stanceCost(unit,'standing'),turn=turnAPCost(standing,facing);
 const attack=Math.max(8,Math.ceil(8+(100-(stat(unit,'dexterity')+stat(unit,'agility'))/2)/10));
 const level=clamp(Math.floor(Number.isFinite(aim)?aim:0),0,4);
 return {stance,turn,attack,aim:level*KNIFE_THROW.aimAP,aimLevel:level,facing,energy:KNIFE_THROW.energy,total:stance+turn+attack+level*KNIFE_THROW.aimAP};
}
export function knifeThrowRange(unit,knife=heldThrowingKnife(unit)){
 if(!knife)return {nominal:0,maximum:0};
 const strength=stat(unit,'strength'),energy=stat(unit,'energy',100);
 const nominal=clamp(strength*(.5+energy/200)/10*(.6/Math.max(.1,knife.record.weight)),2,12);
 // Beyond the useful range accuracy is halved, as in the classic knife rule.
 // Twice that range is the physical limit of this improvised period weapon.
 return {nominal,maximum:nominal*2};
}
export function knifeThrowChance(unit,distance,aim=0,knife=heldThrowingKnife(unit)){
 if(!knife||!Number.isFinite(distance)||distance<0)return 0;
 const range=knifeThrowRange(unit,knife);if(distance>range.maximum)return 0;
 const skill=(stat(unit,'dexterity')+stat(unit,'marksmanship'))/2;
 const condition=knife.record.condition??100,effective=condition<skill?(skill+condition)/2:skill;
 const wounds=Number.isFinite(unit.hp)?effectiveWounds(unit):0;
 const chance=effective+clamp(Math.floor(Number.isFinite(aim)?aim:0),0,4)*7-distance*3+
  (stat(unit,'morale',80)-80)*.1-wounds*.3-(100-stat(unit,'energy',100))*.15-
  (unit.shock??0)*4-(unit.fatigue??0)*.05;
 return Math.round(clamp(chance*(distance>range.nominal?.5:1),1,95));
}
export function knifeThrowDamage(unit,knife=heldThrowingKnife(unit)){
 return knife?KNIFE_THROW.damage*(.5+stat(unit,'strength')/200)*(.5+(knife.record.condition??100)/200):0;
}
