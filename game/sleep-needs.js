// Classic JA2: profile sleep need, +1/+2/+4 below 75/50/25% health,
// Night Ops reduction, bounded to 4–12. Granaderos profile values are game
// balance data, not historical claims about the named people's sleep habits.
export const SLEEP_PROFILES=Object.freeze(Object.fromEntries([
 [6,[103,116,131,144]],
 [7,[101,106,110,118,123,128,137,142]],
 [9,[105,112,119,126,133,140,145]],
 [10,[109,125,139]],
].flatMap(([hours,ids])=>ids.map(id=>[id,hours]))));

export function sleepNeed(unit){
 const base=Object.hasOwn(SLEEP_PROFILES,unit.id)?SLEEP_PROFILES[unit.id]:8;
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
