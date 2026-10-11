import {DEFAULT_CATALOGUE} from '../campaigns/default.js';

// Classic JA2: profile sleep need, +1/+2/+4 below 75/50/25% health,
// Night Ops reduction, bounded to 4–12. Granaderos profile values are game
// balance data, not historical claims about the named people's sleep habits.
export const SLEEP_PROFILES=Object.freeze({...DEFAULT_CATALOGUE.sleepProfiles});

export function sleepNeed(unit){
 // Older authored stories retain their numeric save slots. Those slots do
 // not grant the historical cast's profile; explicit traits still apply.
 const base=!unit.genericCharacter&&Object.hasOwn(SLEEP_PROFILES,unit.id)?SLEEP_PROFILES[unit.id]:8;
 const health=(unit.hp??unit.maxHp??100)/Math.max(1,unit.maxHp??100);
 const wounds=health<.25?4:health<.5?2:health<.75?1:0;
 const nightTraining=unit.traits?.includes('night_vision')?1:0;
 return {base,wounds,nightTraining,hours:Math.max(4,Math.min(12,base+wounds-nightTraining))};
}
export function sleepRecovery(unit){
 const need=sleepNeed(unit);
 // Keep the existing healthy eight-hour baseline on the 0–100 game scale.
 // No fractional bank or extra recovery is awarded when an assignment changes.
 return {...need,fatigue:Math.max(1,Math.floor(64/need.hours)),energy:Math.max(1,Math.floor(96/need.hours))};
}
export function sleepNeedStatus(unit){
 const rate=sleepRecovery(unit);
 return `Necesidad de sueño: ${rate.hours} h de referencia · base ${rate.base}${rate.wounds?` + ${rate.wounds} por heridas`:''}${rate.nightTraining?' − 1 por entrenamiento nocturno':''}. Descanso: +${rate.energy} energía/h · −${rate.fatigue} fatiga/h.`;
}
