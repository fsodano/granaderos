// Fatigue limits sustained capacity; energy is the breath available right now.
// The 10-point floor and inverse scale follow classic JA2's maximum-breath model.
export function maximumEnergyAtFatigue(fatigue: number): number {
  return Math.max(10, 100 - Math.min(100, Math.max(0, Math.round(fatigue))));
}

// Classic JA2 clears strategic collapse at 60 maximum breath.
export function collapseRecoveryPending(fatigue: number): boolean {
  return maximumEnergyAtFatigue(fatigue) < 60;
}

export function energyAfterLimit(energy: number, maximum: number): number {
  return Math.min(energy, maximum);
}

export function fatigueAfterGain(fatigue: number, amount: number): number {
  return Math.min(100, Math.max(0, Math.ceil(fatigue + amount)));
}

export function energyAfterRecovery(energy: number, amount: number, maximum: number): number {
  return Math.min(maximum, energy + amount);
}

export function fatigueAfterRecovery(fatigue: number, amount: number): number {
  return Math.max(0, fatigue - amount);
}
