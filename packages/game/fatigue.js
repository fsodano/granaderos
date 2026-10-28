// Fatigue limits sustained capacity; energy is the breath available right now.
// The 10-point floor and inverse scale follow classic JA2's maximum-breath model.
export const maximumEnergy = unit => Math.max(10,100-Math.min(100,Math.max(0,Math.round(unit.fatigue??0))));
// Classic JA2 clears strategic collapse at 60 maximum breath.
export const needsCollapseRecovery=unit=>Boolean(unit.sleepCollapsed&&maximumEnergy(unit)<60);
export function limitEnergy(unit){unit.energy=Math.min(unit.energy??100,maximumEnergy(unit));}
export function gainFatigue(unit,amount){unit.fatigue=Math.min(100,Math.max(0,Math.ceil((unit.fatigue??0)+amount)));limitEnergy(unit);}
export function recoverEnergy(unit,amount){unit.energy=Math.min(maximumEnergy(unit),(unit.energy??100)+amount);}
export function recoverFatigue(unit,fatigue,energy){unit.fatigue=Math.max(0,(unit.fatigue??0)-fatigue);recoverEnergy(unit,energy);if(unit.sleepCollapsed&&!needsCollapseRecovery(unit))unit.sleepCollapsed=false;}
