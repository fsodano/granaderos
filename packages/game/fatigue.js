import {
  collapseRecoveryPending,
  energyAfterLimit,
  energyAfterRecovery,
  fatigueAfterGain,
  fatigueAfterRecovery,
  maximumEnergyAtFatigue,
} from './domain/personnel/fatigue.ts';

// Fatigue limits sustained capacity; energy is the breath available right now.
export const maximumEnergy = (unit) => maximumEnergyAtFatigue(unit.fatigue ?? 0);
export const needsCollapseRecovery = (unit) =>
  Boolean(unit.sleepCollapsed && collapseRecoveryPending(unit.fatigue ?? 0));
export function limitEnergy(unit) {
  unit.energy = energyAfterLimit(unit.energy ?? 100, maximumEnergy(unit));
}
export function gainFatigue(unit, amount) {
  unit.fatigue = fatigueAfterGain(unit.fatigue ?? 0, amount);
  limitEnergy(unit);
}
export function recoverEnergy(unit, amount) {
  unit.energy = energyAfterRecovery(unit.energy ?? 100, amount, maximumEnergy(unit));
}
export function recoverFatigue(unit, fatigue, energy) {
  unit.fatigue = fatigueAfterRecovery(unit.fatigue ?? 0, fatigue);
  recoverEnergy(unit, energy);
  if (unit.sleepCollapsed && !needsCollapseRecovery(unit)) {
    unit.sleepCollapsed = false;
  }
}
